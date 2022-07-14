import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('ACLManager', {
        from: deployer,
        log: true,
    });

    const ACLManager = await ethers.getContract('ACLManager', deployer);

    if (!(await ACLManager.isPoolAdmin(deployer))) {
        await (await ACLManager.addPoolAdmin(deployer)).wait();
    }
    if (!(await ACLManager.isGovernance(deployer))) {
        await (await ACLManager.addGovernance(deployer)).wait();
    }
};

export default func;
func.tags = ['ACLManager'];
