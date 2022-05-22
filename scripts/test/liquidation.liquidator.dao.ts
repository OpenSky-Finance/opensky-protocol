import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { expect } from '../helpers/chai';
import { deposit, __setup } from './__setup';
import { LOAN_STATUS } from '../helpers/constants';

import {
    advanceTimeAndBlock, getCurrentBlockAndTimestamp,
} from '../helpers/utils';
import { rayMul } from '../helpers/ray-math';
import { BigNumber } from 'ethers';

describe('liquidator dao', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyNFT, borrower, deployer, user001, user002 } = ENV;

        const ethAmount = parseEther('1');
        await deposit(user001, 1, ethAmount);
        await deposit(user002, 1, ethAmount);
        await deposit(deployer, 1, ethAmount);
        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('0.00001'),
            24 * 3600 * 7,
            OpenSkyNFT.address,
            1,
            borrower.address
        );
    });

    it('it can liquidate from dao liquidator', async function () {
        const {
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkyDaoVault,
            OpenSkyDaoLiquidator,
            WNative,
        } = ENV;
        const { deployer: liquidationOperator } = ENV;

        // loan
        const NFT_ID = 1;
        const LOAN_ID = 1;
        const loan = await OpenSkyLoan.getLoanData(LOAN_ID);

        // time pass to LIQUIDATABLE
        const overdueDuration = 2 * 24 * 3600;
        await advanceTimeAndBlock(loan.borrowDuration + overdueDuration);

        expect((await OpenSkyLoan.getLoanData(LOAN_ID)).status).to.eq(LOAN_STATUS.LIQUIDATABLE);

        // can not with draw weth from dao
        expect(liquidationOperator.OpenSkyDaoLiquidator.startLiquidate(LOAN_ID)).reverted;

        // prepare weth for dao vault
        const wethAmount = parseEther('10');
        await liquidationOperator.WNative.deposit({ value: wethAmount });
        await liquidationOperator.WNative.transfer(OpenSkyDaoVault.address, wethAmount);

        // prepare weth for liquidator from dao vault
        await liquidationOperator.OpenSkyDaoVault.approveERC20(WNative.address, OpenSkyDaoLiquidator.address, wethAmount);

        const balanceBeforeLiquidate = await WNative.balanceOf(OpenSkyDaoVault.address);
        await liquidationOperator.OpenSkyDaoLiquidator.startLiquidate(LOAN_ID);
        const balanceAfterLiquidate = await WNative.balanceOf(OpenSkyDaoVault.address);

        const liquidateTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const borrowInterest = rayMul(loan.interestPerSecond, BigNumber.from(liquidateTime - loan.borrowBegin));
        const borrowBalance = loan.amount.add(borrowInterest);

        expect(balanceBeforeLiquidate).to.be.equal(
            balanceAfterLiquidate.add(borrowBalance)
        );

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoVault.address);
    });

    it('it can transfer nft to dao vault', async function () {
        const { OpenSkyNFT, OpenSkyDaoVault, OpenSkyDaoLiquidator } = ENV;
        const { deployer } = ENV;

        await (await OpenSkyNFT.awardItem(OpenSkyDaoLiquidator.address)).wait();

        const NFT_ID = await OpenSkyNFT.totalSupply();
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoLiquidator.address);

        await deployer.OpenSkyDaoLiquidator.withdrawERC721ToDaoVault(OpenSkyNFT.address, NFT_ID);
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoVault.address);
    });

    it('liquidate fail, if msg.sender != LiquidationOperator', async function () {
        const { user001 } = ENV;
        await expect(user001.OpenSkyDaoLiquidator.startLiquidate(1)).to.be.revertedWith(
            'LIQUIDATION_ONLY_OPERATOR_CAN_CALL'
        );
    });

    it('withdraw ERC721 fail, if msg.sender != LiquidationOperator', async function () {
        const { OpenSkyNFT, user001 } = ENV;
        await expect(user001.OpenSkyDaoLiquidator.withdrawERC721ToDaoVault(OpenSkyNFT.address, 1)).to.be.revertedWith(
            'LIQUIDATION_ONLY_OPERATOR_CAN_CALL'
        );
    });
});
