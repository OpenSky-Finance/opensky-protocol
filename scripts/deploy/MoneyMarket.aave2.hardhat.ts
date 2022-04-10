import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // console.log('Begin deploying, deployer:', deployer)

    // ///////////////////////////////////////////////////////

    console.log('aave.MoneyMarket.hardhat', process.env.HARDHAT_FORKING_NETWORK);

    let AaveMoneyMarket;
    if (process.env.HARDHAT_FORKING_NETWORK == 'rinkeby') {
        const config = require(`../config/rinkeby.json`);
        AaveMoneyMarket = await deploy('AaveMoneyMarket', {
            from: deployer,
            args: [config.contractAddress.AAVE_POOL_ADDRESSES_PROVIDER, config.contractAddress.AAVE_WETH_GATEWAY],
            log: true,
        });
        // console.log('AaveMoneyMarket', AaveMoneyMarket.address);
    } else {
        //  TODO check
        /*
         * 1. WETH
         * 2. AToken
         * 3. gateway
         * 4.lending pool
         * */
        //
        let WETH = await deploy('WETH', {
            from: deployer,
            args: [],
            log: true,
        });
        console.log('WETH', WETH.address);

        let AWETH = await deploy('AToken', {
            from: deployer,
            args: ['AWETH', 'AWETH'],
            log: true,
        });
        console.log('AWETH', AWETH.address);
        
        const AWETHIns = await ethers.getContract('AToken', deployer);
        await AWETHIns.initialize(WETH.address);

        //gateway
        let WETHGateway = await deploy('WETHGateway', {
            from: deployer,
            args: [WETH.address, AWETH.address],
            log: true,
        });
        console.log('WETHGateway', WETHGateway.address);

        //AAVELendingPool
        let AAVELendingPool = await deploy('AAVELendingPool', {
            from: deployer,
            args: [AWETH.address],
            log: true,
        });
        const insAAVELendingPool = await ethers.getContract('AAVELendingPool', deployer);
        await insAAVELendingPool.initReserve(AWETH.address);

        console.log('AAVELendingPool', AAVELendingPool.address);

        const insWETHGateway = await ethers.getContract('WETHGateway', deployer);
        await insWETHGateway.authorizeLendingPool(AAVELendingPool.address);

        // AAVELendingPoolAddressesProvider
        let AAVELendingPoolAddressesProvider = await deploy('AAVELendingPoolAddressesProvider', {
            from: deployer,
            args: [],
            log: true,
        });
        console.log('AAVELendingPoolAddressesProvider', AAVELendingPoolAddressesProvider.address);

        const insAAVELendingPoolAddressesProvider = await ethers.getContract('AAVELendingPoolAddressesProvider', deployer);
        await insAAVELendingPoolAddressesProvider.setLendingPool(AAVELendingPool.address);

        // deploy moneymarket
        AaveMoneyMarket = await deploy('AaveMoneyMarket', {
            from: deployer,
            args: [AAVELendingPoolAddressesProvider.address, WETHGateway.address],
            log: true,
        });
        console.log('AaveMoneyMarket', AaveMoneyMarket.address);
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await OpenSkySettings.setMoneyMarketAddress(AaveMoneyMarket.address);
};

func.tags = ['MoneyMarket.aave.hardhat'];
export default func;
