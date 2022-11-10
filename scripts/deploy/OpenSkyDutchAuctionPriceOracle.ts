import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, treasury } = await getNamedAccounts();
  
  await deploy('OpenSkyDutchAuctionPriceOracle', {
    from: deployer,
    args: [],
    log: true,
  });

  const OpenSkyDutchAuctionPriceOracle = await ethers.getContract('OpenSkyDutchAuctionPriceOracle');
  const OpenSkyDutchAuctionLiquidator = await ethers.getContractAt('OpenSkyDutchAuctionLiquidator', "0x15F3748d261c6fB7a047C2b495f730C88f6d3E31");
  await OpenSkyDutchAuctionLiquidator.setPriceOracle(OpenSkyDutchAuctionPriceOracle.address);
};

export default func;
func.tags = ['OpenSkyDutchAuctionPriceOracle'];
