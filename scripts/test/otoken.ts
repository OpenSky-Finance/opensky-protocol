import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost } from '../helpers/utils';
import _ from 'lodash';

import { __setup, setupWithStakingNFT, formatEtherAttrs, formatObjNumbers, checkPoolEquation } from './__setup';

import { ENV } from './__types';

describe('otoken', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    const oneWei = 1;
    const oneEth = parseEther('1');

    it('Check oToken burn 1', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } = env;

        const DEPOSIT_AMOUNT = parseEther('1.2');
        await nftStaker.OpenSkyPool.deposit('1', 0, { value: DEPOSIT_AMOUNT });
        await advanceTimeAndBlock(20);

        const INFO: any = {};
        INFO.nftStaker_balance = await OpenSkyOToken.balanceOf(nftStaker.address);
        INFO.nftStaker_balance_scaled = await OpenSkyOToken.scaledBalanceOf(nftStaker.address);
        INFO.nftStaker_balance_principle = await OpenSkyOToken.principleBalanceOf(nftStaker.address);

        await nftStaker.OpenSkyPool.withdraw('1', INFO.nftStaker_balance);

        INFO.nftStaker_balance_after_withdraw = await OpenSkyOToken.balanceOf(nftStaker.address);

        // console.log(formatEtherAttrs(INFO));
        // console.log(formatObjNumbers(INFO));
    });

    it('Check oToken totalSupply with sum of user balance [1]', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } =
            await setupWithStakingNFT();

        await nftStaker.OpenSkyPool.deposit('1', 0, { value: parseEther('1') });
        await advanceTimeAndBlock(20);
        await deployer.OpenSkyPool.deposit('1', 0, { value: parseEther('1.5') });
        await advanceTimeAndBlock(20);
        await buyer001.OpenSkyPool.deposit('1', 0, { value: parseEther('1.6') });
        await advanceTimeAndBlock(20);
        await buyer002.OpenSkyPool.deposit('1', 0, { value: parseEther('0.9') });
        await advanceTimeAndBlock(20);
        await liquidator.OpenSkyPool.deposit('1', 0, { value: parseEther('1.3333') });

        const INFO: any = {};
        INFO.nftStaker = await OpenSkyOToken.balanceOf(nftStaker.address);
        INFO.deployer = await OpenSkyOToken.balanceOf(deployer.address);
        INFO.buyer001 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.buyer002 = await OpenSkyOToken.balanceOf(buyer002.address);
        INFO.liquidator = await OpenSkyOToken.balanceOf(liquidator.address);

        INFO.totalSupply = await OpenSkyOToken.totalSupply();
        INFO.sum = INFO.nftStaker.add(INFO.deployer).add(INFO.buyer001).add(INFO.buyer002).add(INFO.liquidator);

        expect(INFO.sum).lte(INFO.totalSupply);

        // console.log(formatEtherAttrs(INFO));
    });

    it('Check oToken totalSupply with sum of user balance [2]', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } =
            await setupWithStakingNFT();

        const amount = 1;
        await nftStaker.OpenSkyPool.deposit('1', 0, { value: amount });
        await advanceTimeAndBlock(20);
        await deployer.OpenSkyPool.deposit('1', 0, { value: 2 });
        await advanceTimeAndBlock(20);
        await buyer001.OpenSkyPool.deposit('1', 0, { value: 3 });
        await buyer002.OpenSkyPool.deposit('1', 0, { value: 4 });
        await advanceTimeAndBlock(20);
        await liquidator.OpenSkyPool.deposit('1', 0, { value: 5 });

        const INFO: any = {};
        INFO.nftStaker = await OpenSkyOToken.balanceOf(nftStaker.address);
        INFO.deployer = await OpenSkyOToken.balanceOf(deployer.address);
        INFO.buyer001 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.buyer002 = await OpenSkyOToken.balanceOf(buyer002.address);
        INFO.liquidator = await OpenSkyOToken.balanceOf(liquidator.address);

        INFO.totalSupply = await OpenSkyOToken.totalSupply();
        INFO.sum = INFO.nftStaker.add(INFO.deployer).add(INFO.buyer001).add(INFO.buyer002).add(INFO.liquidator);

        expect(INFO.sum).to.be.lte(INFO.totalSupply);
    });

    it('buyer001 deposit 3ETH and transfer 1.5 ether oToken to buyer002', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { OpenSkyOToken, buyer001, buyer002 } = env;
        const INFO: any = {};

        INFO.buyer001_0 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.buyer002_0 = await OpenSkyOToken.balanceOf(buyer002.address);
        INFO.totalSupply_0 = await OpenSkyOToken.totalSupply();

        await buyer001.OpenSkyPool.deposit('1', 0, { value: parseEther('3') });

        INFO.buyer001_1 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.totalSupply_1 = await OpenSkyOToken.totalSupply();
        expect(INFO.buyer001_1).to.be.equal(INFO.totalSupply_1);

        expect(await buyer001.OpenSkyOToken.transfer(buyer002.address, parseEther('1.5')));

        //can trigger:  sum of oToken balance > totalSupply, when calculate using rounding
        await advanceBlocks(10);

        INFO.buyer001_2 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.buyer002_2 = await OpenSkyOToken.balanceOf(buyer002.address);
        INFO.totalSupply_2 = await OpenSkyOToken.totalSupply();
        INFO.sum_2 = INFO.buyer001_2.add(INFO.buyer002_2);

        // console.log(formatEtherAttrs(INFO));

        expect(INFO.sum_2).to.be.lte(INFO.totalSupply_2);

        expect(await buyer002.OpenSkyPool.withdraw('1', parseEther('1.5')));
    });
});
