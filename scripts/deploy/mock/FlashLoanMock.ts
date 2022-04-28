import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkyNFT = await ethers.getContract('OpenSkyERC721Mock');

    const ApeCoinAirdropMockDeploy = await deploy('ApeCoinMock', {
        from: deployer,
        gasLimit: 4000000,
        args: [OpenSkyNFT.address],
        log: true,
    });

    await deploy('ApeCoinFlashLoanMock', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinAirdropMockDeploy.address],
        log: true,
    });
};

export default func;
func.tags = ['FlashLoanMock'];
func.dependencies = ['OpenSkyMock'];
