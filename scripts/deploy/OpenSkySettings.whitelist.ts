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

    console.log('setting whitelist for network:', network);

    const config = require(`../config/${network}.json`);

    for (const nft of config.whitelist) {
        await (await OpenSkySettings.addToWhitelist(
            1,
            !nft.address ? (await ethers.getContract(nft.contract)).address : nft.address,
            nft.name, nft.symbol, nft.LTV,
            nft.minBorrowDuration, nft.maxBorrowDuration, nft.extendableDuration, nft.overdueDuration,
            { gasLimit: 4000000 }
        )).wait();
    }

    console.log('OpenSkySettings.whitelist done');
};

export default func;
func.tags = ['OpenSkySettings.whitelist'];
func.dependencies = ['OpenSkySettings'];
