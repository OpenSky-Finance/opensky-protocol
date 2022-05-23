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

    it('update price fail, if caller is not owner', async function () {
        const { OpenSkyNFT, nftStaker } = await __setup();

        const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const price = parseEther('1.1');
        await expect(
            nftStaker.OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp)
        ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('update ronud interval successfully', async function () {
        const { deployer: owner } = await __setup();
        expect(await owner.OpenSkyCollateralPriceOracle.updateRoundInterval(10));
    });

    it('update ronud interval fail, if caller is not owner', async function () {
        const { OpenSkyCollateralPriceOracle, buyer001: user001 } = await __setup();
        await expect(
            OpenSkyCollateralPriceOracle.connect(await ethers.getSigner(user001.address)).updateRoundInterval(10)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('update time interval successfully', async function () {
        const { deployer: owner } = await __setup();
        expect(await owner.OpenSkyCollateralPriceOracle.updateTimeInterval(10));
    });

    it('update time interval fail, if caller is not owner', async function () {
        const { OpenSkyCollateralPriceOracle, buyer001: user001 } = await __setup();
        await expect(
            OpenSkyCollateralPriceOracle.connect(await ethers.getSigner(user001.address)).updateTimeInterval(10)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('get price successfully, if timeInterval == 0', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT, buyer001: user001 } = await __setup();

        for (let i = 1; i <= 150; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        expect(
            await OpenSkyCollateralPriceOracle.getPrice(1, OpenSkyNFT.address, 1)
        ).to.be.equal(
            (await user001.OpenSkyCollateralPriceOracle.getPriceData(
                OpenSkyNFT.address, 150
            )).price
        );
    });

    it('get price successfully, if timeInterval > 0', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT, buyer001: user001 } = await __setup();

        for (let i = 1; i <= 150; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        await OpenSkyCollateralPriceOracle.updateTimeInterval(200023);

        expect(
            await OpenSkyCollateralPriceOracle.getPrice(1, OpenSkyNFT.address, 1)
        ).to.be.equal(
            await OpenSkyCollateralPriceOracle.getTwapPriceByTimeInterval(OpenSkyNFT.address, 200023)
        );
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

    it('get TWAP price successfully, if roundLength < roundInterval', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        for (let i = 0; i < 70; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        const roundInterval = 100;
        expect(
            await getTwapPriceByRoundInterval(roundInterval, OpenSkyCollateralPriceOracle, OpenSkyNFT)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByRoundInterval(OpenSkyNFT.address, roundInterval));
    });

    it('get TWAP price successfully, if roundLength > roundInterval', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        for (let i = 0; i < 150; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        const roundInterval = 100;
        expect(
            await getTwapPriceByRoundInterval(roundInterval, OpenSkyCollateralPriceOracle, OpenSkyNFT)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByRoundInterval(OpenSkyNFT.address, roundInterval));
    });

    it('get TWAP price correctly, if nft is not in whitelist', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT, deployer: governance } = await __setup();

        for (let i = 0; i < 150; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        expect(
            await OpenSkyCollateralPriceOracle.getTwapPriceByRoundInterval(OpenSkyNFT.address, 1)
        ).to.gt(0);
        expect(
            await OpenSkyCollateralPriceOracle.getTwapPriceByTimeInterval(OpenSkyNFT.address, 30000)
        ).to.gt(0);

        await governance.OpenSkySettings.removeFromWhitelist(1, OpenSkyNFT.address);
        expect(
            await OpenSkyCollateralPriceOracle.getPrice(1, OpenSkyNFT.address, 1)
        ).to.be.equal(0);
    });

    it('get TWAP price correctly', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        const len = 100 + Math.ceil(Math.random() * 100);
        for (let i = 0; i < len; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        await advanceTimeAndBlock(2 * 3600);
        const interval = Math.ceil(Math.random() * 200);
        expect(
            await getTwapPriceByRoundInterval(interval, OpenSkyCollateralPriceOracle, OpenSkyNFT)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByRoundInterval(OpenSkyNFT.address, interval));
    });

    it('get TWAP price correctly, if roundInterval == 0', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        await advanceTimeAndBlock(8 * 3600);
        let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        let price = parseEther('82.0131');
        await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);

        await advanceTimeAndBlock(24 * 3600);
        expect(price).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByRoundInterval(OpenSkyNFT.address, 0));
    });

    it('get TWAP price correctly, if timeInternal > 0', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        const len = 3; //100 + Math.ceil(Math.random() * 100);
        for (let i = 0; i < len; i++) {
            await advanceTimeAndBlock(8 * 3600);
            let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
            let price = parseEther(randomPrice(80, 100) + '');
            await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);
        }

        await advanceTimeAndBlock(2 * 3600);
        const interval = 12 * 3600 + 1932;
        expect(
            await getTwapPriceByTimeInterval(interval, OpenSkyCollateralPriceOracle, OpenSkyNFT)
        ).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByTimeInterval(OpenSkyNFT.address, interval));
    });

    it('get TWAP price correctly, if timeInterval <= firstPriceData.timestamp', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        await advanceTimeAndBlock(8 * 3600);
        let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        let price = parseEther('82.0131');
        await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);

        await advanceTimeAndBlock(4 * 3600);
        expect(
            await getTwapPriceByTimeInterval(12 * 3600 + 100, OpenSkyCollateralPriceOracle, OpenSkyNFT)
        ).to.be.equal(
            await OpenSkyCollateralPriceOracle.getTwapPriceByTimeInterval(OpenSkyNFT.address, 12 * 3600 + 100)
        );
    });

    it('get TWAP price correctly, if timeInterval >= 0', async function () {
        const { OpenSkyCollateralPriceOracle, OpenSkyNFT } = await __setup();

        await advanceTimeAndBlock(8 * 3600);
        let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        let price = parseEther('82.0131');
        await OpenSkyCollateralPriceOracle.updatePrice(OpenSkyNFT.address, price, timestamp);

        await advanceTimeAndBlock(24 * 3600);
        expect(price).to.be.equal(await OpenSkyCollateralPriceOracle.getTwapPriceByTimeInterval(OpenSkyNFT.address, 100));
    });

    function randomPrice(price1: number, price2: number) {
        if (price2 > price1) {
            return price1 + Math.random() * (price2 - price1);
        } else {
            return price2 + Math.random() * (price1 - price2);
        }
    }

    async function getTwapPriceByRoundInterval(interval: number, OpenSkyCollateralPriceOracle: any, OpenSkyNFT: any) {
        let priceFeedLength = await OpenSkyCollateralPriceOracle.getPriceFeedLength(OpenSkyNFT.address);
        let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        let nextPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, priceFeedLength - 1);
        let cumulativePrice = nextPriceData.price.mul(timestamp - nextPriceData.timestamp);
        let previousPriceData;

        for (let i = 1; i <= interval; i++) {
            if (i == priceFeedLength) {
                break;
            }
            previousPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, priceFeedLength - (i + 1));
            cumulativePrice = cumulativePrice.add(previousPriceData.price.mul(nextPriceData.timestamp - previousPriceData.timestamp));
            nextPriceData = previousPriceData;
        }
        return cumulativePrice.div(timestamp - previousPriceData.timestamp);
    }

    async function getTwapPriceByTimeInterval(timeInterval: number, OpenSkyCollateralPriceOracle: any, OpenSkyNFT: any) {
        let priceFeedLength = await OpenSkyCollateralPriceOracle.getPriceFeedLength(OpenSkyNFT.address);
        let timestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        let baseTimestamp = timestamp - timeInterval;

        let currentPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, priceFeedLength - 1);
        let cumulativePrice = currentPriceData.price.mul(timestamp - currentPriceData.timestamp);

        let i = priceFeedLength - 1;
        let previousPriceData;

        while (i > 0 && currentPriceData.timestamp > baseTimestamp) {
            previousPriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, --i);
            cumulativePrice = cumulativePrice.add(previousPriceData.price.mul(currentPriceData.timestamp - previousPriceData.timestamp));
            currentPriceData = previousPriceData;
        } 

        if (i == 0 && currentPriceData.timestamp > baseTimestamp) {
            return cumulativePrice.div(timestamp - currentPriceData.timestamp);
        }

        let basePriceData = await OpenSkyCollateralPriceOracle.getPriceData(OpenSkyNFT.address, i);
        cumulativePrice = cumulativePrice.add(basePriceData.price.mul(currentPriceData.timestamp - baseTimestamp));
        return cumulativePrice.div(timeInterval);
    }
});
