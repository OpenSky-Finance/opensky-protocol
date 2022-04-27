import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    const CryptoPunksMarket = await deploy('CryptoPunksMarket', {
        from: deployer,
        args: [],
        log: true,
    });

    const WrappedPunk = await deploy('WrappedPunk', {
        from: deployer,
        args: [CryptoPunksMarket.address],
        log: true,
    });

    console.log('**CryptoPunksMarket', CryptoPunksMarket.address);
    console.log('**WrappedPunk', WrappedPunk.address);

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyPunkGateway = await deploy('OpenSkyPunkGateway', {
        from: deployer,
        args: [OpenSkySettings.address, CryptoPunksMarket.address, WrappedPunk.address],
        log: true,
    });

    // punkGatewayAddress
    await (await OpenSkySettings.initPunkGatewayAddress(OpenSkyPunkGateway.address)).wait();
};
export default func;
func.tags = ['OpenSkyPunkGateway.hardhat'];
func.dependencies = ['OpenSkySettings'];
