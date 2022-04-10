import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';
import { LOAN_STATUS, AUCTION_STATUS, POOL_ID } from '../helpers/constants';

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
import { ENV } from './__types';

const BORROW_TIME = 5 * 3600;
const OVERDUE_ONE_DURATION = 5 * 3600;
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

describe('liquidator.dutchAuction', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('it can start and end auction when auction is success complete', async function () {
        const env: ENV = await setupWithStakingNFT();
        const {
            OpenSkyPool,
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkySettings,
            OpenSkyDutchAuction,
            OpenSkyDutchAuctionLiquidator,
        } = env;
        const { treasury } = await getNamedAccounts();
        const { buyer001, deployer } = env; // todo add liquidation operator
        const INFO: any = {};

        expect(await getETHBalance(treasury)).to.eq(0);

        await borrow(env, POOL_ID, '0.00001');

        // loan
        const LOAN_ID = 1;
        INFO.loanData = await OpenSkyLoan.getLoanData(LOAN_ID);

        expect(INFO.loanData.status).to.eq(LOAN_STATUS.BORROWING);

        // time pass
        const duration = (7 + 4) * 24 * 3600;
        await advanceTimeAndBlock(INFO.loanData.borrowDuration.toNumber() + duration + 10);

        INFO.loanData2 = await OpenSkyLoan.getLoanData(LOAN_ID);
        // INFO.bespokeStatus = await OpenSkyPool.getBespokeStatus(INFO.loanData2.reserveId);

        expect(INFO.loanData2.status).to.eq(LOAN_STATUS.LIQUIDATABLE);

        // start liquidation
        await deployer.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        const NFT_ID = 1;
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDutchAuction.address);

        const AUCTION_ID = 1;
        INFO.auctionData_1 = await OpenSkyDutchAuction.getAuctionData(AUCTION_ID);
        INFO.price1 = formatEther(await OpenSkyDutchAuction.getPrice(AUCTION_ID));

        // someone buy the auciton
        const timePass = 1 * 3600 * 24;
        await advanceTimeAndBlock(timePass);

        // TODO check why number too big
        INFO.price2 = formatEther(await OpenSkyDutchAuction.getPrice(AUCTION_ID));

        await buyer001.OpenSkyDutchAuction.buy(AUCTION_ID, { value: parseEther('15') });
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(buyer001.address);

        INFO.auctionStatus = await OpenSkyDutchAuction.getStatus(AUCTION_ID);
        expect(INFO.auctionStatus).to.eq(AUCTION_STATUS.END);

        INFO.liquidatorETHBalance = formatEther(await getETHBalance(OpenSkyDutchAuctionLiquidator.address));
        INFO.auctionData_2 = await OpenSkyDutchAuction.getAuctionData(AUCTION_ID);

        INFO.loanData3 = await OpenSkyLoan.getLoanData(LOAN_ID);

        expect(INFO.loanData3.status).to.eq(LOAN_STATUS.END);

        INFO.liquidatorETHBalance2 = formatEther(await getETHBalance(OpenSkyDutchAuctionLiquidator.address));

        INFO.treasury = await getETHBalance(treasury);
        expect(await getETHBalance(treasury)).to.gt(0);

        // console.log('INFO', INFO);
    });

    it('it can cancel auction [only] by liquidationOperator when auction is not end', async function () {
        const env: ENV = await setupWithStakingNFT();
        const {
            OpenSkyPool,
            OpenSkyLoan,
            OpenSkyNFT,
            OpenSkySettings,
            OpenSkyDutchAuction,
            OpenSkyDutchAuctionLiquidator,
        } = env;
        const { buyer001, deployer, liquidator } = env; // todo add liquidation operator
        const INFO: any = {};

        await borrow(env, POOL_ID, '1.0');

        const LOAN_ID = 1;
        INFO.loanData = await OpenSkyLoan.getLoanData(LOAN_ID);

        // time pass
        const liquidatableTime = 3 * 24 * 3600;
        await advanceTimeAndBlock(INFO.loanData.borrowDuration.toNumber() + liquidatableTime + 1);

        // start liquidation
        await deployer.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        const NFT_ID = 1;
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDutchAuction.address);

        // auction overdue
        await advanceTimeAndBlock(3 * 24 * 3600 + 1);
        const AUCTION_ID = 1;
        INFO.auctionStatus = await OpenSkyDutchAuction.getStatus(AUCTION_ID);

        // cancel auction
        await expect(deployer.OpenSkyDutchAuctionLiquidator.cancelLiquidate(LOAN_ID)).to.revertedWith(
            'ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL'
        );

        await liquidator.OpenSkyDutchAuctionLiquidator.cancelLiquidate(LOAN_ID);

        INFO.auctionStatus2 = await OpenSkyDutchAuction.getStatus(AUCTION_ID);
        expect(INFO.auctionStatus2).to.eq(AUCTION_STATUS.CANCELED);

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(OpenSkyDutchAuctionLiquidator.address);

        // console.log('INFO', INFO);
    });

    it('it can start auction again after auction canceled', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { ACLManager, OpenSkyNFT, OpenSkyDutchAuction, OpenSkyDutchAuctionLiquidator } = env;
        const { buyer001, deployer, liquidator } = env; // todo add liquidation operator
        const { treasury } = await getNamedAccounts();

        const INFO: any = {};
        // [prepare] add treasury as another liquidator for testing
        await (await ACLManager.addLiquidator(treasury)).wait();

        const LOAN_ID = 1;
        const NFT_ID = 1;

        await borrow(env, POOL_ID, '1.0');
        await advanceTimeAndBlock((7 + 10) * 24 * 3600);

        // expect((await OpenSkyLoan.getLoanData(1)).status).to.eq(LOAN_STATUS.LIQUIDATABLE);
        await deployer.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        await advanceTimeAndBlock(24 * 3600);
        await liquidator.OpenSkyDutchAuctionLiquidator.cancelLiquidate(LOAN_ID);

        // ===
        await buyer001.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        await advanceTimeAndBlock(24 * 3600);
        await liquidator.OpenSkyDutchAuctionLiquidator.cancelLiquidate(LOAN_ID);
    });

    it('it can move nft the other liquidationOperator [only] by liquidationOperator', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { ACLManager, OpenSkyNFT, OpenSkyDutchAuction, OpenSkyDutchAuctionLiquidator } = env;
        const { buyer001, deployer, liquidator } = env; // todo add liquidation operator
        const { treasury } = await getNamedAccounts();

        const INFO: any = {};
        // [prepare] add treasury as another liquidator for testing
        await (await ACLManager.addLiquidator(treasury)).wait();

        const LOAN_ID = 1;
        const NFT_ID = 1;

        await borrow(env, POOL_ID, '1.0');
        await advanceTimeAndBlock((7 + 10) * 24 * 3600);

        // expect((await OpenSkyLoan.getLoanData(1)).status).to.eq(LOAN_STATUS.LIQUIDATABLE);
        await deployer.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        await advanceTimeAndBlock(24 * 3600);
        await liquidator.OpenSkyDutchAuctionLiquidator.cancelLiquidate(LOAN_ID);

        // ===

        await expect(
            deployer.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(LOAN_ID, treasury)
        ).to.revertedWith('ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL');

        await expect(
            liquidator.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(LOAN_ID, buyer001.address)
        ).to.revertedWith('LIQUIDATION_TRANSFER_NOT_LIQUIDATOR');

        await liquidator.OpenSkyDutchAuctionLiquidator.transferToAnotherLiquidator(LOAN_ID, treasury);
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.eq(treasury);
    });
});
