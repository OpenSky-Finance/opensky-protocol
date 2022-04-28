import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    await deploy('OpenSkyCollateralPriceOracle', {
        from: deployer,
        args: [OpenSkySettings.address],
        log: true,
    });
    const OpenSkyCollateralPriceOracle = await ethers.getContract('OpenSkyCollateralPriceOracle', deployer);
    await (await OpenSkySettings.setNftPriceOracleAddress(OpenSkyCollateralPriceOracle.address, { gasLimit: 4000000 })).wait();

    const config = require(`../config/${hre.network.name}.json`);

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
