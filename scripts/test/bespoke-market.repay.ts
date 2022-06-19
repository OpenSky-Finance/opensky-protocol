import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { constants } from 'ethers';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp, getTxCost, signBorrowOffer } from '../helpers/utils';
import { rayMul } from '../helpers/ray-math';

enum LoanStatus {
    NONE,
    BORROWING,
    OVERDUE,
    LIQUIDATABLE,
    END,
}

async function getBorrowBalance(loan: any) {
    return loan.amount.add(await getBorrowInterest(loan));
}

async function getBorrowInterest(loan: any) {
    const timestamp = (await getCurrentBlockAndTimestamp()).timestamp;
    const endTime = timestamp < loan.borrowOverdueTime ? loan.borrowOverdueTime : timestamp;
    return rayMul(loan.interestPerSecond, endTime - loan.borrowBegin);
}

describe('bespoke repay ERC721 loan', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyOToken, WNative, borrower, user001,user002 } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        const OfferData = {
            reserveId: 1,
            nftAddress: OpenSkyNFT.address,
            tokenId: 1,
            tokenAmount: 1,
            borrowAmountMin: BORROW_AMOUNT,
            borrowAmountMax: BORROW_AMOUNT.add(parseEther('1')),
            borrowDurationMin: BORROW_DURATION,
            borrowDurationMax: BORROW_DURATION + 24 * 3600 * 30,
            borrowRate: 2000, // 20%
            currency: WNative.address,
            borrower: borrowerWallet.address,
            //
            nonce: constants.One,
            deadline: parseInt(Date.now() / 1000 + '') + 24 * 3600 * 7,
            // params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        ENV.OfferData = { ...OfferData, ...signBorrowOffer(OfferData, borrowerWallet) };
        ENV.LOAN_ID = 1;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);
        await deposit(user001, 1, ENV.SUPPLY_BORROW_AMOUNT);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            ENV.OfferData,
            ENV.SUPPLY_BORROW_AMOUNT,
            ENV.SUPPLY_BORROW_DURATION
        );
    });

    it('should repay a loan using WETH if it is borrowing', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeLendNFT,
            OpenSkyBespokeBorrowNFT,
            OpenSkyBespokeSettings,
            OpenSkySettings,
            OpenSkyOToken,
            WNative,
            borrower,
            SUPPLY_BORROW_AMOUNT,
            LOAN_ID,
            user001: lender,
        } = ENV;

        await advanceTimeAndBlock(3 * 24 * 3600);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        await borrower.WNative.deposit({ value: parseEther('10') });

        await borrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const lenderTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerTokenBalanceBeforeTx = await WNative.balanceOf(borrower.address);
        await borrower.OpenSkyBespokeMarket.repay(LOAN_ID);
        const lenderTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerTokenBalanceAfterTx = await WNative.balanceOf(borrower.address);

        const borrowBalance = await getBorrowBalance(loan);

        const borrowInterest = await getBorrowInterest(loan);
        const protocolFee = borrowInterest.mul(await OpenSkyBespokeSettings.reserveFactor()).div(10000);

        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);
        expect(lenderTokenBalanceAfterTx).to.be.equal(lenderTokenBalanceBeforeTx.add(borrowBalance).sub(protocolFee));
        expect(borrowerTokenBalanceBeforeTx).to.be.equal(borrowerTokenBalanceAfterTx.add(borrowBalance));

        expect(await WNative.balanceOf(await OpenSkySettings.daoVaultAddress())).to.be.equal(protocolFee);

        await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
        await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
    });

    it('should repay a loan using ETH if it is borrowing', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeSettings,
            OpenSkySettings,
            OpenSkyOToken,
            WNative,
            borrower,
            LOAN_ID,
            user001: lender,
        } = ENV;

        await advanceTimeAndBlock(3 * 24 * 3600);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        const lenderBalanceBeforeTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerBalanceBeforeTx = await borrower.getETHBalance();
        const tx = await borrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') });
        const gasCost = await getTxCost(tx);
        const lenderBalanceAfterTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerBalanceAfterTx = await borrower.getETHBalance();

        const borrowBalance = await getBorrowBalance(loan);
        const borrowInterest = await getBorrowInterest(loan);
        const protocolFee = borrowInterest.mul(await OpenSkyBespokeSettings.reserveFactor()).div(10000);

        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);
        expect(lenderBalanceAfterTx).to.be.equal(lenderBalanceBeforeTx.add(borrowBalance).sub(protocolFee));
        expect(borrowerBalanceBeforeTx).to.be.equal(borrowerBalanceAfterTx.add(borrowBalance).add(gasCost));

        expect(await WNative.balanceOf(await OpenSkySettings.daoVaultAddress())).to.be.equal(protocolFee);
    });

    it('should repay the loan using WETH with penalty if it is overdue', async () => {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeLendNFT,
            OpenSkyBespokeBorrowNFT,
            OpenSkyBespokeSettings,
            OpenSkySettings,
            OpenSkyOToken,
            WNative,
            borrower,
            SUPPLY_BORROW_AMOUNT,
            LOAN_ID,
            user001: lender,
        } = ENV;

        await advanceTimeAndBlock(18 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.OVERDUE);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        await borrower.WNative.deposit({ value: parseEther('10') });

        await borrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const lenderTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerTokenBalanceBeforeTx = await WNative.balanceOf(borrower.address);
        await borrower.OpenSkyBespokeMarket.repay(LOAN_ID);
        const lenderTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerTokenBalanceAfterTx = await WNative.balanceOf(borrower.address);

        const borrowBalance = await getBorrowBalance(loan);
        const borrowInterest = await getBorrowInterest(loan);
        const penalty = loan.amount.mul(await OpenSkyBespokeSettings.overdueLoanFeeFactor()).div(10000);
        const protocolFee = borrowInterest
            .add(penalty)
            .mul(await OpenSkyBespokeSettings.reserveFactor())
            .div(10000);

        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);
        expect(lenderTokenBalanceAfterTx).to.be.equal(
            lenderTokenBalanceBeforeTx.add(borrowBalance).add(penalty).sub(protocolFee)
        );
        expect(borrowerTokenBalanceBeforeTx).to.be.equal(borrowerTokenBalanceAfterTx.add(borrowBalance).add(penalty));

        expect(await WNative.balanceOf(await OpenSkySettings.daoVaultAddress())).to.be.equal(protocolFee);

        await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
        await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
    });

    it('should repay the loan using ETH with penalty if it is overdue', async () => {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeSettings,
            OpenSkySettings,
            OpenSkyOToken,
            WNative,
            borrower,
            LOAN_ID,
            user001: lender,
        } = ENV;

        await advanceTimeAndBlock(18 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.OVERDUE);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        const lenderBalanceBeforeTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerBalanceBeforeTx = await borrower.getETHBalance();
        const tx = await borrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') });
        const gasCost = await getTxCost(tx);
        const lenderBalanceAfterTx = await OpenSkyOToken.balanceOf(lender.address);
        const borrowerBalanceAfterTx = await borrower.getETHBalance();

        const borrowBalance = await getBorrowBalance(loan);
        const borrowInterest = await getBorrowInterest(loan);
        const penalty = loan.amount.mul(await OpenSkyBespokeSettings.overdueLoanFeeFactor()).div(10000);
        const protocolFee = borrowInterest
            .add(penalty)
            .mul(await OpenSkyBespokeSettings.reserveFactor())
            .div(10000);

        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);
        expect(lenderBalanceAfterTx).to.be.equal(
            lenderBalanceBeforeTx.add(borrowBalance).add(penalty).sub(protocolFee)
        );
        expect(borrowerBalanceBeforeTx).to.be.equal(
            borrowerBalanceAfterTx.add(borrowBalance).add(penalty).add(gasCost)
        );

        expect(await WNative.balanceOf(await OpenSkySettings.daoVaultAddress())).to.be.equal(protocolFee);
    });

    it('should not repay the loan if it is liquidatable', async () => {
        const { OpenSkyBespokeMarket, borrower, LOAN_ID } = ENV;

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);
        const status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(status).eq(LoanStatus.LIQUIDATABLE);

        expect(borrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') })).revertedWith(
            'BM_REPAY_STATUS_ERROR'
        );
        expect(borrower.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BM_REPAY_STATUS_ERROR');
    });

    it('should not repay the loan if sender is not borrower', async () => {
        const { LOAN_ID, user002: fakeBorrower } = ENV;

        await advanceTimeAndBlock(2 * 24 * 3600);

        expect(fakeBorrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') })).revertedWith(
            'BM_REPAY_NOT_BORROW_NFT_OWNER'
        );
        expect(fakeBorrower.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BM_REPAY_NOT_BORROW_NFT_OWNER');
    });

    it('should only OpenSkyBespokeBorrowNFT owner can repay', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeLendNFT,
            OpenSkyBespokeBorrowNFT,
            OpenSkyBespokeSettings,
            OpenSkySettings,
            OpenSkyOToken,
            WNative,
            borrower,
            SUPPLY_BORROW_AMOUNT,
            LOAN_ID,
            user001: lender,
            user002,
        } = ENV;

        await advanceTimeAndBlock(3 * 24 * 3600);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        await borrower.WNative.deposit({ value: parseEther('10') });

        await borrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // transfer to user002
        await borrower.OpenSkyBespokeBorrowNFT.transferFrom(borrower.address, user002.address, LOAN_ID);

        expect(borrower.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BM_REPAY_NOT_BORROW_NFT_OWNER');


        await user002.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user002.OpenSkyBespokeMarket.repay(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(1)).eq(user002.address);
    });

    it('should foreclose a loan if it is liquidable', async () => {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeLendNFT,
            OpenSkyBespokeBorrowNFT,
            user001: lender,
            LOAN_ID,
        } = ENV;

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);

        const status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(status).eq(LoanStatus.LIQUIDATABLE);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);

        await lender.OpenSkyBespokeMarket.foreclose(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(1)).eq(lender.address);

        await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
        await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
            'ERC721: owner query for nonexistent token'
        );
    });

    it('should only OpenSkyBespokeLendNFT owner can receive NFT when a loan is foreclosed', async () => {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            OpenSkyBespokeLendNFT,
            OpenSkyBespokeBorrowNFT,
            user001: lender,
            user002,
            LOAN_ID,
        } = ENV;

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);

        const status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(status).eq(LoanStatus.LIQUIDATABLE);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        
        // transfer OpenSkyBespokeLendNFT to user002
        await lender.OpenSkyBespokeLendNFT.transferFrom(lender.address, user002.address, LOAN_ID);
        
        await lender.OpenSkyBespokeMarket.foreclose(LOAN_ID);
        
        expect(await OpenSkyNFT.ownerOf(1)).eq(user002.address);
        
    });

    it('should not foreclose a loan if it is not liquidable', async () => {
        const { OpenSkyBespokeMarket, user001: lender, LOAN_ID } = ENV;

        await advanceTimeAndBlock(2 * 24 * 3600);
        const status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(status).to.be.not.equal(LoanStatus.LIQUIDATABLE);
        await expect(lender.OpenSkyBespokeMarket.foreclose(LOAN_ID)).to.revertedWith('BM_FORECLOSE_STATUS_ERROR');
    });

});

