import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { MAX_UINT_256 } from '../../helpers/constants';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';

import UniswapV2FactoryData from '@uniswap/v2-core/build/UniswapV2Factory.json';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import UniswapV2Router02Data from '@uniswap/v2-periphery/build/UniswapV2Router02.json';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    const WETH = await ethers.getContract('WETH', deployer);
    const TestERC20 = await ethers.getContract('TestERC20', deployer);

    // UniswapV2Factory
    await deploy('UniswapV2Factory', {
        contract: UniswapV2FactoryData,
        args: [deployer],
        from: deployer,
    });
    const UniswapV2Factory = await ethers.getContract('UniswapV2Factory', deployer);

    // UniswapV2Router02
    await deploy('UniswapV2Router02', {
        contract: UniswapV2Router02Data,
        args: [UniswapV2Factory.address, WETH.address],
        from: deployer,
    });
    const UniswapV2Router02 = await ethers.getContract('UniswapV2Router02', deployer);

    // init pair
    await UniswapV2Factory.createPair(WETH.address, TestERC20.address);
    // const WETHPairAddress = await UniswapV2Factory.getPair(WETH.address, TestERC20.address);
    // const WETHPair = ethers.getContractAt(IUniswapV2Pair.abi, WETHPairAddress.address, deployer);

    //init liquidity
    await WETH.approve(UniswapV2Router02.address, MAX_UINT_256);
    await TestERC20.approve(UniswapV2Router02.address, MAX_UINT_256);

    await WETH.deposit({ value: parseEther('10') });
    await TestERC20.mint(deployer, parseEther('100000'));

    await UniswapV2Router02.addLiquidity(
        WETH.address,
        TestERC20.address,
        parseEther('10'),
        parseEther('100000'),
        0,
        0,
        deployer,
        MAX_UINT_256,
        {}
    );
};

export default func;
func.tags = ['UniswapV2Mock'];
func.dependencies = ['WETHMock', 'TestERC20'];
