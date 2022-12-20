import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }

    const config = require(`../config/${network}.json`);
    let { ApeCoinStaking, ApeCoin, BAKC } = config.contractAddress;
    if (!ApeCoinStaking) {
        ApeCoinStaking = (await ethers.getContract('ApeCoinStaking')).address;
    }
    if (!ApeCoin) {
        ApeCoin = (await ethers.getContract('ApeCoin')).address;
    }
    if (!BAKC) {
        BAKC = (await ethers.getContract('BAKC')).address;
    }

    const OpenSkySettings = await ethers.getContract('OpenSkySettings');
    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings');

    const OpenSkyLoan = await OpenSkySettings.loanAddress();
    const TransferAdapterERC721Default = await OpenSkyBespokeSettings.TRANSFER_ERC721();

    await deploy('OpenSkyDepositBAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyDepositMAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyDepositBAKCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, BAKC, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyWithdrawBAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyWithdrawMAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyWithdrawBAKCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, BAKC, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyClaimBAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyClaimMAYCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });

    await deploy('OpenSkyClaimBAKCHelper', {
        from: deployer,
        gasLimit: 4000000,
        args: [ApeCoinStaking, ApeCoin, BAKC, OpenSkyLoan, TransferAdapterERC721Default],
        log: true,
    });
};

export default func;
func.tags = ['OpenSkyApeCoinStakingHelper'];
