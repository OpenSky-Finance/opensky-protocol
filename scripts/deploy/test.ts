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

    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock', deployer);
    await (await OpenSkyPool.create('OpenSky ETH', 'OETH')).wait();

    console.log('===TEST DEPLOYED===');
};
export default func;
func.tags = ['test'];
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
    'OpenSkyDutchAuction',
    'OpenSkyDutchAuctionLiquidator',
    'OpenSkyDutchAuctionPriceOracle',
    'TimelockController',
    // dao vault
    'OpenSkyDaoVault',
    'OpenSkyDaoVaultUniswapV2Adapter',
    'OpenSkyDaoLiquidator',
];
