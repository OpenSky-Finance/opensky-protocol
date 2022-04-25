import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    const DURATION_ONE = 2 * 3600 * 24;
    const DURATION_TWO = 3 * 3600 * 24;
    const SPACING = 5 * 60;

    const OpenSkyAuctionPriceOracle = await deploy('OpenSkyDutchAuctionPriceOracle', {
        from: deployer,
        args: [DURATION_ONE, DURATION_TWO, SPACING],
        log: true,
    });
};
export default func;
func.tags = ['OpenSkyDutchAuctionPriceOracle'];
