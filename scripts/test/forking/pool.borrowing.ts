import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';

import { expect } from '../../helpers/chai';
import {
    advanceTimeAndBlock,
    getTxCost,
    getCurrentBlockAndTimestamp,
    almostEqual,
    getETHBalance,
} from '../../helpers/utils';
import _ from 'lodash';

import { __setup, checkPoolEquation, checkTotalDeposits } from './__setup';
import { rayMul } from '../../helpers/ray-math';
import { BigNumber } from 'ethers';
import { Errors, ONE_ETH, ONE_YEAR } from "../../helpers/constants"

const LOAN_STATUS = ['NONE', 'BORROWING', 'EXTENDABLE', 'OVERDUE', 'LIQUIDATABLE', 'LIQUIDATING', 'END'];

describe('borrow', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyPool, borrower, user001, user002 } = ENV;

        await user001.UnderlyingAsset.deposit({ value: ONE_ETH });
        await user002.UnderlyingAsset.deposit({ value: ONE_ETH });

        await user001.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);

        await user001.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);
        await user002.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);

        await borrower.WrappedPunk.registerProxy();
        const wpunkProxyInfo = await borrower.WrappedPunk.proxyInfo(borrower.address);

        ENV.PUNK_INDEX = 5811;
        await borrower.CryptoPunksMarket.transferPunk(wpunkProxyInfo, ENV.PUNK_INDEX);
        await borrower.WrappedPunk.mint(ENV.PUNK_INDEX);


        ENV.Duration = 28 * 24 * 3600;
        await borrower.WrappedPunk.approve(OpenSkyPool.address, ENV.PUNK_INDEX);
    });

    it('user borrow 1.5 ETH', async function () {
        const { OpenSkyDataProvider, WrappedPunk, UnderlyingAsset, OpenSkyLoan, borrower, PUNK_INDEX, Duration } = ENV;

        let wNativeBalanceBeforeBorrow = await UnderlyingAsset.balanceOf(borrower.address);
        let amount = parseEther('1.5');
        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            Duration,
            WrappedPunk.address,
            PUNK_INDEX,
            borrower.address
        );
        let wNativeBalanceAfterBorrow = await UnderlyingAsset.balanceOf(borrower.address);

        // check staker ETH Balance
        expect(wNativeBalanceBeforeBorrow.add(amount)).to.be.equal(wNativeBalanceAfterBorrow);

        // check nft owner
        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(borrower.address);

        // check loan
        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.nftAddress).to.be.equal(WrappedPunk.address);
        expect(loan.tokenId).to.be.equal(PUNK_INDEX);
        expect(loan.borrower).to.be.equal(borrower.address);
        expect(loan.amount).to.be.equal(parseEther('1.5'));
        expect(loan.borrowDuration).to.be.equal(Duration);
        expect(LOAN_STATUS[loan.status]).to.be.equal('BORROWING');

        // check borrow rate
        // expect(loan.borrowRate).to.be.equal(await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0));
    });

    it('user borrow max eth if borrowLimit < availableLiquidity', async function () {
        const { OpenSkyDataProvider, WrappedPunk, MoneyMarket, UnderlyingAsset, OpenSkyLoan, OpenSkyOToken, OpenSkyPool, borrower, user002, PUNK_INDEX, Duration } = ENV;

        await user002.UnderlyingAsset.deposit({ value: parseEther('50') });
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('50'));
        await user002.OpenSkyPool.deposit(1, parseEther('50'), user002.address, 0);

        const availableLiquidity = await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address);
        const borrowLimit = await OpenSkyPool.getBorrowLimitByOracle(1, WrappedPunk.address, PUNK_INDEX);
        expect(availableLiquidity.gt(borrowLimit)).to.be.true;

        await expect(
            borrower.OpenSkyPool.borrow(1, availableLiquidity, Duration, WrappedPunk.address, PUNK_INDEX, borrower.address)
        ).to.revertedWith(Errors.BORROW_AMOUNT_EXCEED_BORROW_LIMIT);

        expect(await borrower.OpenSkyPool.borrow(1, borrowLimit, Duration, WrappedPunk.address, PUNK_INDEX, borrower.address));

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.amount).to.be.equal(borrowLimit);
    });

    it('user borrow max eth if borrowLimit > availableLiquidity', async function () {
        const { OpenSkyDataProvider, WrappedPunk, MoneyMarket, OpenSkyLoan, UnderlyingAsset, OpenSkyOToken, OpenSkyPool, borrower, PUNK_INDEX, Duration } = ENV;

        const availableLiquidity = await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address);
        const borrowLimit = await OpenSkyPool.getBorrowLimitByOracle(1, WrappedPunk.address, PUNK_INDEX);
        expect(availableLiquidity.lt(borrowLimit)).to.be.true;

        await expect(
            borrower.OpenSkyPool.borrow(1, borrowLimit, Duration, WrappedPunk.address, PUNK_INDEX, borrower.address)
        ).to.revertedWith(Errors.RESERVE_LIQUIDITY_INSUFFICIENT);

        expect(
            await borrower.OpenSkyPool.borrow(
                1,
                availableLiquidity,
                Duration,
                WrappedPunk.address,
                PUNK_INDEX,
                borrower.address
            )
        );

        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.amount).to.be.equal(availableLiquidity);
    });

    it('user borrow max', async function () {
        const { OpenSkyDataProvider, WrappedPunk, UnderlyingAsset, OpenSkyOToken, OpenSkyLoan, borrower, PUNK_INDEX, Duration } = ENV;

        let balanceBeforeBorrow = await UnderlyingAsset.balanceOf(borrower.address);
        let tx = await borrower.OpenSkyPool.borrow(
            1,
            ethers.constants.MaxUint256,
            Duration,
            WrappedPunk.address,
            PUNK_INDEX,
            borrower.address
        );
        let balanceAfterBorrow = await UnderlyingAsset.balanceOf(borrower.address);

        // TODO compare with getBorrowLimitByOracle
        const BORROW_MAX = await OpenSkyOToken.totalSupply();

        // check staker ETH Balance
        expect(almostEqual(balanceBeforeBorrow.add(BORROW_MAX), balanceAfterBorrow)).to.be.true;

        // check nft owner
        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(borrower.address);

        // check loan
        const loan = await OpenSkyLoan.getLoanData(1);
        expect(loan.nftAddress).to.be.equal(WrappedPunk.address);
        expect(loan.tokenId).to.be.equal(PUNK_INDEX);
        expect(loan.borrower).to.be.equal(borrower.address);
        expect(almostEqual(loan.amount, BORROW_MAX)).to.be.true;
        expect(loan.borrowDuration).to.be.equal(Duration);
        expect(LOAN_STATUS[loan.status]).to.be.equal('BORROWING');
    });

    it('borrow successfully if minBorrowDuration == maxBorrowDuration', async function () {
        const { WrappedPunk, OpenSkyPool, MoneyMarket, OpenSkyOToken, OpenSkySettings, borrower, PUNK_INDEX } = ENV;

        const ONE_MONTH = 30 * 24 * 3600;
        await OpenSkySettings.addToWhitelist(
            1, WrappedPunk.address, 'oERC721Mock', 'oERC721Mock', 5000, ONE_MONTH, ONE_MONTH, 3 * 24 * 3600, 1 * 24 * 3600
        );

        await expect(
            borrower.OpenSkyPool.borrow(1, ONE_ETH, ONE_MONTH + 1, WrappedPunk.address, PUNK_INDEX, borrower.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await expect(
            borrower.OpenSkyPool.borrow(1, ONE_ETH, ONE_MONTH - 1, WrappedPunk.address, PUNK_INDEX, borrower.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await borrower.OpenSkyPool.borrow(
            1,
            ONE_ETH,
            ONE_MONTH,
            WrappedPunk.address,
            PUNK_INDEX,
            borrower.address
        );
    });
});

describe('repay', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyPool, WrappedPunk, user001, user002, borrower } = ENV;

        await user001.UnderlyingAsset.deposit({ value: ONE_ETH });
        await user002.UnderlyingAsset.deposit({ value: ONE_ETH });

        await user001.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);

        await user001.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);
        await user002.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);

        await borrower.WrappedPunk.registerProxy();
        const wpunkProxyInfo = await borrower.WrappedPunk.proxyInfo(borrower.address);

        ENV.PUNK_INDEX = 5811;
        await borrower.CryptoPunksMarket.transferPunk(wpunkProxyInfo, ENV.PUNK_INDEX);
        await borrower.WrappedPunk.mint(ENV.PUNK_INDEX);

        ENV.Duration = 28 * 24 * 3600;
        await borrower.WrappedPunk.approve(OpenSkyPool.address, ENV.PUNK_INDEX);

        let amount = parseEther('1.5');
        await borrower.OpenSkyPool.borrow(
            1,
            amount,
            ENV.Duration,
            WrappedPunk.address,
            ENV.PUNK_INDEX,
            borrower.address
        );
        ENV.loanId = 1;
    });

    it('user borrow 1.5 ETH and repay with penalty if loan.status == BORROWING', async function () {
        const { OpenSkyPool, WrappedPunk, OpenSkyLoan, UnderlyingAsset, borrower, loanId, PUNK_INDEX } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        await advanceTimeAndBlock(10 * 24 * 3600);
        const penalty = await OpenSkyLoan.getPenalty(loanId);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('EXTENDABLE');

        await borrower.WNative.deposit({ value: parseEther('2') });
        await borrower.WNative.approve(OpenSkyPool.address, parseEther('2'));

        // await expect(borrower.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, borrower.address, 1, parseEther('1.5'), 0);
        const balanceBeforeRepay = await UnderlyingAsset.balanceOf(borrower.address);
        const repayTx = await borrower.OpenSkyPool.repay(loanId);

        const balanceAfterRepay = await UnderlyingAsset.balanceOf(borrower.address);
        const repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        let amount = parseEther('1.5');
        expect(
            almostEqual(
                balanceBeforeRepay.sub(balanceAfterRepay),
                amount.add(interest).add(penalty)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(borrower.address);
    });

    it('user borrow 1.5 ETH and repay with no penalty if loan.status == EXTENDABLE', async function () {
        const { UnderlyingAsset, OpenSkyPool, WrappedPunk, OpenSkyLoan, borrower, loanId, PUNK_INDEX } = ENV;

        let amount = parseEther('1.5');
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        await advanceTimeAndBlock(27 * 24 * 3600);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('EXTENDABLE');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        // await expect(borrower.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, borrower.address, 1, parseEther('1.5'), 0);
        let balanceBeforeRepay = await UnderlyingAsset.balanceOf(borrower.address);
        let repayTx = await borrower.OpenSkyPool.repay(loanId);
        let gasCost = await getTxCost(repayTx);
        let balanceAfterRepay = await UnderlyingAsset.balanceOf(borrower.address);
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        // let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        expect(
            almostEqual(
                balanceBeforeRepay.sub(balanceAfterRepay),
                amount.add(interest)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(borrower.address);
    });

    it('user borrow 1.5 ETH and repay with penalty if loan.status == OVERDUE', async function () {
        const { OpenSkyPool, UnderlyingAsset, WrappedPunk, OpenSkyLoan, borrower, loanId, PUNK_INDEX } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanBeforeRepay = await OpenSkyLoan.getLoanData(loanId);
        let interestPerSecond = loanBeforeRepay.interestPerSecond;

        expect(loanBeforeRepay.interestPerSecond).to.be.equal(interestPerSecond);

        await advanceTimeAndBlock(28 * 24 * 3600 + 60);
        const penalty = await OpenSkyLoan.getPenalty(loanId);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('OVERDUE');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        // await expect(borrower.OpenSkyPool.repay(1, { value: parseEther('1.55') }))
        // .to.emit(OpenSkyPool, 'Repay')
        // .withArgs(1, borrower.address, 1, parseEther('1.5'), 0);
        let balanceBeforeRepay = await UnderlyingAsset.balanceOf(borrower.address);
        let repayTx = await borrower.OpenSkyPool.repay(loanId);
        let gasCost = await getTxCost(repayTx);
        let balanceAfterRepay = await UnderlyingAsset.balanceOf(borrower.address);
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        // let interest = interestPerSecond.mul(repayTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(interestPerSecond, BigNumber.from(repayTime - borrowTime));
        // check eth balance after repay
        expect(
            almostEqual(
                balanceBeforeRepay.sub(balanceAfterRepay),
                loanBeforeRepay.amount.add(interest).add(penalty)
            )
        ).to.be.true;

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(borrower.address);
    });

    it('user borrow 1.5 ETH and repay fail if loan.status == LIQUIDATABLE', async function () {
        const { OpenSkyLoan, borrower, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        expect(LOAN_STATUS[await OpenSkyLoan.getStatus(loanId)]).to.be.equal('LIQUIDATABLE');
        
        await expect(borrower.OpenSkyPool.repay(loanId)).to.revertedWith(
          Errors.REPAY_STATUS_ERROR
        );
    });

    it('user borrow 1.5 ETH and repay by others', async function () {
        const { OpenSkyPool, WrappedPunk, OpenSkyLoan, borrower, user002, PUNK_INDEX } = ENV;

        await user002.UnderlyingAsset.deposit({ value: parseEther('2') });
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        expect(await user002.OpenSkyPool.repay(1));

        expect(user002.address).to.not.equal(borrower.address);

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(borrower.address);
    });

    it('user borrow 1.5 ETH and transfer loan to others', async function () {
        const { OpenSkyPool, WrappedPunk, OpenSkyLoan, borrower, user001, PUNK_INDEX } = ENV;

        expect(
            await borrower.OpenSkyLoan['safeTransferFrom(address,address,uint256)'](
                borrower.address,
                user001.address,
                1
            )
        );

        await user001.UnderlyingAsset.deposit({ value: parseEther('2') });
        await user001.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        expect(await user001.OpenSkyPool.repay(1));

        await expect(OpenSkyLoan.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(user001.address);
    });
});

describe.only('extend', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyPool, WrappedPunk, user001, user002, borrower } = ENV;

        await user001.UnderlyingAsset.deposit({ value: ONE_ETH });
        await user002.UnderlyingAsset.deposit({ value: ONE_ETH });

        await user001.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);

        await user001.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);
        await user002.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);

        await borrower.WrappedPunk.registerProxy();
        const wpunkProxyInfo = await borrower.WrappedPunk.proxyInfo(borrower.address);

        ENV.PUNK_INDEX = 5811;
        await borrower.CryptoPunksMarket.transferPunk(wpunkProxyInfo, ENV.PUNK_INDEX);
        await borrower.WrappedPunk.mint(ENV.PUNK_INDEX);

        await borrower.WrappedPunk.approve(OpenSkyPool.address, ENV.PUNK_INDEX);

        ENV.Duration = 28 * 24 * 3600;

        let amount = parseEther('1.5');
        await borrower.OpenSkyPool.borrow(
            1,
            amount,
            ENV.Duration,
            WrappedPunk.address,
            ENV.PUNK_INDEX,
            borrower.address
        );
        ENV.oldLoanAmount = amount;
        ENV.oldLoanId = 1;
    });

    it('user borrow 1.5 ETH and extend 1 ETH loan successfully if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, UnderlyingAsset, borrower, oldLoanAmount, oldLoanId, Duration, PUNK_INDEX } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(27 * 24 * 3600);

        const newLoanAmount = parseEther('1');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(oldLoanId, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceBeforeExtend.sub(balanceAfterExtend)).to.be.equal(
            oldLoanAmount.sub(newLoanAmount).add(interest)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');
        
        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.amount).to.be.equal(newLoanAmount);
        expect(newLoan.borrowRate.div(10000000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000000));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('user borrow 1.5 ETH and extend 1.7 ETH loan successfully if newLoanAmount - oldLoanAmount < interest', async function () {
        const { OpenSkyPool, OpenSkyLoan, MoneyMarket, UnderlyingAsset, OpenSkyOToken, borrower, oldLoanAmount, oldLoanId, Duration, PUNK_INDEX } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(27 * 24 * 3600);

        const newLoanAmount = parseEther('1.7');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(oldLoanId, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceAfterExtend.sub(balanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');

    });

    it('user borrow 1.5 ETH and extend 2 ETH loan successfully if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, UnderlyingAsset, borrower, oldLoanAmount, oldLoanId, Duration } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(27 * 24 * 3600);

        const newLoanAmount = parseEther('2');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(1, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceAfterExtend.sub(balanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.borrowRate.div(10000000000)).to.be.equal((await OpenSkyDataProvider.getBorrowRate(1, 0, 0, 0, 0)).div(10000000000));
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('user borrow 1.5 ETH and extend 1 ETH loan with penalty if newLoanAmount < oldLoanAmount', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, UnderlyingAsset, borrower, oldLoanAmount, oldLoanId, Duration } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(Duration + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('1');

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(oldLoanId, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceBeforeExtend.sub(balanceAfterExtend)).to.be.equal(
            oldLoanAmount.sub(newLoanAmount).add(interest).add(penalty)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('user borrow 1.5 ETH and extend 1.8 ETH loan with penalty if newLoanAmount - oldLoanAmount < interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, UnderlyingAsset, borrower, oldLoanAmount, oldLoanId, Duration } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const passTime = Duration + 60;
        await advanceTimeAndBlock(passTime);

        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const newLoanAmount = oldLoanAmount.add(rayMul(oldLoan.interestPerSecond, BigNumber.from(passTime)));
        // penalty factor is 0.01, penalty is 0.015
        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const extendTx = await borrower.OpenSkyPool.extend(oldLoanId, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        // const interest = oldLoan.interestPerSecond.mul(extendTime - borrowTime).div(parseUnits('1', 27));
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceAfterExtend.sub(balanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(penalty)
        );
    });

    it('user borrow 1.5 ETH and extend 2 ETH loan with penalty if newLoanAmount - oldLoanAmount > interest + penalty', async function () {
        const { OpenSkyDataProvider, OpenSkyLoan, UnderlyingAsset, borrower, oldLoanAmount, oldLoanId, Duration } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(Duration + 60);

        const penalty = await OpenSkyLoan.getPenalty(oldLoanId);
        const newLoanAmount = parseEther('2');

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(1, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceAfterExtend.sub(balanceBeforeExtend)).to.be.equal(
            newLoanAmount.sub(oldLoanAmount).sub(interest).sub(penalty)
        );
    });

    it('user borrow 1.5 ETH and extend max', async function () {
        const { OpenSkyDataProvider, WrappedPunk, OpenSkyPool, OpenSkyLoan, UnderlyingAsset, borrower, user002, oldLoanAmount, oldLoanId, Duration } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await user002.UnderlyingAsset.deposit({ value: parseEther('50') });
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('50'));
        await user002.OpenSkyPool.deposit(1, parseEther('50'), user002.address, 0);

        await advanceTimeAndBlock(27 * 24 * 3600);

        const newLoanAmount = ethers.constants.MaxUint256;
        const BORROW_LIMIT = await OpenSkyPool.getBorrowLimitByOracle(1, WrappedPunk.address, 1);

        const balanceBeforeExtend = await UnderlyingAsset.balanceOf(borrower.address);
        const oldLoan = await OpenSkyLoan.getLoanData(oldLoanId);
        const extendTx = await borrower.OpenSkyPool.extend(oldLoanId, newLoanAmount, Duration, borrower.address);
        let extendTime = (await getCurrentBlockAndTimestamp()).timestamp;

        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(extendTime - borrowTime));
        const balanceAfterExtend = await UnderlyingAsset.balanceOf(borrower.address);
        expect(balanceAfterExtend.sub(balanceBeforeExtend)).to.be.equal(
            BORROW_LIMIT.sub(oldLoanAmount).sub(interest)
        );

        await expect(OpenSkyLoan.ownerOf(oldLoanId)).to.be.revertedWith('ERC721: owner query for nonexistent token');

        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(LOAN_STATUS[newLoan.status]).to.be.equal('BORROWING');
    });

    it('extend successfully if minBorrowDuration == maxBorrowDuration', async function () {
        const { OpenSkyPool, WrappedPunk, OpenSkySettings, borrower, oldLoanId } = ENV;

        const ONE_MONTH = 30 * 24 * 3600;
        await OpenSkySettings.addToWhitelist(
            1, WrappedPunk.address, 'oERC721Mock', 'oERC721Mock', 5000, ONE_MONTH, ONE_MONTH, 3 * 24 * 3600, 1 * 24 * 3600
        );

        await advanceTimeAndBlock(27 * 24 * 3600);

        await borrower.UnderlyingAsset.deposit({ value: parseEther('2') });
        await borrower.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('2'));

        await expect(
            borrower.OpenSkyPool.extend(1, ONE_ETH, ONE_MONTH + 1, borrower.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await expect(
            borrower.OpenSkyPool.extend(1, ONE_ETH, ONE_MONTH - 1, borrower.address)
        ).to.revertedWith(Errors.BORROW_DURATION_NOT_ALLOWED);

        await borrower.OpenSkyPool.extend(oldLoanId, ONE_ETH, ONE_MONTH, borrower.address);
    });
});
