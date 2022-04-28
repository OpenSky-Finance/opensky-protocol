import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';
import { ENV } from './__types';
import { LOAN_STATUS, AUCTION_STATUS, ONE_YEAR } from '../helpers/constants';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp } from '../helpers/utils';

async function prepareLiquidity(env: ENV) {
    const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
    const ethAmount = parseEther('10');
    await buyer001.OpenSkyPool.deposit(1, 0, { value: ethAmount });
    await buyer002.OpenSkyPool.deposit(1, 0, { value: ethAmount });
}
describe('punk-gateway', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    // borrow from gateway and repay to gateway [x]
    // borrow from pool and repay to pool [ignore]
    // borrow from gateway and repay to pool  [x]
    // borrow from pool and repay to gateway  [x]
    // borrow from gateway and extend in pool [x]
    // borrow from gateway and liquidated in pool [x]

    it('it can offer/buy punk', async function () {
        const env: ENV = await __setup();
        const { CryptoPunksMarket, WrappedPunk } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};
        const PUNK_INDEX = 0;
        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(nftStaker.address);
        // offer
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, buyer001.address);
        // INFO.offer = await CryptoPunksMarket.punksOfferedForSale(PUNK_INDEX);
        // buy
        await buyer001.CryptoPunksMarket.buyPunk(PUNK_INDEX);
        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(buyer001.address);
    });

    it('it can borrow against punk by gateway, then repay by gateway successfully', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyNFT, OpenSkyLoan } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};

        const ethAmount = parseEther('1');
        await buyer001.OpenSkyPool.deposit(1, 0, { value: ethAmount });
        await buyer002.OpenSkyPool.deposit(1, 0, { value: ethAmount });

        INFO.tvl = await OpenSkyPool.getTVL(1);
        // console.log('TVL', formatEther(tvl));
        // await nftStaker.OpenSkyPool.borrow(1, parseEther('0.5'), 5 * 60, OpenSkyNFT.address, 1,nftStaker.address);

        const PUNK_INDEX = 0;
        // approve
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, OpenSkyPunkGateway.address);

        // borrow
        const BORROW_AMOUNT = parseEther('0.5');
        INFO.nftstaker_balance_0 = await nftStaker.getETHBalance();
        await nftStaker.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);
        INFO.nftstaker_balance_1 = await nftStaker.getETHBalance();

        expect(INFO.nftstaker_balance_1).to.be.gt(INFO.nftstaker_balance_0);

        INFO.owner_wpunk_0 = await WrappedPunk.ownerOf(0);
        INFO.owner_of_punk0 = await CryptoPunksMarket.punkIndexToAddress(0);

        expect(INFO.owner_of_punk0).to.be.equal(WrappedPunk.address);
        expect(INFO.owner_wpunk_0).to.be.equal(OpenSkyLoan.address);

        // repay
        const LOAN_ID = 1;
        const REPAY_AMOUNT = parseEther('0.6');
        await nftStaker.OpenSkyPunkGateway.repay(LOAN_ID, { value: REPAY_AMOUNT });

        INFO.owner_of_punk0_after_repayed = await CryptoPunksMarket.punkIndexToAddress(0);

        await expect(OpenSkyLoan.ownerOf(LOAN_ID)).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(INFO.owner_of_punk0_after_repayed).to.be.equal(nftStaker.address);

        // console.log(INFO);
    });

    it('it can borrow against punk by gateway, and then repay by pool ', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyNFT, OpenSkyLoan } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};

        await prepareLiquidity(env);

        const PUNK_INDEX = 0;
        const BORROW_AMOUNT = parseEther('0.5');

        // approve
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, OpenSkyPunkGateway.address);

        // borrow
        await nftStaker.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);
        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(WrappedPunk.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(nftStaker.address);

        advanceTimeAndBlock(1000);

        const LOAN_ID = 1;
        const REPAY_AMOUNT = parseEther('1'); // todo check penety
        INFO.borrowBalance = await OpenSkyLoan.getBorrowBalance(LOAN_ID);
        await nftStaker.OpenSkyPool.repay(LOAN_ID, { value: REPAY_AMOUNT });

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(nftStaker.address);
        await expect(OpenSkyLoan.ownerOf(1)).to.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('it can borrow against wpunk by pool and repay by gateway', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyNFT, OpenSkyLoan } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};

        await prepareLiquidity(env);

        const BORROW_AMOUNT = parseEther('0.5');
        const PUNK_INDEX = 3;

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(nftStaker.address);

        await (await nftStaker.WrappedPunk.approve(OpenSkyPool.address, PUNK_INDEX)).wait();
        await nftStaker.OpenSkyPool.borrow(
            1,
            BORROW_AMOUNT,
            365 * 24 * 3600,
            WrappedPunk.address,
            PUNK_INDEX,
            nftStaker.address
        );
        const LOAN_ID = 1;

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(LOAN_ID)).to.be.equal(nftStaker.address);

        // repay by gateway
        const REPAY_AMOUNT_2 = parseEther('1');
        await nftStaker.OpenSkyPunkGateway.repay(LOAN_ID, { value: REPAY_AMOUNT_2 });

        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(nftStaker.address);
    });

    it('it can borrow from gateway and extend in pool', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyNFT, OpenSkyLoan } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};
        await prepareLiquidity(env);
        const PUNK_INDEX = 0;
        const BORROW_AMOUNT = parseEther('0.5');

        // approve
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, OpenSkyPunkGateway.address);

        // borrow
        await nftStaker.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);

        // extend
        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const oldLoanId = 1;
        await advanceTimeAndBlock(364 * 24 * 3600);
        const newLoanAmount = parseEther('1');

        const extendTx = await nftStaker.OpenSkyPool.extend(oldLoanId, newLoanAmount, 30 * 24 * 3600, {
            value: parseEther('0.8'),
        });
        const newLoan = await OpenSkyLoan.getLoanData(2);
        expect(newLoan.status).to.be.equal(LOAN_STATUS.BORROWING);
    });

    it('it can borrow from gateway and can be liquidated in pool', async function () {
        const env: ENV = await setupWithStakingNFT();
        const {
            CryptoPunksMarket,
            WrappedPunk,
            OpenSkyDutchAuction,
            OpenSkyPunkGateway,
            ACLManager,
            OpenSkyPool,
            OpenSkyNFT,
            OpenSkyLoan,
        } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};
        await prepareLiquidity(env);
        const PUNK_INDEX = 0;
        const LOAN_ID = 1;

        const BORROW_AMOUNT = parseEther('0.5');
        // borrow
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, OpenSkyPunkGateway.address);
        await nftStaker.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);

        await advanceTimeAndBlock(ONE_YEAR + 10 * 24 * 3600);

        INFO.loan = await OpenSkyLoan.getLoanData(LOAN_ID);
        expect(INFO.loan.status).to.eq(LOAN_STATUS.LIQUIDATABLE);

        await deployer.OpenSkyDutchAuctionLiquidator.startLiquidate(LOAN_ID);
        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.eq(OpenSkyDutchAuction.address);

        // liquidation
        const AUCTION_ID = 1;
        INFO.price = await OpenSkyDutchAuction.getPrice(AUCTION_ID);
        await buyer001.OpenSkyDutchAuction.buy(AUCTION_ID, { value: INFO.price });
        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.eq(buyer001.address);
    });

    it('it can borrow against punk by gateway, and then repay by pool, then borrow from pool, then repay by gateway ', async function () {
        const env: ENV = await setupWithStakingNFT();
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyNFT, OpenSkyLoan } = env;
        const { nftStaker, deployer, buyer001, buyer002, liquidator } = env;
        const INFO: any = {};

        await prepareLiquidity(env);

        const PUNK_INDEX = 0;
        const BORROW_AMOUNT = parseEther('0.5');

        // approve
        await nftStaker.CryptoPunksMarket.offerPunkForSaleToAddress(PUNK_INDEX, 0, OpenSkyPunkGateway.address);

        // borrow
        await nftStaker.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);
        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(WrappedPunk.address);
        expect(await OpenSkyLoan.ownerOf(1)).to.be.equal(nftStaker.address);

        advanceTimeAndBlock(1000);

        const LOAN_ID = 1;
        const REPAY_AMOUNT = parseEther('1'); // todo check penety
        INFO.borrowBalance = await OpenSkyLoan.getBorrowBalance(LOAN_ID);
        await nftStaker.OpenSkyPool.repay(LOAN_ID, { value: REPAY_AMOUNT });

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(nftStaker.address);
        await expect(OpenSkyLoan.ownerOf(1)).to.revertedWith('ERC721: owner query for nonexistent token');

        //flow1: redeem punk  && borrow again
        //flow2: borrow with wpunk

        await (await nftStaker.WrappedPunk.approve(OpenSkyPool.address, PUNK_INDEX)).wait();
        await nftStaker.OpenSkyPool.borrow(
            1,
            BORROW_AMOUNT,
            365 * 24 * 3600,
            WrappedPunk.address,
            PUNK_INDEX,
            nftStaker.address
        );
        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).to.be.equal(OpenSkyLoan.address);

        // repay by gateway
        const LOAN_ID_2 = 2;
        const REPAY_AMOUNT_2 = parseEther('1');
        await nftStaker.OpenSkyPunkGateway.repay(LOAN_ID_2, { value: REPAY_AMOUNT_2 });

        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(nftStaker.address);
    });
});
