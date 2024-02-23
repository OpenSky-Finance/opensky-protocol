import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import {
    checkEvent,
} from '../helpers/utils';
import { MAX_UINT_AMOUNT, Errors, ONE_ETH } from '../helpers/constants';

import { __setup, checkPoolEquation } from './__setup';

describe('pool lending deposit', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { user001, user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('user deposit 1 eth', async function () {
        const { OpenSkyPool, OpenSkyOToken, user001, MoneyMarket } = ENV;

        await user001.WNative.approve(OpenSkyPool.address, ONE_ETH);

        let tx = await user001.OpenSkyPool.deposit('1', ONE_ETH, user001.address, 0);

        await checkEvent(tx, 'Deposit', [1, user001.address, ONE_ETH, 0]);

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(ONE_ETH);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(ONE_ETH);
    });

    it('user deposit fail, if amount == 0', async function () {
        const { OpenSkyPool, user001 } = ENV;

        await user001.WNative.approve(OpenSkyPool.address, ONE_ETH);

        await expect(user001.OpenSkyPool.deposit('1', 0, user001.address, 0)).to.be.revertedWith(
            Errors.DEPOSIT_AMOUNT_SHOULD_BE_BIGGER_THAN_ZERO
        );
    });

    it('user deposit fail, if illegal amount', async function () {
        const { user001 } = ENV;

        // MAX_UINT_AMOUNT
        let ret = 0;
        try {
            await user001.OpenSkyPool.deposit('1', MAX_UINT_AMOUNT, user001.address, 0);
        } catch (e) {
            ret = 1;
        }
        expect(ret).eq(1);
    });
});

describe('pool lending withdraw', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyPool, user001, user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const reserve = await OpenSkyPool.getReserveData('1');
        ENV.UnderlyingAsset = reserve.underlyingAsset;

        await user001.WNative.approve(OpenSkyPool.address, parseEther('1'));

        await user001.OpenSkyPool.deposit('1', parseEther('1'), user001.address, 0);
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('user withdraw 1 weth', async function () {
        const { OpenSkyOToken, user001 } = ENV;

        const totalSupplyBeforeWithdraw = await OpenSkyOToken.totalSupply(); 
        const balanceBeforeWithdraw = await OpenSkyOToken.balanceOf(user001.address); 
        const withdrawTx = await user001.OpenSkyPool.withdraw('1', ONE_ETH, user001.address);

        await checkEvent(withdrawTx, 'Withdraw', [1, user001.address, ONE_ETH]);

        // check total supply and balance
        expect(await OpenSkyOToken.totalSupply()).to.be.equal(totalSupplyBeforeWithdraw.sub(ONE_ETH));
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(balanceBeforeWithdraw.sub(ONE_ETH));
    });

    it('user withdraw all', async function () {
        const { WNative, OpenSkyOToken, user001 } = ENV;

        const wNativeBalanceBeforeWithdraw = await WNative.balanceOf(user001.address);
        const oTokenBalanceBeforeWithdraw = await OpenSkyOToken.balanceOf(user001.address);

        await user001.OpenSkyPool.withdraw(1, ethers.constants.MaxUint256, user001.address);

        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(BigNumber.from('0'));
        expect(await WNative.balanceOf(user001.address)).to.be.equal(wNativeBalanceBeforeWithdraw.add(oTokenBalanceBeforeWithdraw));
    });

    it('user withdraw eth if amount > availableLiquidity', async function () {
        const { OpenSkyPool, OpenSkyOToken, OpenSkyNFT, MoneyMarket, UnderlyingAsset, user001, borrower } = ENV;

        await borrower.OpenSkyNFT.awardItem(borrower.address);
        await borrower.OpenSkyNFT.approve(OpenSkyPool.address, 1);

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('0.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        // check availableLiquidity
        expect(await MoneyMarket.getBalance(UnderlyingAsset, OpenSkyOToken.address)).to.be.equal(parseEther('0.5'));

        // withdraw fail if amount > availableLiquidity
        await expect(user001.OpenSkyPool.withdraw(1, parseEther('0.501'), user001.address)).to.revertedWith(
            Errors.WITHDRAW_LIQUIDITY_NOT_SUFFICIENT
        );
    });
});
