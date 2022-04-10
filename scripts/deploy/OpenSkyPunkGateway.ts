import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    // const config = require(`../config/rinkeby.json`);
    // const { PUNK, WPUNK } = config.contractAddress;

    // ////////////////////////////////
    // deploy new
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

    const PUNK = CryptoPunksMarket.address;
    const WPUNK = WrappedPunk.address;
    // deploy end
    // //////////////////////////////////////
    

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyPunkGateway = await deploy('OpenSkyPunkGateway', {
        from: deployer,
        args: [OpenSkySettings.address, PUNK, WPUNK],
        log: true,
    });

    // punkGatewayAddress
    await (await OpenSkySettings.setPunkGatewayAddress(OpenSkyPunkGateway.address)).wait();
};
export default func;
func.tags = ['OpenSkyPunkGateway'];
func.dependencies = ['OpenSkySettings'];
