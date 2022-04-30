import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    const OpenSkyDutchAuction = await ethers.getContract('OpenSkyDutchAuction', deployer);
    const ACLManager = await ethers.getContract('ACLManager', deployer);

    const OpenSkyDutchAuctionLiquidator = await deploy('OpenSkyDutchAuctionLiquidator', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyDutchAuction.address],
        log: true,
    });

    await (await OpenSkySettings.addLiquidator(OpenSkyDutchAuctionLiquidator.address)).wait();
};
export default func;
func.tags = ['OpenSkyDutchAuctionLiquidator'];
func.dependencies = ['OpenSkySettings', 'OpenSkyDutchAuction'];
