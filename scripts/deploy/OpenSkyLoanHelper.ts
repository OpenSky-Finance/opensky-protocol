import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

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

    await deploy('OpenSkyLoanHelper', {
        from: deployer,
        args: [WNative, OpenSkySettings.address],
        log: true,
    });

};

export default func;
func.tags = ['OpenSkyLoanHelper'];
func.dependencies = ['OpenSkySettings'];
