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
    }
    
    // for pool lender 
    const OpenSkyPoolIncentivesControllerLender = await deploy('OpenSkyPoolIncentivesControllerLender', {
        from: deployer,
        gasLimit: 4000000,
        args: [rewardToken, deployer],
        log: true,
    });

    // for pool borrower
    // for bespoke
    
    
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
func.tags = ['incentives'];
func.dependencies = [];
