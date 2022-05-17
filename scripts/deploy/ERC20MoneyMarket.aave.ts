import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

// kovan money market TODO move to config file
// https://docs.aave.com/developers/deployed-contracts/deployed-contracts

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let Aave = await ethers.getContract('AAVELendingPool');

    // money market
    let AaveMoneyMarket = await deploy('AaveV2ERC20MoneyMarket', {
        from: deployer,
        args: [Aave.address],
        log: true,
    });

    // /////////////////////////////////////////////
    const settings = await ethers.getContract('OpenSkySettings');

    // money market
    await settings.setMoneyMarketAddress(AaveMoneyMarket.address);
};
export default func;
func.tags = ['ERC20MoneyMarket.aave'];
func.dependencies = ['MoneyMarket.aave.hardhat'];
