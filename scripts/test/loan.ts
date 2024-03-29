import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost, getCurrentBlockAndTimestamp, almostEqual, getETHBalance, checkEvent } from '../helpers/utils';
import _ from 'lodash';

import { __setup } from './__setup';
import { LOAN_STATUS, ONE_ETH, ONE_YEAR, RAY, Errors } from '../helpers/constants';

describe('loan mint', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });

    it('mint successfully', async function () {
        const { OpenSkyLoan, OpenSkySettings, OpenSkyNFT, deployer: poolMock, borrower } = ENV;
        await OpenSkyLoan.setPoolAddress(poolMock.address);
        await borrower.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower.address, OpenSkyLoan.address, 1);

        const totalSupplyBeforeMint = parseInt((await OpenSkyLoan.totalSupply()).toString());

        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        const mintTx = await OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);
        expect(totalSupplyBeforeMint + 1).to.be.equal(await OpenSkyLoan.totalSupply());
        const txTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;

        const loanId = totalSupplyBeforeMint + 1;
        expect(await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1)).to.be.equal(loanId);

        const loan = await OpenSkyLoan.getLoanData(loanId);
        expect(loan.reserveId).to.be.equal(1);
        expect(loan.nftAddress).to.be.equal(OpenSkyNFT.address);
        expect(loan.tokenId).to.be.equal(1);
        expect(loan.amount).to.be.equal(borrowAmount);
        expect(loan.borrowBegin).to.be.equal(txTimestamp);
        expect(loan.borrowDuration).to.be.equal(ONE_YEAR);
        expect(loan.borrowOverdueTime).to.be.equal(txTimestamp + ONE_YEAR);
        const whitelistInfo = await OpenSkySettings.getWhitelistDetail(1, OpenSkyNFT.address);
        expect(loan.liquidatableTime).to.be.equal(txTimestamp + ONE_YEAR + parseInt(whitelistInfo.overdueDuration));
        expect(loan.borrowRate).to.be.equal(borrowRate);
        expect(
            almostEqual(
                loan.interestPerSecond,
                borrowAmount.mul(borrowRate).div(ONE_YEAR)
            )
        ).to.be.true;
        expect(loan.extendableTime).to.be.equal(txTimestamp + ONE_YEAR - parseInt(whitelistInfo.extendableDuration));
        expect(loan.borrowEnd).to.be.equal(0);
        expect(loan.status).to.be.equal(LOAN_STATUS.BORROWING);

        expect(await OpenSkyNFT.getApproved(1)).to.be.equal(await OpenSkyLoan.poolAddress());

        expect(await OpenSkyLoan.ownerOf(loanId)).to.be.equal(borrower.address);

        await checkEvent(mintTx, 'Mint', [ loanId, borrower.address ])
    });

    it('mint fail if caller is not pool', async function () {
        const { OpenSkyLoan, OpenSkyNFT, deployer, borrower } = ENV;

        await expect(
            OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, parseEther('0.8'), ONE_YEAR, parseUnits('0.05', 27))
        ).to.revertedWith(Errors.ACL_ONLY_POOL_CAN_CALL);
    });
});

