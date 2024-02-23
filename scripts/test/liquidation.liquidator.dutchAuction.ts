import { parseEther, formatEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import { __setup } from './__setup';
import { LOAN_STATUS } from '../helpers/constants';

import {
    advanceTimeAndBlock,
    almostEqual,
    getCurrentBlockAndTimestamp,
    getETHBalance,
    getTxGasUsed,
} from '../helpers/utils';
import { rayMul } from '../helpers/ray-math';
import { BigNumber } from 'ethers';

describe('liquidator.dutchAuction', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { 
            OpenSkyNFT, OpenSkyLoan,
            nftStaker: borrower,
            user001, user002, user003,
        } = ENV;

        const ethAmount = parseEther('1');
        await user001.OpenSkyWETHGateway.deposit(1, user001.address, 0, { value: ethAmount });
        await user002.OpenSkyWETHGateway.deposit(1, user002.address, 0, { value: ethAmount });
        await user003.OpenSkyWETHGateway.deposit(1, user003.address, 0, { value: ethAmount });
        await OpenSkyNFT.awardItem(borrower.address);
        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('2'),
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
    });

    it('should liquidate with eth', async function () {
        const {
            OpenSkySettings, OpenSkyLoan, OpenSkyDutchAuctionLiquidator, OpenSkyNFT, WNative,
            TokenID, LoanID
        } = ENV;
        const { liquidator } = ENV;

        await advanceTimeAndBlock(1 * 3600 * 24);

        const Loan = await OpenSkyLoan.getLoanData(LoanID);

        const Price = await OpenSkyDutchAuctionLiquidator.getPrice(LoanID);

        const ethBalanceBeforeTx = await getETHBalance(liquidator.address);
        const TX = await liquidator.OpenSkyDutchAuctionLiquidator.liquidateETH(LoanID, {value: parseEther('10')});
        const ethBalanceAfterTx = await getETHBalance(liquidator.address);

        const GasUsed = await getTxGasUsed(TX);
        const { timestamp } = await getCurrentBlockAndTimestamp();

        const BorrowBalance = Loan.amount.add(rayMul(Loan.interestPerSecond, BigNumber.from(timestamp - Loan.borrowBegin)));

        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(liquidator.address);

        // expect(
        //     almostEqual(
        //         ethBalanceBeforeTx.sub(ethBalanceAfterTx).add(GasUsed),
        //         Price,
        //         100000000
        //     )
        // ).to.be.true;
        console.log(
            'eth balance',
            (await getETHBalance(await OpenSkySettings.treasuryAddress())).toString(),
        );
        console.log(
            'Price',
            Price.sub(BorrowBalance).toString(),
        );
        expect(
            almostEqual(
                await getETHBalance(await OpenSkySettings.treasuryAddress()),
                Price.sub(BorrowBalance),
                10000000000
            )
        ).to.be.true;
    });

    it('should liquidate with weth', async function() {
        const {
            OpenSkySettings, OpenSkyLoan, OpenSkyDutchAuctionLiquidator, OpenSkyNFT, WNative,
            TokenID, LoanID
        } = ENV;
        const { liquidator } = ENV;

        await advanceTimeAndBlock(1 * 3600 * 24);

        const Loan = await OpenSkyLoan.getLoanData(LoanID);

        await liquidator.WNative.deposit({value: parseEther('10')});
        await liquidator.WNative.approve(OpenSkyDutchAuctionLiquidator.address, parseEther('10'));

        const WETHBalanceBeforeTx = await WNative.balanceOf(liquidator.address);
        await liquidator.OpenSkyDutchAuctionLiquidator.liquidate(LoanID);
        const WETHBalanceAfterTx = await WNative.balanceOf(liquidator.address);

        const Price = WETHBalanceBeforeTx.sub(WETHBalanceAfterTx);

        const { timestamp } = await getCurrentBlockAndTimestamp();

        const BorrowBalance = Loan.amount.add(rayMul(Loan.interestPerSecond, BigNumber.from(timestamp - Loan.borrowBegin)));

        expect(await OpenSkyNFT.ownerOf(TokenID)).to.eq(liquidator.address);

        expect(
            await WNative.balanceOf(await OpenSkySettings.treasuryAddress())
        ).to.eq(Price.sub(BorrowBalance));
    });
});
