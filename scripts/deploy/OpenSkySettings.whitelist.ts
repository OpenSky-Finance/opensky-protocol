import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { parseEther } from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const network = hre.network.name;

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    // depend on OpenSkyCollectionPool tag
    const OpenSkyCollateralPriceOracle = await ethers.getContract('OpenSkyCollateralPriceOracle', deployer);

    console.log('setting whitelist for network:', network);

    if (network == 'rinkeby') {
        const config = require(`../config/rinkeby.json`);

        for (const nft of config.whitelist) {
            await (await OpenSkySettings.addToWhitelist(nft.address, nft.name, nft.symbol, 5000, { gasLimit: 4000000 })).wait();
            // await (await OpenSkyCollectionPool.addCollection(nft.address, { gasLimit: 4000000 })).wait();
            await (
                await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
                    nft.address,
                    parseEther('20'),
                    Math.floor(Date.now() / 1000),
                    { gasLimit: 4000000 }
                )
            ).wait();
        }

        // add wpunk TODO merge with above
        const WPUNK = await ethers.getContract('WrappedPunk', deployer);
        await (await OpenSkySettings.addToWhitelist(WPUNK.address, 'WPUNK', 'WPUNK', 5000)).wait();
        await (
            await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
                WPUNK.address,
                parseEther('20'),
                Math.floor(Date.now() / 1000),
                { gasLimit: 4000000 }
            )
        ).wait();
    } else if (network == 'hardhat') {
        const OpenSkyERC721Mock = await ethers.getContract('OpenSkyERC721Mock', deployer);
        await (await OpenSkySettings.addToWhitelist(OpenSkyERC721Mock.address, 'oERC721Mock', 'oERC721Mock', 5000)).wait();
        // await (await OpenSkyCollectionPool.addCollection(OpenSkyERC721Mock.address)).wait();
        await (
            await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
                OpenSkyERC721Mock.address,
                parseEther('20'),
                Math.floor(Date.now() / 1000),
                { gasLimit: 4000000 }
            )
        ).wait();

        // add wpunk
        const WPUNK = await ethers.getContract('WrappedPunk', deployer);
        await (await OpenSkySettings.addToWhitelist(
            WPUNK.address, 'WPUNK', 'WPUNK', 5000, 300, 365 * 24 * 3600, 3 * 24 * 3600, 1 * 24 * 3600
        )).wait();
        await (
            await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
                WPUNK.address,
                parseEther('20'),
                Math.floor(Date.now() / 1000),
                { gasLimit: 4000000 }
            )
        ).wait();
    }else{
      try {
        const config = require(`../config/${network}.json`); 

        for (const nft of config.whitelist) {
          await (await OpenSkySettings.addToWhitelist(nft.address, nft.name, nft.symbol, 5000, { gasLimit: 4000000 })).wait();

          await (
            await OpenSkyCollateralPriceOracle['updatePrice(address,uint256,uint256)'](
              nft.address,
              parseEther('20'),
              Math.floor(Date.now() / 1000),
              { gasLimit: 4000000 }
            )
          ).wait();
        }

      }catch (e) {
        console.warn('OpenSkySettings.whitelist, set nothing',e)
      }
    }
    console.log('OpenSkySettings.whitelist done')
};

export default func;
func.tags = ['OpenSkySettings.whitelist'];
func.dependencies = ['OpenSkySettings'];
