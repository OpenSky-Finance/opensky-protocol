import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';
import {
    waitForTx,
    advanceBlocks,
    advanceBlock,
    increaseTime,
    advanceTimeAndBlock,
    getCurrentBlockAndTimestamp,
    getTxCost,
} from '../helpers/utils';
import { expect } from '../helpers/chai';
import { ENV } from './__types';
import { LOAN_STATUS, AUCTION_STATUS } from '../helpers/constants';

const DECAY_DURATION = 5 * 24 * 3600;

describe('OpenSkyDutchAuction', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    async function createAuction(env: ENV) {
        const NFT_ID = 1;

        const { OpenSkyDutchAuction, OpenSkyNFT, nftStaker, buyer001 } = env;
        await (await OpenSkyNFT.awardItem(nftStaker.address)).wait();
        expect(await OpenSkyNFT.ownerOf(1)).to.eq(nftStaker.address);

        const reservePrice = parseEther('0.5');

        await nftStaker.OpenSkyNFT.approve(OpenSkyDutchAuction.address, NFT_ID);
        await nftStaker.OpenSkyDutchAuction.createAuction(reservePrice, OpenSkyNFT.address, NFT_ID);
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDutchAuction.address);
    }
    async function buyAuction(user: any, auctionId: any) {}

    it('it can create auction and buy', async function () {
        const env: ENV = await __setup();
        const { OpenSkyDutchAuction, OpenSkyNFT, nftStaker, buyer001 } = env;
        const INFO: any = {};

        await (await OpenSkyNFT.awardItem(nftStaker.address)).wait();
        expect(await OpenSkyNFT.ownerOf(1)).to.eq(nftStaker.address);

        const reservePrice = parseEther('0.5');

        const NFT_ID = 1;
        await nftStaker.OpenSkyNFT.approve(OpenSkyDutchAuction.address, NFT_ID);
        await nftStaker.OpenSkyDutchAuction.createAuction(reservePrice, OpenSkyNFT.address, NFT_ID);
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDutchAuction.address);

        // get  status
        const AUCTION_ID = 1;
        // console.log('status', await OpenSkyDutchAuction.getStatus(AUCTION_ID));
        expect(await OpenSkyDutchAuction.getStatus(1)).to.eq(AUCTION_STATUS.LIVE);

        console.log('price', formatEther(await OpenSkyDutchAuction.getPrice(AUCTION_ID)));

        const timePass = 3 * 3600 * 24;
        await advanceTimeAndBlock(timePass);

        const price = await OpenSkyDutchAuction.getPrice(AUCTION_ID);
        console.log('price', formatEther(price));

        //can buy
        await buyer001.OpenSkyDutchAuction.buy(AUCTION_ID, { value: price });
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(buyer001.address);
    });

    it('it can buy after decay duration', async function () {
        const env: ENV = await __setup();
        const { OpenSkyDutchAuction, OpenSkyNFT, nftStaker, buyer001 } = env;
        const INFO: any = {};
        await createAuction(env);

        const AUCTION_ID = 1;
        expect(await OpenSkyDutchAuction.getStatus(AUCTION_ID)).to.eq(AUCTION_STATUS.LIVE);

        const timePass = DECAY_DURATION + 1;
        await advanceTimeAndBlock(timePass);

        //can buy using reservePrice
        const NFT_ID = 1;
        const price = await OpenSkyDutchAuction.getPrice(AUCTION_ID);
        await buyer001.OpenSkyDutchAuction.buy(AUCTION_ID, { value: price });
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(buyer001.address);
    });
});
