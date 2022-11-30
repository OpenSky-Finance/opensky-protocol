import { arrayify, parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { ONE_ETH, ONE_YEAR } from '../helpers/constants';
import { __setup } from './__setup';

describe('OpenSky Ape Coin Staking', function () {
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
