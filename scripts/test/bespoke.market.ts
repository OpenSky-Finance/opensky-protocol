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

    it('should can [take] a borrow offer using ERC20/WETH currency ', async function () {
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

    it('should can [take] a borrow offer [totaly] using ETH when underlying is WETH', async function () {
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

    it('should can [take] a borrow offer [partly] using ETH when underlying is WETH', async function () {
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

    it('should [cannot] [repay] a loan when liquidatable', async function () {
        const env: any = await __setup();
        const { OpenSkyBespokeMarket, OpenSkyPool, WNative, OpenSkyNFT, OpenSkyBespokeLoanNFT, nftStaker, buyer001 } =
            env;

        const INFO: any = {};
        const NFT_ID = 1;
        const LOAN_ID = 1;

        await signAnOfferAndMakeItTaked(env, buyer001);

        await advanceTimeAndBlock((7 + 2) * 24 * 3600 + 100 * 24 * 3600);
        INFO.status = await OpenSkyBespokeMarket.getStatus(LOAN_ID);
        expect(INFO.status).eq(LoanStatus.LIQUIDATABLE);

        expect(nftStaker.OpenSkyBespokeMarket.repayETH(LOAN_ID, { value: INFO.repayAmount })).revertedWith(
            'BM_REPAY_STATUS_ERROR'
        );
        expect(nftStaker.OpenSkyBespokeMarket.repay(LOAN_ID)).revertedWith('BM_REPAY_STATUS_ERROR');
    });

    it('should can [forclose] a loan when liquidatable', async function () {
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
describe('bespoke.1155', function () {});
describe('bespoke.signing', function () {});
