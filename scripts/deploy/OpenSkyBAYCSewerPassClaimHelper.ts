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

    if (network == 'hardhat') {
        const PLACEHOLDER_NON_ZERO_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const BAYC = (await ethers.getContract('BAYC')).address;
        const MAYC = (await ethers.getContract('MAYC')).address;
        const BAKC = (await ethers.getContract('BAKC')).address;

        const OpenSkyLoan = await ethers.getContract('OpenSkyLoanMock');
        const TransferAdapterERC721Default = await ethers.getContract('TransferAdapterERC721Default');

        const BAYCSewerPass = await deploy('BAYCSewerPass', {
            from: deployer,
            gasLimit: 4000000,
            args: ['SewerPass', 'SEWER', deployer],
            log: true,
        });

        // address _baycContract,
        // address _maycContract,
        // address _bakcContract,
        // address _warmContract,
        // address _delegateCashContract,
        // address _sewerPassContract,
        // address _operator
        const BAYCSewerPassClaim = await deploy('BAYCSewerPassClaim', {
            from: deployer,
            gasLimit: 4000000,
            args: [
                BAYC,
                MAYC,
                BAKC,
                PLACEHOLDER_NON_ZERO_ADDRESS, // won't use
                PLACEHOLDER_NON_ZERO_ADDRESS, // won't use
                BAYCSewerPass.address,
                deployer,
            ],
            log: true,
        });

        await deploy('OpenSkyBAYCSewerPassClaimHelper', {
            from: deployer,
            gasLimit: 4000000,
            args: [
                BAYCSewerPassClaim.address,
                BAYCSewerPass.address,
                BAKC,
                OpenSkyLoan.address, // instant
                TransferAdapterERC721Default.address, //bespoke
            ],
            log: true,
        });
    } else if (network == 'mainnet') {
        const addressData = {
            BAYCSewerPassClaim: '0xBA5a9E9CBCE12c70224446C24C111132BECf9F1d',
            BAYCSewerPass: '0x764AeebcF425d56800eF2c84F2578689415a2DAa',
            BAKCAddress: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623',
            OpenSkyLoanAddress: '0x87D6DeC027E167136B081F888960fE48Bb10328a',
            TransferAdapterERC721DefaultAddress: '0x714aabF76065BA452933cF92D042E2B3354d7aA3',
        };

        await deploy('OpenSkyBAYCSewerPassClaimHelper', {
            from: deployer,
            gasLimit: 4000000,
            args: [
                addressData.BAYCSewerPassClaim,
                addressData.BAYCSewerPass,
                addressData.BAKCAddress,
                addressData.OpenSkyLoanAddress,
                addressData.TransferAdapterERC721DefaultAddress,
            ],
            log: true,
        });
    }
};

export default func;
func.tags = ['OpenSkyBAYCSewerPassClaimHelper'];
