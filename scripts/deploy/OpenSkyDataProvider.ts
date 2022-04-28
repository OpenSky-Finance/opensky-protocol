import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const DataTypes = await ethers.getContract('DataTypes', deployer);
    const MathUtils = await ethers.getContract('MathUtils', deployer);

    await deploy('OpenSkyDataProvider', {
        from: deployer,
        args: [OpenSkySettings.address],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            MathUtils: MathUtils.address,
        },
    });
};
export default func;
func.tags = ['OpenSkyDataProvider'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];
