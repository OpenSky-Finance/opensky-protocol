import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';
import { BigNumber } from 'ethers';

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
    let { PUNK, WPUNK, WNative } = config.contractAddress;
    if (!WNative) {
        WNative = (await ethers.getContract('WETH')).address;
    }
    if (!PUNK || !WPUNK) {
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
        PUNK = CryptoPunksMarket.address;
        WPUNK = WrappedPunk.address;
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const OpenSkyPunkGateway = await deploy('OpenSkyPunkGateway', {
        from: deployer,
        args: [OpenSkySettings.address, PUNK, WPUNK, WNative],
        log: true,
    });

    // punkGatewayAddress
    if (await OpenSkySettings.punkGatewayAddress() == ZERO_ADDRESS) {
        await (await OpenSkySettings.initPunkGatewayAddress(OpenSkyPunkGateway.address, { gasLimit: 4000000 })).wait();
    }
};
export default func;
func.tags = ['OpenSkyPunkGateway'];
func.dependencies = ['OpenSkySettings'];
