import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const MIN_TIMELOCK_DELAY = 172800;
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    await deploy('TimelockController', {
        from: deployer,
        args: [MIN_TIMELOCK_DELAY, [], [ZERO_ADDRESS]],
        log: true,
    });

    const TimelockController = await ethers.getContract('TimelockController', deployer);
};

export default func;
func.tags = ['TimelockController'];
