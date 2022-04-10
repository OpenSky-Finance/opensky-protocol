import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const network = hre.network.name;
    console.log(`MoneyMarket.aave3 in network ${network}`);
    const config = require(`../config/${network}.json`);

    const AaveMoneyMarket = await deploy('AaveV3MoneyMarket', {
        from: deployer,
        args: [
            config.contractAddress.AAVE_V3_POOL_ADDRESSES_PROVIDER,
            config.contractAddress.AAVE_V3_WETH_GATEWAY,
            config.contractAddress.AAVE_V3_AWETH,
        ],
        log: true,
    });
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await (await OpenSkySettings.setMoneyMarketAddress(AaveMoneyMarket.address, { gasLimit: 4000000 })).wait();
};

func.tags = ['MoneyMarket.aave3'];
export default func;