describe('loan update', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyLoan, OpenSkyNFT, deployer: poolMock, borrower } = ENV;
        await OpenSkyLoan.setPoolAddress(poolMock.address);
        await borrower.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower.address, OpenSkyLoan.address, 1);
    
        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);
    
        ENV.loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);
    });

    it('update status successfully', async function () {
        const { OpenSkyLoan, loanId } = ENV;
        
        const tx = await OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.EXTENDABLE);
        await checkEvent(tx, 'UpdateStatus', [ loanId, LOAN_STATUS.EXTENDABLE ]);

        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.EXTENDABLE);
    });

    it('update status fail if status == oldStatus', async function () {
        const { OpenSkyLoan, loanId } = ENV;
        
        await expect(OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.BORROWING)).to.revertedWith(Errors.LOAN_SET_STATUS_ERROR);
    });

    // it('update status fail if loan.status == END', async function () {
    //     const { OpenSkyLoan, borrower, buyer001, loanId } = await setupWithMintLoan();
        
    //     await OpenSkyLoan.end(loanId, borrower.address, buyer001.address);
        
    //     await expect(OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith('LOAN_IS_END');
    // });

    it('update status if loan.status == LIQUIDATING', async function () {
        const { OpenSkyLoan, borrower, buyer001, loanId } = ENV;

        await OpenSkyLoan.startLiquidation(loanId);
        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.LIQUIDATING);
        
        await expect(OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith(Errors.LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED);
        await expect(OpenSkyLoan.updateStatus(loanId, 1)).to.revertedWith(Errors.LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED);
        await expect(OpenSkyLoan.updateStatus(loanId, 2)).to.revertedWith(Errors.LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED);
        await expect(OpenSkyLoan.updateStatus(loanId, 3)).to.revertedWith(Errors.LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED);
    });

    it('end successfully', async function () {
        const { OpenSkyLoan, OpenSkyNFT, borrower, buyer001, loanId } = ENV;

        await OpenSkyLoan.end(loanId, borrower.address, buyer001.address);

        await expect(OpenSkyLoan.ownerOf(loanId)).to.revertedWith('ERC721: owner query for nonexistent token');

        expect(await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1)).to.be.equal(0);
    });

    it('end fail if caller is not pool', async function () {
        const { borrower, loanId } = ENV;
        
        await expect(borrower.OpenSkyLoan.end(loanId, borrower.address, borrower.address)).to.revertedWith(Errors.ACL_ONLY_POOL_CAN_CALL);
    });

    it('end fail if repayer is not owner of loan', async function () {
        const { OpenSkyLoan, buyer001, loanId } = ENV;
        
        await expect(OpenSkyLoan.end(loanId, buyer001.address, buyer001.address)).to.revertedWith(Errors.LOAN_REPAYER_IS_NOT_OWNER);
    });

    it('start liquidation successfully', async function () {
        const { OpenSkyLoan, loanId } = ENV;

        await OpenSkyLoan.startLiquidation(loanId);
        const txTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.LIQUIDATING);
        expect(loan.borrowEnd).to.be.equal(txTimestamp);
    });

    it('start liquidation fail if caller is not pool', async function () {
        const { borrower, loanId } = ENV;

        await expect(borrower.OpenSkyLoan.startLiquidation(loanId)).to.revertedWith(Errors.ACL_ONLY_POOL_CAN_CALL);
    });
});

