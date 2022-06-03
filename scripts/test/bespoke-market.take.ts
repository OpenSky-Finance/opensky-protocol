import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { _TypedDataEncoder } from '@ethersproject/hash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { getTxCost, randomAddress, signBorrowOffer } from '../helpers/utils';
import { ONE_YEAR } from '../helpers/constants';

enum LoanStatus {
    NONE,
    BORROWING,
    OVERDUE,
    LIQUIDATABLE,
    END,
}

describe('bespoke take offer with WETH/ETH', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, WNative, borrower } = ENV;

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
    });

    it('should take a borrow offer using OWETH', async function () {
        const { OpenSkyNFT, OpenSkyOToken, OpenSkyBespokeMarket, WNative, OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        await deposit(user001, 1, SUPPLY_BORROW_AMOUNT);

        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);
        await user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(SUPPLY_BORROW_AMOUNT);
    });

    it('should take a borrow offer using OWETH and WETH if availableLiquidity > oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkyBespokeMarket, OpenSkyOToken, WNative, OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.lt(SUPPLY_BORROW_AMOUNT);

        await user001.WNative.deposit({ value: parseEther('2') });

        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await WNative.balanceOf(user001.address);
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        );
        const tokenBalanceAfterTx = await WNative.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        expect(tokenBalanceBeforeTx.sub(tokenBalanceAfterTx)).eq(
            SUPPLY_BORROW_AMOUNT.sub(oTokenAmount)
        );
    });

    it('should take a borrow offer using OWETH and ETH if availableLiquidity > oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkyBespokeMarket, OpenSkyOToken, WNative, OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);

        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.lt(SUPPLY_BORROW_AMOUNT);

        const ethBalanceBeforeTx = await user001.getETHBalance();
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: SUPPLY_BORROW_AMOUNT }
        );
        const ethBalanceAfterTx = await user001.getETHBalance();

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(ethBalanceBeforeTx.sub(ethBalanceAfterTx)).eq(
            (await getTxCost(tx)).add(SUPPLY_BORROW_AMOUNT).sub(oTokenAmount)
        );
    });

    it('should take a borrow offer using ETH', async function () {
        const { OpenSkyNFT, OpenSkyBespokeMarket, WNative, OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const ethBalanceBeforeTx = await user001.getETHBalance();
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: SUPPLY_BORROW_AMOUNT }
        );

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        const ethBalanceAfterTx = await user001.getETHBalance();
        expect(ethBalanceBeforeTx.sub(ethBalanceAfterTx)).eq(
            (await getTxCost(tx)).add(SUPPLY_BORROW_AMOUNT)
        );
    });

    it('should take a borrow offer using OWETH and ETH if availableLiquidity < oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkySettings, OpenSkyPool, OpenSkyBespokeMarket, OpenSkyOToken, OpenSkyLoan, WNative, OfferData, borrower, user001, user002, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);
        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        await user002.OpenSkyPool.borrow(1, parseEther('0.3'), ONE_YEAR, OpenSkyNFT.address, 3, user002.address);

        const availableLiquidity = await OpenSkyPool.getAvailableLiquidity(1);
        expect(availableLiquidity).to.be.equal(oTokenAmount.sub(parseEther('0.3')));

        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const ethBalanceBeforeTx = await user001.getETHBalance();
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: SUPPLY_BORROW_AMOUNT }
        );
        const ethBalanceAfterTx = await user001.getETHBalance();
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);
        const interest = await OpenSkyLoan.getBorrowInterest(1);
        const treasuryBalance = await OpenSkyOToken.balanceOf(await OpenSkySettings.daoVaultAddress());

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        expect(ethBalanceBeforeTx.sub(ethBalanceAfterTx)).eq(
            (await getTxCost(tx)).add(SUPPLY_BORROW_AMOUNT).sub(availableLiquidity)
        );
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(availableLiquidity.sub(interest.sub(treasuryBalance)));
    });

    it('should take a borrow offer using OWETH and WETH if availableLiquidity < oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkySettings, OpenSkyBespokeMarket, OpenSkyOToken, OpenSkyLoan, WNative, OfferData, borrower, user001, user002, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);
        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        await user002.OpenSkyPool.borrow(1, parseEther('0.3'), ONE_YEAR, OpenSkyNFT.address, 3, user002.address);

        await user001.WNative.deposit({ value: parseEther('10') });

        const availableLiquidity = await OpenSkyPool.getAvailableLiquidity(1);
        expect(availableLiquidity).to.be.equal(oTokenAmount.sub(parseEther('0.3')));

        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await WNative.balanceOf(user001.address);
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        );
        const tokenBalanceAfterTx = await WNative.balanceOf(user001.address);
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);
        const interest = await OpenSkyLoan.getBorrowInterest(1);
        const treasuryBalance = await OpenSkyOToken.balanceOf(await OpenSkySettings.daoVaultAddress());

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        expect(tokenBalanceBeforeTx.sub(tokenBalanceAfterTx)).eq(
            SUPPLY_BORROW_AMOUNT.sub(availableLiquidity)
        );
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(availableLiquidity.sub(interest.sub(treasuryBalance)));
    });

    it('should not take offer if nonce exists', async function () {
        const { OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await borrower.OpenSkyBespokeMarket.cancelMultipleBorrowOffers([constants.One]);

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_NONCE_INVALID');
    });

    it('should not take offer if nonce is less than min nonce', async function () {
        const { OfferData, borrower, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await borrower.OpenSkyBespokeMarket.cancelAllBorrowOffersForSender(constants.Two);

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_NONCE_INVALID');
    });

    it('should not take offer if underlyingAsset != currency', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;
        
        OfferData.currency = randomAddress();

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_OFFER_ASSET_NOT_MATCH');
    });

    it('should not take offer if currency is not on the whitelist', async function () {
        const { OpenSkyBespokeSettings, OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await OpenSkyBespokeSettings.removeCurrency(OfferData.currency);

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_CURRENCY_NOT_IN_WHITELIST');
    });

    it('should not take offer if the offer is expired', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        OfferData.deadline = parseInt(Date.now() / 1000 + '') - 10000,

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_SIGNING_EXPIRATION');
    });

    it('should not take off if the borrow duration is not allowed', async function () {
        const { OpenSkyBespokeSettings, OpenSkyNFT, OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        const config = await OpenSkyBespokeSettings.getBorrowDurationConfig(OpenSkyNFT.address);

        OfferData.borrowDurationMin = parseInt(config.minBorrowDuration_.toString()) - 100;
        OfferData.borrowDurationMax = parseInt(config.maxBorrowDuration_.toString()) + 100;

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_OFFER_DURATION_NOT_ALLOWED');
    });
    
    it('should not take off if the supply duration is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            OfferData.borrowDurationMin - 100
        )).to.revertedWith('BM_TAKE_BORROW_TAKER_DURATION_NOT_ALLOWED');

        OfferData.supplyDuration = OfferData.borrowDurationMax + 100;

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            OfferData.borrowDurationMax + 100
        )).to.revertedWith('BM_TAKE_BORROW_TAKER_DURATION_NOT_ALLOWED');
    });

    it('should not take off if borrow amount is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION } = ENV;

        OfferData.borrowAmountMin = OfferData.borrowAmountMax + 100;

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_OFFER_AMOUNT_NOT_ALLOWED');
    });

    it('should not take off if supply amount is not allowed', async function () {
        const { OfferData, user001, SUPPLY_BORROW_DURATION } = ENV;

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            OfferData.borrowAmountMin.sub(100),
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_SUPPLY_AMOUNT_NOT_ALLOWED');

        await expect(user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            OfferData.borrowAmountMax.add(100),
            SUPPLY_BORROW_DURATION
        )).to.revertedWith('BM_TAKE_BORROW_SUPPLY_AMOUNT_NOT_ALLOWED');
    });
});

