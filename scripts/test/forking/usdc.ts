import { ethers } from 'hardhat';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';

import { expect } from '../../helpers/chai';
import { __setup } from './__setup';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { advanceTimeAndBlock, almostEqual, checkEvent } from '../../helpers/utils';

describe('usdc deposit', function () {
  let ENV: any;
  beforeEach(async () => {
    ENV = await __setup();

    const { user001, WNative, USDC } = ENV;

    await user001.UniswapV2Router.swapExactETHForTokens(
      parseUnits('10000', 6),
      [WNative.address, USDC.address],
      user001.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      { value: parseEther('10') }
    );
  });

  it('user deposit 10000 usdc', async function () {
    const { OpenSkyPool, OUSDC, user001, MoneyMarket } = ENV;

    const amount = parseUnits('10000', 6)

    await user001.USDC.approve(OpenSkyPool.address, amount);

    let tx = await user001.OpenSkyPool.deposit('2', amount, user001.address, 0);

    await checkEvent(tx, 'Deposit', [2, user001.address, amount, 0]);

    expect(await OUSDC.totalSupply()).to.be.equal(amount);
    expect(await OUSDC.balanceOf(user001.address)).to.be.equal(amount);
  });

  it('user deposit 10000 usdc 365 days', async function () {
    const { OpenSkyPool, OpenSkySettings, OUSDC, USDC, user001, MoneyMarket } = ENV;

    const amount = parseUnits('10000', 6)

    await user001.USDC.approve(OpenSkyPool.address, amount);

    let tx = await user001.OpenSkyPool.deposit('2', amount, user001.address, 0);

    await checkEvent(tx, 'Deposit', [2, user001.address, amount, 0]);

    await advanceTimeAndBlock(365 * 24 * 3600);

    const rate = await MoneyMarket.getSupplyRate(USDC.address)
    const interest = amount.mul(rate).div(parseUnits('1', 27));

    expect(
      almostEqual(
        await OUSDC.totalSupply(), 
        amount.add(interest.mul(10000 - await OpenSkySettings.reserveFactor()).div(10000))
      )
    ).to.be.true;
    expect(
      almostEqual(
        await OUSDC.balanceOf(user001.address),
        amount.add(interest.mul(10000 - await OpenSkySettings.reserveFactor()).div(10000))
      )
    ).to.be.true;
  });

  it('user deposit fail, if illegal amount', async function () {
    const { user001 } = ENV;

    // MAX_UINT_AMOUNT
    let ret = 0;
    try {
      await user001.OpenSkyPool.deposit('2', MAX_UINT_AMOUNT, user001.address, 0);
    } catch (e) {
      ret = 1;
    }
    expect(ret).eq(1);
  });
})

describe('usdc withdraw', function () {
  let ENV: any;
  beforeEach(async () => {
    ENV = await __setup();

    const { OpenSkyPool, user001, user002, WNative, USDC } = ENV;
    await user001.UniswapV2Router.swapExactETHForTokens(
      parseUnits('10000', 6),
      [WNative.address, USDC.address],
      user001.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      {
        value: parseEther('10')
      }
    );

    await user002.UniswapV2Router.swapExactETHForTokens(
      parseUnits('5000', 6),
      [WNative.address, USDC.address],
      user002.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      { value: parseEther('5') }
    );

    const reserve = await OpenSkyPool.getReserveData('2');
    ENV.UnderlyingAsset = reserve.underlyingAsset;

    await user001.USDC.approve(OpenSkyPool.address, parseUnits('10000', 6));

    await user001.OpenSkyPool.deposit('2', parseUnits('10000', 6), user001.address, 0);
  });

  it('user withdraw 10000 usdc after 30days', async function () {
    const { USDC, OUSDC, user001 } = ENV;

    await advanceTimeAndBlock(30 * 24 * 3600);

    const USDCBalanceBeforeWithdraw = await USDC.balanceOf(user001.address);
    const OUSDCBalanceBeforeWithdraw = await OUSDC.balanceOf(user001.address);
    const amount = parseUnits('10000', 6);
    const withdrawTx = await user001.OpenSkyPool.withdraw('2', amount, user001.address);

    await checkEvent(withdrawTx, 'Withdraw', [2, user001.address, amount]);

    // check total supply and balance
    expect(await USDC.balanceOf(user001.address)).to.be.equal(USDCBalanceBeforeWithdraw.add(amount));
    expect(
      almostEqual(await OUSDC.balanceOf(user001.address), OUSDCBalanceBeforeWithdraw.sub(amount))
    ).to.be.true;
  });

  it('user withdraw all', async function () {
    const { USDC, OUSDC, user001 } = ENV;

    const USDCBalanceBeforeWithdraw = await USDC.balanceOf(user001.address);
    const OUSDCBalanceBeforeWithdraw = await OUSDC.balanceOf(user001.address);

    await user001.OpenSkyPool.withdraw(2, ethers.constants.MaxUint256, user001.address);

    expect(await OUSDC.balanceOf(user001.address)).to.be.equal(BigNumber.from('0'));
    expect(
      almostEqual(await USDC.balanceOf(user001.address), USDCBalanceBeforeWithdraw.add(OUSDCBalanceBeforeWithdraw))
    ).to.be.true;
  });
});