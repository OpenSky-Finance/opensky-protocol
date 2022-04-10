import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import {
    waitForTx,
    advanceBlocks,
    advanceTimeAndBlock,
    getTxCost,
    getCurrentBlockAndTimestamp,
    almostEqual,
    getETHBalance,
} from '../helpers/utils';
import _ from 'lodash';

import { __setup, checkPoolEquation } from './__setup';

describe('price oracle', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('update price successfully', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        await advanceTimeAndBlock(8 * 3600);

        const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const price = parseEther('1.1');
        await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);

        const latestPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, 0);

        expect(latestPriceData.cumulativePrice).to.be.equal(0);
        expect(latestPriceData.roundId).to.be.equal(1);

        const priceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, 1);
        expect(priceData.price).to.be.equal(price);
        expect(priceData.timestamp).to.be.equal(timestamp);
        expect(priceData.cumulativePrice).to.be.equal(latestPriceData.price.mul(timestamp - latestPriceData.timestamp));
        expect(priceData.roundId).to.be.equal(2);
    });

    it('update price fail, if call is not owner', async function () {
        const { OpenSkyNFT, nftStaker } = await __setup();

        const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const price = parseEther('1.1');
        await expect(
            nftStaker.OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp)
        ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('get price data successfully', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        let priceInitLength = parseInt(
            (await OpenSkyCollateralPriceOracle.getPriceFeedLength(OpenSkyNFT.address)).toString()
        );
        let priceDatas: any = Array(priceInitLength - 1).fill({});
        priceDatas.push(await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, priceInitLength - 1));
        for (let i = priceInitLength; i < 100 + priceInitLength; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            let previousRoundPriceData = priceDatas[i - 1];
            let cumulativePrice = previousRoundPriceData.cumulativePrice.add(
                previousRoundPriceData.price.mul(timestamp - previousRoundPriceData.timestamp)
            );
            priceDatas.push({ price, timestamp, cumulativePrice, roundId: i + 1 });
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }
        let randomRoundId = Math.floor(Math.random() * 100) + priceInitLength;
        const priceDataFromOracle = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, randomRoundId);
        const priceData = priceDatas[randomRoundId];
        expect(priceData.price.toString()).to.be.equal(priceDataFromOracle.price.toString());
        expect(priceData.timestamp).to.be.equal(priceDataFromOracle.timestamp);
        expect(priceData.cumulativePrice.toString()).to.be.equal(priceDataFromOracle.cumulativePrice.toString());
        expect(priceData.roundId).to.be.equal(priceDataFromOracle.roundId);
    });

    it('get TWAP price successfully, if less than 100 round', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        for (let i = 0; i < 70; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        const roundInterval = 100;
        const roundLength = await OpenSkyCollateralPriceOracle.getPriceFeedLength(OpenSkyNFT.address);
        const currentRoundPriceData = await OpenSkyCollateralPriceOracle.getPriceData(
            OpenSkyNFT.address,
            roundLength - 1
        );
        const previousRoundPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, 0);
        expect(
            currentRoundPriceData.cumulativePrice
                .sub(previousRoundPriceData.cumulativePrice)
                .div(currentRoundPriceData.timestamp - previousRoundPriceData.timestamp)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPrice(OpenSkyNFT.address, roundInterval));
    });

    it('get TWAP price successfully, if more than 100 round', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        for (let i = 0; i < 150; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        const roundInterval = 100;
        const roundLength = await OpenSkyCollateralPriceOracle.getPriceFeedLength(OpenSkyNFT.address);
        const currentRoundPriceData = await OpenSkyCollateralPriceOracle.getPriceData(
            OpenSkyNFT.address,
            roundLength - 1
        );
        const previousRoundPriceData = await OpenSkyCollateralPriceOracle.getPriceData(
            OpenSkyNFT.address,
            roundLength - 1 - roundInterval
        );
        expect(
            currentRoundPriceData.cumulativePrice
                .sub(previousRoundPriceData.cumulativePrice)
                .div(currentRoundPriceData.timestamp - previousRoundPriceData.timestamp)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPrice(OpenSkyNFT.address, roundInterval));
    });

    function randomPrice(price1: number, price2: number) {
        if (price2 > price1) {
            return price1 + Math.random() * (price2 - price1);
        } else {
            return price2 + Math.random() * (price1 - price2);
        }
    }
});
