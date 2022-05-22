import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyDaoLiquidator = await deploy('OpenSkyDaoLiquidator', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkySettings.address],
        log: true,
    });

    await (await OpenSkySettings.addLiquidator(OpenSkyDaoLiquidator.address)).wait();
};

export default func;
func.tags = ['OpenSkyDaoLiquidator'];
func.dependencies = [];
