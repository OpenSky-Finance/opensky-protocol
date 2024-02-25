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

    const TakeLendOfferLogic = await deploy('TakeLendOfferLogic', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            BespokeLogic: BespokeLogic.address,
        },
        log: true,
    });

    const TakeBorrowOfferLogic = await deploy('TakeBorrowOfferLogic', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            BespokeLogic: BespokeLogic.address,
        },
        log: true,
    });

    const ForecloseLogic = await deploy('ForecloseLogic', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            BespokeLogic: BespokeLogic.address,
        },
        log: true,
    });

    const RepayLogic = await deploy('RepayLogic', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            BespokeLogic: BespokeLogic.address,
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
        args: [OpenSkySettings.address, OpenSkyBespokeSettings.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
            BespokeLogic: BespokeLogic.address,
            TakeLendOfferLogic: TakeLendOfferLogic.address,
            TakeBorrowOfferLogic: TakeBorrowOfferLogic.address,
            ForecloseLogic: ForecloseLogic.address,
            RepayLogic: RepayLogic.address,
        },
        log: true,
    });
    const OpenSkyBespokeMarket = await ethers.getContract('OpenSkyBespokeMarket', deployer);

    // loan NFT
    const OpenSkyBespokeBorrowNFT = await deploy('OpenSkyBespokeBorrowNFT', {
        from: deployer,
        contract: 'OpenSkyBespokeLoanNFT',
        args: ['OpenSky Bespoke Borrow Receipt', 'OBBR', OpenSkyBespokeSettings.address],
        libraries: {},
        log: true,
    });
    const OpenSkyBespokeLendNFT = await deploy('OpenSkyBespokeLendNFT', {
        from: deployer,
        contract: 'OpenSkyBespokeLoanNFT',
        args: ['OpenSky Bespoke Lend Receipt', 'OBLR', OpenSkyBespokeSettings.address],
        libraries: {},
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

    // offer strategies
    const StrategyAnyInCollection = await deploy('StrategyAnyInCollection', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    const StrategyAnyInSet = await deploy('StrategyAnyInSet', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    const StrategyByAttribute = await deploy('StrategyByAttribute', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    const StrategyPrivate = await deploy('StrategyPrivate', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });
    const StrategyTokenId = await deploy('StrategyTokenId', {
        from: deployer,
        args: [],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    // nft transfer adapters

    const TransferAdapterERC721Default = await deploy('TransferAdapterERC721Default', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyBespokeSettings.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    const TransferAdapterERC1155Default = await deploy('TransferAdapterERC1155Default', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyBespokeSettings.address],
        libraries: {
            BespokeTypes: BespokeTypes.address,
        },
        log: true,
    });

    // currency adapters
    const TransferAdapterCurrencyDefault = await deploy('TransferAdapterCurrencyDefault', {
        from: deployer,
        args: [OpenSkyBespokeSettings.address],
        libraries: {},
        log: true,
    });

    await deploy('TransferAdapterOToken', {
        from: deployer,
        args: [OpenSkySettings.address, OpenSkyBespokeSettings.address],
        libraries: {},
        log: true,
    });
    const TransferAdapterOToken = await ethers.getContract('TransferAdapterOToken', deployer);

    //////////////////////////////////////////////////////////
    console.log('marketAddress', await OpenSkyBespokeSettings['marketAddress()']());
    console.log('borrowLoanAddress', await OpenSkyBespokeSettings['borrowLoanAddress()']());
    console.log('lendLoanAddress', await OpenSkyBespokeSettings['lendLoanAddress()']());

    if ((await OpenSkyBespokeSettings.borrowLoanAddress()) == ZERO_ADDRESS) {
        await (
            await OpenSkyBespokeSettings.initLoanAddress(OpenSkyBespokeBorrowNFT.address, OpenSkyBespokeLendNFT.address)
        ).wait();
    }
    if ((await OpenSkyBespokeSettings.marketAddress()) == ZERO_ADDRESS) {
        await (await OpenSkyBespokeSettings.initMarketAddress(OpenSkyBespokeMarket.address)).wait();
    }

    // NFT whitelist
    console.log('begin whitelist');

    if (network == 'hardhat') {
        const OpenSkyNFT = await ethers.getContract('OpenSkyERC721Mock');
        const ERC721 = {
            address: OpenSkyNFT.address,
            name: 'OpenSkyERC721Mock',
            minBorrowDuration: 300,
            maxBorrowDuration: 31536000,
            overdueDuration: 172800,
        };

        await (
            await OpenSkyBespokeSettings.addToWhitelist(
                ERC721.address,
                ERC721.minBorrowDuration,
                ERC721.maxBorrowDuration,
                ERC721.overdueDuration
            )
        ).wait();

        const OpenSkyERC1155 = await ethers.getContract('OpenSkyERC1155Mock');
        const ERC1155 = {
            address: OpenSkyERC1155.address,
            name: 'OpenSkyERC1155Mock',
            minBorrowDuration: 300,
            maxBorrowDuration: 31536000,
            overdueDuration: 172800,
        };

        await (
            await OpenSkyBespokeSettings.addToWhitelist(
                ERC1155.address,
                ERC1155.minBorrowDuration,
                ERC1155.maxBorrowDuration,
                ERC1155.overdueDuration
            )
        ).wait();
        console.log('bespoke whitelist set successfully');
    } else {
        console.log('setting nft whitelist');
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
    }

    // currency whitelist
    if (network == 'hardhat') {
        await (await OpenSkyBespokeSettings.addCurrency(WETH_ADDRESS)).wait();
        const DAI = await ethers.getContract('DAI');
        await (await OpenSkyBespokeSettings.addCurrency(DAI.address)).wait();
    } else {
        console.log('setting currency whitelist');

        for (const currency of config.whitelistBespokeCurrency) {
            await (await OpenSkyBespokeSettings.addCurrency(currency.address)).wait();
        }
    }
    // open whitelist
    await (await OpenSkyBespokeSettings.openWhitelist()).wait();

    console.log('setting strategies whitelist');
    // strategies whitelist
    await (await OpenSkyBespokeSettings.addStrategy(StrategyAnyInCollection.address)).wait();
    await (await OpenSkyBespokeSettings.addStrategy(StrategyAnyInSet.address)).wait();
    await (await OpenSkyBespokeSettings.addStrategy(StrategyByAttribute.address)).wait();
    await (await OpenSkyBespokeSettings.addStrategy(StrategyPrivate.address)).wait();
    await (await OpenSkyBespokeSettings.addStrategy(StrategyTokenId.address)).wait();

    // /////////////////////////////////
    // init nft transfer adapter
    console.log('setting nft transfer adapter');
    if (
        (await OpenSkyBespokeSettings.TRANSFER_ERC721()) == ZERO_ADDRESS &&
        (await OpenSkyBespokeSettings.TRANSFER_ERC1155()) == ZERO_ADDRESS
    ) {
        await (
            await OpenSkyBespokeSettings.initDefaultNftTransferAdapters(
                TransferAdapterERC721Default.address,
                TransferAdapterERC1155Default.address
            )
        ).wait();
    }

    //  config  currency transfer

    // /////////////////////////////////
    // currency transfer adapter
    console.log('setting currency transfer adapter');
    if ((await OpenSkyBespokeSettings.TRANSFER_CURRENCY()) == ZERO_ADDRESS) {
        await (
            await OpenSkyBespokeSettings.initDefaultCurrencyTransferAdapter(TransferAdapterCurrencyDefault.address)
        ).wait();
    }

    if (network != 'hardhat') {
        await (
            await OpenSkyBespokeSettings.addCurrencyTransferAdapter(
                config.contractAddress.oWNative,
                TransferAdapterOToken.address
            )
        ).wait();
        await (
            await OpenSkyBespokeSettings.addCurrencyTransferAdapter(
                config.contractAddress.oUSDC,
                TransferAdapterOToken.address
            )
        ).wait();
        await (
            await OpenSkyBespokeSettings.addCurrencyTransferAdapter(
                config.contractAddress.oApeCoin,
                TransferAdapterOToken.address
            )
        ).wait();

        // setting for hardhat are in test.ts after OpenSky pool reserve created
        // config TransferAdapterOToken
        await (await TransferAdapterOToken.setOTokenToReserveIdMap(config.contractAddress.oWNative, 1)).wait();
        await (await TransferAdapterOToken.setOTokenToReserveIdMap(config.contractAddress.oUSDC, 2)).wait();
        await (await TransferAdapterOToken.setOTokenToReserveIdMap(config.contractAddress.oApeCoin, 3)).wait();
    }

    console.log('bespoke deployment done');
};

export default func;
func.tags = ['OpenSkyBespokeMarket'];
// func.dependencies = ['ACLManager', 'OpenSkySettings', 'OpenSkyLibrary'];
func.dependencies = ['OpenSkyPool'];
