import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { utils, ContractFactory } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let network = hre.network.name;

    if (network == 'hardhat') {
        await deploy('ApeCoin', {
            from: deployer,
            gasLimit: 4000000,
            args: ['Ape Coin', 'APE'],
            log: true,
        });

        await deploy('BAYC', {
            from: deployer,
            contract: 'SimpleERC721',
            gasLimit: 4000000,
            args: ['BAYC Mock', 'BAYC', ''],
            log: true,
        });

        await deploy('MAYC', {
            from: deployer,
            contract: 'SimpleERC721',
            gasLimit: 4000000,
            args: ['MAYC Mock', 'MAYC', ''],
            log: true,
        });

        await deploy('BAKC', {
            from: deployer,
            contract: 'SimpleERC721',
            gasLimit: 4000000,
            args: ['BAKC Mock', 'BAKC', ''],
            log: true,
        });

        console.log('------------');

        const ApeCoin = await ethers.getContract('ApeCoin');
        const BAYC = await ethers.getContract('BAYC');
        const MAYC = await ethers.getContract('MAYC');
        const BAKC = await ethers.getContract('BAKC');

        await deploy('ApeCoinStaking', {
            from: deployer,
            args: [ApeCoin.address, BAYC.address, MAYC.address, BAKC.address],
            log: true,
        });
    }

    if (network == 'goerli') {
        let network = hre.network.name;
        const config = require(`../../config/${network}.json`);
        const contract = config.contractAddress;
        console.log('contract', contract);
        await deploy('ApeCoinStaking', {
            from: deployer,
            args: [contract.ApeCoin, contract.BAYC, contract.MAYC, contract.BAKC],
            log: true,
        });

        // TODO time range
        const apeCoinStaking = await ethers.getContract('ApeCoinStaking', deployer);

        /************************************
         *  Set Time Ranges for all pools for the first year with real values
         *  *********************************/

        function toWei(x: number) {
            return utils.parseEther(x.toString())
        }

        function secondsTilNextHour(now: Date) : number {
            return 3600 - now.getSeconds() - (now.getMinutes() * 60);
        }

        const NINETY_ONE_DAYS_IN_SECONDS = 24 * 3600 * 91
        const NINETY_TWO_DAYS_IN_SECONDS = 24 * 3600 * 92

        const currentEthTimestamp = (await ethers.provider.getBlock('latest')).timestamp
        let now = new Date(currentEthTimestamp * 1000)

        const START_TIME = currentEthTimestamp + secondsTilNextHour(now)

        const END_FIRST_QUARTER = START_TIME + NINETY_ONE_DAYS_IN_SECONDS
        const END_SECOND_QUARTER = END_FIRST_QUARTER + NINETY_TWO_DAYS_IN_SECONDS
        const END_THIRD_QUARTER = END_SECOND_QUARTER + NINETY_ONE_DAYS_IN_SECONDS
        const END_FOURTH_QUARTER = END_THIRD_QUARTER + NINETY_ONE_DAYS_IN_SECONDS

        console.log(`\nSetting up TimeRanges...`)
        
        // APE COIN Pool
        let firstQuarter = await apeCoinStaking.addTimeRange(0, toWei(10_500_000), START_TIME, END_FIRST_QUARTER, 0)
        await firstQuarter.wait()
        console.log(`First Quarter from ${START_TIME} to ${END_FIRST_QUARTER} for Ape Coin Pool added...`)
        let secondQuarter = await apeCoinStaking.addTimeRange(0, toWei(9_000_000), END_FIRST_QUARTER, END_SECOND_QUARTER, 0)
        await secondQuarter.wait()
        console.log(`Second Quarter from ${END_FIRST_QUARTER} to ${END_SECOND_QUARTER} for Ape Coin Pool added...`)

        let thirdQuarter = await apeCoinStaking.addTimeRange(0, toWei(6_000_000), END_SECOND_QUARTER, END_THIRD_QUARTER, 0)
        await thirdQuarter.wait()
        console.log(`Third Quarter from ${END_SECOND_QUARTER} to ${END_THIRD_QUARTER} for Ape Coin Pool added...`)

        let fourthQuarter = await apeCoinStaking.addTimeRange(0, toWei(4_500_000), END_THIRD_QUARTER, END_FOURTH_QUARTER, 0)
        await fourthQuarter.wait()
        console.log(`Fourth Quarter from ${END_THIRD_QUARTER} to ${END_FOURTH_QUARTER} for Ape Coin Pool added...\n`)


        // BAYC Pool
        firstQuarter = await apeCoinStaking.addTimeRange(1, toWei(16_486_750), START_TIME, END_FIRST_QUARTER, toWei(10_094))
        await firstQuarter.wait()
        console.log(`First Quarter from ${START_TIME} to ${END_FIRST_QUARTER} for BAYC Pool added...`)

        secondQuarter = await apeCoinStaking.addTimeRange(1, toWei(14_131_500), END_FIRST_QUARTER, END_SECOND_QUARTER, toWei(10_094))
        await secondQuarter.wait()
        console.log(`Second Quarter from ${END_FIRST_QUARTER} to ${END_SECOND_QUARTER} for BAYC Pool added...`)

        thirdQuarter = await apeCoinStaking.addTimeRange(1, toWei(9_421_000), END_SECOND_QUARTER, END_THIRD_QUARTER, toWei(10_094))
        await thirdQuarter.wait()
        console.log(`Third Quarter from ${END_SECOND_QUARTER} to ${END_THIRD_QUARTER} for BAYC Pool added...`)

        fourthQuarter = await apeCoinStaking.addTimeRange(1, toWei(7_065_750), END_THIRD_QUARTER, END_FOURTH_QUARTER, toWei(10_094))
        await fourthQuarter.wait()
        console.log(`Fourth Quarter from ${END_THIRD_QUARTER} to ${END_FOURTH_QUARTER} for BAYC Pool added...\n`)


        // MAYC Pool
        firstQuarter = await apeCoinStaking.addTimeRange(2, toWei(6_671_000), START_TIME, END_FIRST_QUARTER, toWei(2042))
        await firstQuarter.wait()
        console.log(`First Quarter from ${START_TIME} to ${END_FIRST_QUARTER} for MAYC Pool added...`)

        secondQuarter = await apeCoinStaking.addTimeRange(2, toWei(5_718_000), END_FIRST_QUARTER, END_SECOND_QUARTER, toWei(2042))
        await secondQuarter.wait()
        console.log(`Second Quarter from ${END_FIRST_QUARTER} to ${END_SECOND_QUARTER} for MAYC Pool added...`)

        thirdQuarter = await apeCoinStaking.addTimeRange(2, toWei(3_812_000), END_SECOND_QUARTER, END_THIRD_QUARTER, toWei(2042))
        await thirdQuarter.wait()
        console.log(`Third Quarter from ${END_SECOND_QUARTER} to ${END_THIRD_QUARTER} for MAYC Pool added...`)

        fourthQuarter = await apeCoinStaking.addTimeRange(2, toWei(2_859_000), END_THIRD_QUARTER, END_FOURTH_QUARTER, toWei(2042))
        await fourthQuarter.wait()
        console.log(`Fourth Quarter from ${END_THIRD_QUARTER} to ${END_FOURTH_QUARTER} for MAYC Pool added...\n`)


        // BAKC Pool
        firstQuarter = await apeCoinStaking.addTimeRange(3, toWei(1_342_250), START_TIME, END_FIRST_QUARTER, toWei(856))
        await firstQuarter.wait()
        console.log(`First Quarter from ${START_TIME} to ${END_FIRST_QUARTER} for BAKC Pool added...`)

        secondQuarter = await apeCoinStaking.addTimeRange(3, toWei(1_150_500), END_FIRST_QUARTER, END_SECOND_QUARTER, toWei(856))
        await secondQuarter.wait()
        console.log(`Second Quarter from ${END_FIRST_QUARTER} to ${END_SECOND_QUARTER} for BAKC Pool added...`)

        thirdQuarter = await apeCoinStaking.addTimeRange(3, toWei(767_000), END_SECOND_QUARTER, END_THIRD_QUARTER, toWei(856))
        await thirdQuarter.wait()
        console.log(`Third Quarter from ${END_SECOND_QUARTER} to ${END_THIRD_QUARTER} for BAKC Pool added...`)

        fourthQuarter = await apeCoinStaking.addTimeRange(3, toWei(575_250), END_THIRD_QUARTER, END_FOURTH_QUARTER, toWei(856))
        await fourthQuarter.wait()
        console.log(`Fourth Quarter from ${END_THIRD_QUARTER} to ${END_FOURTH_QUARTER} for BAKC Pool added...\n`)
    }
    console.log('------------');
};

export default func;
func.tags = ['ApeCoinStakingMock'];
