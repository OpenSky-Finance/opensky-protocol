import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let WNative;
    // prepare params
    let network = hre.network.name;
    if (network == 'hardhat') {
        if (process.env.HARDHAT_FORKING_NETWORK) {
            // read from config
            network = process.env.HARDHAT_FORKING_NETWORK;
            const config = require(`../config/${network}.json`);
            if (network == 'matic') {
                WNative = config.contractAddress.QUICKSWAP_WMATIC;
            } else {
                WNative = config.contractAddress.WETH;
            }
        } else {
            WNative = await ethers.getContract('WETH', deployer);
            WNative= WNative.address
        }
    } else {
        // online network
        const config = require(`../config/${network}.json`);
        WNative = config.contractAddress.WNative;
    }

    await deploy('OpenSkyDaoVault', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkySettings.address, WNative],
        log: true,
    });

    const OpenSkyDaoVault = await ethers.getContract('OpenSkyDaoVault');
    // const InitializeData = OpenSkyDaoVault.interface.encodeFunctionData('initialize(address,address)', [OpenSkySettings.address, WNative]);

    // await deploy('OpenSkyDaoVaultProxy', {
    //     from: deployer,
    //     proxy: {
    //         owner: deployer,
    //         methodName: 'init'
    //     },
    //     args: [OpenSkyDaoVault.address, deployer, InitializeData],
    //     log: true,
    // });

    // const OpenSkyDaoVaultProxy = await ethers.getContract('OpenSkyDaoVaultProxy');
    // await (await OpenSkyDaoVaultProxy.upgradeToAndCall(OpenSkyDaoVault.address, deployer, InitializeData, {gasLimit: 8000000})).wait();

    // await (await OpenSkySettings.setDaoVaultAddress(OpenSkyDaoVaultProxy.address)).wait();
    await (await OpenSkySettings.initDaoVaultAddress(OpenSkyDaoVault.address)).wait();
};

export default func;
func.tags = ['OpenSkyDaoVault'];
func.dependencies = [];
