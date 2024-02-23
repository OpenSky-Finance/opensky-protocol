import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

// kovan money market TODO move to config file
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts

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

    let aaveAddress = network !== 'hardhat' ? config.contractAddress.AAVE_V2_POOL : (await ethers.getContract('AAVELendingPool')).address;

    // money market
    let AaveMoneyMarket = await deploy('AaveV2MoneyMarket', {
        from: deployer,
        args: [aaveAddress],
        log: true,
    });

    // /////////////////////////////////////////////
    const settings = await ethers.getContract('OpenSkySettings');

    // money market
    if (await settings.moneyMarketAddress() == ZERO_ADDRESS) {
        await (await settings.setMoneyMarketAddress(AaveMoneyMarket.address)).wait();
    }
};
export default func;
func.tags = ['ERC20MoneyMarket.aave'];
// func.dependencies = ['MoneyMarket.aave.hardhat'];
