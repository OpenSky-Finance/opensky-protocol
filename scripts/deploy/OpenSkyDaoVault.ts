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

    const OpenSkyDaoVault = await deploy('OpenSkyDaoVault', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkySettings.address, WNative],
        log: true,
    });

    await (await OpenSkySettings.setDaoVaultAddress(OpenSkyDaoVault.address)).wait();
};

export default func;
func.tags = ['OpenSkyDaoVault'];
func.dependencies = [];
