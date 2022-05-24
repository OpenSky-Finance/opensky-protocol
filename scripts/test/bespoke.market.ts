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
    PENDING,
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

    it.only('should can [make a borrow offer] by singing and be acdepted by using ERC20/WETH currency ', async function () {
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

    it.only('should can [make a borrow offer] by singing and be acdepted by using ETH ', async function () {
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
        
        await buyer001.OpenSkyBespokeMarket.takeBorrowOfferETH(offerData,{value: BORROW_AMOUNT});

        const LOAN_ID = 1;
        expect(await OpenSkyNFT.ownerOf(1)).eq(OpenSkyBespokeLoanNFT.address);
        // expect(await WNative.balanceOf(nftStaker.address)).eq(BORROW_AMOUNT);
        // expect(await WNative.balanceOf(buyer001.address)).eq(0);
        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);
    });
    
});
