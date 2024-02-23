import { OpenSkyERC721Mock } from '../../types/OpenSkyERC721Mock';
import { OpenSkyPool } from '../../types/OpenSkyPool';
import { OpenSkyOToken } from '../../types/OpenSkyOToken';
import { OpenSkySettings } from '../../types/OpenSkySettings';

// import { OpenSkyCommonLiquidator } from '../../types/OpenSkyCommonLiquidator';
// import { OpenSkyAuctionLiquidator } from '../../types/OpenSkyAuctionLiquidator';
import { OpenSkyDataProvider } from '../../types/OpenSkyDataProvider';
import { OpenSkyLoan } from '../../types/OpenSkyLoan';

// aave
import { IWETHGateway } from '../../types/IWETHGateway';
import { ILendingPool } from '../../types/ILendingPool';
import { IERC20 } from '../../types/IERC20';

// punk
import { CryptoPunksMarket } from '../../types/CryptoPunksMarket';
import { WrappedPunk } from '../../types/WrappedPunk';
import { OpenSkyPunkGateway } from '../../types/OpenSkyPunkGateway';
import { IOpenSkyMoneyMarket } from '../../types/IOpenSkyMoneyMarket';
import { OpenSkyInterestRateStrategy } from '../../types/OpenSkyInterestRateStrategy';
import { ACLManager } from '../../types/ACLManager';
import { ethers } from 'hardhat';

export interface ENV {
    OpenSkyNFT: OpenSkyERC721Mock;
    OpenSkyPool: OpenSkyPool;
    OpenSkyOToken: OpenSkyOToken;
    OpenSkySettings: OpenSkySettings;
    OpenSkyDataProvider: OpenSkyDataProvider;
    OpenSkyLoan: OpenSkyLoan;

    OpenSkyDaoVault: any;
    OpenSkyDaoVaultUniswapV2Adapter: any;
    OpenSkyDaoLiquidator: any;
    UniswapV2Router02: any;
    WNative: any;
    TestERC20: any;

    OpenSkyDutchAuction: any,
    OpenSkyDutchAuctionLiquidator: any,
    OpenSkyDutchAuctionPriceOracle: any,

    ACLManager: ACLManager;

    MoneyMarket: IOpenSkyMoneyMarket;

    OpenSkyInterestRateStrategy: OpenSkyInterestRateStrategy;

    CryptoPunksMarket: CryptoPunksMarket;
    WrappedPunk: WrappedPunk;
    OpenSkyPunkGateway: OpenSkyPunkGateway;

    AAVE_WETH_GATEWAY: IWETHGateway;
    AAVE_POOL: ILendingPool;
    AAVE_AWETH: IERC20;
    nftStaker: any;
    deployer: any;
    buyer001: any;
    buyer002: any;
    liquidator: any;
}
