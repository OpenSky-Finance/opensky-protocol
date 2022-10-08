import { parseEther } from 'ethers/lib/utils';
import { __setup } from './__setup';
import { expect } from '../helpers/chai';
import { AUCTION_STATUS } from '../helpers/constants';
import { advanceTimeAndBlock } from '../helpers/utils';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

const DECAY_DURATION = 5 * 24 * 3600;

describe('OpenSkyDutchAuction', async function () {
    let ENV: any;

    before(async () => {
        ENV = await __setup();

        const { OpenSkyDutchAuction, OpenSkyNFT, user001, buyer001 } = ENV;
        await OpenSkyNFT.awardItem(user001.address);

        const TokenID = await OpenSkyNFT.totalSupply();
        await user001.OpenSkyNFT.approve(OpenSkyDutchAuction.address, TokenID);
       
        ENV.TokenID = TokenID;
        ENV.ReservePrice = parseEther('0.5');

        await buyer001.WNative.deposit({value: parseEther('1')});
    });

    it('should not create auction', async function () {
        const { OpenSkyNFT, WNative, TokenID, ReservePrice, user001, user002 } = ENV;
        await expect(
            user002.OpenSkyDutchAuction.createAuction(OpenSkyNFT.address, TokenID, WNative.address, ReservePrice)
        ).to.revertedWith('AUCTION_CREATE_NOT_TOKEN_OWNER');

        await expect(
            user001.OpenSkyDutchAuction.createAuction(OpenSkyNFT.address, TokenID, WNative.address, 0)
        ).to.revertedWith('AUCTION_CREATE_RESERVE_PRICE_NOT_ALLOWED');
    });

    it('should create auction', async function () {
        const { OpenSkyDutchAuction, OpenSkyNFT, WNative, user001, TokenID, ReservePrice } = ENV;

        await user001.OpenSkyDutchAuction.createAuction(OpenSkyNFT.address, TokenID, WNative.address, ReservePrice);
        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(OpenSkyDutchAuction.address);

        // check status
        const AuctionID = 1;
        expect(await OpenSkyDutchAuction.getStatus(AuctionID)).to.eq(AUCTION_STATUS.LIVE);

        // check data
        const Auction = await OpenSkyDutchAuction.getAuctionData(AuctionID);
        expect(Auction.underlyingAsset).to.be.equal(WNative.address);
        expect(Auction.nftAddress).to.be.equal(OpenSkyNFT.address);
        expect(Auction.tokenId).to.be.equal(TokenID);
        expect(Auction.tokenOwner).to.be.equal(user001.address);
        expect(Auction.reservePrice).to.be.equal(ReservePrice);

        ENV.AuctionID = AuctionID;
    });

    it('should not cancel auction when sender is not token owner', async function () {
        const { user002: fakeOwner, AuctionID } = ENV;
        await expect(
            fakeOwner.OpenSkyDutchAuction.cancelAuction(AuctionID)
        ).to.revertedWith('AUCTION_CANCEL_NOT_TOKEN_OWNER');
    });

    it('should cancel auction', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyNFT, OpenSkyDutchAuction, user001, AuctionID, TokenID } = ENV;
        await user001.OpenSkyDutchAuction.cancelAuction(AuctionID);
        expect(await OpenSkyDutchAuction.getStatus(AuctionID)).to.eq(AUCTION_STATUS.CANCELED);
        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(user001.address);

        await ethers.provider.send('evm_revert', [SnapshotID])
    });

    it('should buy', async function () {
        const { OpenSkyDutchAuction, OpenSkyNFT, WNative, user001, buyer001, TokenID, AuctionID } = ENV;

        const timePass = DECAY_DURATION + 1;
        await advanceTimeAndBlock(timePass);

        // buy with reservePrice
        const price = await OpenSkyDutchAuction.getPrice(AuctionID);
        await buyer001.WNative.approve(OpenSkyDutchAuction.address, BigNumber.from(price));
        await buyer001.OpenSkyDutchAuction.buy(AuctionID);
        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(buyer001.address);
        expect(await WNative.balanceOf(user001.address)).to.eq(price);
        expect(await OpenSkyDutchAuction.getStatus(AuctionID)).to.eq(AUCTION_STATUS.END);
    });

    it('should not buy when auction status is not live', async function () {
        const { buyer002, AuctionID } = ENV;
        await expect(
            buyer002.OpenSkyDutchAuction.buy(AuctionID)
        ).to.revertedWith('AUCTION_BUY_STATUS_ERROR');
    });

    it('should not cancel auction when status is not live', async function () {
        const { user001, AuctionID } = ENV;
        await expect(
            user001.OpenSkyDutchAuction.cancelAuction(AuctionID)
        ).to.revertedWith('AUCTION_CANCEL_STATUS_ERROR');
    });
});
