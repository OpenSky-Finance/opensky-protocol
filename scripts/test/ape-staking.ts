import { expect } from 'chai';
import { arrayify, parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { MAX_UINT_256, ONE_ETH, ONE_YEAR } from '../helpers/constants';
import { advanceTimeAndBlock } from '../helpers/utils';
import { __setup } from './__setup';

async function depositBAYC(ENV: any) {
    const { OpenSkyApeCoinStakingHelper, borrower, BAYCLoanID } = ENV;
    let ABI = [
        "function depositBAYC((uint256,uint256)[],address)"
    ];
    let iface = new ethers.utils.Interface(ABI);
    let nfts = new Array();
    nfts[0] = [1, parseEther('10')];
    let params = iface.encodeFunctionData(
        "depositBAYC",
        [nfts, borrower.address]
    );
    await borrower.ApeCoin.approve(OpenSkyApeCoinStakingHelper.address, parseEther('10'));
    await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
}

async function depositMAYC(ENV: any) {
    const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, borrower, MAYCLoanID } = ENV;

    let ABI = [
        "function depositMAYC((uint256,uint256)[],address)"
    ];
    let iface = new ethers.utils.Interface(ABI);
    let nfts = new Array();
    nfts[0] = [1, parseEther('10')];
    let params = iface.encodeFunctionData(
        "depositMAYC",
        [nfts, borrower.address]
    );
    await borrower.ApeCoin.approve(OpenSkyApeCoinStakingHelper.address, parseEther('10'));
    await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [MAYCLoanID], arrayify(params));
}

async function depositBAKC(ENV: any) {
    const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, borrower, BAYCLoanID } = ENV;

    let ABI = [
        "function depositBAKC((uint256,uint256,uint256)[],(uint256,uint256,uint256)[],address)"
    ];
    let iface = new ethers.utils.Interface(ABI);
    let baycPairs = new Array();
    baycPairs[0] = [1, 1, parseEther('10')];
    let maycPairs = new Array();
    // maycPairs[0] = [0, 2, parseEther('10')];
    let params = iface.encodeFunctionData(
        "depositBAKC",
        [baycPairs, maycPairs, borrower.address]
    );
    await borrower.ApeCoin.approve(OpenSkyApeCoinStakingHelper.address, parseEther('20'));
    await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 1);
    await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
}

