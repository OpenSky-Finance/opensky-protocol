import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

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
    let { WNative } = config.contractAddress;
    if (!WNative) {
        WNative = (await ethers.getContract('WETH')).address;
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyWETHGateway = await deploy('OpenSkyWETHGateway', {
        from: deployer,
        args: [WNative, OpenSkySettings.address],
        log: true,
    });

    // wethGatewayAddress
    if (await OpenSkySettings.wethGatewayAddress() == ZERO_ADDRESS) {
        await (await OpenSkySettings.initWETHGatewayAddress(OpenSkyWETHGateway.address)).wait();
    }
};

export default func;
func.tags = ['OpenSkyWETHGateway'];
func.dependencies = ['OpenSkySettings'];
