import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost, getCurrentBlockAndTimestamp, almostEqual, getETHBalance, checkEvent } from '../helpers/utils';
import _ from 'lodash';

import { setupWithStakingNFT, __setup } from './__setup';
import { LOAN_STATUS, ONE_YEAR, RAY } from '../helpers/constants';

describe('loan mint', function () {
    it('mint successfully', async function () {
        const { OpenSkyLoan, OpenSkySettings, OpenSkyNFT, deployer, nftStaker } = await setupWithStakingNFT();
        await OpenSkySettings.setPoolAddress(deployer.address);
        await nftStaker.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](nftStaker.address, OpenSkyLoan.address, 1);

        const totalSupplyBeforeMint = parseInt((await OpenSkyLoan.totalSupply()).toString());

        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        const mintTx = await OpenSkyLoan.mint(1, nftStaker.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);
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
        expect(loan.liquidatableTime).to.be.equal(txTimestamp + ONE_YEAR + parseInt(await OpenSkySettings.overdueDuration()));
        expect(loan.borrowRate).to.be.equal(borrowRate);
        expect(
            almostEqual(
                loan.interestPerSecond,
                borrowAmount.mul(borrowRate).div(ONE_YEAR)
            )
        ).to.be.true;
        expect(loan.extendableTime).to.be.equal(txTimestamp + ONE_YEAR - parseInt(await OpenSkySettings.extendableDuration()));
        expect(loan.borrowEnd).to.be.equal(0);
        expect(loan.status).to.be.equal(LOAN_STATUS.BORROWING);

        expect(await OpenSkyNFT.getApproved(1)).to.be.equal(await OpenSkySettings.poolAddress());

        expect(await OpenSkyLoan.ownerOf(loanId)).to.be.equal(nftStaker.address);

        await checkEvent(mintTx, 'Mint', [ loanId, nftStaker.address ])
    });

    it('mint fail if caller is not pool', async function () {
        const { OpenSkyLoan, OpenSkyNFT, deployer, nftStaker } = await setupWithStakingNFT();

        await expect(
            OpenSkyLoan.mint(1, nftStaker.address, OpenSkyNFT.address, 1, parseEther('0.8'), ONE_YEAR, parseUnits('0.05', 27))
        ).to.revertedWith('ACL_ONLY_POOL_CAN_CALL');
    });
});

