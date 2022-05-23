import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import _ from 'lodash';
import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost, randomAddress } from '../helpers/utils';

import { __setup, checkPoolEquation, deposit } from './__setup';
import { MAX_UINT_128, POOL_ID, Errors, ONE_ETH } from '../helpers/constants';

describe('oToken', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('Check oToken burn 1', async function () {
        const { OpenSkyOToken, nftStaker } = ENV;

        const DEPOSIT_AMOUNT = parseEther('1.2');
        await deposit(nftStaker, 1, DEPOSIT_AMOUNT);
        await advanceTimeAndBlock(20);

        const INFO: any = {};
        INFO.nftStaker_balance = await OpenSkyOToken.balanceOf(nftStaker.address);
        INFO.nftStaker_balance_scaled = await OpenSkyOToken.scaledBalanceOf(nftStaker.address);
        INFO.nftStaker_balance_principle = await OpenSkyOToken.principleBalanceOf(nftStaker.address);

        await nftStaker.OpenSkyPool.withdraw('1', INFO.nftStaker_balance, nftStaker.address);

        INFO.nftStaker_balance_after_withdraw = await OpenSkyOToken.balanceOf(nftStaker.address);

        // console.log(formatEtherAttrs(INFO));
        // console.log(formatObjNumbers(INFO));
    });

    it('Check oToken totalSupply with sum of user balance [1]', async function () {
        const { OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } =
            ENV;

        await deposit(nftStaker, 1, parseEther('1'));
        await advanceTimeAndBlock(20);
        await deposit(nftStaker, 1, parseEther('1.5'));
        await advanceTimeAndBlock(20);
        await deposit(nftStaker, 1, parseEther('1.6'));
        await advanceTimeAndBlock(20);
        await deposit(nftStaker, 1, parseEther('0.9'));
        await advanceTimeAndBlock(20);
        await deposit(nftStaker, 1, parseEther('1.3333'));

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
        const { OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } =
            ENV;

        const amount = 1;
        await deposit(nftStaker, 1, BigNumber.from(amount));
        await advanceTimeAndBlock(20);
        await deposit(deployer, 1, BigNumber.from(2));
        await advanceTimeAndBlock(20);
        await deposit(buyer001, 1, BigNumber.from(3));
        await deposit(buyer002, 1, BigNumber.from(4));
        await advanceTimeAndBlock(20);
        await deposit(liquidator, 1, BigNumber.from(5));

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
        const { OpenSkyOToken, buyer001, buyer002 } = ENV;
        const INFO: any = {};

        INFO.buyer001_0 = await OpenSkyOToken.balanceOf(buyer001.address);
        INFO.buyer002_0 = await OpenSkyOToken.balanceOf(buyer002.address);
        INFO.totalSupply_0 = await OpenSkyOToken.totalSupply();

        await deposit(buyer001, 1, parseEther('3'));

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

        expect(await buyer002.OpenSkyPool.withdraw('1', parseEther('1.5'), buyer002.address));
    });

    it('Check oToken tranfer amount > MAX_UINT_128', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } = ENV;
        expect(buyer001.OpenSkyOToken.transfer(buyer002.address, MAX_UINT_128.add(1))).to.be.revertedWith(
          Errors.AMOUNT_TRANSFER_OWERFLOW
        );
    });

    it('Can change treasury address and accrue interest to new treasury', async function () {
        const { OpenSkySettings, OpenSkyPool, AAVE_POOL, UnderlyingAsset, OpenSkyOToken, buyer001, buyer002 } = ENV;
        const INFO: any = {};

        async function addIncome(amount: BigNumber) {
            await advanceTimeAndBlock(3600 * 24);
            // await OpenSkyPool.updateMoneyMarketIncome(POOL_ID, { value: amount });
            await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, amount);
            await OpenSkyPool.updateState(POOL_ID, 0); // add income
            await OpenSkyPool.updateLastMoneyMarketBalance(POOL_ID, 0, 0);
        }

        INFO.oldTreasuryAddress = await OpenSkySettings.daoVaultAddress();
        
        await deposit(buyer001, 1, parseEther('1'));
        await addIncome(parseEther('1'));
        INFO.treasury_balance_0 = await OpenSkyOToken.balanceOf(INFO.oldTreasuryAddress);

        // change treasury
        INFO.newTreasuryAddress = randomAddress();
        await OpenSkySettings.setDaoVaultAddress(INFO.newTreasuryAddress);
        expect(await OpenSkySettings.daoVaultAddress()).eq(INFO.newTreasuryAddress);

        await addIncome(parseEther('1'));

        INFO.treasury_balance_1 = await OpenSkyOToken.balanceOf(INFO.oldTreasuryAddress);
        INFO.treasury_balance_2 = await OpenSkyOToken.balanceOf(INFO.newTreasuryAddress);

        expect(INFO.treasury_balance_2).gt(0);
        // console.log(INFO);
    });
});

describe('oToken transfer', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyNFT, user001, user002, borrower } = ENV;
        await deposit(user001, 1, parseEther('3.37332'));
        await advanceTimeAndBlock(3 * 24 * 3600);
        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );
        await advanceTimeAndBlock(11 * 24 * 3600);
        await deposit(user002, 1, parseEther('1.12132'));
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('transfer ', async () => {
        const { OpenSkyPool, OpenSkyOToken, user001, user003 } = ENV;

        await advanceTimeAndBlock(7 * 24 * 3600);

        await OpenSkyPool.setReserveNormalizedIncome(1, BigNumber.from('3000000000000000000000000000'));

        const reserve = await OpenSkyPool.getReserveData(1); 
        await user001.OpenSkyOToken.transfer(user003.address, parseEther('1.3222'));
        expect(await OpenSkyOToken.balanceOf(user003.address)).to.be.equal(parseEther('1.3222'));
    });
});
