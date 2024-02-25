import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    
    // const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket', deployer);
    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings', deployer);

    const BespokeTypes = await ethers.getContract('BespokeTypes', deployer);
    

    console.log('deploy strategy');
    const StrategyPrivate = await deploy('StrategyPrivate', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    console.log('setting strategies whitelist');
    await (await OpenSkyBespokeSettings.addStrategy(StrategyPrivate.address)).wait();

    console.log('deployment done');
};

export default func;
func.tags = ['OpenSkyBespokeStrategy'];
