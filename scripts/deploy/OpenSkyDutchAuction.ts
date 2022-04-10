import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    await deploy('OpenSkyDutchAuction', {
        from: deployer,
        args: [OpenSkySettings.address],
        log: true,
    });
    const OpenSkyDutchAuctionPriceOracle = await ethers.getContract('OpenSkyDutchAuctionPriceOracle', deployer);
    const OpenSkyDutchAuction = await ethers.getContract('OpenSkyDutchAuction', deployer);

    await (await OpenSkyDutchAuction.setPriceOracle(OpenSkyDutchAuctionPriceOracle.address)).wait();
};
export default func;
func.tags = ['OpenSkyDutchAuction'];
func.dependencies = ['OpenSkySettings', 'OpenSkyDutchAuctionPriceOracle'];
