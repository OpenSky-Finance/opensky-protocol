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

describe('liquidation.dutchAuctionPriceOracle', function () {
    it('it can get accurate price base on time', async function () {
        const { OpenSkyDutchAuctionPriceOracle } = await __setup();

        // same as contract
        const DURATION_ONE = 2 * 24 * 3600;
        const DURATION_TWO = 3 * 24 * 3600;
        const SPACING = 5 * 60;

        // input
        const inputPrice = parseEther('1');
        const startTime = BigNumber.from(Math.floor(new Date().getTime() / 1000));

        // same as contract
        const reservePrice = inputPrice;
        const startPrice = reservePrice.mul(10);
        const turningPrice = reservePrice.mul(3);
        const endPrice = reservePrice.mul(12000).div(10000);
        const turnTime = startTime.add(DURATION_ONE);
        const endTime = turnTime.add(DURATION_TWO);

        console.log('startPrice startTime', inputPrice, startTime);

        async function getPrice() {
            const price = await OpenSkyDutchAuctionPriceOracle.getPrice(inputPrice.toString(), startTime);
            return price;
        }

        // TODO need to trancate  round
        function getExpectPrice(timePass: number) {
            const n = BigNumber.from(Math.floor(timePass / SPACING));
            const priceSpacing = startPrice.sub(turningPrice).div(turnTime.sub(startTime).div(SPACING));
            const expectPrice = startPrice.sub(n.mul(priceSpacing));
            return expectPrice;
        }

        let expectPrice;

        // init price
        expect(await getPrice()).to.be.eq(startPrice);

        //after 3 minutes
        await advanceTimeAndBlock(3 * 60);
        expect(await getPrice()).to.be.eq(startPrice);

        // after total 5 minutes
        await advanceTimeAndBlock(2 * 60);
        expect(await getPrice()).to.be.eq(getExpectPrice(5*60));

        // //after total 2 days
        await advanceTimeAndBlock(2 * 24 * 3600 - (3 + 2) * 60);
        expect(await getPrice()).to.be.eq(turningPrice);
        
        //after total 5 days
        await advanceTimeAndBlock(3 * 24 * 3600);
        expect(await getPrice()).to.be.eq(endPrice);

        //after total more than 5 days
        await advanceTimeAndBlock(3600);
        expect(await getPrice()).to.be.eq(endPrice);
    });
});