describe('loan update', function () {
    async function setupWithMintLoan() {
        const ENV = await setupWithStakingNFT();
        const { OpenSkyLoan, OpenSkySettings, OpenSkyNFT, deployer, nftStaker } = ENV;
        await OpenSkySettings.setPoolAddress(deployer.address);
        await nftStaker.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](nftStaker.address, OpenSkyLoan.address, 1);

        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await OpenSkyLoan.mint(1, nftStaker.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);
        return { loanId, ...ENV };
    }

    it('update status successfully', async function () {
        const { OpenSkyLoan, loanId } = await setupWithMintLoan();
        
        const tx = await OpenSkyLoan.updateStatus(loanId, 1);
        await checkEvent(tx, 'UpdateStatus', [ loanId, 1 ]);

        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(1);
    });

    it('update status fail if status == oldStatus', async function () {
        const { OpenSkyLoan, loanId } = await setupWithMintLoan();
        
        await expect(OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith('LOAN_SET_STATUS_ERROR');
    });

    it('update status fail if caller is not pool', async function () {
        const { nftStaker, loanId } = await setupWithMintLoan();

        await expect(nftStaker.OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith('ACL_ONLY_POOL_CAN_CALL');
    });

    it('update status fail if loan.status == END', async function () {
        const { OpenSkyLoan, nftStaker, buyer001, loanId } = await setupWithMintLoan();
        
        await OpenSkyLoan.end(loanId, nftStaker.address, buyer001.address);
        
        await expect(OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith('LOAN_IS_END');
    });

    it('update status if loan.status == LIQUIDATING', async function () {
        const { OpenSkyLoan, nftStaker, buyer001, loanId } = await setupWithMintLoan();

        await OpenSkyLoan.startLiquidation(loanId);
        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.LIQUIDATING);
        
        await expect(OpenSkyLoan.updateStatus(loanId, 0)).to.revertedWith('LOAN_LIQUIDATING_CAN_BE_SET_END_ONLY');
        await expect(OpenSkyLoan.updateStatus(loanId, 1)).to.revertedWith('LOAN_LIQUIDATING_CAN_BE_SET_END_ONLY');
        await expect(OpenSkyLoan.updateStatus(loanId, 2)).to.revertedWith('LOAN_LIQUIDATING_CAN_BE_SET_END_ONLY');
        await expect(OpenSkyLoan.updateStatus(loanId, 3)).to.revertedWith('LOAN_LIQUIDATING_CAN_BE_SET_END_ONLY');
        expect(await OpenSkyLoan.updateStatus(loanId, 5));
    });

    it('end successfully', async function () {
        const { OpenSkyLoan, OpenSkyNFT, nftStaker, buyer001, loanId } = await setupWithMintLoan();

        await OpenSkyLoan.end(loanId, nftStaker.address, buyer001.address);
        const txTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.END);
        expect(loan.borrowEnd).to.be.equal(txTimestamp);
        expect(loan.repayer).to.be.equal(buyer001.address);

        expect(await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1)).to.be.equal(0);
    });

    it('end fail if caller is not pool', async function () {
        const { nftStaker, loanId } = await setupWithMintLoan();
        
        await expect(nftStaker.OpenSkyLoan.end(loanId, nftStaker.address, nftStaker.address)).to.revertedWith('ACL_ONLY_POOL_CAN_CALL');
    });

    it('end fail if repayer is not owner of loan', async function () {
        const { OpenSkyLoan, buyer001, loanId } = await setupWithMintLoan();
        
        await expect(OpenSkyLoan.end(loanId, buyer001.address, buyer001.address)).to.revertedWith('LOAN_REPAYER_IS_NOT_OWNER');
    });

    it('start liquidation successfully', async function () {
        const { OpenSkyLoan, OpenSkyNFT, loanId } = await setupWithMintLoan();

        await OpenSkyLoan.startLiquidation(loanId);
        const txTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        expect((await OpenSkyLoan.getLoanData(loanId)).status).to.be.equal(LOAN_STATUS.LIQUIDATING);
        expect(loan.borrowEnd).to.be.equal(txTimestamp);
    });

    it('start liquidation fail if caller is not pool', async function () {
        const { nftStaker, loanId } = await setupWithMintLoan();

        await expect(nftStaker.OpenSkyLoan.startLiquidation(loanId)).to.revertedWith('ACL_ONLY_POOL_CAN_CALL');
    });
});

