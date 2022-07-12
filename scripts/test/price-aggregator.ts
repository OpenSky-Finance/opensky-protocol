import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    checkEvent,
    getCurrentBlockAndTimestamp,
    randomAddress,
} from '../helpers/utils';
import _ from 'lodash';

import { __setup, checkPoolEquation } from './__setup';
import { ZERO_ADDRESS } from '../helpers/constants';

describe('price aggregator', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { user001: fakeOwner } = ENV;
        ENV.fakeOwner = fakeOwner;
    });

    it('set price aggregators successfully', async function () {
        const { OpenSkyPriceAggregator, OpenSkyNFT } = ENV;
        const Aggregator = await ethers.getContract('ChainlinkAggregatorMock');
        const tx = await OpenSkyPriceAggregator.setAggregators([OpenSkyNFT.address], [Aggregator.address]);
        await checkEvent(tx, 'SetAggregator', [OpenSkyNFT.address, Aggregator.address]);
        expect(await OpenSkyPriceAggregator.aggregators(OpenSkyNFT.address)).to.be.equal(Aggregator.address);
    });

    // it('remove price aggregators successfully', async function () {
    //     const { OpenSkyPriceAggregator, OpenSkyNFT } = ENV;
    //     await OpenSkyPriceAggregator.setAggregators([OpenSkyNFT.address], [ZERO_ADDRESS]);
    //     expect(await OpenSkyPriceAggregator.aggregators(OpenSkyNFT.address)).to.be.equal(ZERO_ADDRESS);
    // });

    it('set price aggregators fail, if caller is not owner', async function () {
        const { OpenSkyNFT, fakeOwner } = ENV;
        const Aggregator = await ethers.getContract('ChainlinkAggregatorMock');
        await expect(
            fakeOwner.OpenSkyPriceAggregator.setAggregators([OpenSkyNFT.address], [Aggregator.address])
        ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('get price successfully, if aggregator == address(0)', async function () {
        const { OpenSkyPriceAggregator, OpenSkyNFT } = ENV;
        expect(
            await OpenSkyPriceAggregator.getAssetPrice(OpenSkyNFT.address)
        ).to.be.equal(0);
    });

    it('get price successfully, if aggregator != address(0)', async function () {
        const { OpenSkyPriceAggregator, OpenSkyNFT } = ENV;
        const Aggregator = await ethers.getContract('ChainlinkAggregatorMock');
        const answer = parseEther('96.12');
        await Aggregator.setLatestAnswer(answer);
        await OpenSkyPriceAggregator.setAggregators([OpenSkyNFT.address], [Aggregator.address]);
        expect(
            await OpenSkyPriceAggregator.getAssetPrice(OpenSkyNFT.address)
        ).to.be.equal(answer);
    });
});
