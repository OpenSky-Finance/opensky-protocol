import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, treasury } = await getNamedAccounts();
  
  const OpenSkyAuctionPriceOracle = await deploy('OpenSkyDutchAuctionPriceOracle', {
    from: deployer,
    args: [],
    log: true,
  });
};
export default func;
func.tags = ['OpenSkyDutchAuctionPriceOracle'];
