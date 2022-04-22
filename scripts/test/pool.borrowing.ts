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
import { Errors } from '../helpers/constants';

import { setupWithStakingNFT, __setup, checkPoolEquation, formatEtherAttrs, formatObjNumbers } from './__setup';

const ONE_ETH = parseEther('1');

const ONE_YEAR = 365 * 24 * 3600;

const LOAN_STATUS = ['BORROWING', 'EXTENDABLE', 'OVERDUE', 'LIQUIDATABLE', 'LIQUIDATING', 'END'];

async function checkTotalDeposits(env: any) {
    const { OpenSkyPool, MoneyMarket, OpenSkyOToken } = env;
    const reserve = await OpenSkyPool.getReserveData('1');
    const availableLiquidity = await MoneyMarket.getBalance(OpenSkyOToken.address);
    expect(almostEqual(await OpenSkyOToken.totalSupply(), availableLiquidity.add(reserve.totalBorrows))).to.be.true;
}

describe('borrow and repay', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('nft staker borrow 1.5 ETH', async function () {
        const { OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        let stakerETHBalanceBeforeBorrow = await nftStaker.getETHBalance();
        let amount = parseEther('1.5');
        let tx = await nftStaker.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            ONE_YEAR,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        let gasCost = await getTxCost(tx);
        let stakerETHBalanceAfterBorrow = await nftStaker.getETHBalance();

        // check staker ETH Balance
        expect(stakerETHBalanceBeforeBorrow.add(amount).sub(gasCost)).to.be.equal(stakerETHBalanceAfterBorrow);

        // check nft owner
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(nftStaker.address);

        // check loan
        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.nftAddress).to.be.equal(OpenSkyNFT.address);
        expect(loan.tokenId).to.be.equal(1);
        expect(loan.borrower).to.be.equal(nftStaker.address);
        expect(loan.amount).to.be.equal(parseEther('1.5'));
        expect(loan.borrowDuration).to.be.equal(365 * 24 * 3600);
        expect(LOAN_STATUS[loan.status]).to.be.equal('BORROWING');

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow max eth if borrowLimit < availableLiquidity', async function () {
        const { OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH.mul(20) }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH.mul(30) }));

        const availableLiquidity = await MoneyMarket.getBalance(OpenSkyOToken.address);
        const borrowLimit = await OpenSkyPool.getBorrowLimitByOracle(1, OpenSkyNFT.address, 1);
        expect(availableLiquidity.gt(borrowLimit)).to.be.true;

        await expect(
            nftStaker.OpenSkyPool.borrow(1, availableLiquidity, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        ).to.revertedWith(Errors.BORROW_AMOUNT_EXCEED_BORROW_LIMIT);

        expect(await nftStaker.OpenSkyPool.borrow(1, borrowLimit, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address));

        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow max eth if borrowLimit > availableLiquidity', async function () {
        const { OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH.mul(2) }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH.mul(3) }));

        const availableLiquidity = await MoneyMarket.getBalance(OpenSkyOToken.address);
        const borrowLimit = await OpenSkyPool.getBorrowLimitByOracle(1, OpenSkyNFT.address, 1);
        expect(availableLiquidity.lt(borrowLimit)).to.be.true;

        await expect(
            nftStaker.OpenSkyPool.borrow(1, borrowLimit, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        ).to.revertedWith(Errors.RESERVE_LIQUIDITY_INSUFFICIENT);

        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                availableLiquidity,
                ONE_YEAR,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );

        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and repay with penalty if loan.status == BORROWING', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, MoneyMarket, OpenSkyLoan, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            reserveId,
            amount,
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanId = 1;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        const ONE_MONTH = 30 * 24 * 3600;
        await advanceTimeAndBlock(ONE_MONTH);
        const penalty = await OpenSkyLoan.getPenalty(loanId);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('BORROWING');

        // await expect(nftStaker.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, nftStaker.address, 1, parseEther('1.5'), 0);
        let borrowerETHBalanceBeforeRepay = await nftStaker.getETHBalance();
        let repayTx = await nftStaker.OpenSkyPool.repay(loanId, { value: parseEther('1.55') });
        let gasCost = await getTxCost(repayTx);
        let borrowerETHBalanceAfterRepay = await nftStaker.getETHBalance();
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        const loanAfterRepay = await OpenSkyLoan.getLoanData(1);
        expect(LOAN_STATUS[loanAfterRepay.status]).to.be.equal('END');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);

        // check totalDeposits = totalBorrows + availableLiquidity
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and repay with no penalty if loan.status == EXTENDABLE', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            reserveId,
            amount,
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanId = 1;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        await advanceTimeAndBlock(363 * 24 * 3600);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('EXTENDABLE');

        // await expect(nftStaker.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, nftStaker.address, 1, parseEther('1.5'), 0);
        let borrowerETHBalanceBeforeRepay = await nftStaker.getETHBalance();
        let repayTx = await nftStaker.OpenSkyPool.repay(loanId, { value: parseEther('1.85') });
        let gasCost = await getTxCost(repayTx);
        let borrowerETHBalanceAfterRepay = await nftStaker.getETHBalance();
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost)
            )
        ).to.be.true;

        const loanAfterRepay = await OpenSkyLoan.getLoanData(1);
        expect(LOAN_STATUS[loanAfterRepay.status]).to.be.equal('END');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and repay with penalty if loan.status == OVERDUE', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            reserveId,
            amount,
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanId = 1;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        await advanceTimeAndBlock(365 * 24 * 3600 + 60);
        const penalty = await OpenSkyLoan.getPenalty(loanId);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('OVERDUE');

        // await expect(nftStaker.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, nftStaker.address, 1, parseEther('1.5'), 0);
        let borrowerETHBalanceBeforeRepay = await nftStaker.getETHBalance();
        let repayTx = await nftStaker.OpenSkyPool.repay(loanId, { value: parseEther('1.85') });
        let gasCost = await getTxCost(repayTx);
        let borrowerETHBalanceAfterRepay = await nftStaker.getETHBalance();
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        const loanAfterRepay = await OpenSkyLoan.getLoanData(1);
        expect(LOAN_STATUS[loanAfterRepay.status]).to.be.equal('END');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and repay fail if loan.status == LIQUIDATABLE', async function () {
        const {
            OpenSkyNFT,
            OpenSkyPool,
            OpenSkyLoan,
            OpenSkyDataProvider,
            MoneyMarket,
            OpenSkyOToken,
            buyer001,
            buyer002,
            nftStaker,
        } = await setupWithStakingNFT();

        const reserveId = 1;
        expect(await buyer001.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(reserveId, 0, { value: ONE_ETH }));

        const amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(reserveId, amount, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address);
        const loanId = 1;

        const INFO: any = {};
        INFO.totalBorrowBalance_0 = await OpenSkyDataProvider.getReserveData(1);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        INFO.totalBorrowBalance_1 = await OpenSkyDataProvider.getReserveData(1);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('LIQUIDATABLE');
        
        await expect(nftStaker.OpenSkyPool.repay(loanId, { value: parseEther('1.85') })).to.revertedWith(
            Errors.REPAY_STATUS_ERROR
        );
    });

    it('nft staker borrow 1.5 ETH and repay by others', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                parseEther('1.5'),
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );

        expect(await buyer001.OpenSkyPool.repay(1, { value: parseEther('1.55') }));

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(LOAN_STATUS[loan.status]).to.be.equal('END');
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and transfer loan to others', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                parseEther('1.5'),
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );

        expect(
            await nftStaker.OpenSkyLoan['safeTransferFrom(address,address,uint256)'](
                nftStaker.address,
                buyer001.address,
                1
            )
        );

        expect(await buyer001.OpenSkyPool.repay(1, { value: parseEther('1.55') }));

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(LOAN_STATUS[loan.status]).to.be.equal('END');
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(buyer001.address);
    });

    it('nft staker borrow max', async function () {
        const { OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        let stakerETHBalanceBeforeBorrow = await nftStaker.getETHBalance();
        let amount = parseEther('1.5');
        let tx = await nftStaker.OpenSkyPool.borrow(
            1,
            ethers.constants.MaxUint256,
            ONE_YEAR,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        let gasCost = await getTxCost(tx);
        let stakerETHBalanceAfterBorrow = await nftStaker.getETHBalance();

        // TODO compare with getBorrowLimitByOracle
        const BORROW_MAX = await OpenSkyOToken.totalSupply();

        // check staker ETH Balance
        expect(stakerETHBalanceBeforeBorrow.add(BORROW_MAX).sub(gasCost)).to.be.equal(stakerETHBalanceAfterBorrow);

        // check nft owner
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(nftStaker.address);

        // check loan
        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.nftAddress).to.be.equal(OpenSkyNFT.address);
        expect(loan.tokenId).to.be.equal(1);
        expect(loan.borrower).to.be.equal(nftStaker.address);
        expect(loan.amount).to.be.equal(BORROW_MAX);
        expect(loan.borrowDuration).to.be.equal(365 * 24 * 3600);
        expect(LOAN_STATUS[loan.status]).to.be.equal('BORROWING');

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });
});

