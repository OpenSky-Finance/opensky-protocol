import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log('aaveV3.MoneyMarket.hardhat', process.env.HARDHAT_FORKING_NETWORK);

    let AaveMoneyMarket;
    if (process.env.HARDHAT_FORKING_NETWORK == 'rinkeby') {
        const config = require(`../config/rinkeby.json`);
        AaveMoneyMarket = await deploy('AaveV3MoneyMarket', {
            from: deployer,
            args: [
                config.contractAddress.AAVE_V3_POOL_ADDRESSES_PROVIDER,
                config.contractAddress.AAVE_V3_WETH_GATEWAY,
                config.contractAddress.AAVE_V3_AWETH,
            ],
            log: true,
        });
        console.log('AaveV3MoneyMarket', AaveMoneyMarket.address);

        const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
        await OpenSkySettings.setMoneyMarketAddress(AaveMoneyMarket.address);
    } else {
        throw 'support only rinkeby hard forking mode';
    }
};

func.tags = ['MoneyMarket.aave3.hardhat'];
export default func;
