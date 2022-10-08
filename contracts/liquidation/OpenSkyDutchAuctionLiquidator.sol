// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../interfaces/IOpenSkySettings.sol";
import "../interfaces/IOpenSkyLoan.sol";
import "../libraries/types/DataTypes.sol";
import "../interfaces/IOpenSkyCollateralPriceOracle.sol";
import "../interfaces/IOpenSkyPool.sol";
import "../interfaces/IOpenSkyDutchAuction.sol";
import "../interfaces/IOpenSkyDutchAuctionLiquidator.sol";
import "../interfaces/IACLManager.sol";
import "hardhat/console.sol";

contract OpenSkyDutchAuctionLiquidator is ERC721Holder, IOpenSkyDutchAuctionLiquidator {
    using SafeERC20 for IERC20;

    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyDutchAuction public immutable AUCTION;

    // loanId => auctionId
    mapping(uint256 => uint256) public override getAuctionId;
    // auctionId => loanId
    mapping(uint256 => uint256) public override getLoanId;

    modifier onlyLiquidationOperator() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isLiquidationOperator(msg.sender), "ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL");
        _;
    }

    modifier onlyDutchAuction() {
        require(address(AUCTION) == msg.sender, "ACL_ONLY_DUTCH_AUCTION_CAN_CALL");
        _;
    }

    constructor(address settings, address auctionContract) {
        SETTINGS = IOpenSkySettings(settings);
        AUCTION = IOpenSkyDutchAuction(auctionContract);
    }

    function startLiquidation(uint256 loanId) public override {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);

        // maybe already have owned this nft from the other liquidator by transferToAnotherLiquidator
        if (IERC721(loanData.nftAddress).ownerOf(loanData.tokenId) != address(this)) {
            IOpenSkyPool(SETTINGS.poolAddress()).startLiquidation(loanId);
        }

        IERC721(loanData.nftAddress).approve(address(AUCTION), loanData.tokenId);

        // create auction
        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);
        DataTypes.ReserveData memory reserveData = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(loanData.reserveId);
        uint256 auctionId = AUCTION.createAuction(loanData.nftAddress, loanData.tokenId, reserveData.underlyingAsset, borrowBalance);

        getAuctionId[loanId] = auctionId;
        getLoanId[auctionId] = loanId;

        emit StartLiquidation(loanId, auctionId, borrowBalance, loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function cancelLiquidation(uint256 loanId) public override onlyLiquidationOperator {
        require(getAuctionId[loanId] > 0, "AUCTION_IS_NOT_EXIST");

        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        require(loanData.status == DataTypes.LoanStatus.LIQUIDATING, "CANCEL_LIQUIDATE_STATUS_ERROR");

        AUCTION.cancelAuction(getAuctionId[loanId]);

        delete getLoanId[getAuctionId[loanId]];
        delete getAuctionId[loanId];

        emit CancelLiquidation(loanId, getAuctionId[loanId], loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function endLiquidationByAuctionId(uint256 auctionId, uint256 amount) public override onlyDutchAuction {
        require(getLoanId[auctionId] > 0, "LIQUIDATION_AUCTION_ID_ERROR");
        _endLiquidation(getLoanId[auctionId], amount);
    }
    
    function _endLiquidation(uint256 loanId, uint256 amount) internal {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        require(loanData.status == DataTypes.LoanStatus.LIQUIDATING, "LIQUIDATION_LOAN_IS_NOT_IN_LIQUIDATING");

        require(AUCTION.isEnd(getAuctionId[loanId]), "LIQUIDATION_AUCTION_IS_NOT_END");

        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);
        require(amount >= borrowBalance, "LIQUIDATION_END_LESS_THAN_BORROW_BALANCE");

        DataTypes.ReserveData memory reserveData = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(loanData.reserveId);
        IERC20(reserveData.underlyingAsset).safeTransferFrom(msg.sender, address(this), amount);

        // transfer rewards to treasury
        IERC20(reserveData.underlyingAsset).safeTransfer(SETTINGS.treasuryAddress(), amount - borrowBalance);

        // end liquidation
        IERC20(reserveData.underlyingAsset).safeApprove(SETTINGS.poolAddress(), borrowBalance);
        IOpenSkyPool(SETTINGS.poolAddress()).endLiquidation(loanId, borrowBalance);

        delete getLoanId[getAuctionId[loanId]];
        delete getAuctionId[loanId];

        emit EndLiquidation(loanId, getAuctionId[loanId], loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    function transferToAnotherLiquidator(uint256 loanId, address liquidator) external override onlyLiquidationOperator {
        require(SETTINGS.isLiquidator(liquidator), "LIQUIDATION_TRANSFER_NOT_LIQUIDATOR");

        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);

        IERC721(loanData.nftAddress).safeTransferFrom(address(this), liquidator, loanData.tokenId);

        emit TransferToAnotherLiquidator(loanId, liquidator, loanData.nftAddress, loanData.tokenId, msg.sender);
    }

    receive() external payable {}
}
