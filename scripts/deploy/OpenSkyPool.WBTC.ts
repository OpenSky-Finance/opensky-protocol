import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts, ethers } = hre;

  let network = hre.network.name;
  if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
      network = process.env.HARDHAT_FORKING_NETWORK;
  }

  const config = require(`../config/${network}.json`);

  const { WBTC } = config.contractAddress;

  const OpenSkyPool = await ethers.getContract('OpenSkyPool');
  try {
    await (await OpenSkyPool.getReserveData(7)).wait()
  } catch (err: any) {
    await (await OpenSkyPool.create(WBTC, 'OpenSky WBTC', 'OWBTC', 8)).wait();
  }
};

export default func;
func.tags = ['OpenSkyPool.WBTC'];
