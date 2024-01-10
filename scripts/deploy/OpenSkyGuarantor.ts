import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings');

    const DataTypes = await ethers.getContract('DataTypes');
    const MathUtils = await ethers.getContract('MathUtils');

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);
    let { AAVE_V3_POOL } = config.contractAddress;

    if (network == 'hardhat') {
        AAVE_V3_POOL = (await ethers.getContract('AAVELendingPool')).address;
    }

    const OpenSkyPool = await ethers.getContract(network == 'hardhat' ? 'OpenSkyPool' : 'OpenSkyPool');

    await deploy('OpenSkyGuarantor', {
        from: deployer,
        args: [
            OpenSkySettings.address,
            AAVE_V3_POOL,
            (await OpenSkyPool.getReserveData(1)).oTokenAddress
        ],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            MathUtils: MathUtils.address,
        },
    });

    const OpenSkyGuarantor = await ethers.getContract('OpenSkyGuarantor');
    await (await OpenSkySettings.addLiquidator(OpenSkyGuarantor.address)).wait();
};
export default func;

// func.tags = ['OpenSkyGuarantor'];
// func.dependencies = ['', 'AAVELendingPoolMock'];
