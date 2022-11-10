import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
};

export default func;
func.tags = ['Mock'];
func.dependencies = [
    'PunkAndWPunkMock',
    'OpenSkyMock',
    'FlashLoanMock',
    'WETHMock',
    'TestERC20',
    'UniswapV2Mock',
    'AAVELendingPoolMock',
    'ChainlinkAggregatorMock'
];
