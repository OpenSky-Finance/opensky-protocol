import { Signer } from 'ethers';
import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { solidity } from 'ethereum-waffle';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import _ from 'lodash';
import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';

import { setupUser, setupUsers, waitForTx, getTxCost } from '../../helpers/utils';

declare var hre: HardhatRuntimeEnvironment;

chai.use(bignumberChai());
chai.use(solidity);

export interface SignerWithAddress {
    signer: Signer;
    address: string;
}
// export interface TestEnv {
//     users: SignerWithAddress[];
//     contracts: any[];
// }

// const testEnv: TestEnv = {
//     users: [] as SignerWithAddress[],
// } as TestEnv;

// TODO add types

// export interface TestEnv {};
const testEnv: any = {};

export async function initializeMakeSuite() {
    await deployments.fixture(['test']);
    const networkInfo = await ethers.provider.getNetwork();
    console.log('HARDHAT_FORKING_NETWORK:', networkInfo, process.env.HARDHAT_FORKING_NETWORK);

    const contracts: any = {
        OpenSkyNFT: await ethers.getContract('OpenSkyERC721Mock'),
        // TODO support diffrent networks
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

    testEnv.contracts = contracts;

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

    // /////////////////////////////////////////////////////
    // mint test nft
    await (await contracts.OpenSkyNFT.awardItem(nftStaker)).wait();
    await (await contracts.OpenSkyNFT.awardItem(buyer001)).wait();

    // approve
    await (await ENV.nftStaker.OpenSkyNFT.approve(ENV.OpenSkyPool.address, '1')).wait();

    _.merge(testEnv, ENV);
}

let HardhatSnapshotId: string = '0x1';
const setSnapshot = async () => {
    const id = await ethers.provider.send('evm_snapshot', []);
    HardhatSnapshotId = id;
};

const revertHead = async () => {
    async (id: string) => ethers.provider.send('evm_revert', [HardhatSnapshotId]);
};

// before(async () => {
//     await initializeMakeSuite();
// });

export function makeSuite(name: string, tests: (testEnv: any) => void) {
    describe(name, async () => {
        before(async () => {
          await initializeMakeSuite();
          await setSnapshot();
        });
        tests(testEnv);
        after(async () => {
            await revertHead();
        });
    });
}
