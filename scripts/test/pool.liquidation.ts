import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    getTxCost,
    getCurrentBlockAndTimestamp,
    almostEqual,
    getETHBalance,
} from '../helpers/utils';
import _ from 'lodash';

import { setupWithStakingNFT, __setup, checkPoolEquation } from './__setup';
import { Errors, LOAN_STATUS, ONE_YEAR } from "../helpers/constants"

async function setup(env: any) {
    const { buyer001, buyer002, nftStaker, OpenSkyNFT } = env;

    const ONE_ETH = parseEther('1');
    await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });
    await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });

    await nftStaker.OpenSkyPool.borrow(1, parseEther('1.5'), ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address);
}

describe('pool liquidation', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('start liquidation successfully', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, OpenSkyLoan, OpenSkyNFT, ACLManager, deployer } = ENV;

        const borrowingInterestPerSecond = (await OpenSkyPool.getReserveData(1)).borrowingInterestPerSecond;

        await ACLManager.addLiquidator(deployer.address);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        const loanId = 1;
        await OpenSkyPool.startLiquidation(loanId);
        const liquidateTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        // check reserve.borrowingInterestPerSecond
        expect(borrowingInterestPerSecond.sub(loan.interestPerSecond)).to.be.equal(
            (await OpenSkyPool.getReserveData(1)).borrowingInterestPerSecond
        );

        // check nft owner
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(deployer.address);

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
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool } = ENV;

        const loanId = 1;
        await expect(OpenSkyPool.startLiquidation(loanId)).to.revertedWith(Errors.ACL_ONLY_LIQUIDATOR_CAN_CALL);
    });

    it('start liquidation fail if loan.status != LIQUIDATABLE', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, ACLManager, deployer } = ENV;

        await ACLManager.addLiquidator(deployer.address);

        const loanId = 1;
        await expect(OpenSkyPool.startLiquidation(loanId)).to.revertedWith(Errors.START_LIQUIDATION_STATUS_ERROR);
    });

    it('end liquidation successfully', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, OpenSkyLoan, ACLManager, deployer } = ENV;

        await ACLManager.addLiquidator(deployer.address);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        const loanId = 1;
        await OpenSkyPool.startLiquidation(loanId);

        const ETHBalanceBeforeTx = await deployer.getETHBalance();
        const borrowBalance = await OpenSkyLoan.getBorrowBalance(loanId);
        const tx = await OpenSkyPool.endLiquidation(loanId, { value: borrowBalance });
        const gasCost = await getTxCost(tx);
        const ETHBalanceAfterTx = await deployer.getETHBalance();

        // check ETH balance
        expect(
            almostEqual(
                ETHBalanceBeforeTx.sub(ETHBalanceAfterTx),
                borrowBalance.add(gasCost)
            )
        ).to.be.true;

        // TODO, check totalDeposits
        // TODO, check totalBorrows
    });

    it('end liquidation fail if caller is not liquidator', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, ACLManager, deployer } = ENV;

        await ACLManager.addLiquidator(deployer.address);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        const loanId = 1;
        await OpenSkyPool.startLiquidation(loanId);

        await ACLManager.removeLiquidator(deployer.address);

        await expect(OpenSkyPool.endLiquidation(loanId, { value: parseEther('2') })).to.be.revertedWith(
          Errors.ACL_ONLY_LIQUIDATOR_CAN_CALL
        );
    });

    it('end liquidation fail if loan.status != LIQUIDATING', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, ACLManager, deployer } = ENV;

        await ACLManager.addLiquidator(deployer.address);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        const loanId = 1;
        await expect(OpenSkyPool.endLiquidation(loanId, { value: parseEther('2') })).to.be.revertedWith(
          Errors.END_LIQUIDATION_STATUS_ERROR
        );
    });

    it('end liquidation fail if msg.value < borrowBalance', async function () {
        const ENV = await setupWithStakingNFT();
        await setup(ENV);

        const { OpenSkyPool, ACLManager, deployer } = ENV;

        await ACLManager.addLiquidator(deployer.address);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        const loanId = 1;
        await OpenSkyPool.startLiquidation(loanId);

        await expect(OpenSkyPool.endLiquidation(loanId, { value: parseEther('1.52') })).to.be.revertedWith(
          Errors.END_LIQUIDATION_AMOUNT_ERROR
        );
    });
});
