import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('ChainlinkAggregatorMock', {
        from: deployer,
        gasLimit: 4000000,
        args: [],
        log: true,
    });
};

export default func;
func.tags = ['ChainlinkAggregatorMock'];