describe('loan get data', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyLoan, OpenSkySettings, OpenSkyNFT, deployer, borrower } = ENV;
        await OpenSkyLoan.setPoolAddress(deployer.address);
        await borrower.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower.address, OpenSkyLoan.address, 1);

        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);

        ENV.loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);
        ENV.extendableDuration = parseInt((await OpenSkySettings.getWhitelistDetail(1, OpenSkyNFT.address)).extendableDuration);
        ENV.overdueDuration = parseInt((await OpenSkySettings.getWhitelistDetail(1, OpenSkyNFT.address)).overdueDuration);
        ENV.borrowDuration = parseInt((await OpenSkyLoan.getLoanData(ENV.loanId)).borrowDuration);
    });

    it('check status', async function () {
        const { OpenSkyLoan, loanId, extendableDuration, overdueDuration, borrowDuration } = ENV;

        const randomTimeInBorrowing = Math.floor(Math.random() * (borrowDuration - extendableDuration))
        await advanceTimeAndBlock(randomTimeInBorrowing);
        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.BORROWING);

        const randomTimeInExtendable = (borrowDuration - extendableDuration) + Math.floor(Math.random() * extendableDuration);
        await advanceTimeAndBlock(randomTimeInExtendable - randomTimeInBorrowing);
        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.EXTENDABLE);

        const randomTimeInOverdue = borrowDuration + Math.floor(Math.random() * overdueDuration);
        await advanceTimeAndBlock(randomTimeInOverdue - randomTimeInExtendable);
        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.OVERDUE);

        const randomTimeInLiquidatable = borrowDuration + overdueDuration + Math.floor(Math.random() * ONE_YEAR);
        await advanceTimeAndBlock(randomTimeInLiquidatable - randomTimeInOverdue);
        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.LIQUIDATABLE);
    });

    it('check borrow interest if status != END', async function () {
        const { OpenSkyLoan, loanId } = ENV;

        await advanceTimeAndBlock(Math.ceil(Math.random() * (ONE_YEAR * 2)));
        expect(await OpenSkyLoan.getStatus(loanId)).to.not.equal(LOAN_STATUS.END);
        const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);
        const borrowInterest = await OpenSkyLoan.getBorrowInterest(loanId);
        expect(
            almostEqual(
                borrowInterest,
                loan.interestPerSecond.mul(timestamp-loan.borrowBegin).div(RAY)
            )
        ).to.be.true;
    });

    it('check penalty if status == BORROWING or status == OVERDUE', async function () {
        const { OpenSkyLoan, OpenSkySettings, loanId } = ENV;

        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.BORROWING);
        
        const loan = await OpenSkyLoan.getLoanData(loanId);
        const prepaymentFeeFactor = await OpenSkySettings.prepaymentFeeFactor();

        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(
            loan.amount.mul(prepaymentFeeFactor).div(10000)
        );

        await OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.OVERDUE);

        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.OVERDUE);

        const overdueLoanFeeFactor = await OpenSkySettings.overdueLoanFeeFactor();

        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(
            loan.amount.mul(overdueLoanFeeFactor).div(10000)
        );
    });

    it('check penalty if status != BORROWING AND status != OVERDUE', async function () {
        const { OpenSkyLoan, loanId } = ENV;

        await OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.EXTENDABLE);
        
        expect(await OpenSkyLoan.getStatus(loanId)).to.not.equal(LOAN_STATUS.BORROWING);
        expect(await OpenSkyLoan.getStatus(loanId)).to.not.equal(LOAN_STATUS.OVERDUE);
        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(0);
    });
});

