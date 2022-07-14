import _ from 'lodash';
// @ts-ignore
import { ethers, deployments, network, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUser, setupUsers, waitForTx, getTxCost } from '../../helpers/utils';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { ENV } from '../__types';

import IWETHGatewayABI from '../../../data/abi/IWETHGateway.json';
import IERC20 from '../../../data/abi/IERC20.json';
import IPoolABI from '../../../data/abi/IPool.json';
import { expect } from '../../helpers/chai';
import { almostEqual } from '../../helpers/utils';

export const __setup = deployments.createFixture(async () => {
    const isHardForking = !!process.env.HARDHAT_FORKING_NETWORK;

    const config = require(`./config/${process.env.HARDHAT_FORKING_NETWORK}.json`);

    const networkInfo = await ethers.provider.getNetwork();
    console.log('__setup HARDHAT_FORKING_NETWORK:', isHardForking, networkInfo, process.env.HARDHAT_FORKING_NETWORK);

    console.log('__setup fixture:test.HardForking');

    const { 
        PUNK, WPUNK, WNative, USDC,
        OpenSkyPool, OpenSkyWETHGateway, AaveV2MoneyMarket, OpenSkySettings,
        OpenSkyDataProvider, ACLManager, OpenSkyLoan, OpenSkyCollateralPriceOracle, 
        OpenSkyInterestRateStrategy, OpenSkyPunkGateway, OpenSkyDaoVault, OpenSkyBespokeMarket,
        OpenSkyBespokeLendNFT, OpenSkyBespokeBorrowNFT, OpenSkyBespokeSettings
    } = config.contractAddress;

    const contracts: any = {
        OpenSkyPool: await ethers.getContractAt('OpenSkyPool', OpenSkyPool),
        OpenSkyWETHGateway: await ethers.getContractAt('OpenSkyWETHGateway', OpenSkyWETHGateway),
        OpenSkyERC20Pool: await ethers.getContractAt('OpenSkyPool', OpenSkyPool),
        MoneyMarket: await ethers.getContractAt('AaveV2MoneyMarket', AaveV2MoneyMarket),
        OpenSkySettings: await ethers.getContractAt('OpenSkySettings', OpenSkySettings),
        OpenSkyDataProvider: await ethers.getContractAt('OpenSkyDataProvider', OpenSkyDataProvider),
        ACLManager: await ethers.getContractAt('ACLManager', ACLManager),
        OpenSkyLoan: await ethers.getContractAt('OpenSkyLoan', OpenSkyLoan),

        OpenSkyCollateralPriceOracle: await ethers.getContractAt('OpenSkyCollateralPriceOracle', OpenSkyCollateralPriceOracle),
        OpenSkyInterestRateStrategy: await ethers.getContractAt('OpenSkyInterestRateStrategy', OpenSkyInterestRateStrategy),

        // punk-gateway
        CryptoPunksMarket: await ethers.getContractAt('CryptoPunksMarket', PUNK),
        WrappedPunk: await ethers.getContractAt('WrappedPunk', WPUNK),
        OpenSkyPunkGateway: await ethers.getContractAt('OpenSkyPunkGateway', OpenSkyPunkGateway),

        // TimelockController: await ethers.getContract('TimelockController'),

        // Dao vault
        OpenSkyDaoVault: await ethers.getContractAt('OpenSkyDaoVault', OpenSkyDaoVault),
        WNative: await ethers.getContractAt('WETH', WNative),
        USDC: await ethers.getContractAt(IERC20, USDC),
        UnderlyingAsset: await ethers.getContractAt('WETH', WNative),

        // bespoke market
        OpenSkyBespokeMarket: await ethers.getContractAt('OpenSkyBespokeMarket', OpenSkyBespokeMarket),
        OpenSkyBespokeLendNFT: await ethers.getContractAt('OpenSkyBespokeLoanNFT', OpenSkyBespokeLendNFT),
        OpenSkyBespokeBorrowNFT: await ethers.getContractAt('OpenSkyBespokeLoanNFT', OpenSkyBespokeBorrowNFT),
        OpenSkyBespokeSettings: await ethers.getContractAt('OpenSkyBespokeSettings', OpenSkyBespokeSettings),
    };

    // hard code, the first market No. is 1
    const oTokenAddress = (await contracts.OpenSkyPool.getReserveData('1')).oTokenAddress;

    // add oToken
    contracts.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
    contracts.OUSDC = await ethers.getContractAt('OpenSkyOToken', (await contracts.OpenSkyPool.getReserveData('2')).oTokenAddress);

    contracts.AAVE_WETH_GATEWAY = await ethers.getContractAt(
        IWETHGatewayABI,
        config.contractAddress.AAVE_V2_WETH_GATEWAY
    );
    contracts.AAVE_POOL = await ethers.getContractAt(IPoolABI, config.contractAddress.AAVE_V2_POOL);

    const users = await setupUsers(await getUnnamedAccounts(), contracts);
    const { deployer, nftStaker, buyer001, buyer002, buyer003, buyer004, liquidator } = await getNamedAccounts();
    const { user001, user002, user003, user004, user005, borrower } = await getNamedAccounts();

    const ENV = {
        ...contracts,
        users,
        deployer: await setupUser(deployer, contracts),
        nftStaker: await setupUser(nftStaker, contracts),
        buyer001: await setupUser(buyer001, contracts),
        buyer002: await setupUser(buyer002, contracts),
        buyer003: await setupUser(buyer003, contracts),
        buyer004: await setupUser(buyer004, contracts),
        borrower: await setupUser(borrower, contracts),
        user001: await setupUser(user001, contracts),
        user002: await setupUser(user002, contracts),
        user003: await setupUser(user003, contracts),
        user004: await setupUser(user004, contracts),
        liquidator: await setupUser(liquidator, contracts),
    };

    // LiquidationOperator
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(liquidator));
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(deployer));

    return ENV;
});

