import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // hardfork or local deployment
    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    let UniswapV2Router02;
    let WETH;

    // prepare params
    let network = hre.network.name;
    if (network == 'hardhat') {
        if (process.env.HARDHAT_FORKING_NETWORK) {
            // read from config
            network = process.env.HARDHAT_FORKING_NETWORK;
            const config = require(`../config/${network}.json`);
            if (network == 'matic') {
                UniswapV2Router02 = config.contractAddress.QUICKSWAP_UNISWAPV2ROUTER02;
                WETH = config.contractAddress.QUICKSWAP_WMATIC;
            } else {
                UniswapV2Router02 = config.contractAddress.UniswapV2Router02;
                WETH = config.contractAddress.WETH;
            }
        } else {
            WETH = await ethers.getContract('WETH', deployer);
            WETH = WETH.address;
            UniswapV2Router02 = await ethers.getContract('UniswapV2Router02', deployer);
            UniswapV2Router02 = UniswapV2Router02.address;
        }
    } else {
        // online network
        const config = require(`../config/${network}.json`);
        UniswapV2Router02 = config.contractAddress.UniswapV2Router02;
        WETH = config.contractAddress.WETH;
    }

    const OpenSkyDaoVault = await ethers.getContract('OpenSkyDaoVault', deployer);

    const OpenSkyDaoVaultUniswapV2Adapter = await deploy('OpenSkyDaoVaultUniswapV2Adapter', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkySettings.address, OpenSkyDaoVault.address, UniswapV2Router02, WETH],
        log: true,
    });
};

export default func;
func.tags = ['OpenSkyDaoVaultUniswapV2Adapter'];
func.dependencies = ['OpenSkyDaoVault'];
