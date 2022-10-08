import { ethers, getNamedAccounts } from 'hardhat';
import { parseEther, formatEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import { __setup, checkPoolEquation } from './__setup';
import { LOAN_STATUS, AUCTION_STATUS, POOL_ID } from '../helpers/constants';

import {
    advanceTimeAndBlock,
    getETHBalance,
    randomAddress,
} from '../helpers/utils';
import { ENV } from './__types';

const BORROW_TIME = 5 * 3600;
const OVERDUE_ONE_DURATION = 5 * 3600;
async function borrow(env: any, poolId: number, borrowAmountStr: string) {

}

describe('liquidator.dutchAuction', function () {
    let ENV: any;
    before(async () => {
        ENV = await __setup();

        const { 
            OpenSkyNFT, OpenSkySettings, OpenSkyLoan, OpenSkyDutchAuction, ACLManager,
            nftStaker: borrower,
            deployer: liquidationOperator,
            user001: fakeLiquidationOperator,
            user001, user002, user003,
            buyer001
        } = ENV;

        const ethAmount = parseEther('1');
        await user001.OpenSkyWETHGateway.deposit(1, user001.address, 0, { value: ethAmount });
        await user002.OpenSkyWETHGateway.deposit(1, user002.address, 0, { value: ethAmount });
        await user003.OpenSkyWETHGateway.deposit(1, user003.address, 0, { value: ethAmount });
        await OpenSkyNFT.awardItem(borrower.address);
        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('0.01'),
            24 * 3600 * 7,
            OpenSkyNFT.address,
            await OpenSkyNFT.totalSupply(),
            borrower.address
        );
    
        ENV.TokenID = await OpenSkyNFT.totalSupply();
        ENV.LoanID = 1;

        const LoanData = await OpenSkyLoan.getLoanData(ENV.LoanID);

        const duration = (7 + 4) * 24 * 3600;
        await advanceTimeAndBlock(parseInt(LoanData.borrowDuration) + duration + 10);

        expect(await OpenSkyLoan.getStatus(ENV.LoanID)).to.eq(LOAN_STATUS.LIQUIDATABLE);

        await buyer001.WNative.deposit({value: parseEther('10')});
        await buyer001.WNative.approve(OpenSkyDutchAuction.address, parseEther('1'));

        expect(await ACLManager.isLiquidationOperator(liquidationOperator.address)).to.be.true;
        expect(await ACLManager.isLiquidationOperator(fakeLiquidationOperator.address)).to.be.false;

        ENV.liquidationOperator = liquidationOperator;
        ENV.fakeLiquidationOperator = fakeLiquidationOperator;

        const AnotherLiquidator = await randomAddress();
        await OpenSkySettings.addLiquidator(AnotherLiquidator);
        ENV.AnotherLiquidator = AnotherLiquidator;
    });

    it('should start liquidation', async function () {
        const {
            OpenSkyNFT, OpenSkyDutchAuction, OpenSkyDutchAuctionLiquidator,
            TokenID, LoanID
        } = ENV;
        const { liquidationOperator } = ENV;

        await liquidationOperator.OpenSkyDutchAuctionLiquidator.startLiquidation(LoanID);

        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(OpenSkyDutchAuction.address);
        const AuctionID = 1;
        expect(await OpenSkyDutchAuctionLiquidator.getAuctionId(LoanID)).to.eq(AuctionID);
        expect(await OpenSkyDutchAuctionLiquidator.getLoanId(AuctionID)).to.eq(LoanID);
    });

    it('should not cancel liquidation when sender is not liquidation operator', async function () {
        const { fakeLiquidationOperator, LoanID } = ENV;

        await expect(
            fakeLiquidationOperator.OpenSkyDutchAuctionLiquidator.cancelLiquidation(LoanID)
        ).to.revertedWith('ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL');
    });

    it('should not cancel liquidation when loanId does not exist', async function () {
        const {
            liquidationOperator,
            LoanID
        } = ENV;
        const UnvalidableLoanID = 2;
        expect(UnvalidableLoanID).not.eq(LoanID);
        await expect(
            liquidationOperator.OpenSkyDutchAuctionLiquidator.cancelLiquidation(UnvalidableLoanID)
        ).to.revertedWith('AUCTION_IS_NOT_EXIST');
    });

    it('should cancel liquidation', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const {
            OpenSkyNFT, OpenSkyDutchAuctionLiquidator, liquidationOperator, TokenID, LoanID
        } = ENV;
        await liquidationOperator.OpenSkyDutchAuctionLiquidator.cancelLiquidation(LoanID);

        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(OpenSkyDutchAuctionLiquidator.address);

        await ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should not transfer NFT to another liquidator when sender is not liquidation operator', async function () {
        const { fakeLiquidationOperator, AnotherLiquidator, LoanID } = ENV;

        await expect(
            fakeLiquidationOperator.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(
                LoanID,
                AnotherLiquidator
            )
        ).to.revertedWith('ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL');
    });

    it('should not transfer NFT to another liquidator when liquidator is not in whitelist', async function () {
        const { OpenSkySettings, liquidationOperator, LoanID } = ENV;

        const FakeLiquidator = await randomAddress();
        expect(await OpenSkySettings.isLiquidator(FakeLiquidator)).to.be.false;

        await expect(
            liquidationOperator.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(
                LoanID,
                FakeLiquidator
            )
        ).to.revertedWith('LIQUIDATION_TRANSFER_NOT_LIQUIDATOR');
    });

    it('should transfer NFT to another liquidator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const {
            OpenSkyNFT, OpenSkyDutchAuction, liquidationOperator, TokenID, LoanID, AnotherLiquidator
        } = ENV;
        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(OpenSkyDutchAuction.address);

        await liquidationOperator.OpenSkyDutchAuctionLiquidator.cancelLiquidation(LoanID);

        await liquidationOperator.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(
            LoanID,
            AnotherLiquidator
        );

        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(AnotherLiquidator);

        await ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should end liquidation via auction', async function () {
        const {
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkySettings,
            OpenSkyDutchAuction,
            WNative,
            TokenID,
            LoanID
        } = ENV;
        const { buyer001 } = ENV;

        const BorrowBalance = await OpenSkyLoan.getBorrowBalance(LoanID);

        await advanceTimeAndBlock(1 * 3600 * 24);

        const AuctionID = 1;
        const Price = await OpenSkyDutchAuction.getPrice(AuctionID);

        await buyer001.OpenSkyDutchAuction.buy(AuctionID);
        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(buyer001.address);

        const AuctionStatus = await OpenSkyDutchAuction.getStatus(AuctionID);
        expect(AuctionStatus).to.eq(AUCTION_STATUS.END);

        expect(
            await WNative.balanceOf(await OpenSkySettings.treasuryAddress())
        ).to.eq(Price.sub(BorrowBalance));
    });

});
