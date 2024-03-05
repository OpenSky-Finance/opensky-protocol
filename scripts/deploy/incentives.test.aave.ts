import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let network = hre.network.name;
    let rewardToken= ZERO_ADDRESS
    if (network == 'hardhat') {

        await deploy('AaveToken', {
            contract:"MintableERC20",
            from: deployer,
            gasLimit: 4000000,
            args: ['Aave', 'aave'],
            log: true,
        });

        rewardToken = (await ethers.getContract('AaveToken')).address;
    }else{
        //const config = require(`../config/${network}.json`);
        throw "please config rewardToken"
    }
    
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
    
    
    // deploy mocks
    if(network == 'hardhat'){
        
        await deploy('aWETH', {
            contract:"ATokenMock",
            from: deployer,
            gasLimit: 4000000,
            args: [OpenSkyPoolIncentivesControllerLender.address],
            log: true,
        });
        
        await deploy('aDAI', {
            contract:"ATokenMock",
            from: deployer,
            gasLimit: 4000000,
            args: [OpenSkyPoolIncentivesControllerLender.address],
            log: true,
        });
    }
  
};

export default func;
func.tags = ['incentives.test.aave'];
func.dependencies = [];
