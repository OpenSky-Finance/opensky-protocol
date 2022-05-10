import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';
import { LOAN_STATUS, AUCTION_STATUS, POOL_ID } from '../helpers/constants';
import { randomAddress } from '../helpers/utils';

import {
    waitForTx,
    advanceBlocks,
    advanceBlock,
    increaseTime,
    advanceTimeAndBlock,
    getCurrentBlockAndTimestamp,
    getTxCost,
    getETHBalance,
} from '../helpers/utils';

async function borrow(env: any, poolId: number, borrowAmountStr: string) {
    const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } = env;

    const ethAmount = parseEther('1');
    await buyer001.OpenSkyPool.deposit(poolId, 0, { value: ethAmount });
    await buyer002.OpenSkyPool.deposit(poolId, 0, { value: ethAmount });
    await deployer.OpenSkyPool.deposit(poolId, 0, { value: ethAmount });
    // const tvl = await OpenSkyPool.getTVL(poolId);
    await nftStaker.OpenSkyPool.borrow(
        poolId,
        parseEther(borrowAmountStr),
        24 * 3600 * 7,
        OpenSkyNFT.address,
        1,
        nftStaker.address
    );
}

describe('liquidator.dao', function () {
    it('it can liquidate from dao liquidator', async function () {
        const env: any = await setupWithStakingNFT();
        await borrow(env, POOL_ID, '0.00001');

        const {
            OpenSkyPool,
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkySettings,
            OpenSkyDutchAuction,
            OpenSkyDutchAuctionLiquidator,
            OpenSkyDaoVault,
            OpenSkyDaoLiquidator,
            WNative,
        } = env;
        const { buyer001, deployer } = env;
        const INFO: any = {};

        // loan
        const NFT_ID = 1;
        const LOAN_ID = 1;
        INFO.loanData1 = await OpenSkyLoan.getLoanData(LOAN_ID);

        // time pass to LIQUIDATABLE
        const overdueDuration = 2 * 24 * 3600;
        await advanceTimeAndBlock(INFO.loanData1.borrowDuration + overdueDuration);

        INFO.loanData2 = await OpenSkyLoan.getLoanData(LOAN_ID);
        expect(INFO.loanData2.status).to.eq(LOAN_STATUS.LIQUIDATABLE);

        // can not with draw weth from dao
        expect(deployer.OpenSkyDaoLiquidator.startLiquidate(LOAN_ID)).reverted;

        // prepare weth for dao vault
        const wethAmount = parseEther('10');
        await deployer.WNative.deposit({ value: wethAmount });
        await deployer.WNative.transfer(OpenSkyDaoVault.address, wethAmount);

        // prepare weth for liquidator from dao vault
        await deployer.OpenSkyDaoVault.approveERC20(WNative.address, OpenSkyDaoLiquidator.address, wethAmount);

        await deployer.OpenSkyDaoLiquidator.startLiquidate(LOAN_ID);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoVault.address);
    });

    it('it can transfer nft to dao vault', async function () {
        const env: any = await __setup();
        const { OpenSkyNFT, OpenSkyDaoVault, OpenSkyDaoLiquidator } = env;
        const { buyer001, deployer } = env;
        const INFO: any = {};
        const NFT_ID = 1;

        await (await OpenSkyNFT.awardItem(OpenSkyDaoLiquidator.address)).wait();
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoLiquidator.address);

        await deployer.OpenSkyDaoLiquidator.withdrawERC721ToDaoVault(OpenSkyNFT.address, NFT_ID);
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDaoVault.address);
    });
});
