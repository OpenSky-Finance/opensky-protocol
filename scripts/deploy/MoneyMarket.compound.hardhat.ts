import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // ///////////////////////////////////////////////////////

  console.log('CompoundMoneyMarket', process.env.HARDHAT_FORKING_NETWORK);

  let CompoundMoneyMarket = null;
    if (process.env.HARDHAT_FORKING_NETWORK == 'rinkeby') {
        //  Hard FORKING mode
        const config = require(`../config/rinkeby.json`);
        const COMPOUND_CETHER_ADDRESS = config.contractAddress.COMPOUND_CETHER_ADDRESS;

        CompoundMoneyMarket = await deploy('CompoundMoneyMarket', {
            from: deployer,
            args: [COMPOUND_CETHER_ADDRESS],
            log: true,
        });
    } else {
        // mock contract
        let CEther = await deploy('CEther', {
            from: deployer,
            args: ['CEther', 'CEther'],
            log: true,
        });

        // deploy moneymarket
        CompoundMoneyMarket = await deploy('CompoundMoneyMarketMock', {
            from: deployer,
            args: [CEther.address],
            log: true,
        });
    }

    
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await OpenSkySettings.setMoneyMarketAddress(CompoundMoneyMarket.address);
};

func.tags = ['MoneyMarket.compound.hardhat'];
func.dependencies = ['OpenSkySettings'];

export default func;
