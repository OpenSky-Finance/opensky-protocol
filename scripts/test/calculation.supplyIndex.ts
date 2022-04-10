import { ethers, getNamedAccounts } from 'hardhat';
import { formatEther, formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';
import { OPTIMAL_UTILIZATION_RATE } from '../helpers/constants';
import { expect } from '../helpers/chai';
import { BigNumber } from 'ethers';
import { advanceTimeAndBlock } from '../helpers/utils';
import { POOL_ID } from '../helpers/constants';
import { RAY, ONE_YEAR, MAX_UINT_128, MAX_UINT_256, ONE_ETH } from '../helpers/constants';
import { __setup, setupWithStakingNFT, loadContractForusers, checkPoolEquation, formatEtherAttrs } from './__setup';
import { ENV } from './__types';

describe('calculation.supplyIndex', function () {
    // factors:
    // * rate  0, 1, bigNumber superBigNumber
    // * lastBalance  0, littleNumber bigNumber, lastBalance increase 1
    // * index:1 n , 2**128,  2**256
    // * time: same block/ super large block

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('check init status', async function () {
        const { OpenSkyPool, OpenSkyOToken, OpenSkyDataProvider, MoneyMarket, buyer001 } = await setupWithStakingNFT();
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
        // console.log(INFO);
    });

    // one user, deposit 1eth, moneymarket increase 1eth
    it('increase index by moneymarket when no borrow', async function () {
        const { OpenSkyPool, OpenSkyOToken, OpenSkyDataProvider, MoneyMarket, buyer001 } = await setupWithStakingNFT();
        const { treasury } = await getNamedAccounts();
        const INFO: any = {};

        INFO.data0 = await OpenSkyDataProvider.getReserveData(POOL_ID);
        await buyer001.OpenSkyPool.deposit('1', 0, { value: ONE_ETH });

        await OpenSkyPool.updateMoneyMarketIncome(POOL_ID, { value: ONE_ETH });

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
        const { OpenSkyPool, OpenSkyOToken, OpenSkyDataProvider, MoneyMarket, buyer001 } = await setupWithStakingNFT();
        const { treasury } = await getNamedAccounts();

        const INFO: any = {};
        await buyer001.OpenSkyPool.deposit('1', 0, { value: ONE_ETH });
        // INFO.index_0 = await OpenSkyPool.getReserveNormalizedIncome(POOL_ID);

        await OpenSkyPool.updateMoneyMarketIncome(POOL_ID, { value: MAX_UINT_128 });

        await expect(OpenSkyPool.updateState(POOL_ID, 0)).to.revertedWith('INDEX_OVERFLOW');

        // console.log(INFO);
    });

    it('trigger index overflow by user borrowing', async function () {
        const { OpenSkyPool, OpenSkyNFT, MoneyMarket, OpenSkyInterestRateStrategy, deployer, nftStaker } =
            await setupWithStakingNFT();
        const INFO: any = {};

        await deployer.OpenSkyPool.deposit(1, 0, { value: parseEther('100') });

        INFO.rate_0 = await OpenSkyPool.getBorrowRate(POOL_ID);

        await OpenSkyInterestRateStrategy.setBaseBorrowRate(POOL_ID, BigNumber.from(2).pow(128).mul(10000));

        INFO.rate_1 = await OpenSkyPool.getBorrowRate(POOL_ID);

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(POOL_ID, amount, 365 * 24 * 3600, OpenSkyNFT.address, 1, nftStaker.address);

        await advanceTimeAndBlock(3600 * 24 * 1000);

        await expect(OpenSkyPool.updateState(POOL_ID, 0)).to.revertedWith('INDEX_OVERFLOW');
    });

    it('check basic equation', async function () {
        const {
            OpenSkyPool,
            OpenSkyOToken,
            OpenSkyDataProvider,
            buyer001,
            buyer002,
            nftStaker,
            OpenSkyNFT,
            MoneyMarket,
        } = await setupWithStakingNFT();
        const INFO: any = {};
        INFO.tvl = await OpenSkyPool.getTVL(POOL_ID);
        INFO.getTotalBorrowBalance = await OpenSkyPool.getTotalBorrowBalance(POOL_ID);
        INFO.Liquidity = await OpenSkyPool.getAvailableLiquidity(POOL_ID);

        INFO.data = await OpenSkyDataProvider.getReserveData(POOL_ID);

        expect(await buyer001.OpenSkyPool.deposit(POOL_ID, 0, { value: ONE_ETH }));
        expect(await buyer002.OpenSkyPool.deposit(POOL_ID, 0, { value: ONE_ETH }));

        let amount = parseEther('1.5');
        await nftStaker.OpenSkyPool.borrow(POOL_ID, amount, 365 * 24 * 3600, OpenSkyNFT.address, 1, nftStaker.address);

        INFO.data2 = await OpenSkyDataProvider.getReserveData(POOL_ID);

        expect(INFO.data2.availableLiquidity.add(INFO.data2.totalBorrowsBalance)).eq(INFO.data2.totalDeposits);

        // console.log(INFO);
    });
});
