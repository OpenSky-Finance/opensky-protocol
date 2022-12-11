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
};

export default func;
func.tags = ['OpenSkyPriceAggregator'];
