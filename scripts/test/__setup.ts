import _ from 'lodash';
// @ts-ignore
import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUser, setupUsers, waitForTx, getTxCost } from '../helpers/utils';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { ENV } from './__types';

import IWETHGatewayABI from '../../data/abi/IWETHGateway.json';
import IPoolABI from '../../data/abi/IPool.json';
import IATokenABI from '../../data/abi/IAToken.json';
import { expect } from '../helpers/chai';
import { almostEqual } from '../helpers/utils';
import { RAY } from '../helpers/constants';

export const __setup = deployments.createFixture(async () => {
    const isHardForking = !!process.env.HARDHAT_FORKING_NETWORK;

    const networkInfo = await ethers.provider.getNetwork();
    console.log('__setup HARDHAT_FORKING_NETWORK:', isHardForking, networkInfo, process.env.HARDHAT_FORKING_NETWORK);

    if (isHardForking) {
        console.log('__setup fixture:test.HardForking ');
        await deployments.fixture(['test.HardForking']);
    } else {
        console.log('__setup fixture:test ');
        await deployments.fixture(['test']);
    }

    const contracts: any = {
        OpenSkyNFT: await ethers.getContract('OpenSkyERC721Mock'),
        // TODO support different networks
        OpenSkyPool: await ethers.getContract('OpenSkyPoolMock'),
        OpenSkyWETHGateway: await ethers.getContract('OpenSkyWETHGateway'),
        OpenSkyERC20Pool: await ethers.getContract('OpenSkyPoolMock'),
        MoneyMarket: await ethers.getContract('AaveV2MoneyMarket'),
        OpenSkySettings: await ethers.getContract('OpenSkySettings'),
        OpenSkyDataProvider: await ethers.getContract('OpenSkyDataProvider'),
        ACLManager: await ethers.getContract('ACLManager'),
        OpenSkyLoan: await ethers.getContract('OpenSkyLoanMock'),

        OpenSkyCollateralPriceOracle: await ethers.getContract('OpenSkyCollateralPriceOracle'),
        OpenSkyPriceAggregator: await ethers.getContract('OpenSkyPriceAggregator'),
        OpenSkyInterestRateStrategy: await ethers.getContract('OpenSkyInterestRateStrategy'),

        // punk-gateway
        CryptoPunksMarket: await ethers.getContract('CryptoPunksMarket'),
        WrappedPunk: await ethers.getContract('WrappedPunk'),
        OpenSkyPunkGateway: await ethers.getContract('OpenSkyPunkGateway'),

        // TimelockController: await ethers.getContract('TimelockController'),

        // Dao vault
        OpenSkyDaoVault: await ethers.getContract('OpenSkyDaoVault'),
        OpenSkyDaoVaultUniswapV2Adapter: await ethers.getContract('OpenSkyDaoVaultUniswapV2Adapter'),
        OpenSkyDaoLiquidator: await ethers.getContract('OpenSkyDaoLiquidator'),
        UniswapV2Router02: await ethers.getContract('UniswapV2Router02'),
        WNative: await ethers.getContract('WETH'),
        DAI: await ethers.getContract('DAI'),
        UnderlyingAsset: await ethers.getContract('WETH'),
        TestERC20: await ethers.getContract('TestERC20'),
        OpenSkyERC1155Mock: await ethers.getContract('OpenSkyERC1155Mock'),

        // bespoke market
        OpenSkyBespokeMarket: await ethers.getContract('OpenSkyBespokeMarket'),
        OpenSkyBespokeLendNFT: await ethers.getContract('OpenSkyBespokeLendNFT'),
        OpenSkyBespokeBorrowNFT: await ethers.getContract('OpenSkyBespokeBorrowNFT'),
        OpenSkyBespokeSettings: await ethers.getContract('OpenSkyBespokeSettings'),
        // OpenSkyBespokeDataProvider: await ethers.getContract('OpenSkyBespokeDataProvider'),

        OpenSkyDutchAuctionLiquidator: await ethers.getContract('OpenSkyDutchAuctionLiquidator'),
        OpenSkyDutchAuctionPriceOracle: await ethers.getContract('OpenSkyDutchAuctionPriceOracle'),
        OpenSkyLoanDelegator: await ethers.getContract('OpenSkyLoanDelegator'),

        // strategies
        StrategyAnyInCollection: await ethers.getContract('StrategyAnyInCollection'),
        StrategyTokenId: await ethers.getContract('StrategyTokenId'),

        // nft transfer adapter
        TransferAdapterERC721Default: await ethers.getContract('TransferAdapterERC721Default'),
        TransferAdapterERC1155Default: await ethers.getContract('TransferAdapterERC1155Default'),

        //currency transfer adapter
        TransferAdapterCurrencyDefault: await ethers.getContract('TransferAdapterCurrencyDefault'),
        TransferAdapterOToken: await ethers.getContract('TransferAdapterOToken'),
        // ape coin staking
        ApeCoinStaking: await ethers.getContract('ApeCoinStaking'),
        ApeCoin: await ethers.getContract('ApeCoin'),
        BAYC: await ethers.getContract('BAYC'),
        MAYC: await ethers.getContract('MAYC'),
        BAKC: await ethers.getContract('BAKC'),
        OpenSkyApeCoinStaking: await ethers.getContract('OpenSkyApeCoinStaking'),

        OpenSkyDutchAuctionLiquidator: await ethers.getContract('OpenSkyDutchAuctionLiquidator'),
        OpenSkyDutchAuctionPriceOracle: await ethers.getContract('OpenSkyDutchAuctionPriceOracle'),
        OpenSkyLoanDelegator: await ethers.getContract('OpenSkyLoanDelegator')
    };

    // hard code, the first market No. is 1
    const oTokenAddress = (await contracts.OpenSkyPool.getReserveData('1')).oTokenAddress;

    // add oToken
    contracts.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
    contracts.ODAI = await ethers.getContractAt(
        'OpenSkyOToken',
        (
            await contracts.OpenSkyPool.getReserveData('2')
        ).oTokenAddress
    );

    // Dao vault support hard forking only // TODO
    if (isHardForking) {
        contracts.OpenSkyDaoVault = await ethers.getContract('OpenSkyDaoVault');
        contracts.OpenSkyDaoVaultUniswapV2Adapter = await ethers.getContract('OpenSkyDaoVaultUniswapV2Adapter');
        contracts.OpenSkyDaoLiquidator = await ethers.getContract('OpenSkyDaoLiquidator');

        // uniswap
        const config = require(`../config/${process.env.HARDHAT_FORKING_NETWORK}.json`);
        contracts.UniswapV2Router02 = await ethers.getContractAt(
            'IUniswapV2Router02',
            config.contractAddress.QUICKSWAP_UNISWAPV2ROUTER02
        );

        contracts.WNative = await ethers.getContractAt('WETH', config.contractAddress.QUICKSWAP_WMATIC);

        contracts.TestERC20 = await ethers.getContractAt('TestERC20', config.contractAddress.QUICKSWAP_TESTERC20);
    }

    // compound CEther
    // hard fork mode consider diffrent networks
    if (
        (networkInfo.chainId == 31337 && process.env.HARDHAT_FORKING_NETWORK) ||
        networkInfo.chainId == 4 //rinkeby
    ) {
        console.log(`load config for ${process.env.HARDHAT_FORKING_NETWORK}`);
        const config = require(`../config/${process.env.HARDHAT_FORKING_NETWORK}.json`);

        // compound
        // contracts.CEther = await ethers.getContractAt('CErc20Interface', config.contractAddress.COMPOUND_CETHER_ADDRESS);
        // contracts['CompoundMoneyMarket'] = await ethers.getContract('CompoundMoneyMarket');
        // contracts.MoneyMarket = await ethers.getContract('CompoundMoneyMarket');

        // aave-v3 // TODO check, replace abi?
        contracts.AAVE_WETH_GATEWAY = await ethers.getContractAt(
            IWETHGatewayABI,
            config.contractAddress.AAVE_V3_WETH_GATEWAY
        );
        contracts.AAVE_POOL = await ethers.getContractAt(IPoolABI, config.contractAddress.AAVE_V3_POOL);
        contracts.AAVE_AWETH = await ethers.getContractAt(IATokenABI, config.contractAddress.AAVE_V3_AWETH);
    } else {
        // local compound hardhat
        // contracts.CEther = await ethers.getContract('CEther');
        // contracts.MoneyMarket = await ethers.getContract('CompoundMoneyMarketMock');

        // local aave-v2 mock
        contracts.AAVE_POOL = await ethers.getContract('AAVELendingPool');

        //TODO aave mock
        //throw 'please use hardfork mode';
    }

    const users = await setupUsers(await getUnnamedAccounts(), contracts);
    const { deployer, nftStaker, buyer001, buyer002, buyer003, buyer004, liquidator } = await getNamedAccounts();
    const { user001, user002, user003, user004, user005, borrower } = await getNamedAccounts();

    for(const x in contracts){
        contracts[contracts[x].address] = contracts[x];
    }

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

    // init punk  // deployer is contract owner
    await ENV.deployer.CryptoPunksMarket.setInitialOwners(
        [borrower, borrower, borrower, borrower, borrower],
        [0, 1, 2, 3, 4]
    );
    await ENV.deployer.CryptoPunksMarket.allInitialOwnersAssigned();

    // mint wpunk to nftStaker
    await waitForTx(await ENV.borrower.WrappedPunk.registerProxy());
    const wpunkProxyInfo = await ENV.borrower.WrappedPunk.proxyInfo(borrower);
    for (const punkIndex of [3, 4]) {
        await waitForTx(await ENV.borrower.CryptoPunksMarket.transferPunk(wpunkProxyInfo, punkIndex));
        await waitForTx(await ENV.borrower.WrappedPunk.mint(punkIndex));
    }

    // LiquidationOperator
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(liquidator));
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(deployer));

    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));

    await waitForTx(await ENV.OpenSkyNFT.awardItem(user001));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(user002));

    await waitForTx(await ENV.borrower.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));
    await waitForTx(await ENV.user001.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));
    await waitForTx(await ENV.user002.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));

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
