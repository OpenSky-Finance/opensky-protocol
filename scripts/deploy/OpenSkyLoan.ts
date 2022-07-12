import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZERO_ADDRESS } from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const MathUtils = await ethers.getContract('MathUtils', deployer);


    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }
    
    const contract = network == 'hardhat' ? 'OpenSkyLoanMock' : 'OpenSkyLoan';
    
    const poolAddress = await OpenSkySettings.poolAddress()

    const OpenSkyLoan = await deploy(contract, {
        from: deployer,
        args: ['OpenSky Loan', 'OSL', OpenSkySettings.address, poolAddress],
        libraries: {
            MathUtils: MathUtils.address,
        },
        log: true,
    });
    if (await OpenSkySettings.loanAddress() == ZERO_ADDRESS) {
        await (await OpenSkySettings.initLoanAddress(OpenSkyLoan.address, { gasLimit: 4000000 })).wait();
    }
};

export default func;
func.tags = ['OpenSkyLoan'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary', 'OpenSkyPool'];
