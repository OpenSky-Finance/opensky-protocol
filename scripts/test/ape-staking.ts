import { expect } from 'chai';
import { arrayify, parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { MAX_UINT_256, ONE_ETH, ONE_YEAR } from '../helpers/constants';
import { advanceTimeAndBlock } from '../helpers/utils';
import { __setup } from './__setup';

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
        console.log('before borrow', await MAYC.ownerOf(1));
        await borrower.OpenSkyPool.borrow(
            1,
            amount,
            ONE_YEAR,
            MAYC.address,
            1,
            borrower.address
        );
        ENV.MAYCLoanID = 2;
        console.log('after borrow', await MAYC.ownerOf(1));

        await ApeCoinStaking.addTimeRange(1, parseEther('10000000'), 1666576800, 1689181200, parseEther('10000'));
        await ApeCoinStaking.addTimeRange(2, parseEther('10000000'), 1666576800, 1689181200, parseEther('5000'));
    })

    it('should deposit BAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, ApeCoin, borrower, BAYCLoanID } = ENV;

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
    });

    it('should deposit MAYC', async function () {
        const { OpenSkyApeCoinStakingHelper, borrower, MAYCLoanID } = ENV;

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
    });

    it('should deposit BAKC', async function () {
        const { OpenSkyApeCoinStakingHelper, borrower, MAYCLoanID } = ENV;

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
    });

    it('should deposit BAKC', async function () {});

    it('should claim BAYC', async function () {});

    it('should claim MAYC', async function () {});

    it('should claim BAKC', async function () {});

    it('should withdraw BAYC', async function () {});

    it('should withdraw MAYC', async function () {});

    it('should withdraw BAKC', async function () {});

});

describe.only('OpenSky Ape Coin Staking', function () {
    let ENV: any;
    before(async () => {
        ENV = await __setup();
        const { user001, user002, OpenSkyApeCoinStaking, ApeCoinStaking } = ENV;
        await user001.ApeCoin.mint(ApeCoinStaking.address, parseEther('1000000000000'));

        await user001.ApeCoin.mint(user001.address, parseEther('100000'));
        await user001.ApeCoin.approve(OpenSkyApeCoinStaking.address, MAX_UINT_256);
 
        await user002.ApeCoin.mint(user002.address, parseEther('100000'));
        await user002.ApeCoin.approve(OpenSkyApeCoinStaking.address, MAX_UINT_256);
 
        await ApeCoinStaking.addTimeRange(0, parseEther('10000000'), 1666576800, 1689181200, parseEther('10000'));
    });

    it('should deposit ape coin', async function () {
        const { user001, user002, OpenSkyApeCoinStaking, ApeCoinStaking } = ENV;

        await user001.OpenSkyApeCoinStaking["deposit(uint256,address)"](parseEther('1000'), user001.address);
        expect(await OpenSkyApeCoinStaking.balanceOf(user001.address)).eq(parseEther('1000'));
        {
            const userProxy = await OpenSkyApeCoinStaking.userProxies(user001.address);
            const DashboardStake = await ApeCoinStaking.getApeCoinStake(userProxy);
            expect(DashboardStake.deposited).eq(parseEther('1000'));
        }

        await user002.OpenSkyApeCoinStaking["deposit(uint256,address)"](parseEther('100'), user002.address);
        expect(await OpenSkyApeCoinStaking.balanceOf(user002.address)).eq(parseEther('100'));
        {
            const userProxy = await OpenSkyApeCoinStaking.userProxies(user002.address);
            const DashboardStake = await ApeCoinStaking.getApeCoinStake(userProxy);
            expect(DashboardStake.deposited).eq(parseEther('100'));
        }
    });

    it('should claim ape coin rewards', async function () {
        const { user001, OpenSkyApeCoinStaking, ApeCoinStaking, ApeCoin } = ENV;

        await advanceTimeAndBlock(30 * 24 * 3600);
        const userProxy = await OpenSkyApeCoinStaking.userProxies(user001.address);
        const DashboardStake = await ApeCoinStaking.getApeCoinStake(userProxy);
        const BalanceBeforeTx = await ApeCoin.balanceOf(user001.address);
        await user001.OpenSkyApeCoinStaking["claim(address)"](user001.address);
        expect(await ApeCoin.balanceOf(user001.address)).eq(BalanceBeforeTx.add(DashboardStake.unclaimed));
    });

    it('should not claim ape coin rewards if user has not deposited', async function () {
        const { user003 } = ENV;

        await advanceTimeAndBlock(30 * 24 * 3600);
        await expect(user003.OpenSkyApeCoinStaking["claim(address)"](user003.address)).to.revertedWith('HAS_NO_PROXY');
    });

    it('should withdraw ape coin', async function () {
        const { user001, OpenSkyApeCoinStaking, ApeCoin } = ENV;

        const BalanceBeforeTx = await ApeCoin.balanceOf(user001.address);
        await user001.OpenSkyApeCoinStaking["withdraw(uint256,address)"](parseEther('100'), user001.address);
        expect(await OpenSkyApeCoinStaking.balanceOf(user001.address)).eq(parseEther('900'));
        expect(await ApeCoin.balanceOf(user001.address)).eq(BalanceBeforeTx.add(parseEther('100')));
    });

});
