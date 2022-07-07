import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const network = hre.network.name;

    const config = require(`../config/${network}.json`);

    const { WNative, DAI } = config.contractAddress;

    const OpenSkyPool = await ethers.getContract('OpenSkyPool');
    await (await OpenSkyPool.create(WNative, 'OpenSky Matic', 'OMATIC')).wait();
    await (await OpenSkyPool.create(DAI, 'OpenSky DAI', 'ODAI')).wait();

    const OpenSkyWETHGateway = await ethers.getContract('OpenSkyWETHGateway');
    await (await OpenSkyWETHGateway.authorizeLendingPoolWETH()).wait();

    let nfts = [];
    for (const nft of config.whitelist) {
        nfts.push(!nft.address ? (await ethers.getContract(nft.contract)).address : nft.address);
    }
    await (await OpenSkyWETHGateway.authorizeLendingPoolNFT(nfts)).wait();

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
    'OpenSkyPool',
    'OpenSkyLoan',
    'OpenSkyReserveVaultFactory',
    // 'MoneyMarket.aave3',
    'ERC20MoneyMarket.aave',
    'OpenSkyWETHGateway',
    'OpenSkyPunkGateway',
    'OpenSkySettings.whitelist',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyTreasury',
    'OpenSkyDataProvider',
    'OpenSkyDaoVault'
];
