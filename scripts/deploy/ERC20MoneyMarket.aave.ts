import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

// kovan money market TODO move to config file
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    let aaveAddress;
    if (network !== 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        const config = require(`../config/${network}.json`);
        aaveAddress = config.contractAddress.AAVE_V2_POOL; 
    } else {
        aaveAddress = (await ethers.getContract('AAVELendingPool')).address;
    }

    // money market
    let AaveMoneyMarket = await deploy('AaveV2MoneyMarket', {
        from: deployer,
        args: [aaveAddress],
        log: true,
    });

    // /////////////////////////////////////////////
    const settings = await ethers.getContract('OpenSkySettings');

    // money market
    await settings.setMoneyMarketAddress(AaveMoneyMarket.address);
};
export default func;
func.tags = ['ERC20MoneyMarket.aave'];
// func.dependencies = ['MoneyMarket.aave.hardhat'];
