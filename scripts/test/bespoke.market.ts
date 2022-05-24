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
import {
    waitForTx,
    advanceBlocks,
    advanceTimeAndBlock,
    getTxCost,
    getCurrentBlockAndTimestamp,
    almostEqual,
    getETHBalance,
    checkEvent,
} from '../helpers/utils';
import _ from 'lodash';

import { __setup } from './__setup';
import { ENV } from './__types';

enum LoanStatus {
    NONE,
    BORROWING,
    // EXTENDABLE,
    OVERDUE,
    LIQUIDATABLE,
    // LIQUIDATING
    END,
}

describe.only('bespoke', function () {
    function signBorrowOffer(offerData: any, signer: any) {
        const types = [
            'bytes32',
            'uint256', //reserveId
            'address', //nftAddress
            'uint256', //tokenId
            'uint256', //tokenAmount
            'address', //borrower
            'uint256', //amount
            'uint256', //borrowDuration
            'uint256', //borrowRate
            'address', //currency
            'uint256', //nonce
            'uint256', //deadline
            'bytes32',
        ];

        const values = [
            '0x71c250d0adf21aff86e82a289e43cfb27864dda4c2bbe98b4c669556501fc4d7',
            offerData.reserveId,
            offerData.nftAddress,
            offerData.tokenId,
            offerData.tokenAmount,
            offerData.borrower,
            offerData.amount,
            offerData.borrowDuration,
            offerData.borrowRate,
            offerData.currency,
            offerData.nonce,
            offerData.deadline,
            keccak256(offerData.params),
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

    async function signAnOfferAndMakeItTaked(env: any, taker: any) {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            env;

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');

        let offerData: any = {
            reserveId: 1,
            nftAddress: OpenSkyNFT.address,
            tokenId: 1,
            tokenAmount: 1,
            amount: BORROW_AMOUNT,
            borrowDuration: 24 * 3600 * 7,
            borrowRate: 2000, // 20%
            currency: WNative.address,
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            params: defaultAbiCoder.encode([], []),
            verifyingContract: OpenSkyBespokeMarket.address,
        };

        // sign
        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);
        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);
        offerData = { ...offerData, ...signResult };

        // prepare oToken
        await taker.WNative.deposit({ value: BORROW_AMOUNT });
        await taker.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await taker.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
        await taker.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        // take
        await taker.OpenSkyBespokeMarket.takeBorrowOffer(offerData);
        //
        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(BORROW_AMOUNT);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    }

    // shared  default config
    const BORROW_AMOUNT = parseEther('1');

    it('should can [make a borrow offer] by singing and be [taked] using ERC20/WETH currency ', async function () {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            await __setup();

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');

        let offerData: any = {
            reserveId: 1,
            nftAddress: OpenSkyNFT.address,
            tokenId: 1,
            tokenAmount: 1,
            amount: BORROW_AMOUNT,
            borrowDuration: 24 * 3600 * 7,
            borrowRate: 2000, // 20%
            currency: WNative.address,
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            params: defaultAbiCoder.encode([], []),

            verifyingContract: OpenSkyBespokeMarket.address,
        };

        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

        offerData = { ...offerData, ...signResult };
        // console.log(offerData);

        // prepare oWETH
        await buyer001.WNative.deposit({ value: BORROW_AMOUNT });
        await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        await buyer001.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
        await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(offerData);

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);
        expect(await WNative.balanceOf(nftStaker.address)).eq(BORROW_AMOUNT);
        expect(await WNative.balanceOf(buyer001.address)).eq(0);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should can [make a borrow offer] by singing and be [taked] using ETH ', async function () {
        const { OpenSkyBespokeMarket, OpenSkyNFT, OpenSkyPool, WNative, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            await __setup();

        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');

        let offerData: any = {
            reserveId: 1,
            nftAddress: OpenSkyNFT.address,
            tokenId: 1,
            tokenAmount: 1,
            amount: BORROW_AMOUNT,
            borrowDuration: 24 * 3600 * 7,
            borrowRate: 2000, // 20%
            currency: WNative.address,
            borrower: wallet['nftStaker'].address,
            //
            nonce: constants.Zero,
            deadline: Date.now() + 24 * 3600 * 7,
            params: defaultAbiCoder.encode([], []),

            verifyingContract: OpenSkyBespokeMarket.address,
        };

        await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

        const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

        offerData = { ...offerData, ...signResult };

        // prepare oWETH
        // await buyer001.WNative.deposit({ value: BORROW_AMOUNT });
        // await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
        // await buyer001.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
        await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await buyer001.OpenSkyBespokeMarket.takeBorrowOfferETH(offerData, { value: BORROW_AMOUNT });

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);
        // expect(await WNative.balanceOf(nftStaker.address)).eq(BORROW_AMOUNT);
        // expect(await WNative.balanceOf(buyer001.address)).eq(0);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });

    it('should can [repay] a loan using [ERC20/WETH] before liquidatable', async function () {
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
        const BORROW_AMOUNT = parseEther('1');
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        {
            // offer
            var offerData: any = {
                reserveId: 1,
                nftAddress: OpenSkyNFT.address,
                tokenId: 1,
                tokenAmount: 1,
                amount: BORROW_AMOUNT,
                borrowDuration: 24 * 3600 * 7,
                borrowRate: 2000, // 20%
                currency: WNative.address,
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                params: defaultAbiCoder.encode([], []),

                verifyingContract: OpenSkyBespokeMarket.address,
            };

            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
        }

        {
            // take offer
            // prepare oWETH
            await buyer001.WNative.deposit({ value: BORROW_AMOUNT });
            await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await buyer001.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
            await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(offerData);
        }
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);

        await advanceTimeAndBlock(3 * 24 * 3600);

        //repay
        INFO.borrowBalance = await OpenSkyBespokeMarket.getBorrowBalance(LOAN_ID);
        INFO.penalty = await OpenSkyBespokeMarket.getPenalty(LOAN_ID);
        INFO.repayAmount = INFO.borrowBalance.add(INFO.penalty).add(parseEther('0.1')); // add extra incase

        // prepare asset, here is WETH
        await nftStaker.WNative.deposit({ value: INFO.repayAmount.sub(BORROW_AMOUNT) });

        // console.log(INFO);
        await nftStaker.WNative.approve(OpenSkyBespokeMarket.address, INFO.repayAmount);
        await nftStaker.OpenSkyBespokeMarket.repay(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(1)).eq(nftStaker.address);
    });

    it('should can [repay] a loan using [ETH] before liquidatable when underlying is WETH', async function () {
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
        const BORROW_AMOUNT = parseEther('1');
        const wallet: any = {};
        // @ts-ignore
        wallet['nftStaker'] = new ethers.Wallet(process.env.TEST_ACCOUNT_1_KEY, ethers.provider);

        {
            // offer
            var offerData: any = {
                reserveId: 1,
                nftAddress: OpenSkyNFT.address,
                tokenId: 1,
                tokenAmount: 1,
                amount: BORROW_AMOUNT,
                borrowDuration: 24 * 3600 * 7,
                borrowRate: 2000, // 20%
                currency: WNative.address,
                borrower: wallet['nftStaker'].address,
                //
                nonce: constants.Zero,
                deadline: Date.now() + 24 * 3600 * 7,
                params: defaultAbiCoder.encode([], []),

                verifyingContract: OpenSkyBespokeMarket.address,
            };

            await nftStaker.OpenSkyNFT.setApprovalForAll(OpenSkyBespokeMarket.address, true);

            const signResult = signBorrowOffer(offerData, wallet['nftStaker']);

            offerData = { ...offerData, ...signResult };
        }

        {
            // take offer
            // prepare oWETH
            await buyer001.WNative.deposit({ value: BORROW_AMOUNT });
            await buyer001.WNative.approve(OpenSkyPool.address, ethers.constants.MaxUint256);
            await buyer001.OpenSkyPool.deposit('1', BORROW_AMOUNT, buyer001.address, 0);
            await buyer001.OpenSkyOToken.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

            await buyer001.OpenSkyBespokeMarket.takeBorrowOffer(offerData);
        }
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);

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

    it('should [ can not repay] a loan using [ETH] before liquidatable', async function () {
        const env: any = await __setup();
        const { OpenSkyBespokeMarket, OpenSkyPool, WNative, OpenSkyNFT, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        await signAnOfferAndMakeItTaked(env, buyer001);

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100);
        INFO.status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(INFO.status).eq(LoanStatus.LIQUIDATABLE);

        expect(nftStaker.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: INFO.repayAmount })).revertedWith(
            'BP_REPAY_STATUS_ERROR'
        );
        expect(nftStaker.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BP_REPAY_STATUS_ERROR');
    });

    it('should can [forclose] a loan when liquidatable', async function () {
        const env: any = await __setup();
        const {
            OpenSkyBespokeMarket,
            OpenSkyPool,
            WNative,
            OpenSkyNFT,
            OpenSkyBespokeLoanNFT,
            nftStaker,
            deployer,
            buyer001,
            buyer002,
        } = env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        await signAnOfferAndMakeItTaked(env, buyer001);

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100);

        INFO.status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(INFO.status).eq(LoanStatus.LIQUIDATABLE);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).eq(OpenSkyBespokeLoanNFT.address);

        await buyer001.OpenSkyBespokeMarket.forclose(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).eq(buyer001.address);
    });

    it('should be in different status when time pass', async function () {
        const env: any = await __setup();
        const { OpenSkyBespokeMarket, OpenSkyPool, WNative, nftStaker, deployer, buyer001, buyer002 } = env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        INFO.status_0 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        await signAnOfferAndMakeItTaked(env, buyer001);

        INFO.status_1 = await OpenSkyBespokeMarket.getStatus(LOAN_ID);

        await advanceTimeAndBlock(7 * 24 * 3600 + 100);
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
