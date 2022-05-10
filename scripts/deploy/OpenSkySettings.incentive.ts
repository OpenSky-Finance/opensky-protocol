import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import assert from 'assert';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const INCENTIVE_CONTROLLER_ADDRESS = process.env.INCENTIVE_CONTROLLER_ADDRESS;

    assert(INCENTIVE_CONTROLLER_ADDRESS, 'INCENTIVE_CONTROLLER_ADDRESS address not configured');

    console.log('**INCENTIVE_CONTROLLER_ADDRESS', INCENTIVE_CONTROLLER_ADDRESS);
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    await (
        await OpenSkySettings.initIncentiveControllerAddress(INCENTIVE_CONTROLLER_ADDRESS, { gasLimit: 4000000 })
    ).wait();
};
export default func;
func.tags = ['SETTINGS.INCENTIVE_CONTROLLER'];