export const loadContractForusers = async (contractName: string, contractAddress: string) => {
    const { deployer, nftStaker, buyer001, buyer002, liquidator } = await getNamedAccounts();

    const contract = await ethers.getContractAt(contractName, contractAddress);
    const users = { deployer, nftStaker, buyer001, buyer002, liquidator };
    const obj: any = {
        ...contract,
        users: {},
    };

    for (const user in users) {
        // @ts-ignore
        obj.users[user] = await contract.connect(await ethers.getSigner(users[user]));
    }
    return obj;
};

export function formatEtherAttrs(data: any) {
    const obj = _.cloneDeep(data);
    for (const x in obj) {
        if (_.isPlainObject(obj[x])) {
            obj[x] = formatEtherAttrs(obj[x]);
        } else {
            if (BigNumber.isBigNumber(obj[x])) {
                obj[x] = formatEther(obj[x]);
            }
        }
    }
    return obj;
}

export function formatObjNumbers(data: any) {
    const obj = _.cloneDeep(data);
    for (const x in obj) {
        if (_.isPlainObject(obj[x])) {
            obj[x] = formatObjNumbers(obj[x]);
        } else {
            if (BigNumber.isBigNumber(obj[x])) {
                obj[x] = obj[x].toString();
            }
        }
    }
    return obj;
}

export async function checkPoolEquation() {
    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock');
    // await OpenSkyPool.updateState(1,0)
    const OpenSkyDataProvider = await ethers.getContract('OpenSkyDataProvider');
    const { availableLiquidity, totalBorrowsBalance, totalDeposits, TVL } = await OpenSkyDataProvider.getReserveData(1);

    // console.log( formatEther(availableLiquidity), formatEther(totalBorrowsBalance), formatEther(totalDeposits),formatEther(TVL) )

    // add getTVL(reserve) > getTotalBorrowBalance(reserve)
    expect(almostEqual(availableLiquidity.add(totalBorrowsBalance), TVL)).to.be.true;

    // @ts-ignore
    // expect(availableLiquidity.add(totalBorrowsBalance)).to.be.almostEqual(TVL);

    // expect(availableLiquidity.add(totalBorrowsBalance)).eq(TVL);
}

export async function checkTotalDeposits(env: any) {
    const { UnderlyingAsset, OpenSkyPool, MoneyMarket, OpenSkyOToken } = env;
    const availableLiquidity = await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address);
    const totalBorrows = await OpenSkyPool.getTotalBorrowBalance('1');
    if (!almostEqual(await OpenSkyOToken.totalSupply(), availableLiquidity.add(totalBorrows))) {
        console.log('totalSupply', (await OpenSkyOToken.totalSupply()).toString());
        console.log('availableLiquidity.add(reserve.totalBorrows)', availableLiquidity.add(totalBorrows).toString());
    }
    expect(almostEqual(await OpenSkyOToken.totalSupply(), availableLiquidity.add(totalBorrows))).to.be.true;
}

export async function deposit(user: any, reserveId: number, amount: BigNumber) {
    await user.UnderlyingAsset.deposit({ value: amount });
    await user.UnderlyingAsset.approve(user.OpenSkyPool.address, amount);
    await user.OpenSkyPool.deposit(reserveId, amount, user.address, 0);
}
