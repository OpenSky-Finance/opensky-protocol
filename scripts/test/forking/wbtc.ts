import { ethers } from 'hardhat';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';

import { expect } from '../../helpers/chai';
import { __setup } from './__setup';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { advanceTimeAndBlock, almostEqual, checkEvent } from '../../helpers/utils';

describe('wbtc deposit', function () {
  let ENV: any;
  beforeEach(async () => {
    ENV = await __setup();

    const { user001, WNative, AAVE_POOL, WBTC } = ENV;
    console.log('WNative', WNative.address);

    await user001.UniswapV2Router.swapExactETHForTokens(
      parseUnits('0.5', 8),
      [WNative.address, WBTC.address],
      user001.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      { value: parseEther('20') }
    );

    await user001.WBTC.approve(AAVE_POOL.address, parseUnits('0.1', 8));
    await user001.AAVE_POOL.deposit(WBTC.address, parseUnits('0.1', 8), user001.address, 0)
    console.log('---------');
  });

  it('user deposit 0.5 wbtc', async function () {
    const { OpenSkyPool, OWBTC, user001, MoneyMarket } = ENV;

    const amount = parseUnits('0.5', 8)

    await user001.WBTC.approve(OpenSkyPool.address, amount);
    console.log('WBTC balance', ethers.utils.formatUnits(await user001.WBTC.balanceOf(user001.address), 8));

    let tx = await user001.OpenSkyPool.deposit('4', amount, user001.address, 0);

    await checkEvent(tx, 'Deposit', [4, user001.address, amount, 0]);

    expect(await OWBTC.totalSupply()).to.be.equal(amount);
    expect(await OWBTC.balanceOf(user001.address)).to.be.equal(amount);
  });

  it('user deposit 0.5 wbtc 365 days', async function () {
    const { OpenSkyPool, OpenSkySettings, OWBTC, WBTC, user001, MoneyMarket } = ENV;

    const amount = parseUnits('0.5', 8)

    await user001.WBTC.approve(OpenSkyPool.address, amount);

    let tx = await user001.OpenSkyPool.deposit('4', amount, user001.address, 0);

    await checkEvent(tx, 'Deposit', [4, user001.address, amount, 0]);

    await advanceTimeAndBlock(365 * 24 * 3600);

    const rate = await MoneyMarket.getSupplyRate(WBTC.address)
    const interest = amount.mul(rate).div(parseUnits('1', 27));

    expect(
      almostEqual(
        await OWBTC.totalSupply(), 
        amount.add(interest.mul(10000 - await OpenSkySettings.reserveFactor()).div(10000))
      )
    ).to.be.true;
    expect(
      almostEqual(
        await OWBTC.balanceOf(user001.address),
        amount.add(interest.mul(10000 - await OpenSkySettings.reserveFactor()).div(10000))
      )
    ).to.be.true;
  });

  it('user deposit fail, if illegal amount', async function () {
    const { user001 } = ENV;

    // MAX_UINT_AMOUNT
    let ret = 0;
    try {
      await user001.OpenSkyPool.deposit('4', MAX_UINT_AMOUNT, user001.address, 0);
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

    const { OpenSkyPool, user001, user002, WNative, WBTC } = ENV;
    await user001.UniswapV2Router.swapExactETHForTokens(
      parseUnits('0.5', 8),
      [WNative.address, WBTC.address],
      user001.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      {
        value: parseEther('20')
      }
    );

    await user002.UniswapV2Router.swapExactETHForTokens(
      parseUnits('0.5', 8),
      [WNative.address, WBTC.address],
      user002.address,
      parseInt(Date.now() / 1000 + '') + 60000,
      { value: parseEther('20') }
    );

    const reserve = await OpenSkyPool.getReserveData('4');
    ENV.UnderlyingAsset = reserve.underlyingAsset;

    await user001.WBTC.approve(OpenSkyPool.address, parseUnits('0.5', 8));

    await user001.OpenSkyPool.deposit('4', parseUnits('0.5', 8), user001.address, 0);
  });

  it('user withdraw 0.5 wbtc after 30days', async function () {
    const { WBTC, OWBTC, user001 } = ENV;

    await advanceTimeAndBlock(30 * 24 * 3600);

    const WBTCBalanceBeforeWithdraw = await WBTC.balanceOf(user001.address);
    const OWBTCBalanceBeforeWithdraw = await OWBTC.balanceOf(user001.address);
    const amount = parseUnits('10000', 6);
    const withdrawTx = await user001.OpenSkyPool.withdraw('2', amount, user001.address);

    await checkEvent(withdrawTx, 'Withdraw', [2, user001.address, amount]);

    // check total supply and balance
    expect(await WBTC.balanceOf(user001.address)).to.be.equal(WBTCBalanceBeforeWithdraw.add(amount));
    expect(
      almostEqual(await OWBTC.balanceOf(user001.address), OWBTCBalanceBeforeWithdraw.sub(amount))
    ).to.be.true;
  });

  it('user withdraw all', async function () {
    const { WBTC, OWBTC, user001 } = ENV;

    const WBTCBalanceBeforeWithdraw = await WBTC.balanceOf(user001.address);
    const OWBTCBalanceBeforeWithdraw = await OWBTC.balanceOf(user001.address);

    await user001.OpenSkyPool.withdraw(2, ethers.constants.MaxUint256, user001.address);

    expect(await OWBTC.balanceOf(user001.address)).to.be.equal(BigNumber.from('0'));
    expect(
      almostEqual(await WBTC.balanceOf(user001.address), WBTCBalanceBeforeWithdraw.add(OWBTCBalanceBeforeWithdraw))
    ).to.be.true;
  });
});