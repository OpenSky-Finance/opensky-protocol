// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../dependencies/weth/IWETH.sol';

import '../libraries/math/PercentageMath.sol';
import '../libraries/math/WadRayMath.sol';
import '../libraries/math/MathUtils.sol';
import './libraries/BespokeTypes.sol';
import './libraries/BespokeLogic.sol';

import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyPool.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';

contract OpenSkyBespokeMarket is Context, Ownable, IOpenSkyBespokeMarket {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using PercentageMath for uint256;
    using WadRayMath for uint256;

    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;
    IWETH public immutable WETH;

    bytes32 public immutable DOMAIN_SEPARATOR;

    // loan data
    mapping(uint256 => BespokeTypes.LoanData) internal _loans;

    mapping(address => uint256) public minNonce;
    mapping(address => mapping(uint256 => bool)) private _nonce;

    constructor(
        address SETTINGS_,
        address BESPOKE_SETTINGS_,
        address WETH_
    ) {
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
    function takeBorrowOffer(BespokeTypes.BorrowOffer calldata offerData) public override {
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
        IERC721(offerData.nftAddress).safeTransferFrom(offerData.borrower, loanAddress(), offerData.tokenId);
        IOpenSkyBespokeLoanNFT(loanAddress()).onReceiveNFTFromMarket(offerData.nftAddress, offerData.tokenId);

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
    function takeBorrowOfferETH(BespokeTypes.BorrowOffer memory offerData) public payable {
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
        IERC721(offerData.nftAddress).safeTransferFrom(offerData.borrower, loanAddress(), offerData.tokenId);
        IOpenSkyBespokeLoanNFT(loanAddress()).onReceiveNFTFromMarket(offerData.nftAddress, offerData.tokenId);

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
        // mint loan NFT to borrower 
        uint256 loanId = IOpenSkyBespokeLoanNFT(loanAddress()).mint(offerData.borrower);

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

    function repay(uint256 loanId) public override {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BM_REPAY_STATUS_ERROR'
        );

        uint256 penalty = getPenalty(loanId);
        uint256 borrowBalance = getBorrowBalance(loanId);
        uint256 repayAmount = borrowBalance.add(penalty);

        // repay oToken to lender
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        IERC20(underlyingAsset).safeTransferFrom(_msgSender(), address(this), repayAmount);
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), repayAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).deposit(loanData.reserveId, repayAmount, loanData.lender, 0);

        // transfer nft back to borrower
        IERC721(loanData.nftAddress).safeTransferFrom(loanAddress(), loanData.borrower, loanData.tokenId);

        delete _loans[loanId];
        IOpenSkyBespokeLoanNFT(loanAddress()).burn(loanId);

        emit Repay(loanId, _msgSender());
    }

    function repayETH(uint256 loanId) public payable override {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        require(underlyingAsset == address(WETH), 'REPAY_ETH_ASSET_NOT_MATCH');
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BM_REPAY_STATUS_ERROR'
        );

        uint256 penalty = getPenalty(loanId);
        uint256 borrowBalance = getBorrowBalance(loanId);
        uint256 repayAmount = borrowBalance.add(penalty);
        require(msg.value >= repayAmount, 'BM_REPAY_AMOUNT_NOT_ENOUGH');

        // convert to weth
        WETH.deposit{value: repayAmount}();

        // transfer repayAmount to lender
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), repayAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).deposit(loanData.reserveId, repayAmount, loanData.lender, 0);

        // transfer nft back to borrower
        IERC721(loanData.nftAddress).safeTransferFrom(loanAddress(), loanData.borrower, loanData.tokenId);

        delete _loans[loanId];
        IOpenSkyBespokeLoanNFT(loanAddress()).burn(loanId);

        // refund 
        if (msg.value > repayAmount) _safeTransferETH(_msgSender(), msg.value - repayAmount);

        emit RepayETH(loanId, _msgSender());
    }

    function forclose(uint256 loanId) public override {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(loanData.status == BespokeTypes.LoanStatus.LIQUIDATABLE, 'BM_FORCLOSELOAN_STATUS_ERROR');

        IERC721(loanData.nftAddress).safeTransferFrom(loanAddress(), loanData.lender, loanData.tokenId);

        delete _loans[loanId];
        IOpenSkyBespokeLoanNFT(loanAddress()).burn(loanId);

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
        uint256 endTime = block.timestamp;
        return uint256(loan.interestPerSecond).rayMul(endTime.sub(loan.borrowBegin));
    }

    function getBorrowBalance(uint256 loanId) public view override returns (uint256) {
        return _loans[loanId].amount.add(getBorrowInterest(loanId));
    }

    function getPenalty(uint256 loanId) public view override returns (uint256) {
        BespokeTypes.LoanStatus status = getStatus(loanId);
        BespokeTypes.LoanData memory loan = _loans[loanId];
        uint256 penalty = 0;
        if (status == BespokeTypes.LoanStatus.BORROWING) {
            penalty = loan.amount.percentMul(BESPOKE_SETTINGS.prepaymentFeeFactor());
        } else if (status == BespokeTypes.LoanStatus.OVERDUE) {
            penalty = loan.amount.percentMul(BESPOKE_SETTINGS.overdueLoanFeeFactor());
        }
        return penalty;
    }

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'BM_ETH_TRANSFER_FAILED');
    }

    function loanAddress() internal returns (address) {
        return BESPOKE_SETTINGS.loanAddress();
    }

    // Never transfer ETH to this contract directly!
    receive() external payable {}
}
