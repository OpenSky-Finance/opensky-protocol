import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    checkEvent, getCurrentBlockAndTimestamp, getTxCost,
} from '../helpers/utils';
import _, { before } from 'lodash';
import { ONE_ETH, ONE_YEAR } from '../helpers/constants';

import { __setup } from './__setup';
import { rayMul } from '../helpers/ray-math';

describe('weth gateway lending', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, buyer001: user001, buyer002: user002 } = ENV;

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
    });

    it('user deposit successfully', async function () {
        const { OpenSkyOToken, buyer001: user001, buyer002: user002, MoneyMarket } = ENV;

        const ONE_ETH = parseEther('1');

        const ethBalanceBeforeDeposit = await user001.getETHBalance();

        const tx = await user001.OpenSkyWETHGateway.deposit('1', user001.address, 0, { value: ONE_ETH });
        const gasCost = await getTxCost(tx);

        const ethBalanceAfterDeposit = await user001.getETHBalance();
        expect(ethBalanceAfterDeposit).to.be.equal(
            ethBalanceBeforeDeposit.sub(ONE_ETH).sub(gasCost)
        );
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(ONE_ETH);
    });

    it('user withdraw successfully', async function () {
        const { OpenSkyWETHGateway, OpenSkyOToken, user001 } = ENV;

        await user001.OpenSkyWETHGateway.deposit('1', user001.address, 0, { value: ONE_ETH });

        await user001.OpenSkyOToken.approve(OpenSkyWETHGateway.address, ONE_ETH); 

        const ethBalanceBeforeWithdraw = await user001.getETHBalance();
        const withdrawAmount = parseEther('0.132117271');
        const tx = await user001.OpenSkyWETHGateway.withdraw('1', withdrawAmount, user001.address);
        const gasCost = await getTxCost(tx);
        const ethBalanceAfterWithdraw = await user001.getETHBalance();

        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(ONE_ETH.sub(withdrawAmount));
        expect(ethBalanceAfterWithdraw).to.be.equal(
            ethBalanceBeforeWithdraw.sub(gasCost).add(withdrawAmount)
        );
    });
});

describe('weth gateway borrowing', async function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyWETHGateway, buyer001: user001, nftStaker } = ENV;

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);

        await user001.OpenSkyWETHGateway.deposit('1', user001.address, 0, { value: ONE_ETH.mul(10) });

        await nftStaker.OpenSkyNFT.awardItem(nftStaker.address);
        await nftStaker.OpenSkyNFT.approve(OpenSkyWETHGateway.address, '1');
    });

    it('user borrow successfully', async function () {
        const { OpenSkyNFT, OpenSkyLoan, nftStaker } = ENV;

        const ethBalanceBeforeBorrow = await nftStaker.getETHBalance();
        const tx = await nftStaker.OpenSkyWETHGateway.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address
        );
        const gasCost = await getTxCost(tx);
        const ethBalanceAfterBorrow = await nftStaker.getETHBalance();

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(nftStaker.address);
        
        expect(ethBalanceAfterBorrow).to.be.equal(
            ethBalanceBeforeBorrow.add(ONE_ETH).sub(gasCost)
        );
    });

    it('user repay successfully', async function () {
        const { OpenSkyNFT, OpenSkyLoan, nftStaker } = ENV;

        await nftStaker.OpenSkyWETHGateway.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address
        );

        const loan = await OpenSkyLoan.getLoanData(1);

        const repayAmount = ONE_ETH.add(parseEther('0.1'));
        const ethBalanceBeforeRepay = await nftStaker.getETHBalance();
        const tx = await nftStaker.OpenSkyWETHGateway.repay(
            1, { value: repayAmount }
        );
        const gasCost = await getTxCost(tx);
        const ethBalanceAfterRepay = await nftStaker.getETHBalance();
        const currentTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        const borrowBalance = loan.amount.add(
            rayMul(loan.interestPerSecond, currentTimestamp - loan.borrowBegin)
        );

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(nftStaker.address);
        
        expect(ethBalanceAfterRepay).to.be.equal(
            ethBalanceBeforeRepay.sub(gasCost).sub(borrowBalance)
        );
    });

    it('user extend successfully if outAmount <= 0', async function () {
        const { OpenSkyNFT, OpenSkyLoan, borrower } = ENV;

        await borrower.OpenSkyWETHGateway.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, borrower.address
        );

        const loan = await OpenSkyLoan.getLoanData(1);

        await advanceTimeAndBlock(364 * 24 * 3600);

        const extendAmount = parseEther('0.5');
        const ethBalanceBeforeExtend = await borrower.getETHBalance();
        const tx = await borrower.OpenSkyWETHGateway.extend(
            1, extendAmount, ONE_YEAR, { value: ONE_ETH }
        );
        const gasCost = await getTxCost(tx);
        const ethBalanceAfterExtend = await borrower.getETHBalance();
        const currentTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        const borrowInterest = rayMul(loan.interestPerSecond, currentTimestamp - loan.borrowBegin);
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(OpenSkyLoan.address);
        
        expect(ethBalanceAfterExtend).to.be.equal(
            ethBalanceBeforeExtend.sub(gasCost).sub(borrowInterest).sub(ONE_ETH.sub(extendAmount))
        );
    });

    it('user extend successfully if outAmount > 0', async function () {
        const { OpenSkyNFT, OpenSkyLoan, borrower } = ENV;

        await borrower.OpenSkyWETHGateway.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, borrower.address
        );

        const loan = await OpenSkyLoan.getLoanData(1);

        await advanceTimeAndBlock(364 * 24 * 3600);

        const extendAmount = parseEther('1.5');
        const ethBalanceBeforeExtend = await borrower.getETHBalance();
        const tx = await borrower.OpenSkyWETHGateway.extend(
            1, extendAmount, ONE_YEAR, { value: ONE_ETH }
        );
        const gasCost = await getTxCost(tx);
        const ethBalanceAfterExtend = await borrower.getETHBalance();
        const currentTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        const borrowInterest = rayMul(loan.interestPerSecond, currentTimestamp - loan.borrowBegin);
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(OpenSkyLoan.address);
        
        expect(ethBalanceAfterExtend).to.be.equal(
            ethBalanceBeforeExtend.sub(gasCost).sub(borrowInterest).sub(ONE_ETH.sub(extendAmount))
        );
    });
});
