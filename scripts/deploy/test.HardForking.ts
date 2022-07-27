import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const network = hre.network.name;
    console.log('Current network:', network);
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_URL) {
        console.log('Current mode: forking');
        console.log('HARDHAT_FORKING_NETWORK:', process.env.HARDHAT_FORKING_NETWORK);
        console.log('HARDHAT_FORKING_URL:', process.env.HARDHAT_FORKING_URL);
    }

    const config = require(`../config/${network}.json`);
    const { WNative, USDC } = config.contractAddress;

    console.log('init protocol')
    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock', deployer);
    try {
        await (await OpenSkyPool.getReserveData(1)).wait()
    } catch(err: any) {
        await (await OpenSkyPool.create(WNative, 'OpenSky ETH', 'OETH', 18)).wait();
    }
    try {
        await (await OpenSkyPool.getReserveData(2)).wait()
    } catch(err: any) {
        await (await OpenSkyPool.create(USDC, 'OpenSky USDC', 'OUSDC', 6)).wait();
    }

    console.log('===TEST DEPLOYED===');
};
export default func;
func.tags = ['test.HardForking'];
func.dependencies = [
    'Mock',
    'OpenSkyLibrary',
    'ACLManager',
    'OpenSkySettings',
    'OpenSkyInterestRateStrategy',
    'OpenSkyPool',
    'OpenSkyLoan',
    'OpenSkyReserveVaultFactory',
    'MoneyMarket.compound.hardhat', // special
    // 'MoneyMarket.aave3', // aave hardforking
    'OpenSkyPunkGateway.hardhat',
    'OpenSkySettings.whitelist',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyTreasury',
    'OpenSkyDataProvider',
    // gov
    'TimelockController',
    // dao vault
    'OpenSkyDaoVault',
    'OpenSkyDaoVaultUniswapV2Adapter',
    'OpenSkyDaoLiquidator',
];
