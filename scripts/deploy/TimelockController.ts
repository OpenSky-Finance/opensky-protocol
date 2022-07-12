import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);

    await deploy('TimelockController', {
        from: deployer,
        args: [config.timelock.minDelay, config.timelock.proposers, config.timelock.executors],
        log: true,
    });

    const TimelockController = await ethers.getContract('TimelockController', deployer);
};

export default func;
func.tags = ['TimelockController'];
