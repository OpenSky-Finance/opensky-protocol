import { parseEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    getTxCost,
    getCurrentBlockAndTimestamp,
    almostEqual,
    getETHBalance,
} from '../helpers/utils';
import _ from 'lodash';

import { __setup, checkPoolEquation, deposit, checkTotalDeposits } from './__setup';
import { Errors, LOAN_STATUS, ONE_ETH, ONE_YEAR } from "../helpers/constants"

describe('pool liquidation', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkySettings, liquidator, user001, user002, borrower, OpenSkyNFT } = ENV;

        await OpenSkySettings.addLiquidator(liquidator.address);
        await deposit(user001, 1, ONE_ETH);
        await deposit(user002, 1, ONE_ETH);

        await borrower.OpenSkyPool.borrow(1, parseEther('1.5'), ONE_YEAR, OpenSkyNFT.address, 1, borrower.address);
        ENV.loanId = 1;
    });

    afterEach(async () => {
        await checkPoolEquation();
        // await checkTotalDeposits(ENV);
    });

    it('start liquidation successfully', async function () {
        const { OpenSkyPool, OpenSkyLoan, OpenSkyNFT, liquidator, loanId } = ENV;

        const borrowingInterestPerSecond = (await OpenSkyPool.getReserveData(1)).borrowingInterestPerSecond;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await liquidator.OpenSkyPool.startLiquidation(loanId);
        const liquidateTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        // check reserve.borrowingInterestPerSecond
        expect(borrowingInterestPerSecond.sub(loan.interestPerSecond)).to.be.equal(
            (await OpenSkyPool.getReserveData(1)).borrowingInterestPerSecond
        );

        // check nft owner
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(liquidator.address);

        // check loan state
        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.LIQUIDATING);
        expect(loan.borrowEnd).to.be.equal(liquidateTime);

        const borrowBalance = await OpenSkyLoan.getBorrowBalance(loanId);

        // pass 20 days
        await advanceTimeAndBlock(20 * 24 * 3600);

        // check interest increasing is stopped
        expect(await OpenSkyLoan.getBorrowBalance(loanId)).to.be.equal(borrowBalance);
    });

    it('start liquidation fail if caller is not liquidator', async function () {
        const { OpenSkyPool, loanId } = ENV;

        await expect(OpenSkyPool.startLiquidation(loanId)).to.revertedWith(Errors.ACL_ONLY_LIQUIDATOR_CAN_CALL);
    });

    it('start liquidation fail if loan.status != LIQUIDATABLE', async function () {
        const { liquidator, loanId } = ENV;

        await expect(liquidator.OpenSkyPool.startLiquidation(loanId)).to.revertedWith(Errors.START_LIQUIDATION_STATUS_ERROR);
    });

    it('end liquidation successfully', async function () {
        const { OpenSkyPool, UnderlyingAsset, liquidator, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await liquidator.OpenSkyPool.startLiquidation(loanId);

        const liquidationAmount = parseEther('2');
        await liquidator.UnderlyingAsset.deposit({ value: liquidationAmount });
        await liquidator.UnderlyingAsset.approve(OpenSkyPool.address, liquidationAmount);

        const balanceBeforeTx = await UnderlyingAsset.balanceOf(liquidator.address);
        const tx = await liquidator.OpenSkyPool.endLiquidation(loanId, liquidationAmount);
        const balanceAfterTx = await UnderlyingAsset.balanceOf(liquidator.address);

        // check ETH balance
        expect(balanceBeforeTx.sub(balanceAfterTx)).to.be.equal(liquidationAmount);
    });

    it('end liquidation fail if caller is not liquidator', async function () {
        const { OpenSkyPool, OpenSkySettings, liquidator, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await liquidator.OpenSkyPool.startLiquidation(loanId);

        await OpenSkySettings.removeLiquidator(liquidator.address);

        await expect(liquidator.OpenSkyPool.endLiquidation(loanId, parseEther('2'))).to.be.revertedWith(
            Errors.ACL_ONLY_LIQUIDATOR_CAN_CALL
        );
    });

    it('end liquidation fail if loan.status != LIQUIDATING', async function () {
        const { OpenSkyPool, liquidator, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await expect(liquidator.OpenSkyPool.endLiquidation(loanId, parseEther('2'))).to.be.revertedWith(
            Errors.END_LIQUIDATION_STATUS_ERROR
        );
    });

    it('end liquidation fail if amount < borrowBalance', async function () {
        const { liquidator, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await liquidator.OpenSkyPool.startLiquidation(loanId);

        await expect(liquidator.OpenSkyPool.endLiquidation(loanId, parseEther('1.52'))).to.be.revertedWith(
            Errors.END_LIQUIDATION_AMOUNT_ERROR
        );
    });

    it('end liquidation fail if amount >= borrowBalance and allowance < borrowBalance ', async function () {
        const { liquidator, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        await liquidator.OpenSkyPool.startLiquidation(loanId);

        await expect(liquidator.OpenSkyPool.endLiquidation(loanId, parseEther('2'))).to.be.revertedWith(
            'SafeERC20: low-level call failed'
        );
    });
});
