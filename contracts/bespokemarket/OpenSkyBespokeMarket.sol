// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

import '../dependencies/weth/IWETH.sol';

import '../libraries/math/PercentageMath.sol';
import '../libraries/math/WadRayMath.sol';
import '../libraries/math/MathUtils.sol';
import './libraries/BespokeTypes.sol';
import './libraries/BespokeLogic.sol';

import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyPool.sol';
import '../interfaces/IACLManager.sol';

import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';

contract OpenSkyBespokeMarket is
    Context,
    Ownable,
    Pausable,
    ReentrancyGuard,
    ERC721Holder,
    ERC1155Holder,
    IOpenSkyBespokeMarket
{
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using PercentageMath for uint256;
    using WadRayMath for uint256;

    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;
    IWETH public immutable WETH;

    bytes32 public immutable DOMAIN_SEPARATOR;

    // ERC721 interfaceID
    bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    // ERC1155 interfaceID
    bytes4 public constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    mapping(address => uint256) public minNonce;
    mapping(address => mapping(uint256 => bool)) private _nonce;

    Counters.Counter private _loanIdTracker;
    mapping(uint256 => BespokeTypes.LoanData) internal _loans;

    constructor(
        address SETTINGS_,
        address BESPOKE_SETTINGS_,
        address WETH_
    ) Pausable() ReentrancyGuard() {
        SETTINGS = IOpenSkySettings(SETTINGS_);
        BESPOKE_SETTINGS = IOpenSkyBespokeSettings(BESPOKE_SETTINGS_);
        WETH = IWETH(WETH_);

        // Calculate the domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f, // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
                0xf0cf7ce475272740cae17eb3cadd6d254800be81c53f84a2f273b99036471c62, // keccak256("OpenSkyBespokeMarket")
                0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1")) for versionId = 1
                block.chainid,
                address(this)
            )
        );
    }

    /// @dev Only emergency admin can call functions marked by this modifier.
    modifier onlyEmergencyAdmin() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isEmergencyAdmin(_msgSender()), 'BM_ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL');
        _;
    }

    modifier onlyAirdropOperator() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isAirdropOperator(_msgSender()), 'BM_ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL');
        _;
    }

    /// @dev Pause pool for emergency case, can only be called by emergency admin.
    function pause() external onlyEmergencyAdmin {
        _pause();
    }

    /// @dev Unpause pool for emergency case, can only be called by emergency admin.
    function unpause() external onlyEmergencyAdmin {
        _unpause();
    }

    /// @notice Cancel all pending offers for a sender
    /// @param minNonce_ minimum user nonce
    function cancelAllBorrowOffersForSender(uint256 minNonce_) external {
        require(minNonce_ > minNonce[msg.sender], 'BM_CANCEL_NONCE_LOWER_THAN_CURRENT');
        require(minNonce_ < minNonce[msg.sender] + 500000, 'BM_CANCEL_CANNOT_CANCEL_MORE');
        minNonce[msg.sender] = minNonce_;

        emit CancelAllOffers(msg.sender, minNonce_);
    }

    /// @param offerNonces array of borrowOffer nonces
    function cancelMultipleBorrowOffers(uint256[] calldata offerNonces) external {
        require(offerNonces.length > 0, 'BM_CANCEL_CANNOT_BE_EMPTY');

        for (uint256 i = 0; i < offerNonces.length; i++) {
            require(offerNonces[i] >= minNonce[msg.sender], 'BM_CANCEL_NONCE_LOWER_THAN_CURRENT');
            _nonce[msg.sender][offerNonces[i]] = true;
        }

        emit CancelMultipleOffers(msg.sender, offerNonces);
    }

    /// @notice take an borrowing offer using ERC20 include WETH
    function takeBorrowOffer(BespokeTypes.BorrowOffer calldata offerData) public override whenNotPaused nonReentrant {
        BespokeLogic.validateTakeBorrowOffer(
            offerData,
            BespokeLogic.hashBorrowOffer(offerData),
            DOMAIN_SEPARATOR,
            BESPOKE_SETTINGS
        );

        // prevents replay
        _nonce[msg.sender][offerData.nonce] = true;

        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(offerData.reserveId)
            .underlyingAsset;
        // transfer NFT
        _transferNFT(offerData.nftAddress, offerData.borrower, address(this), offerData.tokenId, offerData.tokenAmount);

        // transfer oToken from user,  and withdraw from pool
        address oTokenAddress = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(offerData.reserveId).oTokenAddress;
        IERC20(oTokenAddress).safeTransferFrom(_msgSender(), address(this), offerData.amount);

        IOpenSkyPool(SETTINGS.poolAddress()).withdraw(offerData.reserveId, offerData.amount, offerData.borrower);

        uint256 loanId = _createLoan(offerData);

        emit TakeBorrowOffer(loanId, _msgSender());
    }

    /// @notice take an borrowing offer using ETH
    /// @notice Only for WETH reserve. consider using oWETH first, then ETH if not enough.
    /// @notice Borrower will receive WETH
    function takeBorrowOfferETH(BespokeTypes.BorrowOffer memory offerData)
        public
        payable
        override
        whenNotPaused
        nonReentrant
    {
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(offerData.reserveId)
            .underlyingAsset;

        require(
            underlyingAsset == address(WETH) && offerData.currency == address(WETH),
            'BM_ACCEPT_BORROW_OFFER_ETH_ASSET_NOT_MATCH'
        );

        BespokeLogic.validateTakeBorrowOffer(
            offerData,
            BespokeLogic.hashBorrowOffer(offerData),
            DOMAIN_SEPARATOR,
            BESPOKE_SETTINGS
        );

        // prevents replay
        _nonce[msg.sender][offerData.nonce] = true;

        // transfer NFT
        _transferNFT(offerData.nftAddress, offerData.borrower, address(this), offerData.tokenId, offerData.tokenAmount);

        // oWeth balance
        address oTokenAddress = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(offerData.reserveId).oTokenAddress;
        uint256 oTokenBalance = IERC20(oTokenAddress).balanceOf(_msgSender());
        uint256 oTokenToUse = oTokenBalance < offerData.amount ? oTokenBalance : offerData.amount;
        uint256 inputETH = oTokenBalance < offerData.amount ? offerData.amount.sub(oTokenBalance) : 0;

        if (oTokenToUse > 0) {
            IERC20(oTokenAddress).safeTransferFrom(_msgSender(), address(this), oTokenToUse);
            // oWETH => WETH
            IOpenSkyPool(SETTINGS.poolAddress()).withdraw(offerData.reserveId, oTokenToUse, address(this));
        }
        if (inputETH > 0) {
            require(msg.value >= inputETH, 'BM_TAKE_BORROW_OFFER_ETH_INPUT_NOT_ENOUGH');
            // convert to WETH
            WETH.deposit{value: inputETH}();
        }

        // transfer WETH to borrower
        require(WETH.balanceOf(address(this)) >= offerData.amount, 'BM_TAKE_BORROW_OFFER_ETH_BALANCE_NOT_ENOUGH');
        WETH.transferFrom(address(this), offerData.borrower, offerData.amount);

        uint256 loanId = _createLoan(offerData);

        // refund remaining dust eth
        if (msg.value > inputETH) {
            uint256 refundAmount = msg.value - inputETH;
            _safeTransferETH(msg.sender, refundAmount);
        }

        emit TakeBorrowOfferETH(loanId, _msgSender());
    }

    function _createLoan(BespokeTypes.BorrowOffer memory offerData) internal returns (uint256) {
        uint256 loanId = _minLoanNft(offerData.borrower, _msgSender());

        // share logic
        BespokeTypes.LoanData storage loan = _loans[loanId];

        uint256 borrowRateRay = uint256(offerData.borrowRate).rayDiv(10000);

        loan.reserveId = offerData.reserveId;
        loan.nftAddress = offerData.nftAddress;
        loan.tokenId = offerData.tokenId;
        loan.tokenAmount = offerData.tokenAmount;
        loan.borrower = offerData.borrower;
        loan.amount = offerData.amount;
        loan.borrowRate = uint128(borrowRateRay);
        loan.interestPerSecond = uint128(MathUtils.calculateBorrowInterestPerSecond(borrowRateRay, offerData.amount));
        loan.borrowDuration = uint40(offerData.borrowDuration);

        // lender info
        address lender = _msgSender();
        loan.lender = lender;
        loan.borrowBegin = uint40(block.timestamp);
        loan.borrowOverdueTime = uint40(block.timestamp.add(offerData.borrowDuration));

        (, , uint256 overdueDuration) = BESPOKE_SETTINGS.getBorrowDurationConfig(offerData.nftAddress);
        loan.liquidatableTime = uint40(block.timestamp.add(offerData.borrowDuration).add(overdueDuration));
        loan.status = BespokeTypes.LoanStatus.BORROWING;

        return loanId;
    }

    /// @notice Only OpenSkyBorrowNFT owner can repay
    /// @notice Only OpenSkyLendNFT owner can recieve the payment
    /// @notice This function is not pausable for safety
    function repay(uint256 loanId) public override nonReentrant {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BM_REPAY_STATUS_ERROR'
        );

        (address borrower, address lender) = getLoanParties(loanId);
        require(_msgSender() == borrower, 'BM_REPAY_NOT_BORROW_NFT_OWNER');

        (uint256 repayTotal, uint256 lenderAmount, uint256 protocolFee) = calculateRepayAmountAndProtocolFee(loanId);

        // repay oToken to lender
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        IERC20(underlyingAsset).safeTransferFrom(_msgSender(), address(this), repayTotal);
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), lenderAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).deposit(loanData.reserveId, lenderAmount, lender, 0);

        // dao vault
        if (protocolFee > 0)
            IERC20(underlyingAsset).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), protocolFee);

        // transfer nft back to borrower
        _transferNFT(loanData.nftAddress, address(this), borrower, loanData.tokenId, loanData.tokenAmount);

        _burnLoanNft(loanId);

        emit Repay(loanId, _msgSender());
    }

    /// @notice Only OpenSkyBorrowNFT owner can repay
    /// @notice Only OpenSkyLendNFT owner can recieve the payment
    /// @notice This function is not pausable for safety
    function repayETH(uint256 loanId) public payable override nonReentrant {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        require(underlyingAsset == address(WETH), 'BM_REPAY_ETH_ASSET_NOT_MATCH');
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BM_REPAY_STATUS_ERROR'
        );

        (address borrower, address lender) = getLoanParties(loanId);
        require(_msgSender() == borrower, 'BM_REPAY_NOT_BORROW_NFT_OWNER');

        (uint256 repayTotal, uint256 lenderAmount, uint256 protocolFee) = calculateRepayAmountAndProtocolFee(loanId);

        require(msg.value >= repayTotal, 'BM_REPAY_AMOUNT_NOT_ENOUGH');

        // convert to weth
        WETH.deposit{value: repayTotal}();

        // transfer repayAmount to lender
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), lenderAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).deposit(loanData.reserveId, lenderAmount, lender, 0);

        // dao vault
        if (protocolFee > 0)
            IERC20(underlyingAsset).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), protocolFee);

        // transfer nft back to borrower
        _transferNFT(loanData.nftAddress, address(this), borrower, loanData.tokenId, loanData.tokenAmount);

        _burnLoanNft(loanId);

        // refund
        if (msg.value > repayTotal) _safeTransferETH(_msgSender(), msg.value - repayTotal);

        emit RepayETH(loanId, _msgSender());
    }

    /// @notice anyone can trigger but only OpenSkyLendNFT owner can receive collateral
    function forclose(uint256 loanId) public override whenNotPaused nonReentrant {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(loanData.status == BespokeTypes.LoanStatus.LIQUIDATABLE, 'BM_FORCLOSELOAN_STATUS_ERROR');

        (, address lender) = getLoanParties(loanId);

        _transferNFT(loanData.nftAddress, address(this), lender, loanData.tokenId, loanData.tokenAmount);

        _burnLoanNft(loanId);

        emit Forclose(loanId, _msgSender());
    }

    function isNonceValid(address user, uint256 nonce) external view returns (bool) {
        return _nonce[user][nonce];
    }

    function getLoanData(uint256 loanId) public view override returns (BespokeTypes.LoanData memory) {
        BespokeTypes.LoanData memory loan = _loans[loanId];
        loan.status = getStatus(loanId);
        return loan;
    }

    function getStatus(uint256 loanId) public view override returns (BespokeTypes.LoanStatus) {
        BespokeTypes.LoanData memory loan = _loans[loanId];
        BespokeTypes.LoanStatus status = _loans[loanId].status;
        if (status == BespokeTypes.LoanStatus.BORROWING) {
            if (loan.liquidatableTime < block.timestamp) {
                status = BespokeTypes.LoanStatus.LIQUIDATABLE;
            } else if (loan.borrowOverdueTime < block.timestamp) {
                status = BespokeTypes.LoanStatus.OVERDUE;
            }
        }
        return status;
    }

    function getBorrowInterest(uint256 loanId) public view override returns (uint256) {
        BespokeTypes.LoanData memory loan = _loans[loanId];
        uint256 endTime = block.timestamp < loan.borrowOverdueTime ? loan.borrowOverdueTime : block.timestamp;
        return uint256(loan.interestPerSecond).rayMul(endTime.sub(loan.borrowBegin));
    }

    // @dev principal + fixed-price interest + extra interest(if overdue)
    function getBorrowBalance(uint256 loanId) public view override returns (uint256) {
        return _loans[loanId].amount.add(getBorrowInterest(loanId));
    }

    function getPenalty(uint256 loanId) public view override returns (uint256) {
        BespokeTypes.LoanData memory loan = getLoanData(loanId);
        uint256 penalty = 0;
        if (loan.status == BespokeTypes.LoanStatus.OVERDUE) {
            penalty = loan.amount.percentMul(BESPOKE_SETTINGS.overdueLoanFeeFactor());
        }
        return penalty;
    }

    function calculateRepayAmountAndProtocolFee(uint256 loanId)
        internal
        view
        returns (
            uint256 total,
            uint256 lenderAmount,
            uint256 protocolFee
        )
    {
        uint256 penalty = getPenalty(loanId);
        total = getBorrowBalance(loanId).add(penalty);
        protocolFee = getBorrowInterest(loanId).add(penalty).percentMul(BESPOKE_SETTINGS.reserveFactor());
        lenderAmount = total.sub(protocolFee);
    }

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'BM_ETH_TRANSFER_FAILED');
    }

    function _minLoanNft(address borrower, address lender) internal returns (uint256) {
        _loanIdTracker.increment();
        uint256 tokenId = _loanIdTracker.current();

        getBorrowLoanNFT().mint(tokenId, borrower);
        getLendLoanNFT().mint(tokenId, lender);
        return tokenId;
    }

    function _burnLoanNft(uint256 tokenId) internal {
        getBorrowLoanNFT().burn(tokenId);
        getLendLoanNFT().burn(tokenId);
        delete _loans[tokenId];
    }

    function getLoanParties(uint256 loanId) internal returns (address borrower, address lender) {
        lender = IERC721(BESPOKE_SETTINGS.lendLoanAddress()).ownerOf(loanId);
        borrower = IERC721(BESPOKE_SETTINGS.borrowLoanAddress()).ownerOf(loanId);
    }

    function getBorrowLoanNFT() internal returns (IOpenSkyBespokeLoanNFT) {
        return IOpenSkyBespokeLoanNFT(BESPOKE_SETTINGS.borrowLoanAddress());
    }

    function getLendLoanNFT() internal returns (IOpenSkyBespokeLoanNFT) {
        return IOpenSkyBespokeLoanNFT(BESPOKE_SETTINGS.lendLoanAddress());
    }

    //    function flashLoan(
    //        address receiverAddress,
    //        uint256[] calldata loanIds,
    //        bytes calldata params
    //    ) external override {
    //        uint256 i;
    //        IOpenSkyFlashLoanReceiver receiver = IOpenSkyFlashLoanReceiver(receiverAddress);
    //        // !!!CAUTION: receiver contract may reentry mint, burn, flashloan again
    //
    //        // only loan owner can do flashloan
    //        address[] memory nftAddresses = new address[](loanIds.length);
    //        uint256[] memory tokenIds = new uint256[](loanIds.length);
    //        for (i = 0; i < loanIds.length; i++) {
    //            require(ownerOf(loanIds[i]) == _msgSender(), 'BM_LOAN_CALLER_IS_NOT_OWNER');
    //            BespokeTypes.LoanData memory loanData = getLoanData(loanIds[i]);
    //            require(loanData.status != BespokeTypes.LoanStatus.LIQUIDATABLE, 'BM_FLASHLOAN_STATUS_ERROR');
    //            nftAddresses[i] = loanData.nftAddress;
    //            tokenIds[i] = loanData.tokenId;
    //        }
    //
    //        // step 1: moving underlying asset forward to receiver contract
    //        for (i = 0; i < loanIds.length; i++) {
    //            IERC721(nftAddresses[i]).safeTransferFrom(address(this), receiverAddress, tokenIds[i]);
    //        }
    //
    //        // setup 2: execute receiver contract, doing something like aidrop
    //        require(
    //            receiver.executeOperation(nftAddresses, tokenIds, _msgSender(), address(this), params),
    //            'BM_FLASHLOAN_EXECUTOR_ERROR'
    //        );
    //
    //        // setup 3: moving underlying asset backword from receiver contract
    //        for (i = 0; i < loanIds.length; i++) {
    //            IERC721(nftAddresses[i]).safeTransferFrom(receiverAddress, address(this), tokenIds[i]);
    //            emit FlashLoan(receiverAddress, _msgSender(), nftAddresses[i], tokenIds[i]);
    //        }
    //    }
    //
    /// @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
    /// direct transfers to the contract address.
    /// @param token token to transfer
    /// @param to recipient of the transfer
    /// @param amount amount to send
    function emergencyTokenTransfer(
        address token,
        address to,
        uint256 amount
    ) external onlyEmergencyAdmin {
        IERC20(token).transfer(to, amount);
    }

    /// @inheritdoc IOpenSkyBespokeMarket
    function claimERC20Airdrop(
        address token,
        address to,
        uint256 amount
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        IERC20(token).safeTransfer(to, amount);
        emit ClaimERC20Airdrop(token, to, amount);
    }

    /// @inheritdoc IOpenSkyBespokeMarket
    function claimERC721Airdrop(
        address token,
        address to,
        uint256[] calldata ids
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        for (uint256 i = 0; i < ids.length; i++) {
            IERC721(token).safeTransferFrom(address(this), to, ids[i]);
        }
        emit ClaimERC721Airdrop(token, to, ids);
    }

    /// @inheritdoc IOpenSkyBespokeMarket
    function claimERC1155Airdrop(
        address token,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        IERC1155(token).safeBatchTransferFrom(address(this), to, ids, amounts, data);
        emit ClaimERC1155Airdrop(token, to, ids, amounts, data);
    }

    function _transferNFT(
        address collection,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal {
        if (IERC165(collection).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(collection).safeTransferFrom(from, to, tokenId);
        } else if (IERC165(collection).supportsInterface(INTERFACE_ID_ERC1155)) {
            IERC1155(collection).safeTransferFrom(from, to, tokenId, amount, '');
        }
    }

    receive() external payable {
        revert('BM_RECEIVE_NOT_ALLOWED');
    }

    fallback() external payable {
        revert('BM_FALLBACK_NOT_ALLOWED');
    }
}
