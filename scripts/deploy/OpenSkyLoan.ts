import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);

    const MathUtils = await ethers.getContract('MathUtils', deployer);

    const contract = hre.network.name == 'hardhat' ? 'OpenSkyLoanMock' : 'OpenSkyLoan';

    const OpenSkyLoan = await deploy(contract, {
        from: deployer,
        args: ['OpenSky Loan', 'OSL', OpenSkySettings.address],
        libraries: {
            MathUtils: MathUtils.address,
        },
        log: true,
    });
    console.log('OpenSkyLoan', OpenSkyLoan.address);
    await (await OpenSkySettings.initLoanAddress(OpenSkyLoan.address, { gasLimit: 4000000 })).wait();
};

export default func;
func.tags = ['OpenSkyLoan'];
func.dependencies = ['OpenSkySettings', 'OpenSkyLibrary'];
