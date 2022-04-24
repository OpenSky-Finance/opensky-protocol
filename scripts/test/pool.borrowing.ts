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

import { setupWithStakingNFT, __setup, checkPoolEquation, formatEtherAttrs, formatObjNumbers } from './__setup';
import { rayMul } from '../helpers/ray-math';
import { BigNumber } from 'ethers';
import { Errors } from "../helpers/constants"
import { OpenSkyDataProvider } from '../../types/OpenSkyDataProvider';

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
    async function setupWithDepositing() {
        const ENV = await setupWithStakingNFT();
        const { buyer001, buyer002 } = ENV;

        await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });
        await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });

        return ENV;
    }

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('nft staker borrow 1.5 ETH', async function () {
        const { OpenSkyDataProvider, OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, OpenSkyLoan, nftStaker } = await setupWithDepositing();

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

        // check borrow rate
        expect(loan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow max eth if borrowLimit < availableLiquidity', async function () {
        const { OpenSkyDataProvider, OpenSkyNFT, MoneyMarket, OpenSkyLoan, OpenSkyOToken, OpenSkyPool, nftStaker, buyer002 } = await setupWithDepositing();

        await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('20') });

        const availableLiquidity = await MoneyMarket.getBalance(OpenSkyOToken.address);
        const borrowLimit = await OpenSkyPool.getBorrowLimitByOracle(1, OpenSkyNFT.address, 1);
        expect(availableLiquidity.gt(borrowLimit)).to.be.true;

        await expect(
            nftStaker.OpenSkyPool.borrow(1, availableLiquidity, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address)
        ).to.revertedWith(Errors.BORROW_AMOUNT_EXCEED_BORROW_LIMIT);

        expect(await nftStaker.OpenSkyPool.borrow(1, borrowLimit, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address));

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.amount).to.be.equal(borrowLimit);
        expect(loan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));

        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow max eth if borrowLimit > availableLiquidity', async function () {
        const { OpenSkyDataProvider, OpenSkyNFT, MoneyMarket, OpenSkyLoan, OpenSkyOToken, OpenSkyPool, nftStaker } = await setupWithDepositing();

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

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.amount).to.be.equal(availableLiquidity);
        expect(loan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));

        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and repay with penalty if loan.status == BORROWING', async function () {
        const { OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, OpenSkyLoan, nftStaker } = await setupWithDepositing();

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            1,
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
        // let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);

        // check totalDeposits = totalBorrows + availableLiquidity
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and repay with no penalty if loan.status == EXTENDABLE', async function () {
        const { OpenSkyNFT, OpenSkyLoan, nftStaker } = await setupWithDepositing();

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            1,
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
        // let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and repay with penalty if loan.status == OVERDUE', async function () {
        const { OpenSkyNFT, OpenSkyLoan, nftStaker } = await setupWithDepositing();

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            1,
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
        // let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        expect(
            almostEqual(
                borrowerETHBalanceBeforeRepay.sub(borrowerETHBalanceAfterRepay),
                amount.add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and repay fail if loan.status == LIQUIDATABLE', async function () {
        const { OpenSkyNFT, OpenSkyDataProvider, OpenSkyLoan, nftStaker } = await setupWithDepositing();

        const amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(1, amount, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address);
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
        const { OpenSkyNFT, OpenSkyLoan, nftStaker, buyer001 } = await setupWithDepositing();

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

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
    });

    it('nft staker borrow 1.5 ETH and transfer loan to others', async function () {
        const { OpenSkyNFT, OpenSkyLoan, nftStaker, buyer001 } = await setupWithDepositing();

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

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(buyer001.address);
    });

    it('nft staker borrow max', async function () {
        const { OpenSkyDataProvider, OpenSkyNFT, MoneyMarket, OpenSkyOToken, OpenSkyPool, OpenSkyLoan, nftStaker } = await setupWithDepositing();

        let stakerETHBalanceBeforeBorrow = await nftStaker.getETHBalance();
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

        expect(loan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('borrow successfully if minBorrowDuration == maxBorrowDuration', async function () {
        const { OpenSkyNFT, OpenSkyPool, MoneyMarket, OpenSkyOToken, OpenSkySettings, nftStaker, buyer001, buyer002 } =
            await setupWithStakingNFT();

        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        const ONE_MONTH = 30 * 24 * 3600;
        await OpenSkySettings.addToWhitelist(
            OpenSkyNFT.address, 'oERC721Mock', 'oERC721Mock', 5000, ONE_MONTH, ONE_MONTH, 3 * 24 * 3600, 1 * 24 * 3600
        );

        await expect(
            nftStaker.OpenSkyPool.borrow(1, ONE_ETH, ONE_MONTH + 1, OpenSkyNFT.address, 1, nftStaker.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await expect(
            nftStaker.OpenSkyPool.borrow(1, ONE_ETH, ONE_MONTH - 1, OpenSkyNFT.address, 1, nftStaker.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await nftStaker.OpenSkyPool.borrow(
            1,
            ONE_ETH,
            ONE_MONTH,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });
});

describe('borrow and extend', function () {
    async function setupWithBorrowing() {
        const ENV = await setupWithStakingNFT();
        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, buyer001, buyer002, nftStaker } = ENV;

        await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });
        await buyer002.OpenSkyPool.deposit(1, 0, { value: ONE_ETH });

        const oldLoanAmount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(
            1,
            oldLoanAmount,
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        )
        return { ...ENV, oldLoanAmount, oldLoanId: 1 };
    }
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('nft staker borrow 1.5 ETH and extend 1 ETH loan successfully if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const oldLoanId = 1;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('1');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.8'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceBeforeExtend.sub(stakerETHBalanceAfterExtend)).to.be.equal(
            oldLoanAmount.sub(newLoanAmount).add(interest).add(gasCost)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');
        
        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.amount).to.be.equal(newLoanAmount);
        expect(newLoan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 1.7 ETH loan successfully if newLoanAmount - oldLoanAmount < interest', async function () {
        const { OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount, oldLoanId } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('1.7');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.1'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 2 ETH loan successfully if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyLoan, nftStaker, oldLoanAmount, oldLoanId } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = parseEther('2');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(1, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate.div(10000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('nft staker borrow 1.5 ETH and extend 1 ETH loan with penalty if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount, oldLoanId } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(ONE_YEAR + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('1');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.82'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceBeforeExtend.sub(stakerETHBalanceAfterExtend),
                oldLoanAmount.sub(newLoanAmount).add(interest).add(gasCost).add(penalty)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate.div(10000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 1.8 ETH loan with penalty if newLoanAmount - oldLoanAmount < interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount, oldLoanId } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const passTime = ONE_YEAR + 60;
        await advanceTimeAndBlock(passTime);

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const newLoanAmount = oldLoanAmount.add(rayMul(oldLoan.interestPerSecond, BigNumber.from(passTime)));
        // penalty factor is 0.01, penalty is 0.015
        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        await expect(
            nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, { value: parseEther('0.01') })
        ).to.be.revertedWith(Errors.EXTEND_MSG_VALUE_ERROR);

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.2'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend),
                newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost).sub(penalty)
            )
        ).to.be.true;

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate).to.be.lt(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));
        expect(newLoan.borrowRate.div(100000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(100000000));

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend 2 ETH loan with penalty if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount, oldLoanId } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(ONE_YEAR + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('2');

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(1, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(
            almostEqual(
                stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend),
                newLoanAmount.sub(oldLoanAmount).sub(interest).sub(gasCost).sub(penalty)
            )
        ).to.be.true;

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate.div(10000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000));

        // check totalDeposits = availableLiquidity + totalBorrows
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('nft staker borrow 1.5 ETH and extend max', async function () {
        const { OpenSkyDataProvider, OpenSkyNFT, OpenSkyPool, OpenSkyLoan, MoneyMarket, OpenSkyOToken, nftStaker, oldLoanAmount, oldLoanId, buyer002 } =
            await setupWithBorrowing();

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        expect(await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('20') }));

        await advanceTimeAndBlock(364 * 24 * 3600);

        const newLoanAmount = ethers.constants.MaxUint256;
        const BORROW_LIMIT = await OpenSkyPool.getBorrowLimitByOracle(1, OpenSkyNFT.address, 1);

        const stakerETHBalanceBeforeExtend = await nftStaker.getETHBalance();
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.8'),
        });
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const gasCost = await getTxCost(extendTx);
        const stakerETHBalanceAfterExtend = await nftStaker.getETHBalance();
        expect(stakerETHBalanceAfterExtend.sub(stakerETHBalanceBeforeExtend)).to.be.equal(
            BORROW_LIMIT.sub(oldLoanAmount).sub(interest).sub(gasCost)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate.div(10000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

        // check money market balance and total deposits
        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });

    it('extend successfully if minBorrowDuration == maxBorrowDuration', async function () {
        const { OpenSkyNFT, OpenSkySettings, OpenSkyPool, MoneyMarket, OpenSkyOToken, nftStaker } =
            await setupWithBorrowing();

        const ONE_MONTH = 30 * 24 * 3600;
        await OpenSkySettings.addToWhitelist(
            OpenSkyNFT.address, 'oERC721Mock', 'oERC721Mock', 5000, ONE_MONTH, ONE_MONTH, 3 * 24 * 3600, 1 * 24 * 3600
        );

        await advanceTimeAndBlock(364 * 24 * 3600);

        await expect(
            nftStaker.OpenSkyPool.extend(1, ONE_ETH, ONE_MONTH + 1, { value: parseEther('0.8') })
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await expect(
            nftStaker.OpenSkyPool.extend(1, ONE_ETH, ONE_MONTH + 1, { value: parseEther('0.8') })
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await nftStaker.OpenSkyPool.extend(
            1,
            ONE_ETH,
            ONE_MONTH,
            { value: parseEther('0.8') }
        );

        await checkTotalDeposits({ OpenSkyPool, MoneyMarket, OpenSkyOToken });
    });
});
