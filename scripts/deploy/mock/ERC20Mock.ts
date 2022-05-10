import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { BigNumber } from '@ethersproject/bignumber';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('TestERC20', {
        from: deployer,
        gasLimit: 4000000,
        args: ['Test ERC20', 'TestERC20'],
        log: true,
    });
};

export default func;
func.tags = ['TestERC20'];
