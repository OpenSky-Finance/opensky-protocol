import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const Errors = await ethers.getContract('Errors', deployer);
    const MathUtils = await ethers.getContract('MathUtils', deployer);
    const WadRayMath = await ethers.getContract('WadRayMath', deployer);
    const PercentageMath = await ethers.getContract('PercentageMath', deployer);

    const DataTypes = await ethers.getContract('DataTypes', deployer);

    // const CollectionDataTypes = await deploy('CollectionDataTypes', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    // });

    const ReserveLogic = await deploy('ReserveLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
            DataTypes: DataTypes.address,
        },
    });

    console.log('ReserveLogic', ReserveLogic.address);

    // const ReserveFactoryLogic = await deploy('ReserveFactoryLogic', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    //     libraries: {
    //         Errors: Errors.address,
    //         MathUtils: MathUtils.address,
    //         PercentageMath: PercentageMath.address,
    //         WadRayMath: WadRayMath.address,
    //         DataTypes: DataTypes.address,
    //     },
    // });

    // console.log('ReserveFactoryLogic', ReserveFactoryLogic.address);
};

export default func;
func.tags = ['OpenSkyPoolLibrary'];
func.dependencies = ['OpenSkyLibrary'];
