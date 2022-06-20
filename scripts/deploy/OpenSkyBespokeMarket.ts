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
    let WETH_ADDRESS = config.contractAddress.WNative;
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
        libraries: {
            BespokeTypes: BespokeTypes.address,
            WadRayMath: WadRayMath.address,
            MathUtils: MathUtils.address,
        },
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
            BespokeLogic: BespokeLogic.address,

            MathUtils: MathUtils.address,
            PercentageMath: PercentageMath.address,
            WadRayMath: WadRayMath.address,
        },
        log: true,
    });
    const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket', deployer);

    // loan NFT
    const OpenSkyBespokeBorrowNFT = await deploy('OpenSkyBespokeBorrowNFT', {
        from: deployer,
        contract: 'OpenSkyBespokeLoanNFT',
        args: ['OpenSky Bespoke Borrow Receipt', 'OBBR', OpenSkyBespokeSettings.address],
        libraries: {
            // MathUtils: MathUtils.address,
            // PercentageMath: PercentageMath.address,
            // WadRayMath: WadRayMath.address,
        },
        log: true,
    });
    const OpenSkyBespokeLendNFT = await deploy('OpenSkyBespokeLendNFT', {
        from: deployer,
        contract: 'OpenSkyBespokeLoanNFT',
        args: ['OpenSky Bespoke Lend Receipt', 'OBLR', OpenSkyBespokeSettings.address],
        libraries: {
            // MathUtils: MathUtils.address,
            // PercentageMath: PercentageMath.address,
            // WadRayMath: WadRayMath.address,
        },
        log: true,
    });

    const OpenSkyBespokeDataProvider = await deploy('OpenSkyBespokeDataProvider', {
        from: deployer,
        args: [OpenSkyBespokeMarket.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    //////////////////////////////////////////////////////////

    console.log('marketAddress', await OpenSkyBespokeSettings['marketAddress()']());
    console.log('borrowLoanAddress', await OpenSkyBespokeSettings['borrowLoanAddress()']());
    console.log('lendLoanAddress', await OpenSkyBespokeSettings['lendLoanAddress()']());

    await (
        await OpenSkyBespokeSettings.initLoanAddress(OpenSkyBespokeBorrowNFT.address, OpenSkyBespokeLendNFT.address)
    ).wait();
    await (await OpenSkyBespokeSettings.initMarketAddress(OpenSkyBespokeMarket.address)).wait();

    // NFT whitelist
    for (const nft of config.whitelistBespokeNFT) {
        await (
            await OpenSkyBespokeSettings.addToWhitelist(
                nft.address,
                nft.minBorrowDuration,
                nft.maxBorrowDuration,
                nft.overdueDuration
            )
        ).wait();
    }

    // currency whitelist
    if (network == 'hardhat') {
        await (await OpenSkyBespokeSettings.addCurrency(WETH_ADDRESS)).wait();
        const DAI = await ethers.getContract('DAI');
        await (await OpenSkyBespokeSettings.addCurrency(DAI.address)).wait();
    } else {
        for (const currency of config.whitelistBespokeCurrency) {
            await (await OpenSkyBespokeSettings.addCurrency(currency.address)).wait();
        }
    }
    // open whitelist
    await (await OpenSkyBespokeSettings.openWhitelist()).wait();

    console.log('bespoke deployment done');
};

export default func;
func.tags = ['OpenSkyBespokeMarket'];
func.dependencies = ['ACLManager', 'OpenSkySettings', 'OpenSkyLibrary'];
