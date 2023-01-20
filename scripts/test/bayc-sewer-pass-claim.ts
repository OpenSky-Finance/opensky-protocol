import { expect } from 'chai';
import { arrayify, defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { MAX_UINT_256, ONE_ETH, ONE_YEAR } from '../helpers/constants';
import { advanceTimeAndBlock, waitForTx } from '../helpers/utils';
import { __setup } from './__setup';

describe('BAYC SEWER PASS CLAIM', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();

        const { user001, borrower, deployer, BAYCSewerPassClaim, OpenSkyPool } = ENV;

        // setting
        await deployer.BAYCSewerPassClaim.flipClaimIsActiveState();
        await deployer.BAYCSewerPass.flipMintIsActiveState();
        await deployer.BAYCSewerPass.toggleMinterContract(BAYCSewerPassClaim.address);

        // prepare claimer
        await borrower.BAYC.mint(10);
        await borrower.MAYC.mint(10);
        await borrower.BAKC.mint(10);
    });

    it.skip('can claim with bayc/mayc/bakc', async function () {
        const { borrower, BAYCSewerPassClaim, BAYCSewerPass } = ENV;
        const mintIndex = await BAYCSewerPass.mintIndex();
        console.log('mintIndex', mintIndex);

        await borrower.BAYCSewerPassClaim.claimBayc(1);
        await borrower.BAYCSewerPassClaim.claimBaycBakc(2, 2);
        await borrower.BAYCSewerPassClaim.claimMaycBakc(3, 3);
        await borrower.BAYCSewerPassClaim.claimMayc(4);

        expect(await BAYCSewerPass.ownerOf(0)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(1)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(2)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(3)).eq(borrower.address);
    });

    it('can claim with bayc/mayc/bakc as a collateral', async function () {
        const {
            user001,
            borrower,
            deployer,
            BAYCSewerPassClaim,
            BAYCSewerPass,
            OpenSkyBAYCSewerPassClaimHelper,
            OpenSkyPool,
            OpenSkyLoan,
            BAYC,
            MAYC,
            BAKC,
        } = ENV;
        
        // deposit
        await user001.UnderlyingAsset.deposit({ value: parseEther('10') });
        await user001.UnderlyingAsset.approve(OpenSkyPool.address, parseEther('10'));
        await user001.OpenSkyPool.deposit(1, parseEther('10'), user001.address, 0);

        await borrower.BAYC.setApprovalForAll(OpenSkyPool.address, true);
        await borrower.MAYC.setApprovalForAll(OpenSkyPool.address, true);

        // borrow
        await borrower.OpenSkyPool.borrow(1, parseEther('1'), ONE_YEAR, MAYC.address, 1, borrower.address);
        await borrower.OpenSkyPool.borrow(1, parseEther('1'), ONE_YEAR, MAYC.address, 2, borrower.address);
        await borrower.OpenSkyPool.borrow(1, parseEther('1'), ONE_YEAR, BAYC.address, 1, borrower.address);
        await borrower.OpenSkyPool.borrow(1, parseEther('1'), ONE_YEAR, BAYC.address, 2, borrower.address);

        expect(await OpenSkyLoan.ownerOf(1)).eq(borrower.address); // tier 1
        expect(await OpenSkyLoan.ownerOf(2)).eq(borrower.address); // tier 2
        expect(await OpenSkyLoan.ownerOf(3)).eq(borrower.address); // tier 3
        expect(await OpenSkyLoan.ownerOf(4)).eq(borrower.address); // tier 4

        // for bakc
        await borrower.BAKC.setApprovalForAll(OpenSkyBAYCSewerPassClaimHelper.address, true);

        // mayc
        await borrower.OpenSkyLoan.flashClaim(
            OpenSkyBAYCSewerPassClaimHelper.address,
            [1],
            defaultAbiCoder.encode(['uint256', 'uint256'], [1, 10000])
        );

        //  mayc + bakc
        await borrower.OpenSkyLoan.flashClaim(
            OpenSkyBAYCSewerPassClaimHelper.address,
            [2],
            defaultAbiCoder.encode(['uint256', 'uint256'], [2, 1])
        );

        // // bayc
        await borrower.OpenSkyLoan.flashClaim(
            OpenSkyBAYCSewerPassClaimHelper.address,
            [3],
            defaultAbiCoder.encode(['uint256', 'uint256'], [3, 10000])
        );

        // bayc + bakc
        await borrower.OpenSkyLoan.flashClaim(
            OpenSkyBAYCSewerPassClaimHelper.address,
            [4],
            defaultAbiCoder.encode(['uint256', 'uint256'], [4, 2])
        );

        // BAYCSewerPass start from 0
        expect(await BAYCSewerPass.ownerOf(0)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(1)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(2)).eq(borrower.address);
        expect(await BAYCSewerPass.ownerOf(3)).eq(borrower.address);

        // bakc
        expect(await BAKC.ownerOf(1)).eq(borrower.address);
        expect(await BAKC.ownerOf(2)).eq(borrower.address);
    });
});
