import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from '../../helpers/chai';
import { __setup } from './__setup';
import { increaseTime, waitForTx, getBlockTimestamp } from '../../helpers/utils';
import { MAX_UINT_AMOUNT } from './helpers/constants';
import {ONE_ETH, ONE_YEAR} from "../../helpers/constants";

export async function deposit(user: any, reserveId: number, amount: BigNumber) {
    await user.UnderlyingAsset.deposit({ value: amount });
    await user.UnderlyingAsset.approve(user.OpenSkyPool.address, amount);
    await user.OpenSkyPool.deposit(reserveId, amount, user.address, 0);
}

describe('incentives.pool.lender', function () {
    let ENV: any;

    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkySettings, OpenSkyPoolIncentivesControllerBorrower, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault } = ENV

        // set controller
        await OpenSkySettings.initIncentiveControllerAddressForLoan(OpenSkyPoolIncentivesControllerBorrower.address)
        
        // init
        await OpenSkyPoolIncentivesControllerBorrower.initialize(rewardsVault.address, OpenSkySettings.address)

        // reward
        await rewardToken.mint(rewardsVault.address, 1000000)
        await waitForTx(
            await rewardsVault.TestERC20.approve(OpenSkyPoolIncentivesControllerBorrower.address, MAX_UINT_AMOUNT)
        );
        // distribution
        const distributionDuration = ((await getBlockTimestamp()) + 10000).toString();
        await OpenSkyPoolIncentivesControllerBorrower.setDistributionEnd(distributionDuration)
        
        
        expect(await OpenSkyPoolIncentivesControllerBorrower.getRewardsVault()).to.eq(rewardsVault.address)
        expect(await OpenSkyPoolIncentivesControllerBorrower.REWARD_TOKEN()).to.eq(rewardToken.address)

        //prepare pool
        await deployer.OpenSkyWETHGateway.deposit('1', deployer.address, 0, { value: parseEther('2') });

    })

    it('can config asset', async () => {
        const { OpenSkyPoolIncentivesControllerBorrower, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault } = ENV

        expect( user001.OpenSkyPoolIncentivesControllerBorrower.configureAssets([], [])).to.be.revertedWith("ONLY_EMISSION_MANAGER")

        await deployer.OpenSkyPoolIncentivesControllerBorrower.configureAssets([], [])

    })

    it('can accrue and claim reward when only one user', async () => {
        const { OpenSkyPoolIncentivesControllerBorrower, OpenSkyNFT, TestERC20: rewardToken,
            deployer, user001, user002, borrower, user003:rewardsVault, oWETH, oDAI } = ENV
        const INFO:any ={}

        // borrow
        INFO.start =await getBlockTimestamp()

        await deployer.OpenSkyPoolIncentivesControllerBorrower.configureAssets([oWETH.address], [100])

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1'),
            ONE_YEAR,
            OpenSkyNFT.address,
            1,
            borrower.address
        );
        
        await increaseTime(1000)
        await borrower.OpenSkyPoolIncentivesControllerBorrower.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)

        INFO.start_2 =await getBlockTimestamp()

        INFO.getRewardsBalance = await user001.OpenSkyPoolIncentivesControllerBorrower.getRewardsBalance([oWETH.address], borrower.address)
        INFO.start_3 =await getBlockTimestamp()

        await increaseTime(9000)
        await borrower.OpenSkyPoolIncentivesControllerBorrower.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)

        INFO.end =await getBlockTimestamp()


        INFO.getRewardsBalance2 = await borrower.OpenSkyPoolIncentivesControllerBorrower.getRewardsBalance([oWETH.address], borrower.address)
        

        INFO.getRewardsBalance3 = await borrower.OpenSkyPoolIncentivesControllerBorrower.getRewardsBalance([oWETH.address], borrower.address)
        INFO.rewardTokenAmount_user001 =  await rewardToken.balanceOf(user001.address)
        INFO.rewardTokenAmount_borrower =  await rewardToken.balanceOf(borrower.address)
        INFO.rewardTokenAmount_rewardsVault =  await rewardToken.balanceOf(rewardsVault.address)
        INFO.REWARD_TOKEN = await OpenSkyPoolIncentivesControllerBorrower.REWARD_TOKEN()
        
        // console.log(INFO)
        
        // ignore margin (less than 10s)
        expect(INFO.rewardTokenAmount_borrower).gt(10000*100 - 10*100)
        expect(INFO.rewardTokenAmount_user001).eq(0)
        expect(INFO.rewardTokenAmount_rewardsVault).lt(100*100)

    })



})