describe('borrow and extend', function () {
    afterEach(async () => {
    await checkPoolEquation();
  });
    it('nft staker borrow 1.5 ETH and extend 1 ETH loan successfully if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                oldLoanAmount,
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoanId = 1;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('1');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.8'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceBeforeExtend.sub(stakerETHBalanceAfterExtend)).to.be.equal(
            oldLoanAmount.sub(newLoanAmount).add(interest).add(gasCost)
        );

        expect(LOAN_STATUS[oldLoan.status]).to.be.equal('END');
        
        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 1.7 ETH loan successfully if newLoanAmount - oldLoanAmount < interest', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                oldLoanAmount,
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const oldLoanId = 1;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('1.7');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.1'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost)
        );

        expect(LOAN_STATUS[oldLoan.status]).to.be.equal('END');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 2 ETH loan successfully if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } = await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                oldLoanAmount,
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const oldLoanId = 1;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('2');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(1, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost)
        );

        expect(LOAN_STATUS[oldLoan.status]).to.be.equal('END');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('nft staker borrow 1.5 ETH and extend 1 ETH loan with penalty if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(1, oldLoanAmount, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoanId = 1;

        await advanceTimeAndBlock(ONE_YEAR + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('1');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.82'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceBeforeExtend.sub(stakerETHBalanceAfterExtend),
                oldLoanAmount.sub(newLoanAmount).add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        expect(LOAN_STATUS[oldLoan.status]).to.be.equal('END');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 1.8 ETH loan with penalty if newLoanAmount - oldLoanAmount < interest + penalty', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(1, oldLoanAmount, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const oldLoanId = 1;

        await advanceTimeAndBlock(ONE_YEAR + 60);
        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);

        const newLoanAmount = parseEther('1.8');
        await expect(
            nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, { value: parseEther('0.01') })
        ).to.be.revertedWith(Errors.EXTEND_MSG_VALUE_ERROR);

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.2'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend),
                newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost).sub(penalty)
            )
        ).to.be.true;

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 2 ETH loan with penalty if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(1, oldLoanAmount, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const oldLoanId = 1;

        await advanceTimeAndBlock(ONE_YEAR + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('2');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(1, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend),
                newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost).sub(penalty)
            )
        ).to.be.true;

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend max', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('20') }));

        const oldLoanAmount = parseEther('1.5');
        expect(
            await nftStaker.OpenSkyPool.borrow(
                1,
                oldLoanAmount,
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        );
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoanId = 1;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = ethers.constants.MaxUint256;
        const BORROW_LIMIT = await OpenSkyPool.getBorrowLimitByOracle(1, OpenSkyNFT.address, 1);

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.8'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceBeforeExtend.sub(stakerETHBalanceAfterExtend)).to.be.equal(
            oldLoanAmount.sub(BORROW_LIMIT).add(interest).add(gasCost)
        );

        expect(LOAN_STATUS[oldLoan.status]).to.be.equal('END');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });
});
