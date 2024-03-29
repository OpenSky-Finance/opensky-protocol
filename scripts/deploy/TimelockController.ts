import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);

    await deploy('TimelockController', {
        from: deployer,
        args: [config.timelock.minDelay, config.timelock.proposers, config.timelock.executors],
        log: true,
    });

    const TimelockController = await ethers.getContract('TimelockController', deployer);
    await (await TimelockController.renounceRole(await TimelockController.TIMELOCK_ADMIN_ROLE(), deployer)).wait();
    console.log('deployer renounce TIMELOCK_ADMIN_ROLE successfully')

    const ACLManager = await ethers.getContract('ACLManager', deployer);
    if (await ACLManager.owner() == deployer) {
        if (!(await ACLManager.isPoolAdmin(TimelockController.address))) {
            await (await ACLManager.addPoolAdmin(TimelockController.address)).wait();
            await (await ACLManager.removePoolAdmin(deployer)).wait();
        }
        if (!(await ACLManager.isGovernance(TimelockController.address))) {
            await (await ACLManager.addGovernance(TimelockController.address)).wait();
            await (await ACLManager.removeGovernance(deployer)).wait();
        }
        const DefaultAdminRole = await ACLManager.DEFAULT_ADMIN_ROLE();
        await (await ACLManager.grantRole(DefaultAdminRole, TimelockController.address)).wait();
        await (await ACLManager.renounceRole(DefaultAdminRole, deployer)).wait();
        await (await ACLManager.transferOwnership(TimelockController.address)).wait();
    }
    console.log('ACLManager transfer ownership successfully')

    const OpenSkyWETHGateway = await ethers.getContract('OpenSkyWETHGateway');
    if (await OpenSkyWETHGateway.owner() == deployer)
        await (await OpenSkyWETHGateway.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkyWETHGateway transfer ownership successfully')

    const OpenSkySettings = await ethers.getContract('OpenSkySettings');
    if (await OpenSkySettings.owner() == deployer)
        await (await OpenSkySettings.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkySettings transfer ownership successfully')

    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings');
    if (await OpenSkyBespokeSettings.owner() == deployer)
        await (await OpenSkyBespokeSettings.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkyBespokeSettings transfer ownership successfully')

    const OpenSkyBespokeBorrowNFT = await ethers.getContract('OpenSkyBespokeBorrowNFT');
    if (await OpenSkyBespokeBorrowNFT.owner() == deployer)
        await (await OpenSkyBespokeBorrowNFT.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkyBespokeBorrowNFT transfer ownership successfully')

    const OpenSkyBespokeLendNFT = await ethers.getContract('OpenSkyBespokeLendNFT');
    if (await OpenSkyBespokeLendNFT.owner() == deployer)
        await (await OpenSkyBespokeLendNFT.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkyBespokeLendNFT transfer ownership successfully')

    const OpenSkyInterestRateStrategy = await ethers.getContract('OpenSkyInterestRateStrategy');
    if (await OpenSkyInterestRateStrategy.owner() == deployer)
        await (await OpenSkyInterestRateStrategy.transferOwnership(TimelockController.address)).wait();
    console.log('OpenSkyInterestRateStrategy transfer ownership successfully')
};

export default func;
func.tags = ['TimelockController'];
