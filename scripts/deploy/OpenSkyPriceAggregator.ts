import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('OpenSkyPriceAggregator', {
        from: deployer,
        args: [],
        log: true,
    });

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);

    const OpenSkyPriceAggregator = await ethers.getContract('OpenSkyPriceAggregator');
    const InstantWhitelist = config.whitelist;
    await (await OpenSkyPriceAggregator.setAggregators(
        InstantWhitelist.map((collection: any) => collection.address),
        InstantWhitelist.map((collection: any) => collection.chainlink)
    )).wait();
};

export default func;
func.tags = ['OpenSkyPriceAggregator'];
