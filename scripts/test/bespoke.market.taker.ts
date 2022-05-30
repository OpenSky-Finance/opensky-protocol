import { ethers, deployments, getNamedAccounts } from 'hardhat';
import {
    parseEther,
    formatEther,
    formatUnits,
    parseUnits,
    arrayify,
    defaultAbiCoder,
    keccak256,
    solidityPack,
} from 'ethers/lib/utils';
import { BigNumber, constants, Contract, utils } from 'ethers';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { _TypedDataEncoder } from '@ethersproject/hash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { getCurrentBlockAndTimestamp, getTxCost } from '../helpers/utils';
import { ONE_YEAR } from '../helpers/constants';

enum LoanStatus {
    NONE,
    BORROWING,
    // EXTENDABLE,
    OVERDUE,
    LIQUIDATABLE,
    // LIQUIDATING
    END,
}

function signBorrowOffer(offerData: any, signer: any) {
    const types = [
        'bytes32',
        'uint256', //reserveId
        'address', //nftAddress
        'uint256', //tokenId
        'uint256', //tokenAmount
        'address', //borrower
        'uint256', //amount
        'uint256', //amount2
        'uint256', //borrowDuration
        'uint256', //borrowDuration2
        'uint256', //borrowRate
        'address', //currency
        'uint256', //nonce
        'uint256', //deadline
        // 'bytes32',
    ];

    const values = [
        '0xacdf87371514724eb8e74db090d21dbc2361a02a72e2facac480fe7964ae4feb',
        offerData.reserveId,
        offerData.nftAddress,
        offerData.tokenId,
        offerData.tokenAmount,
        offerData.borrower,
        offerData.borrowAmountMin,
        offerData.borrowAmountMax,
        offerData.borrowDurationMin,
        offerData.borrowDurationMax,
        offerData.borrowRate,
        offerData.currency,
        offerData.nonce,
        offerData.deadline,
        // keccak256(offerData.params),
    ];

    const domain: TypedDataDomain = {
        name: 'OpenSkyBespokeMarket',
        version: '1',
        chainId: '31337', // HRE
        verifyingContract: offerData.verifyingContract,
    };
    const domainSeparator = _TypedDataEncoder.hashDomain(domain);
    const hash = keccak256(defaultAbiCoder.encode(types, values));

    // Compute the digest
    const digest = keccak256(
        solidityPack(['bytes1', 'bytes1', 'bytes32', 'bytes32'], ['0x19', '0x01', domainSeparator, hash])
    );

    return { ...signer._signingKey().signDigest(digest) };
}

describe.only('bespoke take offer', function () {
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
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
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
        const { OpenSkyNFT, OpenSkyPool, OpenSkyBespokeMarket, OpenSkyOToken, OpenSkyLoan, OfferData, user001, user002, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);

        await user002.OpenSkyPool.borrow(1, parseEther('0.3'), ONE_YEAR, OpenSkyNFT.address, 3, user002.address);

        const availableLiquidity = await OpenSkyPool.getAvailableLiquidity(1);
        expect(availableLiquidity).to.be.equal(oTokenAmount.sub(parseEther('0.3')));

        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const ethBalanceBeforeTx = await user001.getETHBalance();
        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: SUPPLY_BORROW_AMOUNT }
        );
        const ethBalanceAfterTx = await user001.getETHBalance();
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);
        const interest = await OpenSkyLoan.getBorrowInterest(1);

        expect(ethBalanceBeforeTx.sub(ethBalanceAfterTx)).eq(
            (await getTxCost(tx)).add(SUPPLY_BORROW_AMOUNT).sub(availableLiquidity)
        );
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(availableLiquidity.sub(interest));
    });

    it('should take a borrow offer using OWETH and WETH if availableLiquidity < oTokenBalance', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyBespokeMarket, OpenSkyOToken, WNative, OfferData, borrower, user001, user002, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION, LOAN_ID } = ENV;

        const oTokenAmount = parseEther('0.5');
        await deposit(user001, 1, oTokenAmount);

        await user002.OpenSkyPool.borrow(1, parseEther('0.3'), ONE_YEAR, OpenSkyNFT.address, 3, user002.address);

        await user001.WNative.deposit({ value: parseEther('10') });

        const availableLiquidity = await OpenSkyPool.getAvailableLiquidity(1);
        expect(availableLiquidity).to.be.equal(oTokenAmount.sub(parseEther('0.3')));

        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        await user001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        const tokenBalanceBeforeTx = await WNative.balanceOf(user001.address);
        console.log('tokenBalanceBeforeTx', tokenBalanceBeforeTx.toString());
        const oTokenBalanceBeforeTx = await OpenSkyOToken.balanceOf(user001.address);
        const tx = await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION
        );
        const tokenBalanceAfterTx = await WNative.balanceOf(user001.address);
        console.log('tokenBalanceAfterTx', tokenBalanceAfterTx.toString());
        const oTokenBalanceAfterTx = await OpenSkyOToken.balanceOf(user001.address);

        expect(tokenBalanceBeforeTx.sub(tokenBalanceAfterTx)).eq(
            SUPPLY_BORROW_AMOUNT.sub(availableLiquidity)
        );
        expect(oTokenBalanceBeforeTx.sub(oTokenBalanceAfterTx)).eq(availableLiquidity);
    });
});

