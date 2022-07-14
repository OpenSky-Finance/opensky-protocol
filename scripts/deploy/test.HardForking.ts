import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }


    const config = require(`../config/${network}.json`);

    console.log('init protocol')
    const { WNative, USDC } = config.contractAddress;

    const OpenSkyPool = await ethers.getContract('OpenSkyPool');
    try {
        await (await OpenSkyPool.getReserveData(1)).wait()
    } catch(err: any) {
        await (await OpenSkyPool.create(WNative, 'OpenSky ETH', 'OETH')).wait();
    }
    try {
        await (await OpenSkyPool.getReserveData(2)).wait()
    } catch(err: any) {
        await (await OpenSkyPool.create(USDC, 'OpenSky USDC', 'OUSDC')).wait();
    }
    console.log('create reserves successfully')

    const OpenSkyWETHGateway = await ethers.getContract('OpenSkyWETHGateway');
    await (await OpenSkyWETHGateway.authorizeLendingPoolWETH()).wait();
    console.log('authorize lending pool WETH successfully')

    let nfts = [];
    for (const nft of config.whitelist) {
        nfts.push(!nft.address ? (await ethers.getContract(nft.contract)).address : nft.address);
    }
    console.log('nfts', nfts)
    await (await OpenSkyWETHGateway.authorizeLendingPoolNFT(nfts)).wait();
    console.log('authorize lending pool NFT successfully')
    console.log('create reserves successfully')

    console.log(`Deployed to ${network} successfully`);
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
    'ERC20MoneyMarket.aave',
    // 'MoneyMarket.compound.hardhat', // special
    // 'MoneyMarket.aave3', // aave hardforking
    'OpenSkyWETHGateway',
    'OpenSkyPunkGateway',
    'OpenSkySettings.whitelist',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyTreasury',
    'OpenSkyDataProvider',
    // gov
    'TimelockController',
    // dao vault
    'OpenSkyDaoVault',
    'OpenSkyBespokeMarket'
];
