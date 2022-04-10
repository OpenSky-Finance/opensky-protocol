import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';
import { BASE_RATE, EXCESS_UTILIZATION_RATE, OPTIMAL_UTILIZATION_RATE, RATE_SLOPE1, RATE_SLOPE2, RAY } from '../helpers/constants';
import BigNumber from 'bignumber.js';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    const PercentageMath = await ethers.getContract('PercentageMath', deployer);

    const OpenSkyInterestRateStrategy = await deploy('OpenSkyInterestRateStrategy', {
        from: deployer,
        args: [
            OPTIMAL_UTILIZATION_RATE,
            RATE_SLOPE1,
            RATE_SLOPE2,
            // BASE_RATE
            new BigNumber(0.2).times(RAY).toFixed()
        ],
        libraries: {
            PercentageMath: PercentageMath.address,
        },
        log: true,
    });

    console.log('OpenSkyInterestRateStrategy', OpenSkyInterestRateStrategy.address);
    await (await OpenSkySettings.setInterestRateStrategyAddress(OpenSkyInterestRateStrategy.address, { gasLimit: 4000000 })).wait();
};

export default func;
func.tags = ['OpenSkyInterestRateStrategy'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];