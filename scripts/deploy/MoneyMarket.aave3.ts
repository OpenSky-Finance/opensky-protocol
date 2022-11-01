import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    console.log(
        `MoneyMarket.aave3 in network ${hre.network.name},HARDHAT_FORKING_NETWORK ${process.env.HARDHAT_FORKING_NETWORK} `
    );
    const config = require(`../config/${network}.json`);

    const AaveMoneyMarket = await deploy('AaveV3MoneyMarket', {
        from: deployer,
        args: [
            config.contractAddress.AAVE_V3_POOL,
        ],
        log: true,
    });
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await (await OpenSkySettings.setMoneyMarketAddress(AaveMoneyMarket.address, { gasLimit: 4000000 })).wait();
};

func.tags = ['MoneyMarket.aave3'];
export default func;
func.dependencies = ['OpenSkySettings'];
