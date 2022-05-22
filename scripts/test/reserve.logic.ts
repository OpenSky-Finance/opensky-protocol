import { parseEther, formatEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    getCurrentBlockAndTimestamp,
} from '../helpers/utils';

import { __setup, checkPoolEquation } from './__setup';
import { RAY, ONE_YEAR } from '../helpers/constants';

describe('reserve logic', function () {
    let ENV: any;

    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyPool, OpenSkySettings, user001, user002, user003 } = ENV;

        const reserveFactor = await OpenSkySettings.reserveFactor();
        const reserveId = 1;

        const amount1 = parseEther(Math.random() * 100 + '');
        const amount2 = parseEther(Math.random() * 100 + '');
        const amount3 = parseEther(Math.random() * 100 + '');

        await user001.WNative.deposit({ value: amount1 });
        await user002.WNative.deposit({ value: amount2 });
        await user003.WNative.deposit({ value: amount3 });

        await user001.WNative.approve(OpenSkyPool.address, amount1);
        await user002.WNative.approve(OpenSkyPool.address, amount2);
        await user003.WNative.approve(OpenSkyPool.address, amount3);

        // initialize reserve
        await user001.OpenSkyPool.deposit(reserveId, amount1, user001.address, 0);
        await user002.OpenSkyPool.deposit(reserveId, amount2, user002.address, 0);
        await user003.OpenSkyPool.deposit(reserveId, amount3, user003.address, 0);

        ENV.reserveId = reserveId;
        ENV.reserveFactor = reserveFactor;
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('check money market balance', async function () {
        const { OpenSkyPool, AAVE_POOL, UnderlyingAsset, OpenSkyOToken, reserveId } = ENV;

        // simulate money market income
        const moneyMarketIncome = parseEther('0.7654964');
        await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, moneyMarketIncome);

        expect(await OpenSkyPool.getMoneyMarketDelta(reserveId)).to.be.equal(moneyMarketIncome);
    });

    it('check borrow interest', async function () {
        const { OpenSkyPool, reserveId } = ENV;

        // add interest per second
        const interestToAdd = parseUnits('0.000034132', 27);
        await OpenSkyPool.updateInterestPerSecond(reserveId, parseUnits('0.000034132', 27), 0);
        expect((await OpenSkyPool.getReserveData(reserveId)).borrowingInterestPerSecond).to.be.equal(interestToAdd);

        // remove interest per second
        const interestToRemove = parseUnits('0.000013823', 27);
        await OpenSkyPool.updateInterestPerSecond(reserveId, 0, parseUnits('0.000013823', 27));
        const currentInterest = interestToAdd.sub(interestToRemove);
        expect((await OpenSkyPool.getReserveData(reserveId)).borrowingInterestPerSecond).to.be.equal(currentInterest);

        const lastUpdateTimestamp = (await OpenSkyPool.getReserveData(reserveId)).lastUpdateTimestamp;

        await advanceTimeAndBlock(30 * 24 * 3600);
        const now = (await getCurrentBlockAndTimestamp()).timestamp;
        const result = await OpenSkyPool.calculateIncome(reserveId, 0);
        const borrowingInterestDelta = currentInterest.mul(now - lastUpdateTimestamp);
        expect(borrowingInterestDelta).to.be.equal(await OpenSkyPool.getBorrowingInterestDelta(reserveId));
        expect(borrowingInterestDelta).to.be.equal(result[1].add(result[2]));
        expect(borrowingInterestDelta).to.be.equal(result[3]);
    });

    it('calculate income if scaledTotalSupply > 0', async function () {
        const { OpenSkyPool, OpenSkyOToken, AAVE_POOL, UnderlyingAsset, reserveId, reserveFactor } = ENV;

        const additionalIncome = parseEther(Math.random() * 10 + '');
        const moneyMarketIncome = parseEther(Math.random() * 10 + '');

        // simulate money market income
        await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, moneyMarketIncome);

        const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();
        expect(scaledTotalSupply.gt(0)).to.be.true;
        const reserve = await OpenSkyPool.getReserveData(reserveId);
        const result = await OpenSkyPool.calculateIncome(reserveId, additionalIncome);
        const totalIncome = additionalIncome.add(moneyMarketIncome).mul(RAY);
        const treasuryIncome = totalIncome.mul(reserveFactor).add(5000).div(10000);
        const userIncome = totalIncome.sub(treasuryIncome);

        // check index
        expect(result[0]).to.be.equal(userIncome.div(scaledTotalSupply).add(reserve.lastSupplyIndex));
        // check users income
        expect(result[1]).to.be.equal(userIncome);
        // check treasury income
        expect(result[2]).to.be.equal(treasuryIncome);
        // check money market income
        expect(result[4]).to.be.equal(moneyMarketIncome.mul(RAY));
    });

    // it('calculate income if scaledTotalSupply == 0', async function () {
    //     const { OpenSkyPool, OpenSkyOToken, reserveId } = ENV;

    //     const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();
    //     expect(scaledTotalSupply.eq(BigNumber.from(0))).to.be.true;

    //     expect((await OpenSkyPool.calculateIncome(reserveId, 0))[0]).to.be.equal(
    //         (await OpenSkyPool.getReserveData(reserveId)).lastSupplyIndex
    //     );
    // });

    // TODO check
    it('check supply index', async function () {
        const {
            OpenSkyPool,
            AAVE_POOL,
            UnderlyingAsset,
            OpenSkyOToken,
            reserveId,
            reserveFactor,
            nftStaker,
            buyer001,
            buyer002,
            buyer003,
            buyer004,
        } = ENV;

        const lenders = [nftStaker, buyer001, buyer002, buyer003, buyer004];
        const borrowers = [nftStaker, buyer001, buyer002];

        for (let i = 0; i < 1; i++) {
            let user = lenders[Math.floor(Math.random() * lenders.length)];
            const userBalance = await user.getETHBalance();
            const randomBalance = parseEther((parseFloat(formatEther(userBalance)) * Math.random()).toFixed(10));
            if (userBalance.lt(randomBalance.add(parseEther('0.1')))) {
                continue;
            }
            const moneyMarketIncome = parseEther(Math.random() + '');

            const lastReserve = await OpenSkyPool.getReserveData(reserveId);
            const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();

            await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, moneyMarketIncome);
            // await OpenSkyPool.updateMoneyMarketIncome(reserveId, { value: moneyMarketIncome });
            await advanceTimeAndBlock(Math.ceil(Math.random()) * (30 * 24 * 3600));

            await user.UnderlyingAsset.deposit({ value: randomBalance });
            await user.UnderlyingAsset.approve(user.OpenSkyPool.address, randomBalance);
            await user.OpenSkyPool.deposit(reserveId, randomBalance, user.address, 0);

            const reserve = await OpenSkyPool.getReserveData(reserveId);
            expect(reserve.lastSupplyIndex).to.be.equal(
                moneyMarketIncome
                    .mul(RAY)
                    .sub(moneyMarketIncome.mul(RAY).mul(reserveFactor).add(5000).div(10000))
                    .div(scaledTotalSupply)
                    .add(lastReserve.lastSupplyIndex)
            );
        }
    });

    it.only('check total borrows and borrow interest per second', async function () {
        async function borrow(user: any, tokenId: number) {
            const lastReserve = await OpenSkyPool.getReserveData(reserveId);
            const borrowAmount = parseEther(Math.ceil(Math.random() * 10) + '');

            await user.OpenSkyPool.borrow(1, borrowAmount, ONE_YEAR, OpenSkyNFT.address, tokenId, user.address);

            const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;

            const currentReserve = await OpenSkyPool.getReserveData(reserveId);
            expect(currentReserve.totalBorrows).to.be.equal(
                lastReserve.totalBorrows
                    .add(
                        lastReserve.borrowingInterestPerSecond.mul(timestamp - lastReserve.lastUpdateTimestamp).div(RAY)
                    )
                    .add(borrowAmount)
            );
            const loanId = await OpenSkyLoan.getLoanId(user.OpenSkyNFT.address, tokenId);
            expect(currentReserve.borrowingInterestPerSecond).to.be.equal(
                lastReserve.borrowingInterestPerSecond.add((await OpenSkyLoan.getLoanData(loanId)).interestPerSecond)
            );

            console.log('user', user.address ,'eth balance', (await user.getETHBalance()).toString());
            await user.UnderlyingAsset.withdraw(borrowAmount);
            console.log('user', user.address ,'eth balance', (await user.getETHBalance()).toString());
        }

        async function repay(user: any, tokenId: number) {
            const loanId = await OpenSkyLoan.getLoanId(user.OpenSkyNFT.address, tokenId);
            const lastReserve = await OpenSkyPool.getReserveData(reserveId);

            const borrowBalance = await OpenSkyLoan.getBorrowBalance(loanId);
            const penalty = await OpenSkyLoan.getPenalty(loanId);

            const amount = borrowBalance.add(penalty).add(parseEther('0.1'));
            await user.UnderlyingAsset.deposit({ value: amount });
            await user.UnderlyingAsset.approve(user.OpenSkyPool.address, amount);
            await user.OpenSkyPool.repay(loanId);

            const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;

            const currentReserve = await OpenSkyPool.getReserveData(reserveId);
            expect(currentReserve.totalBorrows).to.be.equal(
                lastReserve.totalBorrows
                    .add(
                        lastReserve.borrowingInterestPerSecond.mul(timestamp - lastReserve.lastUpdateTimestamp).div(RAY)
                    )
                    .sub(borrowBalance)
            );
            expect(currentReserve.borrowingInterestPerSecond).to.be.equal(
                lastReserve.borrowingInterestPerSecond.sub((await OpenSkyLoan.getLoanData(loanId)).interestPerSecond)
            );
        }

        const { OpenSkyPool, OpenSkyLoan, OpenSkyNFT, reserveId, nftStaker, buyer001, buyer002 } =
            ENV;

        for (let i = 0; i < 100; i++) {
        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(nftStaker, 1);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer001, 2);
        await repay(nftStaker, 1);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer002, 3);

        await repay(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await repay(buyer002, 3);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer002, 3);

        await repay(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await repay(buyer002, 3);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await repay(buyer001, 2);
            console.log('i =', i);
        }
        await printInfo();
    });

    async function printInfo() {
        const { OpenSkyDataProvider } = ENV;
        const { availableLiquidity, totalBorrowsBalance, TVL } = await OpenSkyDataProvider.getReserveData(1);
        console.log('availableLiquidity.add(totalBorrowsBalance)', availableLiquidity.add(totalBorrowsBalance).toString());
        console.log('TVL', TVL.toString());
    }
});
