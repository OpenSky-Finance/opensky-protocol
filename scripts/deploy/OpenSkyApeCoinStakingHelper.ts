import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

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
    let { ApeCoinStaking, ApeCoin, BAKC } = config.contractAddress;
    if (!ApeCoinStaking) {
        ApeCoinStaking = (await ethers.getContract('ApeCoinStaking')).address;
    }
    if (!ApeCoin) {
        ApeCoin = (await ethers.getContract('ApeCoin')).address;
    }
    if (!BAKC) {
        BAKC = (await ethers.getContract('BAKC')).address;
    }

    await deploy('OpenSkyApeCoinStakingHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, BAKC],
        log: true,
    });
};

export default func;
func.tags = ['OpenSkyApeCoinStakingHelper'];
