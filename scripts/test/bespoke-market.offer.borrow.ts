import { ethers } from 'hardhat';
import { parseEther, defaultAbiCoder } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { _TypedDataEncoder } from '@ethersproject/hash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { advanceTimeAndBlock, getTxCost, randomAddress } from '../helpers/utils';
import { ONE_YEAR, BESPOKE_LOAN_STATUS as LoanStatus, OFFER_TYPE } from '../helpers/constants';

import { createOfferData } from '../helpers/utils.bespoke';

describe('bespoke take offer with WETH', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, WNative, borrower, TransferAdapterERC721Default, OpenSkyPool } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);
        ENV.borrowerWallet = borrowerWallet;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        ENV.OfferData = createOfferData(
            ENV,
            { offerType: 0, currency: reserveData.underlyingAsset, lendAsset: reserveData.underlyingAsset },
            borrowerWallet
        );
        ENV.LOAN_ID = 1;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
    });

    it('should take a borrow offer using WETH when [borrow asset]== [lend asset]', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001: lender,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            TransferAdapterCurrencyDefault,
            borrowerWallet,
        } = ENV;

        const OfferData = createOfferData(
            ENV,
            { offerType: 0, reserveId: 2, currency: WNative.address, lendAsset: WNative.address },
            borrowerWallet
        );

        await lender.WNative.deposit({ value: ENV.SUPPLY_BORROW_AMOUNT });
        await lender.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await WNative.balanceOf(lender.address);
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const tokenBalanceAfterTx = await WNative.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(tokenBalanceAfterTx).to.be.equal(tokenBalanceBeforeTx.sub(SUPPLY_BORROW_AMOUNT));
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should take a borrow offer using WETH when [borrow asset]!= [lend asset]', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            WNative,
            OpenSkyOToken, // oWETH
            // OfferData,
            borrower,
            user001: lender,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            TransferAdapterCurrencyDefault,
            borrowerWallet,
        } = ENV;

        const OfferData = createOfferData(
            ENV,
            { offerType: 0, reserveId: 2, currency: WNative.address, lendAsset: OpenSkyOToken.address },
            borrowerWallet
        );

        // lender perpare oToken
        await deposit(lender, 1, OfferData.borrowAmountMax);
        await lender.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(lender.address);
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const tokenBalanceAfterTx = await OpenSkyOToken.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(tokenBalanceAfterTx).to.be.equal(tokenBalanceBeforeTx.sub(SUPPLY_BORROW_AMOUNT));
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        await advanceTimeAndBlock(SUPPLY_BORROW_DURATION - 1); // no penalty

        // borrower repay.
        // deposit for borrow balance increase
        const loanData = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);
        const borrowBalance = await OpenSkyBespokeMarket.getBorrowBalance(LOAN_ID);
        const penalty = await OpenSkyBespokeMarket.getPenalty(LOAN_ID);

        // prepare a little more
        await borrower.WNative.deposit({
            value: borrowBalance.add(penalty).sub(SUPPLY_BORROW_AMOUNT).add(parseEther('0.1')),
        });

        await borrower.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        
        await borrower.OpenSkyBespokeMarket.repay(LOAN_ID);
        expect(await OpenSkyNFT.ownerOf(1)).eq(borrower.address);
    });
    
    it('should not take offer if nonce exists', async function () {
        const { OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await borrower.OpenSkyBespokeMarket.cancelMultipleBorrowOffers([constants.One]);

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
        ).to.revertedWith('BM_TAKE_OFFER_NONCE_INVALID');
    });

    it('should not take offer if nonce is less than min nonce', async function () {
        const { OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await borrower.OpenSkyBespokeMarket.cancelAllBorrowOffersForSender(constants.Two);

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
        ).to.revertedWith('BM_TAKE_OFFER_NONCE_INVALID');
    });

    it('should not take offer if currency is not on the whitelist', async function () {
        const { OpenSkyBespokeSettings, OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await OpenSkyBespokeSettings.removeCurrency(OfferData.currency);

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
        ).to.revertedWith('BM_TAKE_BORROW_CURRENCY_NOT_IN_WHITELIST');
    });

    it('should not take offer if the offer is expired', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        (OfferData.deadline = parseInt(Date.now() / 1000 + '') - 10000),
            await expect(
                user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
            ).to.revertedWith('BM_TAKE_BORROW_SIGNING_EXPIRATION');
    });

    it('should not take off if the borrow duration is not allowed', async function () {
        const { OpenSkyBespokeSettings, OpenSkyNFT, OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } =
            ENV;

        const config = await OpenSkyBespokeSettings.getBorrowDurationConfig(OpenSkyNFT.address);

        OfferData.borrowDurationMin = parseInt(config.minBorrowDuration_.toString()) - 100;
        OfferData.borrowDurationMax = parseInt(config.maxBorrowDuration_.toString()) + 100;

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
        ).to.revertedWith('BM_TAKE_BORROW_OFFER_DURATION_NOT_ALLOWED');
    });

    it('should not take off if the supply duration is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(
                OfferData,
                SUPPLY_BORROW_AMOUNT,
                OfferData.borrowDurationMin - 100
            )
        ).to.revertedWith('BM_TAKE_BORROW_TAKER_DURATION_NOT_ALLOWED');

        OfferData.supplyDuration = OfferData.borrowDurationMax + 100;

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(
                OfferData,
                SUPPLY_BORROW_AMOUNT,
                OfferData.borrowDurationMax + 100
            )
        ).to.revertedWith('BM_TAKE_BORROW_TAKER_DURATION_NOT_ALLOWED');
    });

    it('should not take off if borrow amount is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        OfferData.borrowAmountMin = OfferData.borrowAmountMax + 100;

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION)
        ).to.revertedWith('BM_TAKE_BORROW_OFFER_AMOUNT_NOT_ALLOWED');
    });

    it('should not take off if supply amount is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_DURATION } = ENV;

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(
                OfferData,
                OfferData.borrowAmountMin.sub(100),
                SUPPLY_BORROW_DURATION
            )
        ).to.revertedWith('BM_TAKE_BORROW_SUPPLY_AMOUNT_NOT_ALLOWED');

        await expect(
            user001.OpenSkyBespokeMarket.takeBorrowOffer(
                OfferData,
                OfferData.borrowAmountMax.add(100),
                SUPPLY_BORROW_DURATION
            )
        ).to.revertedWith('BM_TAKE_BORROW_SUPPLY_AMOUNT_NOT_ALLOWED');
    });
});

