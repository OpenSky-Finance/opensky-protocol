import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const DataTypes = await ethers.getContract('DataTypes', deployer);
    const ReserveLogic = await ethers.getContract('ReserveLogic', deployer);
    const Errors = await ethers.getContract('Errors', deployer);
    const MathUtils = await ethers.getContract('MathUtils', deployer);
    const PercentageMath = await ethers.getContract('PercentageMath', deployer);

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const poolContract = network == 'hardhat' ? 'OpenSkyPool' : 'OpenSkyPool';
    await deploy(poolContract, {
        from: deployer,
        args: [OpenSkySettings.address],
        log: true,
        libraries: {
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            DataTypes: DataTypes.address,
            ReserveLogic: ReserveLogic.address,
        },
    });

    const OpenSkyPool = await ethers.getContract(poolContract, deployer);

    if (await OpenSkySettings.poolAddress() == ZERO_ADDRESS) {
        await (await OpenSkySettings.initPoolAddress(OpenSkyPool.address, { gasLimit: 4000000 })).wait();
    }
};

export default func;
func.tags = ['OpenSkyPool'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];