describe('bespoke repay ERC1155 loan', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyERC1155Mock, WNative, borrower, user001 } = ENV;

        await borrower.OpenSkyERC1155Mock.mint(borrower.address, 1, 10, []);

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        const OfferData = {
            reserveId: 1,
            nftAddress: OpenSkyERC1155Mock.address,
            tokenId: 1,
            tokenAmount: 10,
            borrowAmountMin: BORROW_AMOUNT,
            borrowAmountMax: BORROW_AMOUNT.add(parseEther('1')),
            borrowDurationMin: BORROW_DURATION,
            borrowDurationMax: BORROW_DURATION + 24 * 3600 * 30,
            borrowRate: 2000, // 20%
            currency: WNative.address,
            borrower: borrowerWallet.address,
            //
            nonce: constants.One,
            deadline: parseInt(Date.now() / 1000 + '') + 24 * 3600 * 7,
            // params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        ENV.OfferData = { ...OfferData, ...signBorrowOffer(OfferData, borrowerWallet) };
        ENV.LOAN_ID = 1;
        ENV.TOKEN_AMOUNT = 10;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyERC1155Mock.setApprovalForAll(OpenSkyBespokeMarket.address, true);
        await deposit(user001, 1, ENV.SUPPLY_BORROW_AMOUNT);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            ENV.OfferData,
            ENV.SUPPLY_BORROW_AMOUNT,
            ENV.SUPPLY_BORROW_DURATION
        );
    });

    it('should repay a loan', async () => {
        const { OpenSkyERC1155Mock, OpenSkyBespokeMarket, OpenSkyBespokeL, borrower, TOKEN_AMOUNT, LOAN_ID } = ENV;

        await advanceTimeAndBlock(3 * 24 * 3600);

        await borrower.WNative.deposit({ value: parseEther('10') });

        await borrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await borrower.OpenSkyBespokeMarket.repay(LOAN_ID);

        expect(await OpenSkyERC1155Mock.balanceOf(borrower.address, 1)).eq(TOKEN_AMOUNT);
    });

    it('should foreclose a loan', async () => {
        const { OpenSkyERC1155Mock, OpenSkyBespokeMarket, user001: lender, TOKEN_AMOUNT, LOAN_ID } = ENV;

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.LIQUIDATABLE);

        await lender.OpenSkyBespokeMarket.foreclose(LOAN_ID);

        expect(await OpenSkyERC1155Mock.balanceOf(lender.address, 1)).eq(TOKEN_AMOUNT);
    });
});
