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

    // setting
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await OpenSkySettings.setOverdueDuration(5 * 60);

    // BorrowDuration
    await OpenSkySettings.setMinBorrowDuration(5 * 60);
    await OpenSkySettings.setMaxBorrowDuration(10 * 365 * 24 * 3600);

    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock', deployer);
    await (await OpenSkyPool.create('OpenSky ETH', 'OETH')).wait();

    console.log('test deployed');
};
export default func;
func.tags = ['test'];
func.dependencies = [
    'OpenSkyMock',
    'ACLManager',
    'OpenSkySettings',
    'OpenSkyLibrary',
    'OpenSkyInterestRateStrategy',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyLoan',
    'OpenSkyPool',
    'OpenSkyReserveVaultFactory',
    'MoneyMarket.compound.hardhat', // special
    'OpenSkyPunkGateway.hardhat', // make it before OpenSkyCollectionPool to provide WPUNK in test.
    'OpenSkyCollectionPool',
    'OpenSkyTreasury',
    'OpenSkySettings.whitelist', // after OpenSkyMock when test
    'OpenSkyDataProvider',
    'OpenSkyDutchAuction',
    'OpenSkyDutchAuctionLiquidator',
    'OpenSkyDutchAuctionPriceOracle',
];