describe('loan incentive', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyLoan, deployer: poolMock, borrower: borrower001, user001: borrower002, user002: borrower003 } = ENV;

        await OpenSkyLoan.setPoolAddress(poolMock.address);
        await borrower001.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower001.address, OpenSkyLoan.address, 1);
        await borrower002.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower002.address, OpenSkyLoan.address, 2);
        await borrower003.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower003.address, OpenSkyLoan.address, 3);

        ENV.borrower001 = borrower001;
        ENV.borrower002 = borrower002;
        ENV.borrower003 = borrower003;
    });

    it('check total borrow', async function () {
        async function checkMint(user: any, tokenId: number) {
            const totalBorrowsBeforeTx = await OpenSkyLoan.totalBorrows();
            const borrowAmount = parseEther((Math.random() * 10).toFixed(10)), borrowRate = parseUnits('0.05', 27);
            await OpenSkyLoan.mint(1, user.address, OpenSkyNFT.address, tokenId, borrowAmount, ONE_YEAR, borrowRate);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrowsBeforeTx.add(borrowAmount));
        }

        async function checkLiquidating(user: any, loanId: number) {
            const totalBorrowBeforeTx = await OpenSkyLoan.totalBorrows();
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.startLiquidation(loanId);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrowBeforeTx.sub(borrowAmount));
            const totalBorrows = await OpenSkyLoan.totalBorrows();
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrows);
        }

        async function checkEnd(user: any, loanId: number) {
            const totalBorrowsBeforeTx = await OpenSkyLoan.totalBorrows();
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrowsBeforeTx.sub(borrowAmount));
        }

        const { OpenSkyLoan, OpenSkyNFT, borrower001, borrower002, borrower003 } = ENV;
        await checkMint(borrower001, 1);
        await checkMint(borrower002, 2);
        await checkEnd(borrower002, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 2));
        await checkMint(borrower003, 3);
        await checkEnd(borrower003, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 3));
        await checkLiquidating(borrower001, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1));

        expect(await OpenSkyLoan.totalBorrows()).to.be.equal(0);
    });

    it('check user borrows', async function () {
        async function checkMint(user: any, tokenId: number) {
            const userBorrowsBeforeTx = await OpenSkyLoan.userBorrows(user.address);
            const borrowAmount = parseEther((Math.random() * 10).toFixed(10)), borrowRate = parseUnits('0.05', 27);
            await OpenSkyLoan.mint(1, user.address, OpenSkyNFT.address, tokenId, borrowAmount, ONE_YEAR, borrowRate);
            expect(await OpenSkyLoan.userBorrows(user.address)).to.be.equal(userBorrowsBeforeTx.add(borrowAmount));
        }

        async function checkLiquidating(user: any, loanId: number) {
            const userBorrowBeforeTx = await OpenSkyLoan.userBorrows(user.address);
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.startLiquidation(loanId);
            expect(await OpenSkyLoan.userBorrows(user.address)).to.be.equal(userBorrowBeforeTx.sub(borrowAmount));
            const userBorrows = await OpenSkyLoan.userBorrows(user.address);
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.userBorrows(user.address)).to.be.equal(userBorrows);
        }

        async function checkEnd(user: any, loanId: number) {
            const userBorrowsBeforeTx = await OpenSkyLoan.userBorrows(user.address);
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.userBorrows(user.address)).to.be.equal(userBorrowsBeforeTx.sub(borrowAmount));
        }

        async function checkTransfer(user1: any, user2: any, loanId: number) {
            const user1BorrowsBeforeTx = await OpenSkyLoan.userBorrows(user1.address);
            const user2BorrowsBeforeTx = await OpenSkyLoan.userBorrows(user2.address);
            await user1.OpenSkyLoan['safeTransferFrom(address,address,uint256)'](user1.address, user2.address, loanId);
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            expect(await OpenSkyLoan.userBorrows(user1.address)).to.be.equal(user1BorrowsBeforeTx.sub(borrowAmount));
            expect(await OpenSkyLoan.userBorrows(user2.address)).to.be.equal(user2BorrowsBeforeTx.add(borrowAmount));
        }

        const { OpenSkyLoan, OpenSkyNFT, borrower001, borrower002, borrower003 } = ENV;
        await checkMint(borrower001, 1);
        await checkMint(borrower001, 2);
        await checkTransfer(borrower001, borrower002, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 2));
        await checkEnd(borrower002, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 2));
        await checkMint(borrower003, 3);
        await checkEnd(borrower003, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 3));
        await checkLiquidating(borrower001, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1));
    });

});

describe('loan flash loan', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyLoan, OpenSkyNFT, deployer: poolMock, borrower } = ENV;
        await OpenSkyLoan.setPoolAddress(poolMock.address);
        await borrower.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower.address, OpenSkyLoan.address, 1);
    
        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);
    
        ENV.loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);
    });

    it('execute flash loan successfully', async function () {
        const { OpenSkyLoan, OpenSkyNFT, borrower, loanId } = ENV;

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        const loan = await OpenSkyLoan.getLoanData(loanId);

        expect(await OpenSkyLoan.ownerOf(loanId)).to.be.equal(borrower.address);
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(OpenSkyLoan.address);
        await borrower.OpenSkyLoan.flashClaim(ApeCoinFlashLoanMock.address, [loanId], arrayify('0x00'));
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(OpenSkyLoan.address);

        const ApeCoinMock = await ethers.getContract('ApeCoinMock');
        expect(await ApeCoinMock.balanceOf(borrower.address)).to.be.equal(ONE_ETH.mul(10));
    });

    it('execute flash loan failed, if loan.status == LIQUIDATABLE or loan.status == LIQUIDATING', async function () {
        const { OpenSkyLoan, borrower, loanId } = ENV;

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');

        await OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.LIQUIDATABLE);
        await expect(
            borrower.OpenSkyLoan.flashClaim(ApeCoinFlashLoanMock.address, [loanId], arrayify('0x00'))
        ).to.revertedWith(Errors.FLASHLOAN_STATUS_ERROR);

        await OpenSkyLoan.updateStatus(loanId, LOAN_STATUS.LIQUIDATING);
        await expect(
            borrower.OpenSkyLoan.flashClaim(ApeCoinFlashLoanMock.address, [loanId], arrayify('0x00'))
        ).to.revertedWith(Errors.FLASHLOAN_STATUS_ERROR);
    });

    it('execute flash loan failed, if caller is not owner', async function () {
        const { OpenSkyLoan, loanId } = ENV;

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');

        // caller is deployer, not owner of the loan
        await expect(
            OpenSkyLoan.flashClaim(ApeCoinFlashLoanMock.address, [loanId], arrayify('0x00'))
        ).to.revertedWith(Errors.LOAN_CALLER_IS_NOT_OWNER);
    });
});

