import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ZERO_ADDRESS} from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts, ethers} = hre;
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let network = hre.network.name;
    let rewardToken = ZERO_ADDRESS

    rewardToken = (await ethers.getContract('TestERC20')).address;

    // pool lender 
    const OpenSkyPoolIncentivesControllerLender = await deploy('OpenSkyPoolIncentivesControllerLender', {
        from: deployer,
        gasLimit: 4000000,
        args: [rewardToken, deployer],
        log: true,
    });
    // pool borrower
    const OpenSkyPoolIncentivesControllerBorrower = await deploy('OpenSkyPoolIncentivesControllerBorrower', {
        from: deployer,
        gasLimit: 4000000,
        args: [rewardToken, deployer],
        log: true,
    });

    // bespoke borrower
    const OpenSkyBespokeIncentivesControllerBorrower = await deploy('OpenSkyBespokeIncentivesControllerBorrower', {
        from: deployer,
        gasLimit: 4000000,
        args: [rewardToken, deployer],
        log: true,
    });
    // bespoke lender
    const OpenSkyBespokeIncentivesControllerLender = await deploy('OpenSkyBespokeIncentivesControllerLender', {
        from: deployer,
        gasLimit: 4000000,
        args: [rewardToken, deployer],
        log: true,
    });
    
};

export default func;
func.tags = ['incentives.test'];
func.dependencies = [];
