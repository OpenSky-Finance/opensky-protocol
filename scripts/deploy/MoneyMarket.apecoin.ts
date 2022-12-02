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
    let { ApeCoinStaking, ApeCoin } = config.contractAddress;
    if (!ApeCoinStaking) {
        ApeCoinStaking = (await ethers.getContract('ApeCoinStaking')).address;
    }

    const ApeCoinStakingMoneyMarket = await deploy('ApeCoinStakingMoneyMarket', {
        from: deployer,
        args: [
            ApeCoinStaking,
        ],
        log: true,
    });
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await (await OpenSkySettings.setMoneyMarketAddress(ApeCoinStakingMoneyMarket.address, { gasLimit: 4000000 })).wait();

    if (!ApeCoin) {
        ApeCoin = (await ethers.getContract('ApeCoin')).address;
    }
    const OpenSkyPool = await ethers.getContract('OpenSkyPoolMock');
    await (await OpenSkyPool.create(ApeCoin, 'OpenSky Ape', 'OAPE', 18)).wait();
};

func.tags = ['MoneyMarket.apecoin'];
export default func;
func.dependencies = ['OpenSkySettings'];