/*
describe('bespoke repay', function () {
    async function signAnOfferAndMakeItTaked(env: any, taker: any) {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            env;

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        {
            var BORROW_AMOUNT = parseEther('1');
            var BORROW_DURATION = 24 * 3600 * 7;
            var offerData: any;
            offerData = {
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
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                // params: defaultAbiCoder.encode([], []),
                verifyingContract: OpenSkyBespokeMarket.address,
            };

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
            // console.log(offerData);

            var SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
            var SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;
        }

        {
            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            // prepare oToken
            await taker.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
            await taker.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await taker.OpenSkyPool.deposit('1', SUPPLY_BORROW_AMOUNT, buyer001.address, 0);
            await taker.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            // take
            await taker.OpenSkyBespokeMarket.takeBorrowOffer(offerData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        }

        // check
        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    }

    it('should take a borrow offer using ERC20/WETH currency ', async function () {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            await __setup();

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        let BORROW_AMOUNT = parseEther('1');
        let BORROW_DURATION = 24 * 3600 * 7;
        let offerData: any;
        offerData = {
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
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            // params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

        offerData = { ...offerData, ...signResult };
        // console.log(offerData);

        const SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        const SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);
        // prepare oWETH
        await buyer001.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
        await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await buyer001.OpenSkyPool.deposit('1', SUPPLY_BORROW_AMOUNT, buyer001.address, 0);
        await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(offerData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await WNative.balanceOf(buyer001.address)).eq(0);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should take a borrow offer [totaly] using ETH when underlying is WETH', async function () {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            await __setup();

        const INFO: any = {};
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        let BORROW_AMOUNT = parseEther('1');
        let BORROW_DURATION = 24 * 3600 * 7;
        let offerData: any;
        offerData = {
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
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            // params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

        offerData = { ...offerData, ...signResult };
        const SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        const SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

        // prepare oWETH
        // await buyer001.WNative.deposit({ value: BORROW_AMOUNT });
        // await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        // await buyer001.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
        await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        INFO.eth_balanceOf_buyer001_1 = await buyer001.getETHBalance();
        const tx = await buyer001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            offerData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: SUPPLY_BORROW_AMOUNT }
        );

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        INFO.eth_balanceOf_buyer001_2 = await buyer001.getETHBalance();
        expect(INFO.eth_balanceOf_buyer001_1.sub(INFO.eth_balanceOf_buyer001_2)).eq(
            (await getTxCost(tx)).add(SUPPLY_BORROW_AMOUNT)
        );
    });

    it('should take a borrow offer [partly] using ETH when underlying is WETH', async function () {
        const {
            OpenSkyBespokeMarket,
            OpenSkyNFT,
            OpenSkyPool,
            OpenSkyOToken,
            WNative,
            OpenSkyBespokeLoanNFT,
            nftStaker,
            buyer001,
        } = await __setup();

        const INFO: any = {};
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        let BORROW_AMOUNT = parseEther('1');
        let BORROW_DURATION = 24 * 3600 * 7;
        let offerData: any;
        offerData = {
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
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            // params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

        offerData = { ...offerData, ...signResult };
        const SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        const SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        const OTOKEN_PREPARE = SUPPLY_BORROW_AMOUNT.div(2);
        const ETH_TO_CONSUME = SUPPLY_BORROW_AMOUNT.sub(OTOKEN_PREPARE);

        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

        // prepare some oWETH but less than BORROW_AMOUNT
        await buyer001.WNative.deposit({ value: OTOKEN_PREPARE });
        await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await buyer001.OpenSkyPool.deposit('1', OTOKEN_PREPARE, buyer001.address, 0);
        await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        expect(await OpenSkyOToken.balanceOf(buyer001.address)).eq(OTOKEN_PREPARE);

        INFO.eth_balanceOf_buyer001_1 = await buyer001.getETHBalance();
        const tx = await buyer001.OpenSkyBespokeMarket.takeBorrowOfferETH(
            offerData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            { value: OTOKEN_PREPARE }
        );

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(SUPPLY_BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        // oTOken consumed out
        expect(await OpenSkyOToken.balanceOf(buyer001.address)).eq(0);

        INFO.eth_balanceOf_buyer001_2 = await buyer001.getETHBalance();
        expect(INFO.eth_balanceOf_buyer001_1.sub(INFO.eth_balanceOf_buyer001_2)).eq(
            (await getTxCost(tx)).add(ETH_TO_CONSUME)
        );
    });

    it('should repay a loan using [ERC20/WETH] before liquidatable', async function () {
        const env: any = await __setup();
        const {
            OpenSkyBespokeMarket,
            OpenSkyBespokeLoanNFT,
            OpenSkyNFT,
            OpenSkyPool,
            OpenSkyOToken,
            WNative,
            nftStaker,
            deployer,
            buyer001,
            buyer002,
            liquidator,
        } = ENV;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        {
            // offer
            var BORROW_AMOUNT = parseEther('1');
            var BORROW_DURATION = 24 * 3600 * 7;
            var offerData: any;
            offerData = {
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
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                // params: defaultAbiCoder.encode([], []),
                verifyingContract: OpenSkyBespokeMarket.address,
            };

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
            var SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
            var SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;
        }

        {
            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            // take offer
            // prepare oWETH
            await buyer001.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
            await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await buyer001.OpenSkyPool.deposit('1', SUPPLY_BORROW_AMOUNT, buyer001.address, 0);
            await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(
                offerData,
                SUPPLY_BORROW_AMOUNT,
                SUPPLY_BORROW_DURATION
            );
        }
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);

        await advanceTimeAndBlock(3 * 24 * 3600);

        //repay
        INFO.borrowBalance = await OpenSkyBespokeMarket.getBorrowBalance(LOAN_ID);
        INFO.penalty = await OpenSkyBespokeMarket.getPenalty(LOAN_ID);
        INFO.repayAmount = INFO.borrowBalance.add(INFO.penalty).add(parseEther('0.1')); // add extra incase

        // prepare asset, here is WETH
        await nftStaker.WNative.deposit({ value: INFO.repayAmount.sub(SUPPLY_BORROW_AMOUNT) });

        // console.log(INFO);
        await nftStaker.WNative.approve(OpenSkyBespokeMarket.address, INFO.repayAmount);
        await nftStaker.OpenSkyBespokeMarket.repay(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(1)).eq(nftStaker.address);
    });

    it('should repay a loan using [ETH] before liquidatable when underlying is WETH', async function () {
        const env: any = await __setup();
        const {
            OpenSkyBespokeMarket,
            OpenSkyBespokeLoanNFT,
            OpenSkyNFT,
            OpenSkyPool,
            OpenSkyOToken,
            WNative,
            nftStaker,
            deployer,
            buyer001,
            buyer002,
            liquidator,
        } = env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        {
            // offer
            var BORROW_AMOUNT = parseEther('1');
            var BORROW_DURATION = 24 * 3600 * 7;
            var offerData: any;
            offerData = {
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
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                // params: defaultAbiCoder.encode([], []),
                verifyingContract: OpenSkyBespokeMarket.address,
            };

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
            var SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
            var SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;
        }

        {
            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            // take offer
            // prepare oWETH
            await buyer001.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
            await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await buyer001.OpenSkyPool.deposit('1', SUPPLY_BORROW_AMOUNT, buyer001.address, 0);
            await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(
                offerData,
                SUPPLY_BORROW_AMOUNT,
                SUPPLY_BORROW_DURATION
            );
        }
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeMarket.address);

        await advanceTimeAndBlock(3 * 24 * 3600);

        //repay
        INFO.borrowBalance = await OpenSkyBespokeMarket.getBorrowBalance(LOAN_ID);
        INFO.penalty = await OpenSkyBespokeMarket.getPenalty(LOAN_ID);
        INFO.repayAmount = INFO.borrowBalance.add(INFO.penalty).add(parseEther('0.1')); // add extra incase

        // // prepare asset, here is WETH
        // await nftStaker.WNative.deposit({ value: INFO.repayAmount.sub(BORROW_AMOUNT) });
        //
        // console.log(INFO);
        // await nftStaker.WNative.approve(OpenSkyBespokeMarket.address, INFO.repayAmount);
        //
        await nftStaker.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: INFO.repayAmount });

        expect(await OpenSkyNFT.ownerOf(1)).eq(nftStaker.address);
    });

    it('should not repay a loan when liquidatable', async function () {
        const { OpenSkyBespokeMarket, OpenSkyPool, WNative, OpenSkyNFT, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            ENV;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        await signAnOfferAndMakeItTaked(ENV, buyer001);

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);
        INFO.status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(INFO.status).eq(LoanStatus.LIQUIDATABLE);

        expect(nftStaker.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: INFO.repayAmount })).revertedWith(
            'BM_REPAY_STATUS_ERROR'
        );
        expect(nftStaker.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BM_REPAY_STATUS_ERROR');
    });

    it('should forclose a loan when liquidatable', async function () {
        const env: any = await __setup();
        const { OpenSkyBespokeMarket, OpenSkyPool, OpenSkyNFT, nftStaker, buyer001, buyer002 } = env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        await signAnOfferAndMakeItTaked(env, buyer001);

        // hard code. SUPPLY_BORROW_DURATION
        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);

        INFO.status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(INFO.status).eq(LoanStatus.LIQUIDATABLE);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).eq(OpenSkyBespokeMarket.address);

        await buyer001.OpenSkyBespokeMarket.forclose(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).eq(buyer001.address);
    });

    it('should be in different status when time pass', async function () {
        const env: any = await __setup();

        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            env;

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        INFO.status_0 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        {
            var BORROW_AMOUNT = parseEther('1');
            var BORROW_DURATION = 24 * 3600 * 7;
            var offerData: any;
            offerData = {
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
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                // params: defaultAbiCoder.encode([], []),
                verifyingContract: OpenSkyBespokeMarket.address,
            };

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
            // console.log(offerData);

            var SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
            var SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;
        }

        {
            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            // prepare oToken
            await buyer001.WNative.deposit({ value: SUPPLY_BORROW_AMOUNT });
            await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await buyer001.OpenSkyPool.deposit('1', SUPPLY_BORROW_AMOUNT, buyer001.address, 0);
            await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            // take
            await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(offerData, SUPPLY_BORROW_AMOUNT, SUPPLY_BORROW_DURATION);
        }

        INFO.status_1 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        await advanceTimeAndBlock(SUPPLY_BORROW_DURATION + 100);
        INFO.status_2 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        await advanceTimeAndBlock(2 * 24 * 3600);
        INFO.status_3 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        expect(INFO.status_0).eq(LoanStatus.NONE);
        expect(INFO.status_1).eq(LoanStatus.BORROWING);
        expect(INFO.status_2).eq(LoanStatus.OVERDUE);
        expect(INFO.status_3).eq(LoanStatus.LIQUIDATABLE);

        // console.log(INFO);
    });
});
describe('bespoke-settings', function () {
    it('settings', async function () {
        const {
            OpenSkyBespokeSettings,
            OpenSkyBespokeMarket,
            OpenSkyNFT,
            OpenSkyPool,
            WNative,
            OpenSkyBespokeLoanNFT,
            nftStaker,
            buyer001,
        } = await __setup();
        expect(await OpenSkyBespokeSettings.isWhitelistOn()).eq(false);
        await OpenSkyBespokeSettings.openWhitelist();
        expect(await OpenSkyBespokeSettings.isWhitelistOn()).eq(true);
        await OpenSkyBespokeSettings.closeWhitelist();
        expect(await OpenSkyBespokeSettings.isWhitelistOn()).eq(false);
    });
});
describe('bespoke.nft', function () {
    // transfer repay. one or both
});
describe('bespoke.1155', function () { });
describe('bespoke.signing', function () { });
*/