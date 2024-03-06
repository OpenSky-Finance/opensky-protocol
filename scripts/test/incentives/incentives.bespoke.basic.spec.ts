import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';

import { expect } from '../../helpers/chai';
import { increaseTime, waitForTx, getBlockTimestamp } from '../../helpers/utils';
import {ONE_ETH, ONE_YEAR} from "../../helpers/constants";
import { createOfferData } from '../../helpers/utils.bespoke';

import { MAX_UINT_AMOUNT } from './helpers/constants';
import { __setup } from './__setup';

export async function deposit(user: any, reserveId: number, amount: BigNumber) {
    await user.UnderlyingAsset.deposit({ value: amount });
    await user.UnderlyingAsset.approve(user.OpenSkyPool.address, amount);
    await user.OpenSkyPool.deposit(reserveId, amount, user.address, 0);
}

describe('incentives.bespoke', function () {
    let ENV: any;

    beforeEach(async () => {
        ENV = await __setup();

        const { OpenSkySettings, OpenSkyBespokeIncentivesControllerLender,OpenSkyBespokeIncentivesControllerBorrower, 
            OpenSkyBespokeMarket, OpenSkyBespokeSettings,
            TransferAdapterERC721Default,
            TestERC20: rewardToken,
            deployer, user001, user002, borrower, user003:rewardsVault } = ENV

        // set controller
        await OpenSkyBespokeSettings.initIncentiveControllerAddressLend(OpenSkyBespokeIncentivesControllerLender.address)
        await OpenSkyBespokeSettings.initIncentiveControllerAddressBorrow(OpenSkyBespokeIncentivesControllerBorrower.address)

        // init
        await OpenSkyBespokeIncentivesControllerLender.initialize(rewardsVault.address, OpenSkyBespokeMarket.address)
        await OpenSkyBespokeIncentivesControllerBorrower.initialize(rewardsVault.address, OpenSkyBespokeMarket.address)

        // reward
        await rewardToken.mint(rewardsVault.address, 1000000*2)
        await waitForTx(
            await rewardsVault.TestERC20.approve(OpenSkyBespokeIncentivesControllerLender.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
            await rewardsVault.TestERC20.approve(OpenSkyBespokeIncentivesControllerBorrower.address, MAX_UINT_AMOUNT)
        );
        
        // distribution
        const distributionDuration = ((await getBlockTimestamp()) + 10000).toString();
        await OpenSkyBespokeIncentivesControllerLender.setDistributionEnd(distributionDuration)
        await OpenSkyBespokeIncentivesControllerBorrower.setDistributionEnd(distributionDuration)
        
        expect(await OpenSkyBespokeIncentivesControllerLender.getRewardsVault()).to.eq(rewardsVault.address)
        expect(await OpenSkyBespokeIncentivesControllerLender.REWARD_TOKEN()).to.eq(rewardToken.address)
        expect(await OpenSkyBespokeIncentivesControllerBorrower.getRewardsVault()).to.eq(rewardsVault.address)
        expect(await OpenSkyBespokeIncentivesControllerBorrower.REWARD_TOKEN()).to.eq(rewardToken.address)
        
        //for bespoke loan
        // @ts-ignore
        const borrowerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_6_KEY, ethers.provider);
        ENV.borrowerWallet = borrowerWallet;
        const BORROW_AMOUNT = parseEther('1');
        const BORROW_DURATION = 24 * 3600 * 7;
        ENV.SUPPLY_BORROW_AMOUNT = BORROW_AMOUNT.add(parseEther('1'));
        ENV.SUPPLY_BORROW_DURATION = BORROW_DURATION + 24 * 3600 * 10;
        await borrower.OpenSkyNFT.setApprovalForAll(TransferAdapterERC721Default.address, true);

    })

    it('can config asset', async () => {
        const { OpenSkyBespokeIncentivesControllerLender, OpenSkyBespokeIncentivesControllerBorrower, TestERC20: rewardToken,
            deployer, user001, user002, user003:rewardsVault } = ENV

        expect( user001.OpenSkyBespokeIncentivesControllerLender.configureAssets([], [])).to.be.revertedWith("ONLY_EMISSION_MANAGER")
        expect( user001.OpenSkyBespokeIncentivesControllerBorrower.configureAssets([], [])).to.be.revertedWith("ONLY_EMISSION_MANAGER")

        await deployer.OpenSkyBespokeIncentivesControllerLender.configureAssets([], [])
        await deployer.OpenSkyBespokeIncentivesControllerBorrower.configureAssets([], [])

    })

    it('can accrue and claim reward for both borrower and lender', async () => {
        const { OpenSkyBespokeMarket, OpenSkyBespokeIncentivesControllerLender, OpenSkyBespokeIncentivesControllerBorrower, OpenSkyNFT, TestERC20: rewardToken,
            deployer, user001:lender, user002, borrower, borrowerWallet,  user003:rewardsVault, oWETH, oDAI, WNative,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
        } = ENV
        const INFO:any ={}

        INFO.start =await getBlockTimestamp()
        
        // borrower create offer
        const OfferData = createOfferData(
            ENV,
            { offerType: 0, currency: WNative.address, lendAsset: ethers.constants.AddressZero },
            borrowerWallet
        );

        // deposit
        await lender.WNative.deposit({ value: ENV.SUPPLY_BORROW_AMOUNT });
        await lender.WNative.approve(OpenSkyBespokeMarket.address, ethers.constants.MaxUint256);
        
        // take offer
        await lender.OpenSkyBespokeMarket.takeBorrowOffer(
            OfferData,
            SUPPLY_BORROW_AMOUNT,
            SUPPLY_BORROW_DURATION,
            WNative.address,
            false
        );
        expect(await OpenSkyNFT.ownerOf(1)).eq(ENV.TransferAdapterERC721Default.address);
        expect(await WNative.balanceOf(borrower.address)).eq(SUPPLY_BORROW_AMOUNT);
        
        
        // config incentive 
        await deployer.OpenSkyBespokeIncentivesControllerLender.configureAssets([WNative.address], [100])
        await deployer.OpenSkyBespokeIncentivesControllerBorrower.configureAssets([WNative.address], [100])
        

        await increaseTime(1000)
        await borrower.OpenSkyBespokeIncentivesControllerBorrower.claimRewardsToSelf([WNative.address],MAX_UINT_AMOUNT)
        await lender.OpenSkyBespokeIncentivesControllerLender.claimRewardsToSelf([WNative.address],MAX_UINT_AMOUNT)

        INFO.start_2 =await getBlockTimestamp()

        INFO.getRewardsBalance_borrower = await lender.OpenSkyBespokeIncentivesControllerBorrower.getRewardsBalance([WNative.address], borrower.address)
        INFO.getRewardsBalance_lender = await lender.OpenSkyBespokeIncentivesControllerLender.getRewardsBalance([WNative.address], lender.address)

        INFO.start_3 =await getBlockTimestamp()

        await increaseTime(9000)
        await borrower.OpenSkyBespokeIncentivesControllerBorrower.claimRewardsToSelf([WNative.address],MAX_UINT_AMOUNT)
        await lender.OpenSkyBespokeIncentivesControllerLender.claimRewardsToSelf([WNative.address],MAX_UINT_AMOUNT)

        INFO.end =await getBlockTimestamp()
        
        INFO.rewardTokenAmount_lender =  await rewardToken.balanceOf(lender.address)
        INFO.rewardTokenAmount_borrower =  await rewardToken.balanceOf(borrower.address)
        INFO.rewardTokenAmount_rewardsVault =  await rewardToken.balanceOf(rewardsVault.address)
        
        
        // ignore margin (less than 10s)
        expect(INFO.rewardTokenAmount_lender).gt(10000*100 - 10*100)
        expect(INFO.rewardTokenAmount_borrower).gt(10000*100 - 10*100)
        expect(INFO.rewardTokenAmount_rewardsVault).lt(100*100)

        // console.log(INFO)

    })



})
