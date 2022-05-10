import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import assert from 'assert';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    // const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    // const treasury = process.env.TREASURY

    // const OpenSkyTreasury = await deploy('OpenSkyTreasury', {
    //     from: deployer,
    //     args: [],
    //     log: true,
    // });
    // assert(treasury,'treasury address not configured')
    
    // console.log('**OpenSkyTreasury', treasury)
    // const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    // await (await OpenSkySettings.setTreasuryAddress(treasury, {gasLimit:4000000})).wait();
};
export default func;
func.tags = ['OpenSkyTreasury'];
