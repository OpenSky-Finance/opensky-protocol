import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('ApeCoin', {
        from: deployer,
        gasLimit: 4000000,
        args: ['Ape Coin', 'APE'],
        log: true,
    });

    await deploy('BAYC', {
        from: deployer,
        contract: 'SimpleERC721',
        gasLimit: 4000000,
        args: ['BAYC Mock', 'BAYC', ''],
        log: true,
    });

    await deploy('MAYC', {
        from: deployer,
        contract: 'SimpleERC721',
        gasLimit: 4000000,
        args: ['MAYC Mock', 'MAYC', ''],
        log: true,
    });

    await deploy('BAKC', {
        from: deployer,
        contract: 'SimpleERC721',
        gasLimit: 4000000,
        args: ['BAKC Mock', 'BAKC', ''],
        log: true,
    });

    console.log('------------');

    const ApeCoin = await ethers.getContract('ApeCoin');
    const BAYC = await ethers.getContract('BAYC');
    const MAYC = await ethers.getContract('MAYC');
    const BAKC = await ethers.getContract('BAKC');

    await deploy('ApeCoinStaking', {
        from: deployer,
        args: [ApeCoin.address, BAYC.address, MAYC.address, BAKC.address],
        log: true,
    });
    console.log('------------');
};

export default func;
func.tags = ['ApeCoinStakingMock'];
