import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }
    const config = require(`../config/${network}.json`);
    let WETH_ADDRESS = config.contractAddress.WNative;
    if (!WETH_ADDRESS) {
        WETH_ADDRESS = (await ethers.getContract('WETH')).address;
    }

    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings');
    const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket');

    const BespokeTypes = await ethers.getContract('BespokeTypes');

    // refinance
    let AAVE2LendingPoolAddressesProvider;
    if (network == 'hardhat' || network == 'goerli') {
        AAVE2LendingPoolAddressesProvider = await ethers.getContract('AAVELendingPoolAddressesProvider');
    } else {
        // TODO read aave info form config
        AAVE2LendingPoolAddressesProvider = config.contractAddress.AAVE_V2_POOL_ADDRESSES_PROVIDER;
        if (!AAVE2LendingPoolAddressesProvider) throw 'AAVE_V2_POOL_ADDRESSES_PROVIDER not exist';
    }

    const OpenSkyRefinance = await deploy('OpenSkyRefinance', {
        from: deployer,
        args: [
            AAVE2LendingPoolAddressesProvider.address,
        ],
        libraries: {
        },
        log: true,
    });

    // refinance adapters
    const BespokeToBespokeAdapter = await deploy('BespokeToBespokeAdapter', {
        from: deployer,
        args: [
            AAVE2LendingPoolAddressesProvider.address,
            OpenSkyBespokeSettings.address
        ],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    const PoolToBespokeAdapter = await deploy('PoolToBespokeAdapter', {
        from: deployer,
        args: [AAVE2LendingPoolAddressesProvider.address, OpenSkyBespokeSettings.address, OpenSkySettings.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    const BespokeToPoolAdapter = await deploy('BespokeToPoolAdapter', {
        from: deployer,
        args: [AAVE2LendingPoolAddressesProvider.address, OpenSkyBespokeSettings.address, OpenSkySettings.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    
    console.log('done')
};

export default func;
func.tags = ['OpenSkyRefinance'];
// func.dependencies = ['OpenSkyBespokeMarket'];
