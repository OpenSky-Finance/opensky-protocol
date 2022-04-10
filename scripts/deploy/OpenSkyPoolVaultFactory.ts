import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

  const DataTypes = await ethers.getContract('DataTypes', deployer);
  // const ReserveDataLogic = await ethers.getContract('ReserveDataLogic', deployer);
  // const ValidationLogic = await ethers.getContract('ValidationLogic', deployer);

  const OpenSkyReserveVaultFactory = await deploy('OpenSkyReserveVaultFactory', {
    from: deployer,
    args: [OpenSkySettings.address],
    log: true,
    libraries: {
      // DataTypes: DataTypes.address,
      // ReserveDataLogic: ReserveDataLogic.address,
      // ValidationLogic: ValidationLogic.address,
    },
  });
  await (await OpenSkySettings.setVaultFactoryAddress(OpenSkyReserveVaultFactory.address, {gasLimit:4000000})).wait();
};

export default func;
func.tags = ['OpenSkyReserveVaultFactory'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];
