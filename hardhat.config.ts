import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import '@typechain/ethers-v5';
import 'hardhat-gas-reporter';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-storage-layout';
import 'solidity-coverage';

dotenv.config();

const TEST_ACCOUNTS_KEYS: any = [
    process.env.TEST_ACCOUNT_0_KEY,
    process.env.TEST_ACCOUNT_1_KEY,
    process.env.TEST_ACCOUNT_2_KEY,
    process.env.TEST_ACCOUNT_3_KEY,
    process.env.TEST_ACCOUNT_4_KEY,
    process.env.TEST_ACCOUNT_5_KEY,
    process.env.TEST_ACCOUNT_6_KEY,
    process.env.TEST_TREASURY_KEY,
];
const TEST_ACCOUNTS_HARDHAT: any = [
    {
        privateKey: process.env.TEST_ACCOUNT_0_KEY,
        balance: '115792089237316195423570985008687907853269984665640564039457584007913129639935', // uint256 max
    },
    {
        privateKey: process.env.TEST_ACCOUNT_1_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_ACCOUNT_2_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_ACCOUNT_3_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_ACCOUNT_4_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_ACCOUNT_5_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_ACCOUNT_6_KEY,
        balance: '100000000000000000000',
    },
    {
        privateKey: process.env.TEST_TREASURY_KEY,
        balance: '0',
    },
];
const TEST_ACCOUNTS_NAMED = {
    deployer: 0,
    user001: 1,
    user002: 2,
    user003: 3,
    user004: 4,
    user005: 5,
    borrower: 6,
    nftStaker: 1,
    buyer001: 2,
    buyer002: 3,
    buyer003: 4,
    buyer004: 5,
    liquidator: 4,
    nftHolder1: { default: 1 },
    nftHolder2: { default: 2 },
    oTokenHolder1: { default: 3 },
    oTokenHolder2: { default: 4 },
    bidder1: { default: 5 },
    bidder2: { default: 6 },
    treasury: 7,
};

const config: HardhatUserConfig = {
    namedAccounts: TEST_ACCOUNTS_NAMED,
    networks: {
        hardhat: {
            allowUnlimitedContractSize: false,
            accounts: TEST_ACCOUNTS_HARDHAT,
            tags: ['hardhat'],
            forking: process.env.HARDHAT_FORKING_URL
                ? {
                      url: process.env.HARDHAT_FORKING_URL,
                      blockNumber: Number(process.env.HARDHAT_FORKING_BLOCKNUMBER),
                  }
                : undefined,
        },
        ganache: {
            url: 'http://127.0.0.1:7545',
            accounts: { mnemonic: process.env.TEST_MNEMONIC },
            tags: ['ganache'],
        },
        rinkeby: {
            accounts: TEST_ACCOUNTS_KEYS,
            url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            tags: ['rinkeby'],
        },
        kovan: {
            accounts: TEST_ACCOUNTS_KEYS,
            url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            tags: ['kovan'],
        },
        mainnet: {
            // accounts: process.env.PRODUCTION_PRIVATE_KEY !== undefined ? [process.env.PRODUCTION_PRIVATE_KEY] : [],
            url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            tags: ['mainnet'],
        },
        matic: {
            chainId: 137,
            accounts: TEST_ACCOUNTS_KEYS,
            url: `https://polygon-rpc.com/`,
            tags: ['matic'],
        },
        mumbai: {
            chainId: 80001,
            accounts: TEST_ACCOUNTS_KEYS,
            url: `https://rpc-mumbai.maticvigil.com`,
            tags: ['mumbai'],
        },
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: true,
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: 'USD',
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    paths: {
        deploy: 'scripts/deploy',
        tests: 'scripts/test',
        deployments: 'data/deployments',
        cache: 'data/cache',
        artifacts: 'data/artifacts',
        imports: 'imports',
    },
    abiExporter: {
        path: 'data/abi',
        clear: true,
        flat: true,
        except: [],
        spacing: 2,
    },
    solidity: {
        compilers: [
            {
                version: '0.4.19',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 500,
                    },
                },
            },
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 500,
                    },
                },
            },
            {
                // Docs for the compiler https://docs.soliditylang.org/en/v0.8.10/using-the-compiler.html
                version: '0.8.10',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    evmVersion: 'london',
                },
            },
        ],
    },
    mocha: {
        timeout: 100000,
    },
    typechain: {
        outDir: './types',
        target: 'ethers-v5',
    },
};

export default config;
