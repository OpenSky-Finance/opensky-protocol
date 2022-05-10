import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    const CryptoPunksMarket = await deploy('CryptoPunksMarket', {
        from: deployer,
        args: [],
        log: true,
    });

    const WrappedPunk = await deploy('WrappedPunk', {
        from: deployer,
        args: [CryptoPunksMarket.address],
        log: true,
    });
};

export default func;
func.tags = ['PunkAndWPunkMock'];
func.dependencies = [];
