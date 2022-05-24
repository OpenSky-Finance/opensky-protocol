import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const OpenSkySettings = await ethers.getContract('OpenSkySettings', deployer);
    const MathUtils = await ethers.getContract('MathUtils', deployer);
    const PercentageMath = await ethers.getContract('PercentageMath', deployer);
    const WadRayMath = await ethers.getContract('WadRayMath', deployer);

    const ACLManager = await ethers.getContract('ACLManager');

    let network = hre.network.name;
    if (network == 'hardhat' && process.env.HARDHAT_FORKING_NETWORK) {
        network = process.env.HARDHAT_FORKING_NETWORK;
    }
    const config = require(`../config/${network}.json`);
    let { WETH_ADDRESS } = config.contractAddress;
    if (!WETH_ADDRESS) {
        WETH_ADDRESS = (await ethers.getContract('WETH')).address;
    }

    // libraries
    const BespokeTypes = await deploy('BespokeTypes', {
        from: deployer,
        args: [],
        log: true,
    });

    const SignatureChecker = await deploy('SignatureChecker', {
        from: deployer,
        args: [],
        log: true,
    });

    const BespokeLogic = await deploy('BespokeLogic', {
        from: deployer,
        args: [],
        log: true,
    });

    //
    await deploy('OpenSkyBespokeSettings', {
        from: deployer,
        gasLimit: 4000000,
        args: [ACLManager.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    const OpenSkyBespokeSettings = await ethers.getContract('OpenSkyBespokeSettings', deployer);

    await deploy('OpenSkyBespokeMarket', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyBespokeSettings.address, WETH_ADDRESS],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            SignatureChecker: SignatureChecker.address,
            BespokeLogic:BespokeLogic.address,

            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
        },
        log: true,
    });
    const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket', deployer);

    // loan NFT
    await deploy('OpenSkyBespokeLoanNFT', {
        from: deployer,
        args: ['OpenSky Bespoke Loan', 'OSBL', OpenSkySettings.address, OpenSkyBespokeMarket.address],
        libraries: {
            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
        },
        log: true,
    });
    const OpenSkyBespokeLoanNFT = await ethers.getContract('OpenSkyBespokeLoanNFT', deployer);
    //
    // set loan nft address for market
    await (await OpenSkyBespokeSettings.initLoanAddress(OpenSkyBespokeLoanNFT.address)).wait();
    await (await OpenSkyBespokeSettings.addCurrency(WETH_ADDRESS)).wait();
};

export default func;
func.tags = ['OpenSkyBespokeMarket'];
func.dependencies = ['ACLManager', 'OpenSkySettings', 'OpenSkyLibrary'];
