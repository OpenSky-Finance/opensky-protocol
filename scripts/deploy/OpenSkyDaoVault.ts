import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let WETH;
    // prepare params
    let network = hre.network.name;
    if (network == 'hardhat') {
        if (process.env.HARDHAT_FORKING_NETWORK) {
            // read from config
            network = process.env.HARDHAT_FORKING_NETWORK;
            const config = require(`../config/${network}.json`);
            if (network == 'matic') {
                WETH = config.contractAddress.QUICKSWAP_WMATIC;
            } else {
                WETH = config.contractAddress.WETH;
            }
        } else {
            WETH = await ethers.getContract('WETH', deployer);
            WETH= WETH.address
        }
    } else {
        // online network
        const config = require(`../config/${network}.json`);
        WETH = config.contractAddress.WETH;
    }

    const OpenSkyDaoVault = await deploy('OpenSkyDaoVault', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkySettings.address, WETH],
        log: true,
    });

    await (await OpenSkySettings.setDaoVaultAddress(OpenSkyDaoVault.address)).wait();
};

export default func;
func.tags = ['OpenSkyDaoVault'];
func.dependencies = [];
