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

    // const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock');
    // await (await OpenSkyPool.create('OpenSky ETH', 'OETH')).wait();

    const WETH = await ethers.getContract('WETH');
    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock');
    await (await OpenSkyPool.create(WETH.address, 'OpenSky ETH', 'OETH', 18)).wait();
    const DAI = await ethers.getContract('DAI');
    await (await OpenSkyPool.create(DAI.address, 'OpenSky DAI', 'ODAI', 18)).wait();

    const OpenSkyWETHGateway = await ethers.getContract('OpenSkyWETHGateway');
    await (await OpenSkyWETHGateway.authorizeLendingPoolWETH()).wait();
    const config = require(`../config/${network}.json`);

    let nfts = [];
    for (const nft of config.whitelist) {
        nfts.push(!nft.address ? (await ethers.getContract(nft.contract)).address : nft.address);
    }
    await (await OpenSkyWETHGateway.authorizeLendingPoolNFT(nfts)).wait();

    // //////////////////////////////////////////////////////////
    // Bespoke
    // 1. add currency transfer adapter
    // 2. add  oToken to currency whitelist
    // depends on reserve initialize
    const TransferAdapterOToken = await ethers.getContract('TransferAdapterOToken');
    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings');

    const reserveData1 = await OpenSkyPool.getReserveData(1); // WETH
    await (await TransferAdapterOToken['setOTokenToReserveIdMap(address,uint256)'](reserveData1.oTokenAddress, 1)).wait();
    await (
        await OpenSkyBespokeSettings.addCurrencyTransferAdapter(
            reserveData1.oTokenAddress,
            TransferAdapterOToken.address
        )
    ).wait();

    const reserveData2 = await OpenSkyPool.getReserveData(2); // DAI
    await (await TransferAdapterOToken['setOTokenToReserveIdMap(address,uint256)'](reserveData2.oTokenAddress, 2)).wait();

    await (
        await OpenSkyBespokeSettings.addCurrencyTransferAdapter(
            reserveData2.oTokenAddress,
            TransferAdapterOToken.address
        )
    ).wait();

    // add oTokenAddress to currency whitelist
    await (await OpenSkyBespokeSettings.addCurrency(reserveData1.oTokenAddress)).wait();
    await (await OpenSkyBespokeSettings.addCurrency(reserveData2.oTokenAddress)).wait();

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
    // 'MoneyMarket.compound.hardhat', // special
    // 'MoneyMarket.aave3', // aave hardforking
    // 'MoneyMarket.aave.hardhat', // special
    'ERC20MoneyMarket.aave',
    'OpenSkyWETHGateway',
    'OpenSkyPunkGateway.hardhat',
    'OpenSkySettings.whitelist',
    'OpenSkyCollateralPriceOracle',
    'OpenSkyPriceAggregator',
    'OpenSkyTreasury',
    'OpenSkyDataProvider',
    // 'TimelockController',
    // dao vault
    'OpenSkyDaoVault',
    'OpenSkyDaoVaultUniswapV2Adapter',
    'OpenSkyDaoLiquidator',
    // bespoke
    'OpenSkyBespokeMarket',
    'OpenSkyDutchAuctionLiquidator',
    'OpenSkyDutchAuctionPriceOracle',
    'OpenSkyLoanDelegator',
    'OpenSkyLoanHelper',
    'OpenSkyGuarantor',
    'OpenSkyApeCoinStakingHelper',
    'MoneyMarket.apecoin',
];
