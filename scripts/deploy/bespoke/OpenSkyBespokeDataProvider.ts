import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    
    const BespokeTypes = await ethers.getContract('BespokeTypes', deployer);

    const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket', deployer);

    const OpenSkyBespokeDataProvider = await deploy('OpenSkyBespokeDataProvider', {
        from: deployer,
        args: [OpenSkyBespokeMarket.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    console.log('OpenSkyBespokeDataProvider deployed');
};

export default func;
func.tags = ['OpenSkyBespokeDataProvider'];
