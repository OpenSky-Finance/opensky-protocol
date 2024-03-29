import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import {
  advanceTimeAndBlock,
    checkEvent,
} from '../helpers/utils';
import { MAX_UINT_256 } from '../helpers/constants';

import { __setup } from './__setup';

describe('ape coin deposit', function () {
    let ENV: any;
    before(async () => {
        ENV = await __setup();

        const { user001, user002, OpenSkyPool, ApeCoinStaking } = ENV;
        await user001.ApeCoin.mint(ApeCoinStaking.address, parseEther('1000000000000'));
        await user001.ApeCoin.mint(user001.address, parseEther('1000'));
        await user002.ApeCoin.mint(user002.address, parseEther('1000'));

        await user001.ApeCoin.approve(OpenSkyPool.address, MAX_UINT_256);
        await user002.ApeCoin.approve(OpenSkyPool.address, MAX_UINT_256);

        await ApeCoinStaking.addTimeRange(0, parseEther('100'), 1666576800, 1689181200, parseEther('10000'));

        await user001.ApeCoin.approve(ApeCoinStaking.address, parseEther('100'));
        await user001.ApeCoinStaking.depositApeCoin(parseEther('100'), user001.address);

        await OpenSkyPool.setTreasuryFactor(3, 0);
    });

    it('should deposit ape coins', async function () {
        const { OpenSkyPool, OAPE, ApeCoinStaking, ApeCoinStakingMoneyMarket, ApeCoin, user001, user002 } = ENV;

        {
            await user001.WNative.approve(OpenSkyPool.address, parseEther('100'));
     
            let tx = await user001.OpenSkyPool.deposit('3', parseEther('100'), user001.address, 0);
     
            await checkEvent(tx, 'Deposit', [3, user001.address, parseEther('100'), 0]);
     
            expect(await OAPE.totalSupply()).to.be.equal(parseEther('100'));
            expect(await OAPE.balanceOf(user001.address)).to.be.equal(parseEther('100'));
        }

        await advanceTimeAndBlock(4 * 3600);

        {
            await user002.WNative.approve(OpenSkyPool.address, parseEther('10'));
     
            let tx = await user002.OpenSkyPool.deposit('3', parseEther('10'), user002.address, 0);
     
            await checkEvent(tx, 'Deposit', [3, user002.address, parseEther('10'), 0]);

            // const DashboardStake = (await ApeCoinStaking.getPoolsUI())[0];
            // console.log(DashboardStake.currentTimeRange)
     
            // expect(await OAPE.totalSupply()).to.be.equal(
            //     parseEther('110')
            // );
            // expect(await OAPE.balanceOf(user002.address)).to.be.equal(parseEther('10'));
        }
    });

    it('should OAPE more than APE', async function () {
        const { OAPE, ApeCoinStaking, user001 } = ENV;

        await advanceTimeAndBlock(4 * 3600);
        
        console.log('OAPE balance', (await OAPE.balanceOf(user001.address)).toString())
        console.log('total supply', (await OAPE.totalSupply()).toString())
        const user001Staked = await ApeCoinStaking.getApeCoinStake(user001.address);
        console.log('APE balance', user001Staked.deposited.add(user001Staked.unclaimed).toString());

        expect(
            (await OAPE.balanceOf(user001.address)).gt(user001Staked.deposited.add(user001Staked.unclaimed))
        ).to.be.true;
    })

    it('should withdraw ape coins', async function () {
        const { OAPE, user001 } = ENV;

        const totalSupplyBeforeWithdraw = await OAPE.totalSupply(); 
        const balanceBeforeWithdraw = await OAPE.balanceOf(user001.address); 
        const withdrawTx = await user001.OpenSkyPool.withdraw('3', parseEther('100'), user001.address);

        await checkEvent(withdrawTx, 'Withdraw', [3, user001.address, parseEther('100')]);

        // check total supply and balance
        expect(await OAPE.balanceOf(user001.address)).to.be.equal(balanceBeforeWithdraw.sub(parseEther('100')));
        expect(await OAPE.totalSupply()).to.be.equal(totalSupplyBeforeWithdraw.sub(parseEther('100')));
    });

    it('should withdraw all ape coins', async function () {
        const { ApeCoinStaking, OAPE, user001, user002 } = ENV;

        {
            await advanceTimeAndBlock(10 * 3600);
            const totalSupplyBeforeWithdraw = await OAPE.totalSupply(); 
            const user001Balance = await OAPE.balanceOf(user001.address); 
            const withdrawTx = await user001.OpenSkyPool.withdraw('3', user001Balance, user001.address);
        
            expect(await OAPE.balanceOf(user001.address)).to.be.equal(0);
        
            await checkEvent(withdrawTx, 'Withdraw', [3, user001.address, user001Balance]);
        
            // check total supply and balance
            expect(await OAPE.totalSupply()).to.be.equal(totalSupplyBeforeWithdraw.sub(user001Balance));
        }
        {
            await advanceTimeAndBlock(10 * 24 * 3600);
            const user002Balance = await OAPE.balanceOf(user002.address); 
            const withdrawTx = await user002.OpenSkyPool.withdraw('3', user002Balance, user002.address);
        
            expect(await OAPE.balanceOf(user002.address)).to.be.equal(0);
        
            await checkEvent(withdrawTx, 'Withdraw', [3, user002.address, user002Balance]);
        
            // check total supply and balance
            expect(await OAPE.totalSupply()).to.be.equal(0);
        }

        const oTokenStaked = await ApeCoinStaking.getApeCoinStake(OAPE.address);
        expect(oTokenStaked.deposited).to.eq(0);
        expect(oTokenStaked.unclaimed).to.eq(0);

    });

});
