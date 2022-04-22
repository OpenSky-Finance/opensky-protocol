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
    checkETHBalance,
    checkEvent,
} from '../helpers/utils';
import _ from 'lodash';
import { MAX_UINT_AMOUNT, Errors } from '../helpers/constants';

import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';

describe('pool lending', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('user deposit 1 eth', async function () {
        const { OpenSkyOToken, buyer001, MoneyMarket } = await setupWithStakingNFT();

        const ONE_ETH = parseEther('1');
        let ethBalanceBeforeTx = await buyer001.getETHBalance();
        let tx = await buyer001.OpenSkyPool.deposit('1', 0, { value: ONE_ETH });
        let gasCost = await getTxCost(tx);
        let ethBalanceAfterTx = await buyer001.getETHBalance();

        expect(almostEqual(ethBalanceBeforeTx.sub(ethBalanceAfterTx), ONE_ETH.add(gasCost))).to.be.true;

        await checkEvent(tx, 'Deposit', [1, buyer001.address, ONE_ETH, 0]);

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(ONE_ETH);
        expect(await OpenSkyOToken.balanceOf(buyer001.address)).to.be.equal(ONE_ETH);
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal(ONE_ETH);
    });

    it('user deposit illegal amount', async function () {
        const { OpenSkyOToken, buyer001, MoneyMarket } = await setupWithStakingNFT();

        await expect(buyer001.OpenSkyPool.deposit('1', 0, { value: 0 })).to.be.revertedWith(
          Errors.DEPOSIT_AMOUNT_SHOULD_BE_BIGGER_THAN_ZERO
        );

        // MAX_UINT_AMOUNT
        let ret = 0;
        try {
            await buyer001.OpenSkyPool.deposit('1', 0, { value: MAX_UINT_AMOUNT });
        } catch (e) {
            ret = 1;
        }
        expect(ret).eq(1);

        // equal as balance, fail as gas cost some
        let ret2 = 0;
        try {
            const balance = await buyer001.getETHBalance();
            await buyer001.OpenSkyPool.deposit('1', 0, { value: balance });
        } catch (e) {
            ret2 = 1;
        }
        expect(ret2).eq(1);
    });

    it('user deposit 1 eth and withdraw 1 eth', async function () {
        const { OpenSkyPool, OpenSkyOToken, MoneyMarket, buyer001 } = await setupWithStakingNFT();

        const ONE_ETH = parseEther('1');
        await buyer001.OpenSkyPool.deposit('1', 0, { value: ONE_ETH });

        // const withdrawTx = await checkETHBalance(
        //     buyer002,
        //     buyer002.OpenSkyPool.withdraw('1', ONE_ETH),
        //     ONE_ETH
        // );

        let ethBalanceBeforeTx = await buyer001.getETHBalance();
        let withdrawTx = await buyer001.OpenSkyPool.withdraw('1', ONE_ETH);
        let gasCost = await getTxCost(withdrawTx);
        let ethBalanceAfterTx = await buyer001.getETHBalance();

        expect(almostEqual(ethBalanceAfterTx.sub(ethBalanceBeforeTx), ONE_ETH.sub(gasCost))).to.be.true;

        await checkEvent(withdrawTx, 'Withdraw', [1, buyer001.address, ONE_ETH]);

        // check total supply and money market balance
        expect(await OpenSkyOToken.totalSupply()).to.be.equal('0');
        expect(await OpenSkyOToken.balanceOf(buyer001.address)).to.be.equal('0');
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal('0');
    });

    it('user withdraw all', async function () {
        const { OpenSkyOToken, OpenSkyNFT, MoneyMarket, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: parseEther('1') }));
        expect(await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: parseEther('1') }));

        await nftStaker.OpenSkyPool.borrow(
            reserveId,
            parseEther('0.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        // check availableLiquidity
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal(parseEther('1.5'));

        await advanceTimeAndBlock(30 * 24 * 3600);

        await buyer001.OpenSkyPool.withdraw(reserveId, ethers.constants.MaxUint256);
        // const buyer001BalanceBeforeWithdraw = await OpenSkyOToken.balanceOf(buyer001.address);
        // await checkETHBalance(
        //     buyer001,
        //     buyer001.OpenSkyPool.withdraw(reserveId, ethers.constants.MaxUint256),
        //     buyer001BalanceBeforeWithdraw
        // );
        expect(almostEqual(await OpenSkyOToken.balanceOf(buyer001.address), BigNumber.from('0'))).to.be.true;
    });

    it('user withdraw eth if amount > availableLiquidity', async function () {
        const { OpenSkyOToken, OpenSkyNFT, MoneyMarket, buyer001, nftStaker } = await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: parseEther('1') }));

        await nftStaker.OpenSkyPool.borrow(
            reserveId,
            parseEther('0.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        // check availableLiquidity
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal(parseEther('0.5'));

        // withdraw fail if amount > availableLiquidity
        await expect(buyer001.OpenSkyPool.withdraw(reserveId, parseEther('0.501'))).to.revertedWith(
          Errors.WITHDRAW_LIQUIDITY_NOT_SUFFIENCE
        );

        await buyer001.OpenSkyPool.withdraw(reserveId, parseEther('0.5'));

        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal('0');
    });

    it('user deposit 1 eth and interest increases 0.01 eth', async function () {
        const { OpenSkyPool, OpenSkyOToken, buyer001, MoneyMarket } = await setupWithStakingNFT();

        await OpenSkyPool.setTreasuryFactor(1, 0);

        expect(await buyer001.OpenSkyPool.deposit('1', 0, { value: parseEther('1') }));

        // interest increases 0.01 eth
        await MoneyMarket.simulateInterestIncrease(OpenSkyOToken.address, { value: parseEther('0.01') });

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(parseEther('1.01'));
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal(parseEther('1.01'));

        // check user balance
        expect(await OpenSkyOToken.balanceOf(buyer001.address)).to.be.equal(parseEther('1.01'));

        // check user can withdraw
        expect(await buyer001.OpenSkyPool.withdraw('1', parseEther('1.01')));

        // check money market balance
        expect(await MoneyMarket.getBalance(OpenSkyOToken.address)).to.be.equal('0');
    });

    it('3 users deposit some eth and interest increases', async function () {
        function getInterestDeltaExceptTreasury(interestDelta: BigNumber) {
            return interestDelta.mul(parseEther('0.995')).div(parseEther('1'));
        }

        function caculateSupplyIndex(lastSupplyIndex: BigNumber, lastTotalSupply: BigNumber, interestDelta: BigNumber) {
            if (lastTotalSupply.eq(BigNumber.from(0))) {
                return parseUnits('1', 27);
            }
            const cumulateInterestRate = interestDelta.mul(parseUnits('1', 27)).div(lastTotalSupply);
            return lastSupplyIndex.mul(parseUnits('1', 27).add(cumulateInterestRate)).div(parseUnits('1', 27));
        }

        const { OpenSkySettings, OpenSkyPool, OpenSkyOToken, buyer001, buyer002, buyer003, MoneyMarket } =
            await setupWithStakingNFT();
        const treasuryAddress = await OpenSkySettings.treasuryAddress();
        {
            // user001 depoist 0.1eth
            const lastSupplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            const lastTotalSupply = await OpenSkyOToken.totalSupply();
            await buyer001.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') });

            // check interest increase and total supply
            const totalSupply = await OpenSkyOToken.totalSupply();
            const interestDeltaExceptTreasury = getInterestDeltaExceptTreasury(parseEther('0'));
            expect(totalSupply.toString()).to.be.equals(lastTotalSupply.add(parseEther('0.1')));

            // check index
            const supplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            expect(caculateSupplyIndex(lastSupplyIndex, lastTotalSupply, interestDeltaExceptTreasury)).to.be.equals(
                supplyIndex
            );

            expect(totalSupply).to.be.equal(await MoneyMarket.getBalance(OpenSkyOToken.address));

            // check rate
        }

        {
            const lastSupplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            const lastTotalSupply = await OpenSkyOToken.totalSupply();
            const buyer001LastBalance = await OpenSkyOToken.balanceOf(buyer001.address);

            // simulate interest increase
            await advanceTimeAndBlock(30 * 3600 * 24);
            const interestDelta = parseEther('0.01');
            await MoneyMarket.simulateInterestIncrease(OpenSkyOToken.address, { value: interestDelta });
            const interestDeltaExceptTreasury = getInterestDeltaExceptTreasury(interestDelta);

            // check money market
            expect((await MoneyMarket.getBalance(OpenSkyOToken.address)).toString()).to.be.equals(
                lastTotalSupply.add(interestDelta).toString()
            );

            expect((await OpenSkyOToken.balanceOf(buyer001.address)).toString()).to.be.equals(
                parseEther('0.1').add(interestDeltaExceptTreasury).toString()
            );

            // user002 depoist 0.1eth after 30 days
            await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') });

            expect(almostEqual(await OpenSkyOToken.totalSupply(), await MoneyMarket.getBalance(OpenSkyOToken.address)))
                .to.be.true;

            // check buyer001 balance
            expect((await OpenSkyOToken.balanceOf(buyer001.address)).toString()).to.be.equals(
                buyer001LastBalance.add(interestDeltaExceptTreasury).toString()
            );

            // check interest increase, check totalsupply
            const totalSupply = await OpenSkyOToken.totalSupply();
            expect(totalSupply.toString()).to.be.equals(interestDelta.add(lastTotalSupply).add(parseEther('0.1')));

            // check index
            const supplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            expect(caculateSupplyIndex(lastSupplyIndex, lastTotalSupply, interestDeltaExceptTreasury)).to.be.equals(
                supplyIndex
            );

            expect(totalSupply).to.be.equal(await MoneyMarket.getBalance(OpenSkyOToken.address));

            const treasuryShareOfInterest = interestDelta.mul(50).div(10000);
            expect(almostEqual(await OpenSkyOToken.balanceOf(treasuryAddress), treasuryShareOfInterest)).to.be.true;

            // check rate
        }

        {
            const lastSupplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            const lastTotalSupply = await OpenSkyOToken.totalSupply();
            const buyer001LastBalance = await OpenSkyOToken.balanceOf(buyer001.address);
            const buyer002LastBalance = await OpenSkyOToken.balanceOf(buyer002.address);
            const treasuryLastBalance = await OpenSkyOToken.balanceOf(treasuryAddress);

            // simulate interest increase
            await advanceTimeAndBlock(30 * 3600 * 24);
            const interestDelta = parseEther('0.015');
            await MoneyMarket.simulateInterestIncrease(OpenSkyOToken.address, { value: interestDelta });

            const interestDeltaExceptTreasury = getInterestDeltaExceptTreasury(interestDelta);

            expect((await MoneyMarket.getBalance(OpenSkyOToken.address)).toString()).to.be.equals(
                lastTotalSupply.add(interestDelta).toString()
            );

            // check buyer001 balance
            expect((await OpenSkyOToken.balanceOf(buyer001.address)).toString()).to.be.equals(
                buyer001LastBalance
                    .add(interestDeltaExceptTreasury.mul(buyer001LastBalance).div(lastTotalSupply))
                    .toString()
            );

            // check buyer002 balance
            expect(
                almostEqual(
                    await OpenSkyOToken.balanceOf(buyer002.address),
                    buyer002LastBalance.add(interestDeltaExceptTreasury.mul(buyer002LastBalance).div(lastTotalSupply))
                )
            ).to.be.true;

            // check treasury balance
            expect(
                almostEqual(
                    await OpenSkyOToken.balanceOf(treasuryAddress),
                    treasuryLastBalance.add(interestDeltaExceptTreasury.mul(treasuryLastBalance).div(lastTotalSupply))
                )
            ).to.be.true;

            // check index
            const supplyIndex = await OpenSkyPool.getReserveNormalizedIncome(1);
            // expect(caculateSupplyIndex(lastSupplyIndex, lastTotalSupply, interestDeltaExceptTreasury)).to.be.equals(supplyIndex);

            // user003 depoist 0.2eth after 30 days
            await buyer003.OpenSkyPool.deposit(1, 0, { value: parseEther('0.2') });

            expect(almostEqual(await OpenSkyOToken.totalSupply(), await MoneyMarket.getBalance(OpenSkyOToken.address)))
                .to.be.true;

            // check treasury balance
            expect(
                almostEqual(
                    await OpenSkyOToken.balanceOf(treasuryAddress),
                    interestDelta
                        .mul(50)
                        .div(10000)
                        .add(treasuryLastBalance)
                        .add(interestDeltaExceptTreasury.mul(treasuryLastBalance).div(lastTotalSupply))
                )
            ).to.be.true;
        }
    });
});
