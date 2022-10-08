// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../../interfaces/IOpenSkyDutchAuction.sol";
import "../../interfaces/IOpenSkyDutchAuctionPriceOracle.sol";
import "../../interfaces/IOpenSkyDutchAuctionLiquidator.sol";
import "../../interfaces/IOpenSkySettings.sol";
import "hardhat/console.sol";

contract OpenSkyDutchAuction is Ownable, ReentrancyGuard, ERC721Holder, IOpenSkyDutchAuction {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    IOpenSkySettings public immutable SETTINGS;

    Counters.Counter private _auctionIdTracker;

    IOpenSkyDutchAuctionPriceOracle public PRICE_ORACLE;

    // id => Auction
    mapping(uint256 => Auction) public auctions;

    modifier auctionExists(uint256 auctionId) {
        require(_exists(auctionId), "AUCTION_NOT_EXIST");
        _;
    }

    constructor(address settings) Ownable() {
        SETTINGS = IOpenSkySettings(settings);
    }

    function setPriceOracle(address priceOracle_) external onlyOwner {
        require(priceOracle_ != address(0), "AUCTION_NEW_PRICEORACLE_IS_THE_ZERO_ADDRESS");
        PRICE_ORACLE = IOpenSkyDutchAuctionPriceOracle(priceOracle_);
    }

    function createAuction(
        address nftAddress,
        uint256 tokenId,
        address underlyingAsset,
        uint256 reservePrice
    ) external override returns (uint256) {
        address tokenOwner = IERC721(nftAddress).ownerOf(tokenId);
        require(msg.sender == tokenOwner, "AUCTION_CREATE_NOT_TOKEN_OWNER");
        require(reservePrice > 0, "AUCTION_CREATE_RESERVE_PRICE_NOT_ALLOWED");

        _auctionIdTracker.increment();
        uint256 auctionId = _auctionIdTracker.current();
        uint256 startTime = block.timestamp;

        auctions[auctionId] = Auction({
            nftAddress: nftAddress,
            tokenId: tokenId,
            underlyingAsset: underlyingAsset,
            reservePrice: reservePrice,
            startTime: startTime,
            tokenOwner: tokenOwner,
            buyer: address(0),
            buyPrice: 0,
            buyTime: 0,
            status: Status.LIVE
        });

        IERC721(nftAddress).transferFrom(tokenOwner, address(this), tokenId);
        _auctionIdTracker.increment();

        emit AuctionCreated(auctionId, nftAddress, tokenId, tokenOwner, underlyingAsset, startTime, reservePrice);
        return auctionId;
    }

    function cancelAuction(uint256 auctionId) external override auctionExists(auctionId) {
        Auction memory auction = auctions[auctionId]; 
        require(auction.status == Status.LIVE, "AUCTION_CANCEL_STATUS_ERROR");
        require(auction.tokenOwner == msg.sender, "AUCTION_CANCEL_NOT_TOKEN_OWNER");
        _cancelAuction(auctionId);
        emit AuctionCanceled(
            auctionId,
            auction.nftAddress,
            auction.tokenId,
            auction.tokenOwner,
            auction.underlyingAsset,
            block.timestamp
        );
    }

    function buy(uint256 auctionId) external override auctionExists(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId]; 

        require(auction.status == Status.LIVE, "AUCTION_BUY_STATUS_ERROR");

        uint256 price = PRICE_ORACLE.getPrice(auction.reservePrice, auction.startTime);

        // transfer price token
        IERC20(auction.underlyingAsset).safeTransferFrom(msg.sender, address(this), price);

        auction.status = Status.END;
        auction.buyTime = block.timestamp;
        auction.buyPrice = price;
        auction.buyer = msg.sender;

        IERC721(auction.nftAddress).safeTransferFrom(
            address(this),
            msg.sender,
            auction.tokenId
        );

        if (SETTINGS.isLiquidator(auctions[auctionId].tokenOwner)) {
            // end liquidation if tokenOwner is a liquidator contract
            IERC20(auction.underlyingAsset).safeApprove(auction.tokenOwner, price);
            IOpenSkyDutchAuctionLiquidator(auction.tokenOwner).endLiquidationByAuctionId(
                auctionId,
                price
            );
        } else {
            IERC20(auction.underlyingAsset).safeTransfer(auction.tokenOwner, price);
        }

        emit AuctionEnded(
            auctionId,
            auction.nftAddress,
            auction.tokenId,
            msg.sender,
            auction.underlyingAsset,
            price,
            block.timestamp
        );
    }

    function getPrice(uint256 auctionId) public view override auctionExists(auctionId) returns (uint256) {
        require(auctions[auctionId].status == Status.LIVE, "AUCTION_GET_PRICE_STATUS_ERROR");
        return PRICE_ORACLE.getPrice(auctions[auctionId].reservePrice, auctions[auctionId].startTime);
    }

    function getAuctionData(uint256 auctionId) public view override auctionExists(auctionId) returns (Auction memory) {
        return auctions[auctionId];
    }

    function getStatus(uint256 auctionId) public view override auctionExists(auctionId) returns (Status) {
        return auctions[auctionId].status;
    }

    function isLive(uint256 auctionId) public view override auctionExists(auctionId) returns (bool) {
        return auctions[auctionId].status == Status.LIVE;
    }

    function isEnd(uint256 auctionId) public view override auctionExists(auctionId) returns (bool) {
        return auctions[auctionId].status == Status.END;
    }

    function isCanceled(uint256 auctionId) public view override auctionExists(auctionId) returns (bool) {
        return auctions[auctionId].status == Status.CANCELED;
    }

    function _exists(uint256 auctionId) internal view returns (bool) {
        return auctions[auctionId].tokenOwner != address(0);
    }

    function _cancelAuction(uint256 auctionId) internal {
        address tokenOwner = auctions[auctionId].tokenOwner;
        IERC721(auctions[auctionId].nftAddress).safeTransferFrom(
            address(this),
            tokenOwner,
            auctions[auctionId].tokenId
        );
        auctions[auctionId].status = Status.CANCELED;
    }

    receive() external payable {}
}
