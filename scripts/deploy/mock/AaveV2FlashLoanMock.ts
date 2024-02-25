import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

//!!! Only used to deploy a mock flash loan on test network, should be run separately
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // ///////////////////////////////////////////////////////
    let network = hre.network.name;
    if (network == 'hardhat' || network == 'mainnet') {
        throw 'Only for online test network';
    }
    const config = require(`../../config/${network}.json`);

    // Only for flash loan fro borrowing weth
    // Read WETH
    const WETH_ADDRESS = config.contractAddress.WNative;

     await deploy('AWETH', {
        from: deployer,
        contract: 'AToken',
        args: ['AWETH', 'AWETH'],
        log: true,
    });
    const AWETH = await ethers.getContract('AWETH');
    await AWETH.initialize(WETH_ADDRESS);

    //AAVELendingPool
    let AAVELendingPool = await deploy('AAVELendingPool', {
        from: deployer,
        args: [],
        log: true,
    });
    const insAAVELendingPool = await ethers.getContract('AAVELendingPool', deployer);
    await (await insAAVELendingPool.addReserve(WETH_ADDRESS, AWETH.address)).wait();

    // AAVELendingPoolAddressesProvider
    let AAVELendingPoolAddressesProvider = await deploy('AAVELendingPoolAddressesProvider', {
        from: deployer,
        args: [],
        log: true,
    });

    const insAAVELendingPoolAddressesProvider = await ethers.getContract('AAVELendingPoolAddressesProvider', deployer);
    await (await insAAVELendingPoolAddressesProvider.setLendingPool(AAVELendingPool.address)).wait();
};

func.tags = ['AaveV2FlashLoanMock'];
export default func;
