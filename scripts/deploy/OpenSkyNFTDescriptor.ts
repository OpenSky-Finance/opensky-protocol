import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const ACLManager = await ethers.getContract('ACLManager', deployer);

    await deploy('OpenSkyInstantLoanDescriptor', {
        from: deployer,
        contract: 'OpenSkyNFTDescriptor',
        args: [ACLManager.address],
        log: true,
    });

    await deploy('OpenSkyBespokeLoanDescriptor', {
        from: deployer,
        contract: 'OpenSkyNFTDescriptor',
        args: [ACLManager.address],
        log: true,
    });

};

export default func;
func.tags = ['OpenSkyNFTDescriptor'];
func.dependencies = ['ACLManager'];