describe('bespoke take offer with Token', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, DAI, borrower } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        const OfferData = {
            reserveId: 2,
            nftAddress: OpenSkyNFT.address,
            tokenId: 1,
            tokenAmount: 1,
            borrowAmountMin: BORROW_AMOUNT,
            borrowAmountMax: BORROW_AMOUNT.add(parseEther('1')),
            borrowDurationMin: BORROW_DURATION,
            borrowDurationMax: BORROW_DURATION + 24 * 3600 * 30,
            borrowRate: 2000, // 20%
            currency: DAI.address,
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
    });

    it('should take a borrow offer using DAI', async function () {
        const { OpenSkyNFT, OpenSkyBespokeMarket, DAI, OfferData, borrower, user001: lender, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        await DAI.mint(lender.address, parseEther('10'));
        await lender.DAI.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await DAI.balanceOf(lender.address);
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const tokenBalanceAfterTx = await DAI.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await DAI.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(tokenBalanceAfterTx).to.be.equal(tokenBalanceBeforeTx.sub(SUPPLY_BORROW_AMOUNT));
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should take a borrow offer using oDAI', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyBespokeMarket, DAI, ODAI, OfferData, borrower, user001: lender, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        await DAI.mint(lender.address, parseEther('10'));
        await lender.DAI.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await lender.OpenSkyPool.deposit('2', parseEther('10'), lender.address, 0);
        expect(await ODAI.balanceOf(lender.address)).to.gt(SUPPLY_BORROW_AMOUNT);

        await lender.ODAI.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        const oTokenBalanceBeforeTx = await ODAI.balanceOf(lender.address);
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        const oTokenBalanceAfterTx = await ODAI.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await DAI.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(oTokenBalanceAfterTx).to.be.equal(oTokenBalanceBeforeTx.sub(SUPPLY_BORROW_AMOUNT));
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should take a borrow offer using oDAI and DAI if availableLiquidity > oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyBespokeMarket, ODAI, DAI, OfferData, borrower, user001: lender, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        await DAI.mint(lender.address, parseEther('10'));

        const oTokenAmount = parseEther('0.5');
        await lender.DAI.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await lender.OpenSkyPool.deposit('2', parseEther('0.5'), lender.address, 0);
        expect(await ODAI.balanceOf(lender.address)).to.lt(SUPPLY_BORROW_AMOUNT);

        await lender.DAI.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await lender.ODAI.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await DAI.balanceOf(lender.address);
        const oTokenBalanceBeforeTx = await ODAI.balanceOf(lender.address);
        const tx = await lender.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        );
        const tokenBalanceAfterTx = await DAI.balanceOf(lender.address);
        const oTokenBalanceAfterTx = await ODAI.balanceOf(lender.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await DAI.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        expect(tokenBalanceBeforeTx.sub(tokenBalanceAfterTx)).eq(
            SUPPLY_BORROW_AMOUNT.sub(oTokenAmount)
        );
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(
            oTokenAmount
        );
    });
});

describe('bespoke take ERC1155 offer ', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyERC1155Mock, WNative, borrower } = ENV;

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
    });

    it('should take a borrow offer', async function () {
        const { OpenSkyERC1155Mock, OpenSkyBespokeMarket, OfferData, user001, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, TOKEN_AMOUNT, LOAN_ID } = ENV;

        await deposit(user001, 1, SUPPLY_BORROW_AMOUNT);

        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyBespokeMarket.takeBorrowOffer(OfferData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);

        expect(await OpenSkyERC1155Mock.balanceOf(OpenSkyBespokeMarket.address, 1)).eq(TOKEN_AMOUNT);
    });
});
