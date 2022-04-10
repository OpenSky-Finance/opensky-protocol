import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    await deploy('OpenSkyCollateralPriceOracle', {
        from: deployer,
        args: [OpenSkySettings.address],
        log: true,
    });
    const OpenSkyCollateralPriceOracle = await ethers.getContract('OpenSkyCollateralPriceOracle', deployer);
    console.log('OpenSkyCollateralPriceOracle', OpenSkyCollateralPriceOracle.address);
    await (await OpenSkySettings.setNftPriceOracleAddress(OpenSkyCollateralPriceOracle.address, { gasLimit: 4000000 })).wait();
};

export default func;
func.tags = ['OpenSkyCollectionPool'];
func.dependencies = ['OpenSkySettings'];
