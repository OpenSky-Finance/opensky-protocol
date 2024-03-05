import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from '../../helpers/chai';
import { __setup } from './__setup';
import { increaseTime, waitForTx, getBlockTimestamp } from '../../helpers/utils';
import { MAX_UINT_AMOUNT } from './helpers/constants';
import {ONE_ETH} from "../../helpers/constants";

export async function deposit(user: any, reserveId: number, amount: BigNumber) {
    await user.UnderlyingAsset.deposit({ value: amount });
    await user.UnderlyingAsset.approve(user.OpenSkyPool.address, amount);
    await user.OpenSkyPool.deposit(reserveId, amount, user.address, 0);
}

describe('incentives.pool.lender', function () {
    let ENV: any;
    
    beforeEach(async () => {
        ENV = await __setup();
        
        // init
        const { OpenSkySettings, OpenSkyPoolIncentivesControllerLender, TestERC20: rewardToken, 
            deployer, user001, user002, user003:rewardsVault } = ENV
        
        // reward
        await OpenSkyPoolIncentivesControllerLender.setRewardsVault(rewardsVault.address)
        await rewardToken.mint(rewardsVault.address, 1000000)
        await waitForTx(
            await rewardsVault.TestERC20.approve(OpenSkyPoolIncentivesControllerLender.address, MAX_UINT_AMOUNT)
        );
        // distribution
        const distributionDuration = ((await getBlockTimestamp()) + 10000).toString();
        await OpenSkyPoolIncentivesControllerLender.setDistributionEnd(distributionDuration)
        
        console.log('OpenSkyPoolIncentivesControllerLender', OpenSkyPoolIncentivesControllerLender.address)
       
        // set controller
        await OpenSkySettings.initIncentiveControllerAddress(OpenSkyPoolIncentivesControllerLender.address)

        expect(await OpenSkyPoolIncentivesControllerLender.getRewardsVault()).to.eq(rewardsVault.address)
        expect(await OpenSkyPoolIncentivesControllerLender.REWARD_TOKEN()).to.eq(rewardToken.address)
    })
    
    it('can config asset', async () => {
        const { OpenSkyPoolIncentivesControllerLender, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault } = ENV
        
        expect( user001.OpenSkyPoolIncentivesControllerLender.configureAssets([], [])).to.be.revertedWith("ONLY_EMISSION_MANAGER")
        
        await deployer.OpenSkyPoolIncentivesControllerLender.configureAssets([], [])
        
    })
    
    it.only('can accrue and claim reward when only one user', async () => {
        const { OpenSkyPoolIncentivesControllerLender, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault, oWETH, oDAI } = ENV
        const INFO:any ={}


        await user001.OpenSkyWETHGateway.deposit('1', user001.address, 0, { value: ONE_ETH });
        await deployer.OpenSkyPoolIncentivesControllerLender.configureAssets([oWETH.address], [100])
        
        INFO.start =await getBlockTimestamp()

        await increaseTime(1000)
        await user001.OpenSkyPoolIncentivesControllerLender.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)

        INFO.start_2 =await getBlockTimestamp()

        INFO.getRewardsBalance = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)
        INFO.start_3 =await getBlockTimestamp()

        await increaseTime(9000)
        await user001.OpenSkyPoolIncentivesControllerLender.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)

        INFO.end =await getBlockTimestamp()


        INFO.getRewardsBalance2 = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)

        
        // await user001.OpenSkyPoolIncentivesControllerLender.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)


        INFO.getRewardsBalance3 = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)

        INFO.rewardTokenAmount =  await rewardToken.balanceOf(user001.address)
        INFO.rewardTokenAmount_rewardsVault =  await rewardToken.balanceOf(rewardsVault.address)

        
        INFO.REWARD_TOKEN = await OpenSkyPoolIncentivesControllerLender.REWARD_TOKEN()
        

        console.log(INFO)

    })

    it('can accrue and claim reward when more than one user', async () => {
        const { OpenSkyPoolIncentivesControllerLender, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault, oWETH, oDAI } = ENV

        expect(await OpenSkyPoolIncentivesControllerLender.getRewardsVault()).to.eq(rewardsVault.address)
        expect(await OpenSkyPoolIncentivesControllerLender.REWARD_TOKEN()).to.eq(rewardToken.address)


        await user001.OpenSkyWETHGateway.deposit('1', user001.address, 0, { value: ONE_ETH });
        await user002.OpenSkyWETHGateway.deposit('1', user002.address, 0, { value: ONE_ETH });

        await deployer.OpenSkyPoolIncentivesControllerLender.configureAssets([oWETH.address], [100])

        await increaseTime(1000)


        const INFO:any ={}
        await increaseTime(9000)

        INFO.getRewardsBalance = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)
        INFO.getRewardsBalance2 = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)


        await user001.OpenSkyPoolIncentivesControllerLender.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)
        await user002.OpenSkyPoolIncentivesControllerLender.claimRewardsToSelf([oWETH.address],MAX_UINT_AMOUNT)


        INFO.getRewardsBalance3 = await user001.OpenSkyPoolIncentivesControllerLender.getRewardsBalance([oWETH.address], user001.address)

        INFO.rewardTokenAmount_user001 =  await rewardToken.balanceOf(user001.address)
        INFO.rewardTokenAmount_user002 =  await rewardToken.balanceOf(user002.address)

        INFO.rewardTokenAmount_rewardsVault =  await rewardToken.balanceOf(rewardsVault.address)


        INFO.REWARD_TOKEN = await OpenSkyPoolIncentivesControllerLender.REWARD_TOKEN()


        console.log(INFO)

    })
    

})
