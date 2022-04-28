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

import { setupWithStakingNFT, __setup, checkPoolEquation } from './__setup';
import { RAY, ONE_YEAR } from '../helpers/constants';
import { rayMul } from '../helpers/ray-math';

describe('reserve logic', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    async function setup() {
        const ENV = await setupWithStakingNFT();
        const { OpenSkySettings } = ENV;

        const reserveFactor = await OpenSkySettings.reserveFactor();
        const reserveId = 1;

        return { reserveFactor, reserveId, ...ENV };
    }

    async function setupWithInitialize() {
        const ENV = await setup();
        const { buyer001, buyer002, buyer003, reserveId } = ENV;

        // initialize reserve
        await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: parseEther(Math.random() * 100 + '') });
        await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: parseEther(Math.random() * 100 + '') });
        await buyer003.OpenSkyPool.deposit(reserveId, 0, { value: parseEther(Math.random() * 100 + '') });

        return ENV;
    }

    it('check money market balance', async function () {
        const { OpenSkyPool, reserveId } = await setupWithInitialize();

        // simulate money market income
        const moneyMarketIncome = parseEther('0.7654964');
        await OpenSkyPool.updateMoneyMarketIncome(reserveId, { value: moneyMarketIncome });

        expect(await OpenSkyPool.getMoneyMarketDelta(reserveId)).to.be.equal(moneyMarketIncome);
    });

    it('check borrow interest', async function () {
        const { OpenSkyPool, reserveId } = await setupWithInitialize();

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
        const { OpenSkyPool, OpenSkyOToken, reserveId, reserveFactor } = await setupWithInitialize();

        const additionalIncome = parseEther(Math.random() * 10 + '');
        const moneyMarketIncome = parseEther(Math.random() * 10 + '');

        // simulate money market income
        await OpenSkyPool.updateMoneyMarketIncome(reserveId, { value: moneyMarketIncome });

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

    it('calculate income if scaledTotalSupply == 0', async function () {
        const { OpenSkyPool, OpenSkyOToken, reserveId } = await setup();

        const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();
        expect(scaledTotalSupply.eq(BigNumber.from(0))).to.be.true;

        expect((await OpenSkyPool.calculateIncome(reserveId, 0))[0]).to.be.equal(
            (await OpenSkyPool.getReserveData(reserveId)).lastSupplyIndex
        );
    });

    // TODO check
    it('check supply index', async function () {
        async function checkSupplyIndex(tx: any, moneyMarketIncome: BigNumber) {
            const lastReserve = await OpenSkyPool.getReserveData(reserveId);
            const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();
            console.log('lastReserve.lastUpdateTimestamp', lastReserve.lastUpdateTimestamp);
            console.log('lastReserve.lastSupplyIndex', lastReserve.lastSupplyIndex.toString());

            await OpenSkyPool.updateMoneyMarketIncome(reserveId, { value: moneyMarketIncome });
            await advanceTimeAndBlock(Math.ceil(Math.random()) * (30 * 24 * 3600));
            console.log('block.timestamp', (await getCurrentBlockAndTimestamp()).timestamp);

            await (await tx).wait();

            const reserve = await OpenSkyPool.getReserveData(reserveId);
            console.log('reserve.lastUpdateTimestamp', reserve.lastUpdateTimestamp);
            // check index
            console.log('reserve.lastSupplyIndex', reserve.lastSupplyIndex.toString());
            // expect(reserve.lastSupplyIndex).to.be.equal(
            //     moneyMarketIncome.mul(RAY).div(scaledTotalSupply).add(lastReserve.lastSupplyIndex)
            // );
        }

        const {
            OpenSkyPool,
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkyOToken,
            reserveId,
            reserveFactor,
            nftStaker,
            buyer001,
            buyer002,
            buyer003,
            buyer004,
        } = await setupWithInitialize();
        const lenders = [nftStaker, buyer001, buyer002, buyer003, buyer004];
        const borrowers = [nftStaker, buyer001, buyer002];

        for (let i = 0; i < 200; i++) {
            let user = lenders[Math.floor(Math.random() * lenders.length)];
            const userBalance = await user.getETHBalance();
            const randomBalance = parseEther((parseFloat(formatEther(userBalance)) * Math.random()).toFixed(10));
            if (userBalance.lt(randomBalance.add(parseEther('0.1')))) {
                continue;
            }
            const moneyMarketIncome = parseEther(Math.random() + '');

            const lastReserve = await OpenSkyPool.getReserveData(reserveId);
            const scaledTotalSupply = await OpenSkyOToken.scaledTotalSupply();

            await OpenSkyPool.updateMoneyMarketIncome(reserveId, { value: moneyMarketIncome });
            await advanceTimeAndBlock(Math.ceil(Math.random()) * (30 * 24 * 3600));

            await user.OpenSkyPool.deposit(reserveId, 0, { value: randomBalance });

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

    it('check total borrows and borrow interest per second', async function () {
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
        }

        async function repay(user: any, tokenId: number) {
            const loanId = await OpenSkyLoan.getLoanId(user.OpenSkyNFT.address, tokenId);
            const lastReserve = await OpenSkyPool.getReserveData(reserveId);

            const borrowBalance = await OpenSkyLoan.getBorrowBalance(loanId);
            const penalty = await OpenSkyLoan.getPenalty(loanId);

            await user.OpenSkyPool.repay(loanId, { value: borrowBalance.add(penalty).add(parseEther('0.1')) });

            const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;

            const currentReserve = await OpenSkyPool.getReserveData(reserveId);
            expect(currentReserve.totalBorrows).to.be.equal(
                lastReserve.totalBorrows
                    .add(
                        lastReserve.borrowingInterestPerSecond.mul(timestamp - lastReserve.lastUpdateTimestamp).div(RAY)
                    )
                    .sub(await OpenSkyLoan.getBorrowBalance(loanId))
            );
            expect(currentReserve.borrowingInterestPerSecond).to.be.equal(
                lastReserve.borrowingInterestPerSecond.sub((await OpenSkyLoan.getLoanData(loanId)).interestPerSecond)
            );
        }

        const { OpenSkyPool, OpenSkyLoan, OpenSkyNFT, reserveId, nftStaker, buyer001, buyer002 } =
            await setupWithInitialize();

        await borrow(nftStaker, 1);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await borrow(buyer002, 3);

        await repay(buyer001, 2);

        await advanceTimeAndBlock(Math.ceil(Math.random()) * ONE_YEAR);
        await repay(buyer002, 3);
    });
});
