import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from '../../helpers/chai';
import { __setup } from './__setup';
import { increaseTime, waitForTx, getBlockTimestamp } from '../../helpers/utils';


import { eventChecker } from './helpers/comparator-engine';

import { getUserIndex } from './DistributionManager/data-helpers/asset-user-data';
import { assetDataComparator, getAssetsData } from './DistributionManager/data-helpers/asset-data';
import { getRewards } from './DistributionManager/data-helpers/base-math';


describe('incentives.pool.lender', function () {
    let ENV: any;
    
    beforeEach(async () => {
        ENV = await __setup();
        
        // init
        const { OpenSkyPoolIncentivesControllerLender, TestERC20: rewardToken, 
            deployer, user001, user002, user003:rewardsVault } = ENV
        
        
        await OpenSkyPoolIncentivesControllerLender.initialize(rewardsVault.address)
        
        await rewardToken.mint(rewardsVault.address, parseEther('10000'))
        
        
        // deposit
        // reward
        
    })

    it('Tries to submit config updates not from emission manager', async () => {
        const { OpenSkyPoolIncentivesControllerLender, oWETH, oDAI, user001 } = ENV;
        await expect(
            user001.OpenSkyPoolIncentivesControllerLender.configureAssets([], [])
        ).to.be.revertedWith('ONLY_EMISSION_MANAGER');
    });
    

    it('handleAction All 0', async function () {
        const { OpenSkyPoolIncentivesControllerLender:pullRewardsIncentivesController,
            aWETH, oWETH, oDAI,user001 } = ENV;

        const userAddress = user001.address;
        const underlyingAsset = aWETH.address;
        
        const config = {
            caseName: 'All 0',
            emissionPerSecond: '0',
            userBalance: '0',
            totalSupply: '0',
            customTimeMovement:0
        }
        
        const {caseName,
            totalSupply,
            userBalance,
            customTimeMovement,
            emissionPerSecond} = config
        
        await increaseTime(100);

        await pullRewardsIncentivesController.configureAssets(
            [underlyingAsset],
            [config.emissionPerSecond]
        );
        
        
        const distributionEndTimestamp = await pullRewardsIncentivesController.DISTRIBUTION_END();

        const rewardsBalanceBefore = await pullRewardsIncentivesController.getUserUnclaimedRewards(
            userAddress
        );

        const userIndexBefore = await getUserIndex(
            pullRewardsIncentivesController,
            userAddress,
            underlyingAsset
        );
        const assetDataBefore = (
            await getAssetsData(pullRewardsIncentivesController, [underlyingAsset])
        )[0];

        if (customTimeMovement) {
            await increaseTime(customTimeMovement);
        }
        
        // doing
        const handleActionReceipt = await waitForTx(
            await aWETH.handleActionOnAic(userAddress, totalSupply, userBalance)
        );
        const eventsEmitted = handleActionReceipt.events || [];
        const actionBlockTimestamp = await getBlockTimestamp(handleActionReceipt.blockNumber);

        
        const userIndexAfter = await getUserIndex(
            pullRewardsIncentivesController,
            userAddress,
            underlyingAsset
        );

        const assetDataAfter = (
            await getAssetsData(pullRewardsIncentivesController, [underlyingAsset])
        )[0];
        const expectedAccruedRewards = getRewards(
            userBalance,
            userIndexAfter,
            userIndexBefore
        ).toString();
        
        const rewardsBalanceAfter = await pullRewardsIncentivesController.getUserUnclaimedRewards(
            userAddress
        );

        // ------- Distribution Manager tests START -----
        await assetDataComparator(
            { underlyingAsset, totalStaked: totalSupply },
            assetDataBefore,
            assetDataAfter,
            actionBlockTimestamp,
            distributionEndTimestamp.toNumber(),
            {}
        );


        console.log({distributionEndTimestamp, rewardsBalanceBefore, userIndexAfter, assetDataAfter, expectedAccruedRewards})

    })
})
