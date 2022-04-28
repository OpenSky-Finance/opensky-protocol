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

    const network = hre.network.name;
    const interestRate = require(`../config/${network}`).interestRate;
    let optimalUtilizationRate = new BigNumber(interestRate.optimalUtilizationRate).times(RAY).toFixed();
    let rateSlope1 = new BigNumber(interestRate.rateSlope1).times(RAY).toFixed();
    let rateSlope2 = new BigNumber(interestRate.rateSlope2).times(RAY).toFixed();
    let baseRate = new BigNumber(interestRate.baseRate).times(RAY).toFixed();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    const PercentageMath = await ethers.getContract('PercentageMath', deployer);

    const OpenSkyInterestRateStrategy = await deploy('OpenSkyInterestRateStrategy', {
        from: deployer,
        args: [
            optimalUtilizationRate,
            rateSlope1,
            rateSlope2,
            baseRate
        ],
        libraries: {
            PercentageMath: PercentageMath.address,
        },
        log: true,
    });

    await (await OpenSkySettings.setInterestRateStrategyAddress(OpenSkyInterestRateStrategy.address, { gasLimit: 4000000 })).wait();
};

export default func;
func.tags = ['OpenSkyInterestRateStrategy'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];