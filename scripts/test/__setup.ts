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
    await deployments.fixture(['test']);
    const networkInfo = await ethers.provider.getNetwork();
    console.log('HARDHAT_FORKING_NETWORK:', networkInfo, process.env.HARDHAT_FORKING_NETWORK);

    const contracts: any = {
        OpenSkyNFT: await ethers.getContract('OpenSkyERC721Mock'),
        // TODO support different networks
        OpenSkyPool: await ethers.getContract('OpenSkyPoolMock'),
        // MoneyMarket: await ethers.getContract('CompoundMoneyMarketMock'),
        OpenSkySettings: await ethers.getContract('OpenSkySettings'),
        OpenSkyDataProvider: await ethers.getContract('OpenSkyDataProvider'),
        ACLManager: await ethers.getContract('ACLManager'),
        OpenSkyLoan: await ethers.getContract('OpenSkyLoanMock'),

        OpenSkyCollateralPriceOracle: await ethers.getContract('OpenSkyCollateralPriceOracle'),
        OpenSkyInterestRateStrategy: await ethers.getContract('OpenSkyInterestRateStrategy'),

        OpenSkyDutchAuction: await ethers.getContract('OpenSkyDutchAuction'),
        OpenSkyDutchAuctionLiquidator: await ethers.getContract('OpenSkyDutchAuctionLiquidator'),
        OpenSkyDutchAuctionPriceOracle: await ethers.getContract('OpenSkyDutchAuctionPriceOracle'),

        // punk-gateway
        CryptoPunksMarket: await ethers.getContract('CryptoPunksMarket'),
        WrappedPunk: await ethers.getContract('WrappedPunk'),
        OpenSkyPunkGateway: await ethers.getContract('OpenSkyPunkGateway'),
    };

    // compound CEther
    // hard fork mode consider diffrent networks
    if (
        (networkInfo.chainId == 31337 && process.env.HARDHAT_FORKING_NETWORK) ||
        networkInfo.chainId == 4 //rinkeby
    ) {
        console.log(`load config for ${process.env.HARDHAT_FORKING_NETWORK}`)
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
        contracts.CEther = await ethers.getContract('CEther');
        contracts.MoneyMarket = await ethers.getContract('CompoundMoneyMarketMock');

        //TODO aave mock
        // throw 'please use hardfork mode';
    }

    const users = await setupUsers(await getUnnamedAccounts(), contracts);
    const { deployer, nftStaker, buyer001, buyer002, buyer003, buyer004, liquidator } = await getNamedAccounts();

    const ENV = {
        ...contracts,
        users,
        deployer: await setupUser(deployer, contracts),
        nftStaker: await setupUser(nftStaker, contracts),
        buyer001: await setupUser(buyer001, contracts),
        buyer002: await setupUser(buyer002, contracts),
        buyer003: await setupUser(buyer003, contracts),
        buyer004: await setupUser(buyer004, contracts),
        liquidator: await setupUser(liquidator, contracts),
    };

    // init punk  // deployer is contract owner
    await ENV.deployer.CryptoPunksMarket.setInitialOwners(
        [nftStaker, nftStaker, nftStaker, nftStaker, nftStaker],
        [0, 1, 2, 3, 4]
    );
    await ENV.deployer.CryptoPunksMarket.allInitialOwnersAssigned();

    // mint wpunk to nftStaker
    await waitForTx(await ENV.nftStaker.WrappedPunk.registerProxy());
    const wpunkProxyInfo = await ENV.nftStaker.WrappedPunk.proxyInfo(nftStaker);
    for (const punkIndex of [3, 4]) {
        await waitForTx(await ENV.nftStaker.CryptoPunksMarket.transferPunk(wpunkProxyInfo, punkIndex));
        await waitForTx(await ENV.nftStaker.WrappedPunk.mint(punkIndex));
    }

    // LiquidationOperator
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(liquidator));

    return ENV;
});

export const setupWithStakingNFT = deployments.createFixture(async () => {
    const ENV = await __setup();

    const { deployer, nftStaker, buyer001, buyer002, liquidator } = await getNamedAccounts();

    await (await ENV.OpenSkyNFT.awardItem(nftStaker)).wait();
    await (await ENV.OpenSkyNFT.awardItem(buyer001)).wait();
    await (await ENV.OpenSkyNFT.awardItem(buyer002)).wait();

    await (await ENV.nftStaker.OpenSkyNFT.approve(ENV.OpenSkyPool.address, '1')).wait();
    await (await ENV.buyer001.OpenSkyNFT.approve(ENV.OpenSkyPool.address, '2')).wait();
    await (await ENV.buyer002.OpenSkyNFT.approve(ENV.OpenSkyPool.address, '3')).wait();

    // hard code, the first market No. is 1
    const oTokenAddress = (await ENV.OpenSkyPool.getReserveData('1')).oTokenAddress;

    // add oToken
    const contracts = {
        OpenSkyOToken: await ethers.getContractAt('OpenSkyOToken', oTokenAddress),
    };
    const ENV_EXTRA = {
        ...contracts,
        deployer: await setupUser(deployer, contracts),
        nftStaker: await setupUser(nftStaker, contracts),
        buyer001: await setupUser(buyer001, contracts),
        buyer002: await setupUser(buyer002, contracts),
        liquidator: await setupUser(liquidator, contracts),
    };
    _.merge(ENV, ENV_EXTRA);

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
    // expect(almostEqual(availableLiquidity.add(totalBorrowsBalance), TVL)).to.be.true;

    // @ts-ignore
    expect(availableLiquidity.add(totalBorrowsBalance)).to.be.almostEqual(TVL);

    // expect(availableLiquidity.add(totalBorrowsBalance)).eq(TVL);
}
