import { ethers } from 'hardhat';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { constants } from 'ethers';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp, getTxCost } from '../helpers/utils';
import { rayMul } from '../helpers/ray-math';
import { createOfferData } from '../helpers/utils.bespoke';

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
    const endTime =
        timestamp < loan.borrowOverdueTime
            ? loan.isProrated
                ? timestamp
                : loan.borrowOverdueTime
            : loan.borrowOverdueTime;
    return rayMul(loan.interestPerSecond, endTime - loan.borrowBegin);
}

describe('bespoke repay ERC721 loan', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const {
            OpenSkyPool,
            OpenSkyBespokeMarket,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
            TransferAdapterCurrencyDefault,
            OpenSkyNFT,
            OpenSkyOToken,
            WNative,
            StrategyTokenId,
            borrower,
            user001: lender,
            user002,
        } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);
        // @ts-ignore
        const lenderWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;

        const reserveData = await OpenSkyPool.getReserveData(1);

        // lend offer
        ENV.OfferData = createOfferData(
            ENV,
            {
                offerType: 1, // lend offer
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
                tokenAddress: OpenSkyNFT.address,
                tokenId: 1,
                tokenAmount: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
            },
            lenderWallet
        );

        ENV.LOAN_ID = 1;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        await deposit(lender, 1, ENV.SUPPLY_BORROW_AMOUNT);
        await lender.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            ENV.OfferData,
            1, // tokenId

            ENV.SUPPLY_BORROW_AMOUNT,
            ENV.SUPPLY_BORROW_DURATION,
            // parseEther('1'),
            // ENV.OfferData.borrowDurationMin,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        // await user001.WNative.deposit({ value: parseEther('10') });
        // await user001.WNative.approve(TransferAdapterCurrencyDefault.address, ethers.constants.MaxUint256);

        // await user001.OpenSkyBespokeMarket.takeBorrowOffer(
        //     ENV.OfferData,
        //     ENV.SUPPLY_BORROW_AMOUNT,
        //     ENV.SUPPLY_BORROW_DURATION
        // );
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

        console.log('start');

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
        // @ts-ignore
        expect(lenderTokenBalanceAfterTx).to.be.almostEqual(
            lenderTokenBalanceBeforeTx.add(borrowBalance).sub(protocolFee)
        );
        expect(borrowerTokenBalanceBeforeTx).to.be.equal(borrowerTokenBalanceAfterTx.add(borrowBalance));

        // @ts-ignore
        expect(await WNative.balanceOf(await OpenSkySettings.daoVaultAddress())).to.be.almostEqual(protocolFee);

        // await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
        // await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
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

        // await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
        // await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
    });


    it('should not repay the loan if it is liquidatable', async () => {
        const { OpenSkyBespokeMarket, borrower, LOAN_ID } = ENV;

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);
        const status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(status).eq(LoanStatus.LIQUIDATABLE);

        // expect(borrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') })).revertedWith(
        //     'BM_REPAY_STATUS_ERROR'
        // );

        // await( await borrower.OpenSkyBespokeMarket.repay(LOAN_ID)).wait()

        expect(borrower.OpenSkyBespokeMarket.repay(LOAN_ID)).to.revertedWith('BM_REPAY_STATUS_ERROR');
    });

    it('should not repay the loan if sender is not OpenSkyBespokeBorrowNFT owner', async () => {
        const { LOAN_ID, user002: fakeBorrower, borrower, OpenSkyBespokeMarket, OpenSkyNFT } = ENV;

        await advanceTimeAndBlock(2 * 24 * 3600);

        await fakeBorrower.WNative.deposit({ value: parseEther('10') });

        await fakeBorrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // expect(fakeBorrower.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: parseEther('10') })).revertedWith(
        //     'BM_REPAY_NOT_BORROW_NFT_OWNER'
        // );
        await (await fakeBorrower.OpenSkyBespokeMarket.repay(LOAN_ID)).wait();

        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);

        // expect(fakeBorrower.OpenSkyBespokeMarket.repay(LOAN_ID)).to.revertedWith('BM_REPAY_NOT_BORROW_NFT_OWNER');
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

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);

        await lender.OpenSkyBespokeMarket.foreclose(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(1)).eq(lender.address);

        // await expect(OpenSkyBespokeLendNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
        // await expect(OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.revertedWith(
        //     'ERC721: owner query for nonexistent token'
        // );
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

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);

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

        const { OpenSkyBespokeMarket, OpenSkyERC1155Mock, TransferAdapterCurrencyDefault, TransferAdapterERC1155Default, WNative, borrower, user001 } =
            ENV;

        await borrower.OpenSkyERC1155Mock.mint(borrower.address, 1, 10, []);

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        ENV.OfferData = createOfferData(
            ENV,
            {
                offerType: 0,
                tokenAddress: OpenSkyERC1155Mock.address,
                tokenId: 1,
                tokenAmount: 10,
                currency: WNative.address,
                lendAsset: WNative.address,
            },
            borrowerWallet
        );

        ENV.LOAN_ID = 1;
        ENV.TOKEN_AMOUNT = 10;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyERC1155Mock.setApprovalForAll(TransferAdapterERC1155Default.address, true);
        // await deposit(user001, 1, ENV.SUPPLY_BORROW_AMOUNT);
        // await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await user001.WNative.deposit({ value: parseEther('10') });
        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

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
