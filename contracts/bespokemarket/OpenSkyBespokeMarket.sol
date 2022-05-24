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
import './libraries/SignatureChecker.sol';
import './libraries/BespokeLogic.sol';

import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyPool.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';

import 'hardhat/console.sol';

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
        require(minNonce_ > minNonce[msg.sender], 'BP_CANCEL_NONCE_LOWER_THAN_CURRENT');
        require(minNonce_ < minNonce[msg.sender] + 500000, 'BP_CANCEL_CANNOT_CANCEL_MORE');
        minNonce[msg.sender] = minNonce_;

        emit CancelAllOffers(msg.sender, minNonce_);
    }

    /// @param offerNonces array of borrowOffer nonces
    function cancelMultipleBorrowOffers(uint256[] calldata offerNonces) external {
        require(offerNonces.length > 0, 'BP_CANCEL_CANNOT_BE_EMPTY');

        for (uint256 i = 0; i < offerNonces.length; i++) {
            require(offerNonces[i] >= minNonce[msg.sender], 'BP_CANCEL_NONCE_LOWER_THAN_CURRENT');
            _nonce[msg.sender][offerNonces[i]] = true;
        }

        emit CancelMultipleOffers(msg.sender, offerNonces);
    }

    function acceptBorrowOffer(BespokeTypes.BorrowOffer calldata offerData) public override {
        verifyBorrowOffer(offerData, BespokeLogic.hashBorrowOffer(offerData));

        if (BESPOKE_SETTINGS.isWhitelistOn()) {
            require(BESPOKE_SETTINGS.inWhitelist(offerData.nftAddress), 'BP_NFT_NOT_IN_WHITELIST');
        }

        // TODO add approved check?
        require(
            IERC721(offerData.nftAddress).ownerOf(offerData.tokenId) == offerData.borrower,
            'BP_BORROWER_NOT_OWNER_OF_NFT'
        );

        require(
            IERC721(offerData.nftAddress).isApprovedForAll(offerData.borrower, address(this)),
            'BP_NFT_NOT_APPROVED_FOR_ALL'
        );

        (uint256 minBorrowDuration, uint256 maxBorrowDuration, ) = getBorrowDurationConfig(offerData.nftAddress);
        require(
            offerData.borrowDuration >= minBorrowDuration && offerData.borrowDuration <= maxBorrowDuration,
            'BP_BORROW_DURATION_NOT_ALLOWED'
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

        // mint loan NFT
        uint256 loanId = IOpenSkyBespokeLoanNFT(loanAddress()).mint(_msgSender());
        uint256 borrowRateRay = uint256(offerData.borrowRate).rayDiv(10000);

        BespokeTypes.LoanData storage loan = _loans[loanId];
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
        _loans[loanId].lender = lender;
        _loans[loanId].borrowBegin = uint40(block.timestamp);
        _loans[loanId].borrowOverdueTime = uint40(block.timestamp.add(offerData.borrowDuration));

        (, , uint256 overdueDuration) = getBorrowDurationConfig(offerData.nftAddress);
        _loans[loanId].liquidatableTime = uint40(block.timestamp.add(offerData.borrowDuration).add(overdueDuration));
        _loans[loanId].status = BespokeTypes.LoanStatus.BORROWING;

        emit AcceptBorrowOffer(
            loanId,
            lender,
            block.timestamp,
            _loans[loanId].borrowOverdueTime,
            _loans[loanId].liquidatableTime
        );
    }

    /// @notice Only for WETH reserve. consider oWETH first, and can use ETH if not enough.
    /// @notice Borrower will accept ETH
    function acceptBorrowOfferETH(BespokeTypes.BorrowOffer calldata offerData) public payable {
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(offerData.reserveId)
            .underlyingAsset;
        require(underlyingAsset == address(WETH), 'BP_ACCEPT_BORROW_OFFER_ETH_ASSET_NOT_MATCH');

        if (BESPOKE_SETTINGS.isWhitelistOn()) {
            require(BESPOKE_SETTINGS.inWhitelist(offerData.nftAddress), 'BP_NFT_NOT_IN_WHITELIST');
        }

        // TODO add approved check?
        require(
            IERC721(offerData.nftAddress).ownerOf(offerData.tokenId) == offerData.borrower,
            'BP_BORROWER_NOT_OWNER_OF_NFT'
        );

        require(
            IERC721(offerData.nftAddress).isApprovedForAll(offerData.borrower, address(this)),
            'BP_NFT_NOT_APPROVED_FOR_ALL'
        );

        (uint256 minBorrowDuration, uint256 maxBorrowDuration, ) = getBorrowDurationConfig(offerData.nftAddress);
        require(
            offerData.borrowDuration >= minBorrowDuration && offerData.borrowDuration <= maxBorrowDuration,
            'BP_BORROW_DURATION_NOT_ALLOWED'
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
            IOpenSkyPool(SETTINGS.poolAddress()).withdraw(offerData.reserveId, oTokenToUse, address(this));
        }
        if (inputETH > 0) require(msg.value >= inputETH, 'BP_ACCEPT_BORROW_OFFER_ETH_INPUT_NOT_ENOUGH');

        require(address(this).balance >= offerData.amount, 'BP_ACCEPT_BORROW_OFFER_ETH_BALANCE_NOT_ENOUGH');
        _safeTransferETH(offerData.borrower, offerData.amount);

        // mint loan NFT
        uint256 loanId = IOpenSkyBespokeLoanNFT(loanAddress()).mint(_msgSender());
        uint256 borrowRateRay = uint256(offerData.borrowRate).rayDiv(10000);

        BespokeTypes.LoanData storage loan = _loans[loanId];
        loan.reserveId = offerData.reserveId;
        loan.nftAddress = offerData.nftAddress;
        loan.tokenId = offerData.tokenId;
        loan.tokenAmount = offerData.tokenAmount;
        loan.borrower = offerData.borrower;
        loan.amount = offerData.amount;
        loan.borrowRate = uint128(borrowRateRay);
        loan.interestPerSecond = uint128(MathUtils.calculateBorrowInterestPerSecond(borrowRateRay, offerData.amount));
        loan.borrowDuration = uint40(offerData.borrowDuration);
        // loan.status = BespokeTypes.LoanStatus.PENDING;

        // lender info
        address lender = _msgSender();
        _loans[loanId].lender = lender;
        _loans[loanId].borrowBegin = uint40(block.timestamp);
        _loans[loanId].borrowOverdueTime = uint40(block.timestamp.add(offerData.borrowDuration));

        (, , uint256 overdueDuration) = getBorrowDurationConfig(offerData.nftAddress);
        _loans[loanId].liquidatableTime = uint40(block.timestamp.add(offerData.borrowDuration).add(overdueDuration));
        _loans[loanId].status = BespokeTypes.LoanStatus.BORROWING;

        // refund remaining dust eth
        if (msg.value > inputETH) {
            uint256 refundAmount = msg.value - inputETH;
            _safeTransferETH(msg.sender, refundAmount);
        }

        emit AcceptBorrowOfferETH(
            loanId,
            lender,
            block.timestamp,
            _loans[loanId].borrowOverdueTime,
            _loans[loanId].liquidatableTime
        );
    }

    function repay(uint256 loanId) public override {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BP_REPAY_STATUS_ERROR'
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

    function repayETH(uint256 loanId) public payable {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        require(underlyingAsset == address(WETH), 'REPAY_ETH_ASSET_NOT_MATCH');
        require(
            loanData.status == BespokeTypes.LoanStatus.BORROWING || loanData.status == BespokeTypes.LoanStatus.OVERDUE,
            'BP_REPAY_STATUS_ERROR'
        );

        uint256 penalty = getPenalty(loanId);
        uint256 borrowBalance = getBorrowBalance(loanId);
        uint256 repayAmount = borrowBalance.add(penalty);
        require(msg.value >= repayAmount, 'BP_REPAY_AMOUNT_NOT_ENOUGH');

        // transition eth=>weth
        WETH.deposit{value: repayAmount}();

        // transfer repayAmount to lender
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), repayAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).deposit(loanData.reserveId, repayAmount, loanData.lender, 0);

        // transfer nft back to borrower
        IERC721(loanData.nftAddress).safeTransferFrom(loanAddress(), loanData.borrower, loanData.tokenId);

        delete _loans[loanId];
        IOpenSkyBespokeLoanNFT(loanAddress()).burn(loanId);

        // return
        if (msg.value > repayAmount) _safeTransferETH(_msgSender(), msg.value - repayAmount);

        emit Repay(loanId, _msgSender());
    }

    function forclose(uint256 loanId) public override {
        BespokeTypes.LoanData memory loanData = getLoanData(loanId);
        require(loanData.status == BespokeTypes.LoanStatus.LIQUIDATABLE, 'BP_FORCLOSELOAN_STATUS_ERROR');

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

    function getBorrowDurationConfig(address nftAddress)
        public
        view
        override
        returns (
            uint256 minBorrowDuration,
            uint256 maxBorrowDuration,
            uint256 overdueDuration
        )
    {
        if (BESPOKE_SETTINGS.isWhitelistOn() && BESPOKE_SETTINGS.inWhitelist(nftAddress)) {
            BespokeTypes.WhitelistInfo memory info = BESPOKE_SETTINGS.getWhitelistDetail(nftAddress);
            minBorrowDuration = info.minBorrowDuration;
            maxBorrowDuration = info.maxBorrowDuration;
            overdueDuration = info.overdueDuration;
        } else {
            minBorrowDuration = BESPOKE_SETTINGS.minBorrowDuration();
            maxBorrowDuration = BESPOKE_SETTINGS.maxBorrowDuration();
            overdueDuration = BESPOKE_SETTINGS.overdueDuration();
        }
    }

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'BP_ETH_TRANSFER_FAILED');
    }

    function loanAddress() internal returns (address) {
        return BESPOKE_SETTINGS.loanAddress();
    }

    function verifyBorrowOffer(BespokeTypes.BorrowOffer calldata offerData, bytes32 offerHash) internal {
        //TODO more checks
        require(block.timestamp <= offerData.deadline, 'BP_SIGNING_EXPIRATION');

        require(
            SignatureChecker.verify(
                offerHash,
                offerData.borrower,
                offerData.v,
                offerData.r,
                offerData.s,
                DOMAIN_SEPARATOR
            ),
            'BP_SIGNATURE_INVALID'
        );
    }

    // Never transfer ETH to this contract directly!
    receive() external payable {}
}