describe('loan claim airdrop', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { ACLManager, OpenSkyLoan, deployer: poolMock, OpenSkyNFT, borrower, user003: airdropOperator } = ENV;
        await OpenSkyLoan.setPoolAddress(poolMock.address);
        await ACLManager.addAirdropOperator(airdropOperator.address);
        await borrower.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](borrower.address, OpenSkyLoan.address, 1);
    
        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await poolMock.OpenSkyLoan.mint(1, borrower.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);
        ENV.airdropOperator = airdropOperator;
    });

    it('claim ERC20 successfully', async function () {
        const { OpenSkyLoan, TestERC20, user002, airdropOperator, user004 } = ENV;

        await TestERC20.mint(OpenSkyLoan.address, parseEther('10'));
        await airdropOperator.OpenSkyLoan.claimERC20Airdrop(TestERC20.address, user004.address, parseEther('2'));
        expect(await TestERC20.balanceOf(user004.address)).to.be.equal(parseEther('2'));
    });

    it('claim ERC721 successfully', async function () {
        const { OpenSkyLoan, OpenSkyNFT, user002, airdropOperator, user004 } = ENV;

        await user002.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](user002.address, OpenSkyLoan.address, 3);
        await airdropOperator.OpenSkyLoan.claimERC721Airdrop(OpenSkyNFT.address, user004.address, [3]);
        expect(await OpenSkyNFT.ownerOf(3)).to.be.equal(user004.address);
    });

    it('claim ERC721 fail, if ERC721 token is as collateral', async function () {
        const { OpenSkyNFT, airdropOperator, user004 } = ENV;
        await expect(
            airdropOperator.OpenSkyLoan.claimERC721Airdrop(OpenSkyNFT.address, user004.address, [1])
        ).to.revertedWith(Errors.LOAN_COLLATERAL_NFT_CAN_NOT_BE_CLAIMED);
    });

    it('claim ERC1155 successfully', async function () {
        const { OpenSkyLoan, OpenSkyERC1155Mock, user002, airdropOperator, user004 } = ENV;

        await OpenSkyERC1155Mock.mint(OpenSkyLoan.address, 1, 10, arrayify('0x00'));
        await airdropOperator.OpenSkyLoan.claimERC1155Airdrop(OpenSkyERC1155Mock.address, user004.address, [1], [2], arrayify('0x00'));
        expect(await OpenSkyERC1155Mock.balanceOf(user004.address, 1)).to.be.equal(2);
    });

    it('claim fail, if caller is not airdrop operator', async function () {
        const { OpenSkyNFT, TestERC20, OpenSkyERC1155Mock, user001, user003 } = ENV;
        await expect(
            user001.OpenSkyLoan.claimERC20Airdrop(OpenSkyNFT.address, user003.address, ONE_ETH)
        ).to.revertedWith(Errors.ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL);
        await expect(
            user001.OpenSkyLoan.claimERC721Airdrop(OpenSkyNFT.address, user003.address, [1])
        ).to.revertedWith(Errors.ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL);
        await expect(
            user001.OpenSkyLoan.claimERC1155Airdrop(OpenSkyERC1155Mock.address, user003.address, [1], [1], arrayify('0x00'))
        ).to.revertedWith(Errors.ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL);
    });
});
