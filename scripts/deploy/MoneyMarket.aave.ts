import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

// kovan money market TODO move to config file
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts
const LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS = '0x88757f2f99175387ab4c6a4b3067c77a695b0349';
const AAVE_WETH_GATEWAY_ADDRESS = '0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkyNFT1 = await deploy('OpenSkyERC721Mock', {
        from: deployer,
        gasLimit: 4000000,
        args: ['Open Sky NFT1', 'OPNFT1'],
        log: true,
    });

    const OpenSkyERC1155Token = await deploy('OpenSkyERC1155Mock', {
        from: deployer,
        gasLimit: 4000000,
        args: ['http://token-uri/tokenid/'],
        log: true,
    });

    const OpenSkySettings = await deploy('OpenSkySettings', {
        from: deployer,
        args: [],
        log: true,
    });

    // deploy library first
    const DataTypes = await deploy('DataTypes', {
        from: deployer,
        args: [],
        log: true,
    });
    const ReserveDataLogic = await deploy('ReserveDataLogic', {
        from: deployer,
        args: [],
        log: true,
    });

    // const ValidationLogic = await deploy('ValidationLogic', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    //     libraries: {
    //         DataTypes: DataTypes.address,
    //         ReserveDataLogic: ReserveDataLogic.address,
    //     },
    // });

    console.log('start to deploy OpenSkyBespokePool ', OpenSkySettings.address);
    const OpenSkyBespokePool = await deploy('OpenSkyBespokePool', {
        from: deployer,
        args: [OpenSkySettings.address, 'OpenSkyBespokePool', 'OpenSkyBespokePool', ''],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            ReserveDataLogic: ReserveDataLogic.address,
            // ValidationLogic: ValidationLogic.address,
        },
    });

    
    const DefaultReserveInterestRateStrategy = await deploy('OpenSkyDefaultReserveInterestRateStrategy', {
        from: deployer,
        args: [],
        log: true,
    });

    // market factory
    const OpenSkyBespokePoolVaultFactory = await deploy('OpenSkyBespokePoolVaultFactory', {
        from: deployer,
        args: [OpenSkySettings.address, 'OpenSkyBespokePool', 'OpenSkyBespokePool', ''],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            ReserveDataLogic: ReserveDataLogic.address,
        },
    });

    const OpenSkyBespokePoolLending = await deploy('OpenSkyBespokePoolLending', {
        from: deployer,
        args: [OpenSkySettings.address, 'OpenSkyBespokePool', 'OpenSkyBespokePool', ''],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            ReserveDataLogic: ReserveDataLogic.address,
            // ValidationLogic: ValidationLogic.address,
        },
    });
    // money market
    let AaveMoneyMarket = await deploy('AaveMoneyMarket', {
        from: deployer,
        args: [LENDING_POOL_ADDRESSES_PROVIDER_ADDRESS, AAVE_WETH_GATEWAY_ADDRESS],
        log: true,
    });

    // /////////////////////////////////////////////
    const addressProvider = await ethers.getContract('OpenSkySettings', deployer);
    await addressProvider.setMarketAddress(OpenSkyBespokePool.address);

    await addressProvider.setDefaultLendingRateModelAddress(DefaultReserveInterestRateStrategy.address); 

    await addressProvider.setMarketVaultFactoryAddress(OpenSkyBespokePoolVaultFactory.address);
    await addressProvider.setLendingAddress(OpenSkyBespokePoolLending.address);

    // money market
    await addressProvider.setMoneyMarketAddress(AaveMoneyMarket.address);
};
export default func;
func.tags = ['MoneyMarket.aave'];