describe('bespoke take offer with Token', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, DAI, borrower, TransferAdapterERC721Default, OpenSkyPool } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        ENV.borrowerWallet = borrowerWallet;

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;

        const reserveData = await OpenSkyPool.getReserveData(2); // DAI

        console.log('reserveData', reserveData.oTokenAddress);

        ENV.OfferData = createOfferData(
            ENV,
            {
                offerType: 0,
                reserveId: 2,
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.underlyingAsset,
            },
            borrowerWallet
        );

        ENV.LOAN_ID = 1;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
    });

    it('should take a borrow offer using DAI', async function () {
        const {
            OpenSkyNFT,
            OpenSkyBespokeMarket,
            DAI,
            // OfferData,
            borrower,
            user001: lender,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            TransferAdapterCurrencyDefault,
            borrowerWallet,
        } = ENV;

        const OfferData = createOfferData(
            ENV,
            { offerType: 0, reserveId: 2, currency: DAI.address, lendAsset: DAI.address },
            borrowerWallet
        );

        await DAI.mint(lender.address, parseEther('10'));
        await lender.DAI.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await DAI.balanceOf(lender.address);
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const tokenBalanceAfterTx = await DAI.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await DAI.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(tokenBalanceAfterTx).to.be.equal(tokenBalanceBeforeTx.sub(SUPPLY_BORROW_AMOUNT));
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });
});

describe('bespoke take ERC1155 offer ', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const {
            OpenSkyBespokeMarket,
            OpenSkyERC1155Mock,
            WNative,
            borrower,
            TransferAdapterERC1155Default,
            TransferAdapterCurrencyDefault,
            OpenSkyPool,
        } = ENV;

        await borrower.OpenSkyERC1155Mock.mint(borrower.address, 1, 10, []);

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const reserveData = await OpenSkyPool.getReserveData(1);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        ENV.OfferData = createOfferData(
            ENV,
            {
                offerType: 0,
                tokenAddress: OpenSkyERC1155Mock.address,
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.underlyingAsset,
                tokenId: 1,
                tokenAmount: 10,
                reserveId: 1,
            },
            borrowerWallet
        );

        console.log('currency', reserveData.underlyingAsset);
        console.log('WNative', WNative.address);

        ENV.LOAN_ID = 1;
        ENV.TOKEN_AMOUNT = 10;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyERC1155Mock.setApprovalForAll(TransferAdapterERC1155Default.address, true);
    });

    it('should take a borrow offer', async function () {
        const {
            OpenSkyERC1155Mock,
            OpenSkyBespokeMarket,
            OfferData,
            user001,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            TOKEN_AMOUNT,
            LOAN_ID,
            TransferAdapterERC1155Default,
            TransferAdapterOToken,
            TransferAdapterCurrencyDefault,
            WNative,
        } = ENV;

        // await deposit(user001, 1, SUPPLY_BORROW_AMOUNT);

        await user001.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);

        expect(await OpenSkyERC1155Mock.balanceOf(TransferAdapterERC1155Default.address, 1)).eq(TOKEN_AMOUNT);
    });
});
