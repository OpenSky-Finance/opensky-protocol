import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // deploy library first
    const DataTypes = await deploy('DataTypes', {
        from: deployer,
        args: [],
        log: true,
    });

    const Errors = await deploy('Errors', {
        from: deployer,
        args: [],
        log: true,
    });

    const MathUtils = await deploy('MathUtils', {
        from: deployer,
        args: [],
        log: true,
    });
    const WadRayMath = await deploy('WadRayMath', {
        from: deployer,
        args: [],
        log: true,
    });

    const PercentageMath = await deploy('PercentageMath', {
        from: deployer,
        args: [],
        log: true,
    });

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

    /*
    const ReserveDataLogic = await deploy('ReserveDataLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
        },
    });

    // const ValidationLogic = await deploy('ValidationLogic', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    //     libraries: {
    //         DataTypes: DataTypes.address,
    //         ReserveDataLogic: ReserveDataLogic.address,
    //     },
    // });

    const LendingLogic = await deploy('LendingLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
            ReserveDataLogic: ReserveDataLogic.address,
        },
    });

    const StakingLogic = await deploy('StakingLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
            ReserveDataLogic: ReserveDataLogic.address,
        },
    });

    const LiquidatingLogic = await deploy('LiquidatingLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
            ReserveDataLogic: ReserveDataLogic.address,
        },
    });

    const BorrowingLogic = await deploy('BorrowingLogic', {
        from: deployer,
        args: [],
        log: true,
        libraries: {
            DataTypes: DataTypes.address,
            Errors: Errors.address,
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
            ReserveDataLogic: ReserveDataLogic.address,
            // ValidationLogic:ValidationLogic.address
        },
    });

  const VaultFactoryLogic = await deploy('VaultFactoryLogic', {
      from: deployer,
      args: [],
      log: true,
      libraries: {
          DataTypes: DataTypes.address,
          Errors: Errors.address,
          ReserveDataLogic: ReserveDataLogic.address,
      }
  });

    // const AuctionLogic = await deploy('AuctionLogic', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    //     libraries: {
    //         DataTypes: DataTypes.address,
    //         Errors: Errors.address,
    //         ReserveDataLogic: ReserveDataLogic.address,
    //     }
    // });
    */
};

export default func;
func.tags = ['OpenSkyLibrary'];
