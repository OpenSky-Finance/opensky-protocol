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
    let WETH_ADDRESS = config.contractAddress.WNative;
    if (!WETH_ADDRESS) {
        WETH_ADDRESS = (await ethers.getContract('WETH')).address;
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings');
    const OpenSkyDutchAuctionPriceOracle = await ethers.getContract('OpenSkyDutchAuctionPriceOracle', deployer);

    const OpenSkyDutchAuctionLiquidator = await deploy('OpenSkyDutchAuctionLiquidator', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyDutchAuctionPriceOracle.address, WETH_ADDRESS],
        log: true,
    });

    await (await OpenSkySettings.addLiquidator(OpenSkyDutchAuctionLiquidator.address)).wait();
};
export default func;
func.tags = ['OpenSkyDutchAuctionLiquidator'];
func.dependencies = ['OpenSkyDutchAuctionPriceOracle'];
