import { ethers } from 'hardhat';
import { parseEther, defaultAbiCoder, keccak256, formatEther } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { _TypedDataEncoder } from '@ethersproject/hash';
import _ from 'lodash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { advanceTimeAndBlock, getTxCost, randomAddress } from '../helpers/utils';
import { ONE_YEAR, OFFER_TYPE, BESPOKE_LOAN_STATUS, ONE_ETH } from '../helpers/constants';
import { createOfferData, decodeOfferData, encodeOfferData } from '../helpers/utils.bespoke';

describe('bespoke refinance', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyBespokeMarket, OpenSkyNFT, WNative, borrower, user001, user002, TransferAdapterOToken } = ENV;
        // @ts-ignore lender
        const user001Wallet = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);
        // @ts-ignore lender
        const user002Wallet = new ethers.Wallet(process.env.TEST_ACCOUNT_2_KEY, ethers.provider);

        const WALLETS: any = {
            user001: user001Wallet,
            user002: user002Wallet,
        };
        ENV.WALLETS = WALLETS;

        // prepare liquidity for offer
        await deposit(user001, 1, parseEther('50'));
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
    });

    it('[bespoke to bespoke] should can extend a loan and borrow [more]', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            OpenSkyBespokeDataProvider,
            WNative,
            borrower,
            user001,
            user002,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            OpenSkyBespokeBorrowNFT,
            StrategyTokenId,
            TransferAdapterERC721Default,
            BespokeToBespokeAdapter,
            WALLETS,
            TransferAdapterCurrencyDefault,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                // reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );
        // lender user001 prepare oToken.  done in beforeEach
        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            parseEther('1'),
            OfferData.borrowDurationMin,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        // //////////////////////////////////////////////////////
        // offer 2
        const OfferData2 = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                // reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('2'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user002
        );
        // lender user002 prepare oToken
        await deposit(user002, 1, OfferData2.borrowAmountMax);
        await user002.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        //  ////////////////////////////////////////////////////////
        // refinance
        // prepare info
        const loan = await OpenSkyBespokeDataProvider.getLoanData(1);
        const flashBorrow = {
            asset: WNative.address, // loan.currency, //!!! should be underlying
            amount: loan.borrowBalance.add(loan.penalty).add(parseEther('0.1')), // add extra
        };
        const borrowInfo = {
            // reserveId: 1,
            amount: parseEther('3'), // should be less than ltv * price oracle
            duration: 24 * 3600 * 10,
            offer: OfferData2,
        };
        const CURRENT_LOAN_ID = 1;

        // encode params
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'bytes'],
            [CURRENT_LOAN_ID, borrowInfo.amount, borrowInfo.duration, encodeOfferData(borrowInfo.offer)]
        );

        //  refinance
        // prepare loan NFT
        await borrower.OpenSkyBespokeBorrowNFT.approve(BespokeToBespokeAdapter.address, 1);
        await borrower.OpenSkyRefinance.refinance(
            BespokeToBespokeAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(2)).eq(borrower.address);
    });
    it('[bespoke to bespoke] should can extend a loan and borrow [less]', async function () {
        // borrow 2 then refiannce to 1
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            OpenSkyBespokeDataProvider,
            WNative,
            borrower,
            user001,
            user002,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            OpenSkyBespokeBorrowNFT,
            StrategyTokenId,
            TransferAdapterERC721Default,
            BespokeToBespokeAdapter,
            TransferAdapterOToken,
            WALLETS,
        } = ENV;
        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );
        // lender user001 prepare oToken.  done in beforeEach
        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            parseEther('2'),
            OfferData.borrowDurationMin,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        // //////////////////////////////////////////////////////
        // offer 2
        const OfferData2 = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user002
        );
        // lender user002 prepare oToken
        await deposit(user002, 1, OfferData2.borrowAmountMax);
        await user002.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // //  ////////////////////////////////////////////////////////
        // refinance
        // prepare info
        const loan = await OpenSkyBespokeDataProvider.getLoanData(1);
        const flashBorrow = {
            asset: loan.currency,
            amount: loan.borrowBalance.add(loan.penalty).add(parseEther('0.1')), // add extra
        };
        const borrowInfo = {
            reserveId: 1,
            amount: parseEther('1'), // should be less than ltv * price oracle
            duration: 24 * 3600 * 10,
            offer: OfferData2,
        };
        const CURRENT_LOAN_ID = 1;

        // encode params
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'bytes'],
            [CURRENT_LOAN_ID, borrowInfo.amount, borrowInfo.duration, encodeOfferData(borrowInfo.offer)]
        );

        //  refinance
        // approve loanNft
        await borrower.OpenSkyBespokeBorrowNFT.approve(BespokeToBespokeAdapter.address, 1);

        // TODO calculate exactly how much  borrower need to provide
        // prepare weth
        await borrower.WNative.deposit({ value: parseEther('1.5') });
        await borrower.WNative.approve(BespokeToBespokeAdapter.address, parseEther('1.5'));

        // prepare loan NFT
        await borrower.OpenSkyBespokeBorrowNFT.approve(BespokeToBespokeAdapter.address, 1);
        await borrower.OpenSkyRefinance.refinance(
            BespokeToBespokeAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(2)).eq(borrower.address);
    });

    it('[pool to bespoke] should can extend a loan and borrow [more]', async function () {
        const {
            OpenSkyPool,
            OpenSkyDataProvider,
            OpenSkyNFT,
            WNative,
            OpenSkyLoan,
            borrower,
            WALLETS,
            StrategyTokenId,
            PoolToBespokeAdapter,
            OpenSkyBespokeBorrowNFT,
        } = ENV;

        // step1 borrow from a pool
        await borrower.OpenSkyPool.borrow(1, parseEther('2'), ONE_YEAR, OpenSkyNFT.address, 1, borrower.address);

        // console.log(await WNative.balanceOf(borrower.address));
        expect(await WNative.balanceOf(borrower.address)).eq(parseEther('2'));
        await advanceTimeAndBlock(8 * 3600);

        const reserveData = await OpenSkyPool.getReserveData(1);

        // step2: offer
        const offerData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );

        // step3: extend
        // prepare data
        const POOL_LOAN_ID = 1;
        const poolLoanData = await OpenSkyDataProvider.getLoanData(POOL_LOAN_ID);

        const flashBorrow = {
            asset: reserveData.underlyingAsset,
            amount: poolLoanData.borrowBalance.add(poolLoanData.penalty),
        };
        // TODO check:add 0.1eth extra for interest may growing before on chain
        flashBorrow.amount = flashBorrow.amount.add(parseEther('0.1'));
        // console.log('flashBorrow', flashBorrow, formatEther(flashBorrow.amount));

        const borrowInfo = {
            borrowAmount: parseEther('3'),
            borrowDuration: offerData.borrowDurationMin,
        };

        // encode params
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'bytes'],
            [POOL_LOAN_ID, borrowInfo.borrowAmount, borrowInfo.borrowDuration, encodeOfferData(offerData)]
        );

        // prepare loan NFT
        await borrower.OpenSkyLoan.approve(PoolToBespokeAdapter.address, 1);

        await borrower.OpenSkyRefinance.refinance(
            PoolToBespokeAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(1)).eq(borrower.address);
    });
    it('[pool to bespoke] should can extend a loan and borrow [less]', async function () {
        const {
            OpenSkyPool,
            OpenSkyDataProvider,
            OpenSkyNFT,
            WNative,
            OpenSkyLoan,
            borrower,
            WALLETS,
            StrategyTokenId,
            PoolToBespokeAdapter,
            OpenSkyBespokeBorrowNFT,
        } = ENV;
        // step1 borrow from a pool
        await borrower.OpenSkyPool.borrow(1, parseEther('2'), ONE_YEAR, OpenSkyNFT.address, 1, borrower.address);

        // console.log(await WNative.balanceOf(borrower.address));
        expect(await WNative.balanceOf(borrower.address)).eq(parseEther('2'));
        await advanceTimeAndBlock(8 * 3600);

        const reserveData = await OpenSkyPool.getReserveData(1);

        // step2: offer
        const offerData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );

        // step3: extend
        // prepare data
        const POOL_LOAN_ID = 1;
        const poolLoanData = await OpenSkyDataProvider.getLoanData(POOL_LOAN_ID);

        const flashBorrow = {
            asset: reserveData.underlyingAsset,
            amount: poolLoanData.borrowBalance.add(poolLoanData.penalty),
        };
        // TODO check:add 0.1eth extra for interest may growing before on chain
        flashBorrow.amount = flashBorrow.amount.add(parseEther('0.1'));
        // console.log('flashBorrow', flashBorrow, formatEther(flashBorrow.amount));

        const borrowInfo = {
            borrowAmount: parseEther('1'),
            borrowDuration: offerData.borrowDurationMin,
        };

        // encode params
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'bytes'],
            [POOL_LOAN_ID, borrowInfo.borrowAmount, borrowInfo.borrowDuration, encodeOfferData(offerData)]
        );

        // TODO calculate exactly how much  borrower need to provide
        // prepare weth
        await borrower.WNative.deposit({ value: parseEther('1.5') });
        await borrower.WNative.approve(PoolToBespokeAdapter.address, parseEther('1.5'));

        // prepare loan NFT
        await borrower.OpenSkyLoan.approve(PoolToBespokeAdapter.address, 1);

        await borrower.OpenSkyRefinance.refinance(
            PoolToBespokeAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(1)).eq(borrower.address);
    });

    it('[bespoke to pool] should can extend a loan and borrow [more]', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyLoan,
            OpenSkyBespokeMarket,
            WNative,
            borrower,
            user001,
            user002,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            OpenSkyBespokeBorrowNFT,
            OpenSkyBespokeDataProvider,
            StrategyTokenId,
            TransferAdapterERC721Default,
            BespokeToBespokeAdapter,
            BespokeToPoolAdapter,
            WALLETS,
        } = ENV;
        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );
        // lender prepare oToken in before each module

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1, // token if
            parseEther('2'), //BORROW_AMOUNT,
            OfferData.borrowDurationMin,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        // refinance to pool

        const loan = await OpenSkyBespokeDataProvider.getLoanData(1);
        const flashBorrow = {
            asset: loan.currency,
            amount: loan.borrowBalance.add(loan.penalty),
        };
        // add extra
        flashBorrow.amount = flashBorrow.amount.add(parseEther('0.1'));
        // console.log('flashBorrow', flashBorrow, formatEther(flashBorrow.amount));
        //
        // function borrow(
        //     uint256 reserveId,
        //     uint256 amount,
        //     uint256 duration,
        //     address nftAddress,
        //     uint256 tokenId,
        //     address onBehalfOf
        // )
        const borrowInfo = {
            reserveId: 1,
            amount: parseEther('3'), // should be less than ltv * price oracle
            duration: 24 * 3600 * 10, //
            onBehalfOf: borrower.address,
            // nftAddress: loan.nftAddress,
            // tokenId: loan.tokenId,
        };

        const BESPOKE_LOAN_ID = 1; //
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint256', 'address'],
            [BESPOKE_LOAN_ID, borrowInfo.reserveId, borrowInfo.amount, borrowInfo.duration, borrowInfo.onBehalfOf]
        );

        // prepare loan NFT
        await borrower.OpenSkyBespokeBorrowNFT.approve(BespokeToPoolAdapter.address, 1);
        await borrower.OpenSkyRefinance.refinance(
            BespokeToPoolAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );

        expect(await OpenSkyLoan.ownerOf(1)).eq(borrowInfo.onBehalfOf);
    });
    it('[bespoke to pool] should can extend a loan and borrow [less]', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyLoan,
            OpenSkyBespokeMarket,
            WNative,
            borrower,
            user001,
            user002,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            LOAN_ID,
            OpenSkyBespokeBorrowNFT,
            OpenSkyBespokeDataProvider,
            StrategyTokenId,
            TransferAdapterERC721Default,
            BespokeToBespokeAdapter,
            BespokeToPoolAdapter,
            WALLETS,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                borrowAmountMin: parseEther('1'),
                borrowAmountMax: parseEther('5'),
                currency: reserveData.underlyingAsset,
                lendAsset: reserveData.oTokenAddress,
            },
            WALLETS.user001
        );
        // lender prepare oToken in before each module

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1, // token if
            parseEther('2'), //BORROW_AMOUNT,
            OfferData.borrowDurationMin,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        // refinance to pool

        const loan = await OpenSkyBespokeDataProvider.getLoanData(1);
        const flashBorrow = {
            asset: loan.currency,
            amount: loan.borrowBalance.add(loan.penalty),
        };
        // add extra
        flashBorrow.amount = flashBorrow.amount.add(parseEther('0.1'));
        // console.log('flashBorrow', flashBorrow, formatEther(flashBorrow.amount));
        //
        // function borrow(
        //     uint256 reserveId,
        //     uint256 amount,
        //     uint256 duration,
        //     address nftAddress,
        //     uint256 tokenId,
        //     address onBehalfOf
        // )
        const borrowInfo = {
            reserveId: 1,
            amount: parseEther('1'), // should be less than ltv * price oracle
            duration: 24 * 3600 * 10, //
            onBehalfOf: borrower.address,
            // nftAddress: loan.nftAddress,
            // tokenId: loan.tokenId,
        };

        const BESPOKE_LOAN_ID = 1; //
        const params = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint256', 'address'],
            [BESPOKE_LOAN_ID, borrowInfo.reserveId, borrowInfo.amount, borrowInfo.duration, borrowInfo.onBehalfOf]
        );

        // TODO calculate exactly how much  borrower need to provide
        // prepare weth
        await borrower.WNative.deposit({ value: parseEther('1.5') });
        await borrower.WNative.approve(BespokeToPoolAdapter.address, parseEther('1.5'));

        // prepare loan NFT
        await borrower.OpenSkyBespokeBorrowNFT.approve(BespokeToPoolAdapter.address, 1);
        await borrower.OpenSkyRefinance.refinance(
            BespokeToPoolAdapter.address,
            flashBorrow.asset,
            flashBorrow.amount,
            params
        );

        expect(await OpenSkyLoan.ownerOf(1)).eq(borrowInfo.onBehalfOf);
    });
});
