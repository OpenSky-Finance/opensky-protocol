import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    await deploy('OpenSkyCollateralPriceOracle', {
        from: deployer,
        args: [OpenSkySettings.address, ZERO_ADDRESS],
        log: true,
    });
    const OpenSkyCollateralPriceOracle = await ethers.getContract('OpenSkyCollateralPriceOracle', deployer);
    if (await OpenSkySettings.nftPriceOracleAddress() == ZERO_ADDRESS) {
        await (await OpenSkySettings.setNftPriceOracleAddress(OpenSkyCollateralPriceOracle.address, { gasLimit: 4000000 })).wait();
    }

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);

    for (const priceFeed of config.prices) {
        await (
            await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
                !priceFeed.address ? (await ethers.getContract(priceFeed.contract)).address : priceFeed.address,
                parseEther(priceFeed.price),
                priceFeed.timestamp > 0 ? priceFeed.timestamp : Math.floor(Date.now() / 1000),
                { gasLimit: 4000000 }
            )
        ).wait();
    }
};

export default func;
func.tags = ['OpenSkyCollateralPriceOracle'];
func.dependencies = ['OpenSkySettings'];
