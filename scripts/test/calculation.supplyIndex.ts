import { ethers, getNamedAccounts } from 'hardhat';
import { formatEther, formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';
import { expect } from '../helpers/chai';
import { advanceTimeAndBlock } from '../helpers/utils';
import { POOL_ID, Errors } from '../helpers/constants';
import { RAY, ONE_YEAR, MAX_UINT_128, MAX_UINT_256, ONE_ETH } from '../helpers/constants';
import { __setup, checkPoolEquation, deposit } from './__setup';
import { ENV } from './__types';

describe('calculation.supplyIndex', function () {
    // factors:
    // * rate  0, 1, bigNumber superBigNumber
    // * lastBalance  0, littleNumber bigNumber, lastBalance increase 1
    // * index:1 n , 2**128,  2**256
    // * time: same block/ super large block

    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        ENV.POOL_ID = 1;
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('check init status', async function () {
        const { OpenSkyPool, POOL_ID } = ENV;
        const INFO: any = {};
        INFO.index_0 = await OpenSkyPool.getReserveNormalizedIncome(POOL_ID);
        INFO.getReserveData = await OpenSkyPool.getReserveData(POOL_ID);

        expect(INFO.index_0).to.eq(RAY);
        await advanceTimeAndBlock(ONE_YEAR);
        await advanceTimeAndBlock(ONE_YEAR);
        expect(INFO.index_0).to.eq(RAY);

        INFO.getAvailableLiquidity = await OpenSkyPool.getAvailableLiquidity(POOL_ID);
        expect(INFO.getAvailableLiquidity).to.eq(0);

        // rate
        expect(INFO.getReserveData.borrowingInterestPerSecond).to.eq(0);
    });

    // one user, deposit 1eth, moneymarket increase 1eth
    it('increase index by moneymarket when no borrow', async function () {
        const { AAVE_POOL, UnderlyingAsset, OpenSkyPool, OpenSkyOToken, OpenSkyDataProvider, user001, POOL_ID } = ENV;
        // const { treasury } = await getNamedAccounts();
        const INFO: any = {};

        INFO.data0 = await OpenSkyDataProvider.getReserveData(POOL_ID);
        await deposit(user001, POOL_ID, ONE_ETH);

        await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, ONE_ETH);

        // INFO.getReserveData = await OpenSkyPool.getReserveData(POOL_ID);
        // INFO.moneyMarketBalnce_1 = await MoneyMarket.getBalance(OpenSkyOToken.address);

        // INFO.moneyMarketBalnce_2 = await MoneyMarket.getBalance(OpenSkyOToken.address);
        // INFO.getReserveData2 = await OpenSkyPool.getReserveData(POOL_ID);
        // INFO.totalSupply = await OpenSkyOToken.totalSupply();
        // INFO.oTokenBalance_buyer001 = await OpenSkyOToken.balanceOf(buyer001.address);
        // INFO.oTokenBalance_treasury = await OpenSkyOToken.balanceOf(treasury);

        advanceTimeAndBlock(10 * 24 * 3600);
        await OpenSkyPool.updateState(POOL_ID, 0);
        await OpenSkyPool.updateLastMoneyMarketBalance(POOL_ID, 0,0);

        // INFO.totalSupply_2 = await OpenSkyOToken.totalSupply();
        // INFO.oTokenBalance_buyer001_2 = await OpenSkyOToken.balanceOf(buyer001.address);
        // INFO.oTokenBalance_treasury_2 = await OpenSkyOToken.balanceOf(treasury);
        // expect(INFO.totalSupply_2.eq(INFO.oTokenBalance_buyer001_2.add(INFO.oTokenBalance_treasury_2)));

        // console.log(INFO);
    });

    it('trigger index overflow by money market', async function () {
        const { AAVE_POOL, UnderlyingAsset, OpenSkyPool, OpenSkyOToken, user001 } = ENV;

        await deposit(user001, 1, ONE_ETH);

        await AAVE_POOL.simulateInterestIncrease(UnderlyingAsset.address, OpenSkyOToken.address, MAX_UINT_128);

        await expect(OpenSkyPool.updateState(POOL_ID, 0)).to.revertedWith(Errors.RESERVE_INDEX_OVERFLOW);
    });

    // it('trigger index overflow by user borrowing', async function () {
    //     const { OpenSkyPool, OpenSkyNFT, MoneyMarket, OpenSkyInterestRateStrategy, deployer, nftStaker } =
    //         await setupWithStakingNFT();
    //     const INFO: any = {};
    //
    //     await deployer.OpenSkyPool.deposit(1, 0, { value: parseEther('100') });
    //
    //     await OpenSkyInterestRateStrategy.setBaseBorrowRate(POOL_ID, BigNumber.from(2).pow(127).mul(1));
    //
    //     let amount = parseEther('1.5');
    //     await nftStaker.OpenSkyPool.borrow(POOL_ID, amount, 365 * 24 * 3600, OpenSkyNFT.address, 1, nftStaker.address);
    //
    //     await advanceTimeAndBlock(3600 * 24 * 365* (2**30));
    //
    //     await expect(OpenSkyPool.updateState(POOL_ID, 0)).to.revertedWith(Errors.RESERVE_INDEX_OVERFLOW);
    // });

    it('check basic equation', async function () {
        const {
            OpenSkyPool,
            OpenSkyDataProvider,
            user001,
            user002,
            borrower,
            OpenSkyNFT,
        } = ENV;
        const INFO: any = {};
        INFO.tvl = await OpenSkyPool.getTVL(POOL_ID);
        INFO.getTotalBorrowBalance = await OpenSkyPool.getTotalBorrowBalance(POOL_ID);
        INFO.Liquidity = await OpenSkyPool.getAvailableLiquidity(POOL_ID);

        INFO.data = await OpenSkyDataProvider.getReserveData(POOL_ID);

        await deposit(user001, POOL_ID, ONE_ETH);
        await deposit(user002, POOL_ID, ONE_ETH);

        let amount = parseEther('1.5');
        await borrower.OpenSkyPool.borrow(POOL_ID, amount, 365 * 24 * 3600, OpenSkyNFT.address, 1, borrower.address);

        INFO.data2 = await OpenSkyDataProvider.getReserveData(POOL_ID);

        expect(INFO.data2.availableLiquidity.add(INFO.data2.totalBorrowsBalance)).eq(INFO.data2.totalDeposits);
    });
});