describe('OpenSky Ape Coin Staking Helper', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { borrower } = ENV;
        await borrower.BAYC.mint(10);
        await borrower.MAYC.mint(10);
        await borrower.BAKC.mint(10);

        const { OpenSkyPool, ApeCoinStaking, BAYC, MAYC, user001, user002 } = ENV;

        await user001.UnderlyingAsset.deposit({ value: ONE_ETH.mul(10) });
        await user002.UnderlyingAsset.deposit({ value: ONE_ETH.mul(10) });

        await user001.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH.mul(10));
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH.mul(10));

        await user001.OpenSkyPool.deposit(1, ONE_ETH.mul(10), user001.address, 0);
        await user002.OpenSkyPool.deposit(1, ONE_ETH.mul(10), user001.address, 0);

        await borrower.ApeCoin.mint(borrower.address, parseEther('100000'));
        await borrower.ApeCoin.mint(ApeCoinStaking.address, parseEther('1000000000000000'));

        let amount = parseEther('1.5');
        await borrower.BAYC.approve(OpenSkyPool.address, 1);
        await borrower.OpenSkyPool.borrow(
            1,
            amount,
            ONE_YEAR,
            BAYC.address,
            1,
            borrower.address
        );
        ENV.BAYCLoanID = 1;

        await borrower.MAYC.approve(OpenSkyPool.address, 1);
        await borrower.OpenSkyPool.borrow(
            1,
            amount,
            ONE_YEAR,
            MAYC.address,
            1,
            borrower.address
        );
        ENV.MAYCLoanID = 2;

        await ApeCoinStaking.addTimeRange(1, parseEther('10000000'), 1666576800, 1689181200, parseEther('10000'));
        await ApeCoinStaking.addTimeRange(2, parseEther('10000000'), 1666576800, 1689181200, parseEther('5000'));
        await ApeCoinStaking.addTimeRange(3, parseEther('10000000'), 1666576800, 1689181200, parseEther('12000'));
    })

    it('should deposit BAYC', async function () {
        const { ApeCoinStaking } = ENV;

        await depositBAYC(ENV);

        const nftPosition = await ApeCoinStaking.nftPosition(1, 1);
        expect(nftPosition.stakedAmount).to.be.equal(parseEther('10'));
    });

    it('should deposit MAYC', async function () {
        const { ApeCoinStaking } = ENV;

        await depositMAYC(ENV);

        const nftPosition = await ApeCoinStaking.nftPosition(2, 1);
        expect(nftPosition.stakedAmount).to.be.equal(parseEther('10'));
    });

    it('should deposit BAKC with BAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, borrower, BAYCLoanID } = ENV;

        let ABI = [
            "function depositBAKC((uint256,uint256,uint256)[],(uint256,uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let baycPairs = new Array();
        baycPairs[0] = [1, 1, parseEther('10')];
        let maycPairs = new Array();
        // maycPairs[0] = [0, 2, parseEther('10')];
        let params = iface.encodeFunctionData(
            "depositBAKC",
            [baycPairs, maycPairs, borrower.address]
        );
        await borrower.ApeCoin.approve(OpenSkyApeCoinStakingHelper.address, parseEther('20'));
        await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 1);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));

        const nftPosition = await ApeCoinStaking.nftPosition(3, 1);
        expect(nftPosition.stakedAmount).to.be.equal(parseEther('10'));
    });

    it('should deposit BAKC with MAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, borrower, MAYCLoanID } = ENV;

        let ABI = [
            "function depositBAKC((uint256,uint256,uint256)[],(uint256,uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let baycPairs = new Array();
        let maycPairs = new Array();
        maycPairs[0] = [1, 2, parseEther('10')];
        let params = iface.encodeFunctionData(
            "depositBAKC",
            [baycPairs, maycPairs, borrower.address]
        );
        await borrower.ApeCoin.approve(OpenSkyApeCoinStakingHelper.address, parseEther('20'));
        await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 2);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [MAYCLoanID], arrayify(params));

        const nftPosition = await ApeCoinStaking.nftPosition(3, 2);
        expect(nftPosition.stakedAmount).to.be.equal(parseEther('10'));
    });

    it('should claim BAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function claimBAYC(uint256[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let params = iface.encodeFunctionData(
            "claimBAYC",
            [[1], borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(1, 1);
        const pool = await ApeCoinStaking.pools(1);
        const rewards = (await ApeCoinStaking.rewardsBy(
            1,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed)).to.be.equal(BalanceAfterTx);
    });

    it('should claim MAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, MAYCLoanID } = ENV;

        await depositMAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function claimMAYC(uint256[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let params = iface.encodeFunctionData(
            "claimMAYC",
            [[1], borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(2, 1);
        const pool = await ApeCoinStaking.pools(2);
        const rewards = (await ApeCoinStaking.rewardsBy(
            2,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [MAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed)).to.be.equal(BalanceAfterTx);
    });

    it('should claim BAKC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAKC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function claimBAKC((uint256,uint256)[],(uint256,uint256)[],address)"
        ];

        let baycPairs = new Array();
        baycPairs[0] = [1, 1];
        let maycPairs = new Array();
        let iface = new ethers.utils.Interface(ABI);
        let params = iface.encodeFunctionData(
            "claimBAKC",
            [baycPairs, maycPairs, borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(3, 1);
        const pool = await ApeCoinStaking.pools(3);
        const rewards = (await ApeCoinStaking.rewardsBy(
            3,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 1);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed)).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw BAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawBAYC((uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let nfts = new Array();
        nfts[0] = [1, parseEther('2')];
        let params = iface.encodeFunctionData(
            "withdrawBAYC",
            [nfts, borrower.address]
        );

        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(parseEther('2'))).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw BAYC all', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawBAYC((uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let nfts = new Array();
        nfts[0] = [1, parseEther('10')];
        let params = iface.encodeFunctionData(
            "withdrawBAYC",
            [nfts, borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(1, 1);
        const pool = await ApeCoinStaking.pools(1);
        const rewards = (await ApeCoinStaking.rewardsBy(
            1,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed).add(nftPosition.stakedAmount)).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw MAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, MAYCLoanID } = ENV;

        await depositMAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawMAYC((uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let nfts = new Array();
        nfts[0] = [1, parseEther('2')];
        let params = iface.encodeFunctionData(
            "withdrawMAYC",
            [nfts, borrower.address]
        );

        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [MAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(parseEther('2'))).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw MAYC all', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, MAYCLoanID } = ENV;

        await depositMAYC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawMAYC((uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let nfts = new Array();
        nfts[0] = [1, parseEther('10')];
        let params = iface.encodeFunctionData(
            "withdrawMAYC",
            [nfts, borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(2, 1);
        const pool = await ApeCoinStaking.pools(2);
        const rewards = (await ApeCoinStaking.rewardsBy(
            2,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [MAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed).add(nftPosition.stakedAmount)).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw BAKC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAKC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawBAKC((uint256,uint256,uint256)[],(uint256,uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let baycPairs = new Array();
        baycPairs[0] = [1, 1, parseEther('2')];
        let maycPairs = new Array();
        let params = iface.encodeFunctionData(
            "withdrawBAKC",
            [baycPairs, maycPairs, borrower.address]
        );

        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 1);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(parseEther('2'))).to.be.equal(BalanceAfterTx);
    });

    it('should withdraw BAKC all', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoinStaking, ApeCoin, borrower, BAYCLoanID } = ENV;

        await depositBAKC(ENV);

        await advanceTimeAndBlock(24 * 3600);

        let ABI = [
            "function withdrawBAKC((uint256,uint256,uint256)[],(uint256,uint256,uint256)[],address)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        let baycPairs = new Array();
        baycPairs[0] = [1, 1, parseEther('10')];
        let maycPairs = new Array();
        let params = iface.encodeFunctionData(
            "withdrawBAKC",
            [baycPairs, maycPairs, borrower.address]
        );

        const nftPosition = await ApeCoinStaking.nftPosition(3, 1);
        const pool = await ApeCoinStaking.pools(3);
        const rewards = (await ApeCoinStaking.rewardsBy(
            3,
            pool.lastRewardedTimestampHour.toString(),
            parseInt(pool.lastRewardedTimestampHour.toString()) + 24 * 3600
        ))[0];
        const accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare.add(rewards.mul(ONE_ETH).div(pool.stakedAmount));
        
        const accumulatedApeCoins = nftPosition.stakedAmount.mul(accumulatedRewardsPerShare);
        const rewardsToBeClaimed = accumulatedApeCoins.sub(nftPosition.rewardsDebt).div(ONE_ETH);
        const BalanceBeforeTx = await ApeCoin.balanceOf(borrower.address);
        await borrower.BAKC.approve(OpenSkyApeCoinStakingHelper.address, 1);
        await borrower.OpenSkyLoan.flashClaim(OpenSkyApeCoinStakingHelper.address, [BAYCLoanID], arrayify(params));
        const BalanceAfterTx = await ApeCoin.balanceOf(borrower.address);
        expect(BalanceBeforeTx.add(rewardsToBeClaimed).add(nftPosition.stakedAmount)).to.be.equal(BalanceAfterTx);
    });

});
