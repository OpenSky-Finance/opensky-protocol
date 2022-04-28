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
    const { PUNK, WPUNK } = config.contractAddress;

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyPunkGateway = await deploy('OpenSkyPunkGateway', {
        from: deployer,
        args: [OpenSkySettings.address, PUNK, WPUNK],
        log: true,
    });

    // punkGatewayAddress
    await (await OpenSkySettings.initPunkGatewayAddress(OpenSkyPunkGateway.address)).wait();
};
export default func;
func.tags = ['OpenSkyPunkGateway'];
func.dependencies = ['OpenSkySettings'];
