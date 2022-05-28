import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // ///////////////////////////////////////////////////////

    const WETH = await ethers.getContract('WETH', deployer);
    console.log('WETH', WETH.address);

    let AWETH = await deploy('AToken', {
        from: deployer,
        args: ['AWETH', 'AWETH'],
        log: true,
    });

    const AWETHIns = await ethers.getContract('AToken', deployer);
    await AWETHIns.initialize(WETH.address);

    //gateway
    let WETHGateway = await deploy('WETHGateway', {
        from: deployer,
        args: [WETH.address, AWETH.address],
        log: true,
    });

    //AAVELendingPool
    let AAVELendingPool = await deploy('AAVELendingPool', {
        from: deployer,
        args: [AWETH.address],
        log: true,
    });
    const insAAVELendingPool = await ethers.getContract('AAVELendingPool', deployer);
    await insAAVELendingPool.initReserve(AWETH.address);

    const insWETHGateway = await ethers.getContract('WETHGateway', deployer);
    await insWETHGateway.authorizeLendingPool(AAVELendingPool.address);

    // AAVELendingPoolAddressesProvider
    let AAVELendingPoolAddressesProvider = await deploy('AAVELendingPoolAddressesProvider', {
        from: deployer,
        args: [],
        log: true,
    });

    const insAAVELendingPoolAddressesProvider = await ethers.getContract('AAVELendingPoolAddressesProvider', deployer);
    await insAAVELendingPoolAddressesProvider.setLendingPool(AAVELendingPool.address);
};

func.tags = ['AAVELendingPoolMock'];
export default func;
