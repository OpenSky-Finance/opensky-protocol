import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // load network connfig
    const network = hre.network.name;
    let config: any = {};
    if (network !== 'hardhat') {
        config = require(`../config/${network}`);
    }

    const COMPOUND_CETHER_ADDRESS = config.contractAddress.COMPOUND_CETHER_ADDRESS;

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let MoneyMarket = await deploy('CompoundMoneyMarket', {
        from: deployer,
        args: [COMPOUND_CETHER_ADDRESS],
        log: true,
    });
    await (await OpenSkySettings.setMoneyMarketAddress(MoneyMarket.address, {gasLimit:4000000})).wait();
};

export default func;
func.tags = ['MoneyMarket.compound'];
func.dependencies = ['OpenSkySettings'];
