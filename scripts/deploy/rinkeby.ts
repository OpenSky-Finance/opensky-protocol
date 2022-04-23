import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const network = hre.network.name;
    console.log('current network:', network);
    console.log('Do some settings...');

    const OpenSkyPool = await ethers.getContract('OpenSkyPool', deployer);
    await (await OpenSkyPool.create('OpenSky ETH', 'OETH')).wait();

    console.log(`Deployed to ${network} successfully`);
};

export default func;
func.tags = ['rinkeby'];
func.dependencies = [
    'ACLManager',
    'OpenSkySettings',
    'OpenSkyLibrary',
    'OpenSkyInterestRateStrategy',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyLoan',
    'OpenSkyPool',
    'OpenSkyReserveVaultFactory',
    'MoneyMarket.aave3',
    'OpenSkyPunkGateway',
    'OpenSkyCollectionPool',
    'OpenSkyTreasury',
    'OpenSkySettings.whitelist', // should after OpenSkyCollectionPool
    'OpenSkyDataProvider',
    'OpenSkyDutchAuction',
    'OpenSkyDutchAuctionLiquidator',
    'OpenSkyDutchAuctionPriceOracle'
];
