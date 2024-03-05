import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUser, setupUsers, waitForTx, getTxCost, evmRevert, evmSnapshot, getBlockTimestamp } from '../../../helpers/utils';

import { MAX_UINT_AMOUNT } from '../helpers/constants';

export const __setup = deployments.createFixture(async () => {

    const networkInfo = await ethers.provider.getNetwork();
    await deployments.fixture(['incentives.test.for-aave-cases']);

    const contracts: any = {
        OpenSkyNFT: await ethers.getContract('OpenSkyERC721Mock'),
        OpenSkyPool: await ethers.getContract('OpenSkyPoolMock'),
        OpenSkyWETHGateway: await ethers.getContract('OpenSkyWETHGateway'),
        OpenSkyERC20Pool: await ethers.getContract('OpenSkyPoolMock'),
        MoneyMarket: await ethers.getContract('AaveV2MoneyMarket'),
        OpenSkySettings: await ethers.getContract('OpenSkySettings'),
        OpenSkyDataProvider: await ethers.getContract('OpenSkyDataProvider'),
        ACLManager: await ethers.getContract('ACLManager'),
        OpenSkyLoan: await ethers.getContract('OpenSkyLoanMock'),

        OpenSkyCollateralPriceOracle: await ethers.getContract('OpenSkyCollateralPriceOracle'),
        OpenSkyPriceAggregator: await ethers.getContract('OpenSkyPriceAggregator'),
        OpenSkyInterestRateStrategy: await ethers.getContract('OpenSkyInterestRateStrategy'),
        
        // Dao vault
        OpenSkyDaoVault: await ethers.getContract('OpenSkyDaoVault'),
        OpenSkyDaoVaultUniswapV2Adapter: await ethers.getContract('OpenSkyDaoVaultUniswapV2Adapter'),
        OpenSkyDaoLiquidator: await ethers.getContract('OpenSkyDaoLiquidator'),
        UniswapV2Router02: await ethers.getContract('UniswapV2Router02'),
        WNative: await ethers.getContract('WETH'),
        DAI: await ethers.getContract('DAI'),
        UnderlyingAsset: await ethers.getContract('WETH'),
        TestERC20: await ethers.getContract('TestERC20'),
        OpenSkyERC1155Mock: await ethers.getContract('OpenSkyERC1155Mock'),

        // bespoke market
        OpenSkyBespokeMarket: await ethers.getContract('OpenSkyBespokeMarket'),
        OpenSkyBespokeLendNFT: await ethers.getContract('OpenSkyBespokeLendNFT'),
        OpenSkyBespokeBorrowNFT: await ethers.getContract('OpenSkyBespokeBorrowNFT'),
        OpenSkyBespokeSettings: await ethers.getContract('OpenSkyBespokeSettings'),
        OpenSkyBespokeDataProvider: await ethers.getContract('OpenSkyBespokeDataProvider'),

        OpenSkyDutchAuctionLiquidator: await ethers.getContract('OpenSkyDutchAuctionLiquidator'),
        OpenSkyDutchAuctionPriceOracle: await ethers.getContract('OpenSkyDutchAuctionPriceOracle'),
        OpenSkyLoanDelegator: await ethers.getContract('OpenSkyLoanDelegator'),

        // strategies
        StrategyAnyInCollection: await ethers.getContract('StrategyAnyInCollection'),
        StrategyAnyInSet: await ethers.getContract('StrategyAnyInSet'),
        StrategyByAttribute: await ethers.getContract('StrategyByAttribute'),
        StrategyPrivate: await ethers.getContract('StrategyPrivate'),
        StrategyTokenId: await ethers.getContract('StrategyTokenId'),

        // nft transfer adapter
        TransferAdapterERC721Default: await ethers.getContract('TransferAdapterERC721Default'),
        TransferAdapterERC1155Default: await ethers.getContract('TransferAdapterERC1155Default'),

        //currency transfer adapter
        TransferAdapterCurrencyDefault: await ethers.getContract('TransferAdapterCurrencyDefault'),
        TransferAdapterOToken: await ethers.getContract('TransferAdapterOToken'),

        // refinance
        OpenSkyRefinance: await ethers.getContract('OpenSkyRefinance'),
        BespokeToBespokeAdapter: await ethers.getContract('BespokeToBespokeAdapter'),
        PoolToBespokeAdapter: await ethers.getContract('PoolToBespokeAdapter'),
        BespokeToPoolAdapter: await ethers.getContract('BespokeToPoolAdapter'),
        
        // incentive
        OpenSkyPoolIncentivesControllerLender: await ethers.getContract('OpenSkyPoolIncentivesControllerLender'),
        OpenSkyPoolIncentivesControllerBorrower: await ethers.getContract('OpenSkyPoolIncentivesControllerBorrower'),
        OpenSkyBespokeIncentivesControllerLender: await ethers.getContract('OpenSkyBespokeIncentivesControllerLender'),
        OpenSkyBespokeIncentivesControllerBorrower: await ethers.getContract('OpenSkyBespokeIncentivesControllerBorrower'),
    };
    
    // oToken
    contracts.oWETH = await ethers.getContractAt('OpenSkyOToken', (await contracts.OpenSkyPool.getReserveData('1')).oTokenAddress);
    contracts.oDAI = await ethers.getContractAt('OpenSkyOToken', (await contracts.OpenSkyPool.getReserveData('2')).oTokenAddress);
    
    //only for aave test cases:  aTokenMock  
    contracts.aWETH = await ethers.getContract('aWETH');
    contracts.aDAI = await ethers.getContract('aDAI');
    
    // users
    const users = await setupUsers(await getUnnamedAccounts(), contracts);
    const { deployer, nftStaker, buyer001, buyer002, buyer003, buyer004, liquidator } = await getNamedAccounts();
    const { user001, user002, user003, user004, user005, borrower } = await getNamedAccounts();

    for(const x in contracts){
        contracts[contracts[x].address] = contracts[x];
    }

    const ENV = {
        ...contracts,
        users,
        deployer: await setupUser(deployer, contracts),
        nftStaker: await setupUser(nftStaker, contracts),
        buyer001: await setupUser(buyer001, contracts),
        buyer002: await setupUser(buyer002, contracts),
        buyer003: await setupUser(buyer003, contracts),
        buyer004: await setupUser(buyer004, contracts),
        borrower: await setupUser(borrower, contracts),
        user001: await setupUser(user001, contracts),
        user002: await setupUser(user002, contracts),
        user003: await setupUser(user003, contracts),
        user004: await setupUser(user004, contracts),
        user005: await setupUser(user005, contracts),
        liquidator: await setupUser(liquidator, contracts),
    };
    
    // settings
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(liquidator));
    await waitForTx(await ENV.deployer.ACLManager.addLiquidationOperator(deployer));

    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(borrower));

    await waitForTx(await ENV.OpenSkyNFT.awardItem(user001));
    await waitForTx(await ENV.OpenSkyNFT.awardItem(user002));

    await waitForTx(await ENV.borrower.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));
    await waitForTx(await ENV.user001.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));
    await waitForTx(await ENV.user002.OpenSkyNFT.setApprovalForAll(ENV.OpenSkyPool.address, true));
    
    // ///////////////////////////////////////////////////////////////////
    

    return ENV;
})

