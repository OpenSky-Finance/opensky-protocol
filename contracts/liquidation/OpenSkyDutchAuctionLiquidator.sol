// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyDutchAuction.sol';
import '../interfaces/IOpenSkyLoan.sol';
import '../libraries/types/DataTypes.sol';
import '../interfaces/IOpenSkyCollateralPriceOracle.sol';
import '../interfaces/IOpenSkyPool.sol';
import '../interfaces/IOpenSkyDutchAuction.sol';
import '../interfaces/IOpenSkyDutchAuctionLiquidator.sol';
import '../interfaces/IACLManager.sol';

contract OpenSkyDutchAuctionLiquidator is ERC721Holder, IOpenSkyDutchAuctionLiquidator {
    using SafeMath for uint256;
    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyDutchAuction public immutable AUCTIONCONTRACT;

    // loanId=>auctionId
    // auction not handled
    mapping(uint256 => uint256) public override getAuctionId;
    // auctionId=>loanId
    mapping(uint256 => uint256) public override getLoanId;

    modifier onlyLiquidationOperator() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isLiquidationOperator(msg.sender), 'LIQUIDATION_ONLY_OPERATOR_CAN_CALL');
        _;
    }

    modifier onlyDutchAuction() {
        require(address(AUCTIONCONTRACT) == msg.sender, 'LIQUIDATION_ONLY_DUTCH_AUCTION_CAN_CALL');
        _;
    }

    constructor(address settings, address auctionContract) {
        SETTINGS = IOpenSkySettings(settings);
        AUCTIONCONTRACT = IOpenSkyDutchAuction(auctionContract);
    }

    function startLiquidate(uint256 loanId) public override onlyLiquidationOperator {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        // check status

        // may already have hold this nft by dao
        if (IERC721(loanData.nftAddress).ownerOf(loanData.tokenId) != address(this)) {
            IOpenSkyPool(SETTINGS.poolAddress()).startLiquidation(loanId);
        }

        // IOpenSkyCollateralPriceOracle priceOracle = IOpenSkyCollateralPriceOracle(SETTINGS.nftPriceOracleAddress());
        // uint256 startPrice = priceOracle.getPrice(loanData.reserveId, loanData.nftAddress, loanData.tokenId);
        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);

        // check transfer NFT to dutch auction contract
        IERC721(loanData.nftAddress).approve(address(AUCTIONCONTRACT), loanData.tokenId);
        uint256 auctionId = AUCTIONCONTRACT.createAuction(borrowBalance, loanData.nftAddress, loanData.tokenId);

        getAuctionId[loanId] = auctionId;
        getLoanId[auctionId] = loanId;
        //IERC721(reserve.nftAddress).approve(address(fractional), reserve.nftTokenId);

        emit StartLiquidate(loanId, auctionId, borrowBalance, loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function cancelLiquidate(uint256 loanId) public override onlyLiquidationOperator {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        require(loanData.status == DataTypes.LoanStatus.LIQUIDATING, 'LIQUIDATION_CANCEL_STATUS_ERROR');

        require(getAuctionId[loanId] > 0, 'LIQUIDATION_AUCTION_IS_NOT_EXIST');

        AUCTIONCONTRACT.cancelAuction(getAuctionId[loanId]);

        // transfer to dao vault
        IERC721(loanData.nftAddress).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), loanData.tokenId);

        delete getLoanId[getAuctionId[loanId]];
        delete getAuctionId[loanId];

        emit CancelLiquidate(loanId, getAuctionId[loanId], loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function endLiquidateByAuctionId(uint256 auctionId) public payable override onlyDutchAuction {
        endLiquidate(getLoanId[auctionId]);
    }

    function endLiquidate(uint256 loanId) internal {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        require(loanData.status == DataTypes.LoanStatus.LIQUIDATING, 'LIQUIDATION_LOAN_IS_NOT_IN_LIQUIDATING');

        require(getAuctionId[loanId] > 0, 'LIQUIDATION_AUCTION_IS_NOT_EXIST');

        require(AUCTIONCONTRACT.isEnd(getAuctionId[loanId]), 'LIQUIDATION_AUCTION_IS_NOT_END');

        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);
        require(msg.value >= borrowBalance, 'LIQUIDATION_PAYMENT_LESS_THAN_BORROW_BALANCE');

        // transfer to dao vault
        _safeTransferETH(SETTINGS.daoVaultAddress(), msg.value - borrowBalance);

        // end liquidation
        IOpenSkyPool(SETTINGS.poolAddress()).endLiquidation(loanId, borrowBalance);

        delete getLoanId[getAuctionId[loanId]];
        delete getAuctionId[loanId];

        emit EndLiquidate(loanId, getAuctionId[loanId], loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function withdrawERC721ToDaoVault(address token, uint256 tokenId) external onlyLiquidationOperator {
        IERC721(token).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), tokenId);
        emit WithdrawERC721(token, tokenId, SETTINGS.daoVaultAddress());
    }

    receive() external payable {}

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'ETH_TRANSFER_FAILED');
    }
}
