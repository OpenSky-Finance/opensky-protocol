import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);
    let { WETH } = config.contractAddress;
    if (!WETH) {
        WETH = (await ethers.getContract('WETH')).address;
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyWETHGateway = await deploy('OpenSkyWETHGateway', {
        from: deployer,
        args: [WETH, OpenSkySettings.address],
        log: true,
    });

    // punkGatewayAddress
    await (await OpenSkySettings.initWETHGatewayAddress(OpenSkyWETHGateway.address)).wait();
};

export default func;
func.tags = ['OpenSkyWETHGateway'];
func.dependencies = ['OpenSkySettings'];
