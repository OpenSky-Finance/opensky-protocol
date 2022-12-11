import { ethers } from 'hardhat';
import { arrayify, parseEther } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { _TypedDataEncoder } from '@ethersproject/hash';

import { expect } from '../helpers/chai';

import { deposit, __setup } from './__setup';
import { advanceTimeAndBlock, getTxCost, randomAddress } from '../helpers/utils';
import { ONE_ETH, ONE_YEAR, OFFER_TYPE } from '../helpers/constants';
import { createOfferData } from '../helpers/utils.bespoke';

enum LoanStatus {
    NONE,
    BORROWING,
    OVERDUE,
    LIQUIDATABLE,
    END,
}

describe('bespoke claim airdrop', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const {
            OpenSkyBespokeMarket,
            OpenSkyNFT,
            WNative,
            TransferAdapterCurrencyDefault,
            TransferAdapterERC721Default,
            borrower,
            user001,
        } = ENV;

        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);

        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        ENV.OfferData = createOfferData(ENV, { offerType: OFFER_TYPE.BORROW }, borrowerWallet);
        ENV.LOAN_ID = 1;

        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('0.5'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;

        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

        // await deposit(user001, 1, ENV.SUPPLY_BORROW_AMOUNT);
        // await user001.OpenSkyOToken.approve(TransferAdapterCurrencyDefault.address, ethers.constants.MaxUint256);

        await user001.WNative.deposit({ value: ENV.SUPPLY_BORROW_AMOUNT });
        await user001.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);

        await user001.OpenSkyBespokeMarket.takeBorrowOffer(
            ENV.OfferData,
            ENV.SUPPLY_BORROW_AMOUNT,
            ENV.SUPPLY_BORROW_DURATION
        );
    });

    it('should flash claim if the loan is borrowing', async function () {
        const {
            OpenSkyBespokeMarket,
            OpenSkyBespokeBorrowNFT,
            OpenSkyNFT,
            TransferAdapterERC721Default,
            borrower,
            LOAN_ID,
        } = ENV;

        await advanceTimeAndBlock(16 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.BORROWING);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.be.equal(borrower.address);
        
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(TransferAdapterERC721Default.address);
        
        await borrower.TransferAdapterERC721Default.flashClaim(ApeCoinFlashLoanMock.address, [LOAN_ID], arrayify('0x00'));
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(TransferAdapterERC721Default.address);

        const ApeCoinMock = await ethers.getContract('ApeCoinMock');
        expect(await ApeCoinMock.balanceOf(borrower.address)).to.be.equal(ONE_ETH.mul(10));
    });

    it('should flash claim if the loan is overdue', async function () {
        const { OpenSkyBespokeMarket, OpenSkyBespokeBorrowNFT, OpenSkyNFT,TransferAdapterERC721Default, borrower, LOAN_ID } = ENV;

        await advanceTimeAndBlock(18 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.OVERDUE);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.be.equal(borrower.address);
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(TransferAdapterERC721Default.address);
        await borrower.TransferAdapterERC721Default.flashClaim(ApeCoinFlashLoanMock.address, [LOAN_ID], arrayify('0x00'));
        expect(await OpenSkyNFT.ownerOf(loan.tokenId)).to.be.equal(TransferAdapterERC721Default.address);

        const ApeCoinMock = await ethers.getContract('ApeCoinMock');
        expect(await ApeCoinMock.balanceOf(borrower.address)).to.be.equal(ONE_ETH.mul(10));
    });

    it('should not flash claim if the caller is not the owner of loans', async () => {
        const { OpenSkyBespokeMarket, OpenSkyBespokeBorrowNFT, OpenSkyNFT,TransferAdapterERC721Default, user001: fakeBorrower, LOAN_ID } = ENV;

        await advanceTimeAndBlock(18 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.OVERDUE);

        const loan = await OpenSkyBespokeMarket.getLoanData(LOAN_ID);

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        expect(await OpenSkyBespokeBorrowNFT.ownerOf(LOAN_ID)).to.be.not.equal(fakeBorrower.address);
        await expect(
            fakeBorrower.TransferAdapterERC721Default.flashClaim(ApeCoinFlashLoanMock.address, [LOAN_ID], arrayify('0x00'))
        ).to.revertedWith('BM_FLASHCLAIM_CALLER_IS_NOT_OWNER');
    });

    it('should not flash claim if the loan is liquidatable', async () => {
        const { OpenSkyBespokeMarket, OpenSkyBespokeBorrowNFT, TransferAdapterERC721Default,borrower, LOAN_ID } = ENV;

        await advanceTimeAndBlock(30 * 24 * 3600);

        expect(await OpenSkyBespokeMarket.getStatus(LOAN_ID)).eq(LoanStatus.LIQUIDATABLE);

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        await expect(
            borrower.TransferAdapterERC721Default.flashClaim(ApeCoinFlashLoanMock.address, [LOAN_ID], arrayify('0x00'))
        ).to.revertedWith('BM_FLASHCLAIM_STATUS_ERROR');
    });
});
