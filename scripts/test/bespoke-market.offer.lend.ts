import { ethers } from 'hardhat';
import { parseEther, defaultAbiCoder, arrayify } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { _TypedDataEncoder } from '@ethersproject/hash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { getTxCost, randomAddress } from '../helpers/utils';
import { ONE_YEAR, OFFER_TYPE, BESPOKE_LOAN_STATUS as LoanStatus, ZERO_ADDRESS } from '../helpers/constants';
import { createOfferData } from '../helpers/utils.bespoke';

describe('bespoke take lend offer', function () {
    let ENV: any;
    beforeEach(async () => {
        console.log('beforeEach start');
        ENV = await __setup();
        // @ts-ignore lender
        ENV.lender001Wallet = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);
        ENV.LOAN_ID = 1;
        // supply weth
        // await borrower.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);
    });

    it('should can take a lend offer with type SINGLE and using oTOken', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );

        // lender prepare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);

        // repay
    });

    it('should can take a lend offer with type SINGLE and using oTOken with OnBehalfOf is different with borrower', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            OpenSkyBespokeBorrowNFT,
            WNative,
            // OfferData,
            borrower,
            user001,
            user002,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );

        // lender perpare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            user002.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(1)).eq(user002.address);
        expect(await WNative.balanceOf(user002.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);

        // repay
    });

    it('should can take a lend offer with type SINGLE and without oTOken', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
            TransferAdapterCurrencyDefault,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyTokenId.address,
                lendAsset: reserveData.underlyingAsset,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );

        // lender perpare WETH
        // await deposit(user001, 1, OfferData.borrowAmountMax);
        user001.WNative.deposit({ value: OfferData.borrowAmountMax });
        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(0);

        // repay
    });

    it('should can take a lend offer with type COLLECTION and using oTOken ', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            StrategyAnyInCollection,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);
        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyAnyInCollection.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );

        // lender perpare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);
    });

    it('should can take a lend offer with type COLLECTION multi Times and using oTOken ', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            StrategyAnyInCollection,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);
        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyAnyInCollection.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
                nonceMaxTimes: 2,
            },
            lender001Wallet
        );

        // lender perpare oToken
        // provide money for max 2 offer
        await deposit(user001, 1, OfferData.borrowAmountMax.mul(2));
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);
        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);

        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            2,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );

        await expect(
            borrower.OpenSkyBespokeMarket.takeLendOffer(
                OfferData,
                3,
                BORROW_AMOUNT,
                BORROW_DURATION,
                borrower.address,
                defaultAbiCoder.encode([], []),
                { gasLimit: 4000000 }
            )
        ).to.revertedWith('BM_TAKE_OFFER_NONCE_INVALID');
    });
    
    it('should can take a lend offer with type PRIVATE with oToken ', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            user002,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            StrategyPrivate,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
            TransferAdapterCurrencyDefault,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyPrivate.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
                params: defaultAbiCoder.encode(['address'], [borrower.address])
            },
            lender001Wallet
        );

        // lender prepare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);

    });
    it('should can [not] take a lend offer with type PRIVATE with oToken when PRIVATE_ACCOUNT_NOT_MATCH', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            user002,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            StrategyPrivate,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
            TransferAdapterCurrencyDefault,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyPrivate.address,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
                params: defaultAbiCoder.encode(['address'], [user002.address]) 
            },
            lender001Wallet
        );
        
        await expect(
            borrower.OpenSkyBespokeMarket.takeLendOffer(
                OfferData,
                1,
                OfferData.borrowAmountMin,
                OfferData.borrowDurationMin,
                borrower.address,
                defaultAbiCoder.encode([], []),
                { gasLimit: 4000000 }
            )
        ).to.be.revertedWith('BM_STRATEGY_PRIVATE_ACCOUNT_NOT_MATCH');
        

        // expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        // expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        // expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        // expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);

    });

    it.skip('should can take a lend offer with type MULTIPLE ', async function () {
        const {
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            StrategyAnyInCollection,
            StrategyAnyInSet,
            TransferAdapterERC721Default,
        } = ENV;

        const a = defaultAbiCoder.encode(['uint[]'], [['1', '2', '3']]);
        const b = defaultAbiCoder.decode(['uint[]'], a);
        console.log('a===', a, b);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: StrategyAnyInSet.address,
                params: defaultAbiCoder.encode(['uint256[]'], [['1', '2', '3']]),
            },
            lender001Wallet
        );

        // lender perpare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;
        await borrower.OpenSkyBespokeMarket.takeLendOffer(
            OfferData,
            1,
            BORROW_AMOUNT,
            BORROW_DURATION,
            borrower.address,
            defaultAbiCoder.encode([], []),
            { gasLimit: 4000000 }
        );
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(BORROW_AMOUNT);
    });
    it('should can take a lend offer with type ATTRIBUTE ', async function () {});
    it('should can take a lend offer with type PRIVATE ', async function () {});

    it('should can not take a lend offer when nonce used', async function () {});

    // erc20 not weth
    it('should can take a lend offer which set currency to erc20', async function () {});
    it('should can not take a lend offer which set currency not match', async function () {});

    // nft adapter
    it('should can take a lend with 1155', async function () {});
    it('should can take a lend with customize nft adaptor', async function () {});

    // isProrated
    it('should can take a lend offer and repay when isProrated is true', async function () {});
    it('should can take a lend offer and repay when isProrated is false', async function () {});

    //  repay loan which is triggered by take lend offer
    it('should repay a loan created by taking a lend offer with erc721 as collateral', async function () {});
    it('should repay a loan created by taking a lend offer with erc1155 as collateral', async function () {});

    it('should can not take a lend offer if strategy not in whitelist or zero', async function () {
        const {
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyOToken,
            OpenSkyBespokeMarket,
            WNative,
            // OfferData,
            borrower,
            user001,
            lender001Wallet,
            LOAN_ID,
            StrategyTokenId,
            TransferAdapterERC721Default,
            TransferAdapterOToken,
        } = ENV;

        const reserveData = await OpenSkyPool.getReserveData(1);

        const OfferData = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: ZERO_ADDRESS,
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );
        const OfferData2 = createOfferData(
            ENV,
            {
                offerType: OFFER_TYPE.LEND,
                reserveId: 1,
                strategy: randomAddress(),
                lendAsset: reserveData.oTokenAddress,
                currency: reserveData.underlyingAsset,
            },
            lender001Wallet
        );

        // lender perpare oToken
        await deposit(user001, 1, OfferData.borrowAmountMax);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // borrower approve
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);

        const BORROW_AMOUNT = OfferData.borrowAmountMin;
        const BORROW_DURATION = OfferData.borrowDurationMin;

        await expect(
            borrower.OpenSkyBespokeMarket.takeLendOffer(
                OfferData,
                1,
                BORROW_AMOUNT,
                BORROW_DURATION,
                borrower.address,
                defaultAbiCoder.encode([], []),
                { gasLimit: 4000000 }
            )
        ).to.be.revertedWith('BM_TAKE_LEND_STRATEGY_EMPTY');
        await expect(
            borrower.OpenSkyBespokeMarket.takeLendOffer(
                OfferData2,
                1,
                BORROW_AMOUNT,
                BORROW_DURATION,
                borrower.address,
                defaultAbiCoder.encode([], []),
                { gasLimit: 4000000 }
            )
        ).to.be.revertedWith('BM_TAKE_LEND_STRATEGY_NOT_IN_WHITE_LIST');
    });
});
