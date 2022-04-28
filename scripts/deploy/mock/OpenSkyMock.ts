import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkyNFT1 = await deploy('OpenSkyERC721Mock', {
        from: deployer,
        gasLimit: 4000000,
        args: ['NFT1', 'NFT1'],
        log: true,
    });

    const OpenSkyERC1155Token = await deploy('OpenSkyERC1155Mock', {
        from: deployer,
        gasLimit: 4000000,
        args: ['http://token-uri/tokenid/'],
        log: true,
    });
};

export default func;
func.tags = ['OpenSkyMock'];
func.dependencies = [];
