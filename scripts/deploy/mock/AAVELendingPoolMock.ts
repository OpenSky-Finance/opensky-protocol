import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // ///////////////////////////////////////////////////////

    const WETH = await ethers.getContract('WETH');
    const DAI = await ethers.getContract('DAI');
    console.log('WETH', WETH.address);

    await deploy('AWETH', {
        from: deployer,
        contract: 'AToken',
        args: ['AWETH', 'AWETH'],
        log: true,
    });

    await deploy('ADAI', {
        from: deployer,
        contract: 'AToken',
        args: ['ADAI', 'ADAI'],
        log: true,
    });

    const AWETH = await ethers.getContract('AWETH');
    await AWETH.initialize(WETH.address);

    const ADAI = await ethers.getContract('ADAI');
    await ADAI.initialize(DAI.address);

    //gateway
    let WETHGateway = await deploy('WETHGateway', {
        from: deployer,
        args: [WETH.address, AWETH.address],
        log: true,
    });

    //AAVELendingPool
    let AAVELendingPool = await deploy('AAVELendingPool', {
        from: deployer,
        args: [],
        log: true,
    });
    const insAAVELendingPool = await ethers.getContract('AAVELendingPool', deployer);
    await insAAVELendingPool.addReserve(WETH.address, AWETH.address);
    await insAAVELendingPool.addReserve(DAI.address, ADAI.address);

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