describe('loan get data', function () {
    async function setupWithMintLoan() {
        const ENV = await setupWithStakingNFT();
        const { OpenSkyLoan, OpenSkySettings, OpenSkyNFT, deployer, nftStaker } = ENV;
        await OpenSkySettings.setPoolAddress(deployer.address);
        await nftStaker.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](nftStaker.address, OpenSkyLoan.address, 1);

        const borrowAmount = parseEther('0.8'), borrowRate = parseUnits('0.05', 27);
        await OpenSkyLoan.mint(1, nftStaker.address, OpenSkyNFT.address, 1, borrowAmount, ONE_YEAR, borrowRate);

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);
        const extendableDuration = parseInt(await OpenSkySettings.extendableDuration());
        const overdueDuration = parseInt(await OpenSkySettings.overdueDuration());
        const borrowDuration = parseInt((await OpenSkyLoan.getLoanData(loanId)).borrowDuration);

        return { loanId, extendableDuration, overdueDuration, borrowDuration, ...ENV };
    }

    it('check status', async function () {
        const { OpenSkyLoan, loanId, extendableDuration, overdueDuration, borrowDuration } = await setupWithMintLoan();

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
        const { OpenSkyLoan, OpenSkyNFT } = await setupWithMintLoan();

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);

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

    it('check borrow interest if status == END', async function () {
        const { OpenSkyLoan, OpenSkyNFT, nftStaker } = await setupWithMintLoan();

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);

        await advanceTimeAndBlock(Math.ceil(Math.random() * ONE_YEAR));
        
        await OpenSkyLoan.end(loanId, nftStaker.address, nftStaker.address);

        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.END);
        const endTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const loan = await OpenSkyLoan.getLoanData(loanId);

        expect(loan.borrowEnd).to.be.equal(endTimestamp);

        await advanceTimeAndBlock(Math.ceil(Math.random() * ONE_YEAR));

        const borrowInterest = await OpenSkyLoan.getBorrowInterest(loanId);
        expect(
            almostEqual(
                borrowInterest,
                loan.interestPerSecond.mul(endTimestamp-loan.borrowBegin).div(RAY)
            )
        ).to.be.true;
    });

    it('check penalty if status == BORROWING or status == OVERDUE', async function () {
        const { OpenSkyLoan, OpenSkyNFT, OpenSkySettings } = await setupWithMintLoan();

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);

        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.BORROWING);
        
        const loan = await OpenSkyLoan.getLoanData(loanId);
        const penaltyFactor = await OpenSkySettings.penaltyFactor();

        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(
            loan.amount.mul(penaltyFactor).div(10000)
        );

        await OpenSkyLoan.updateStatus(loanId, 2);

        expect(await OpenSkyLoan.getStatus(loanId)).to.be.equal(LOAN_STATUS.OVERDUE);

        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(
            loan.amount.mul(penaltyFactor).div(10000)
        );
    });

    it('check penalty if status != BORROWING AND status != OVERDUE', async function () {
        const { OpenSkyLoan, OpenSkyNFT } = await setupWithMintLoan();

        const loanId = await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1);

        await OpenSkyLoan.updateStatus(loanId, 1);
        
        expect(await OpenSkyLoan.getStatus(loanId)).to.not.equal(LOAN_STATUS.BORROWING);
        expect(await OpenSkyLoan.getStatus(loanId)).to.not.equal(LOAN_STATUS.OVERDUE);
        expect(await OpenSkyLoan.getPenalty(loanId)).to.be.equal(0);
    });
});

describe('loan incentive', function () {
    async function setup() {
        const ENV = await setupWithStakingNFT();
        const { OpenSkyLoan, OpenSkySettings, deployer: poolMock, nftStaker: user001, buyer001: user002, buyer002: user003 } = ENV;

        await OpenSkySettings.setPoolAddress(poolMock.address);
        await user001.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](user001.address, OpenSkyLoan.address, 1);
        await user002.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](user002.address, OpenSkyLoan.address, 2);
        await user003.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](user003.address, OpenSkyLoan.address, 3);

        return { ...ENV, user001, user002, user003 };
    }

    it('check total borrow', async function () {
        async function checkMint(user: any, tokenId: number) {
            const totalBorrowsBeforeTx = await OpenSkyLoan.totalBorrows();
            const borrowAmount = parseEther((Math.random() * 10).toFixed(10)), borrowRate = parseUnits('0.05', 27);
            await OpenSkyLoan.mint(1, user.address, OpenSkyNFT.address, tokenId, borrowAmount, ONE_YEAR, borrowRate);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrowsBeforeTx.add(borrowAmount));
        }

        async function checkLiquidating(user: any, loanId: number) {
            const totalBorrowBeforeTx = await OpenSkyLoan.totalBorrow();
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.totalBorrow()).to.be.equal(totalBorrowBeforeTx.sub(borrowAmount));
        }

        async function checkEnd(user: any, loanId: number) {
            const totalBorrowsBeforeTx = await OpenSkyLoan.totalBorrows();
            const borrowAmount = (await OpenSkyLoan.getLoanData(loanId)).amount;
            await OpenSkyLoan.end(loanId, user.address, user.address);
            expect(await OpenSkyLoan.totalBorrows()).to.be.equal(totalBorrowsBeforeTx.sub(borrowAmount));
        }

        const { OpenSkyLoan, OpenSkyNFT, user001, user002, user003 } = await setup();
        await checkMint(user001, 1);
        await checkMint(user002, 2);
        await checkEnd(user002, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 2));
        await checkMint(user003, 3);
        await checkEnd(user003, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 3));
        await checkEnd(user001, await OpenSkyLoan.getLoanId(OpenSkyNFT.address, 1));

        expect(await OpenSkyLoan.totalBorrows()).to.be.equal(0);
    });
});

describe('loan flash loan', function () {
});

describe('loan claim airdrop', function () {
});
