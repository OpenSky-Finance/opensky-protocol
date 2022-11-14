import { formatEther, parseEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    advanceTimeAndBlock,
    getCurrentBlockAndTimestamp,
} from '../helpers/utils';
import _ from 'lodash';

import { __setup, checkPoolEquation, deposit, checkTotalDeposits } from './__setup';
import { Errors, LOAN_STATUS, ONE_ETH, ONE_YEAR } from "../helpers/constants"
import { ethers } from 'hardhat';

describe('loan guarantor', function () {
    let ENV: any;
    before(async () => {
        ENV = await __setup();

        const { user001, user002, borrower, OpenSkyNFT } = ENV;

        await deposit(user001, 1, parseEther('2'));
        await deposit(user002, 1, parseEther('5'));

        await borrower.OpenSkyPool.borrow(1, parseEther('1.5'), ONE_YEAR, OpenSkyNFT.address, 1, borrower.address);
        ENV.loanId = 1;
        ENV.guarantor = user001;
    });

    it('should guarantee', async function () {
        const { OpenSkyGuarantor, OpenSkyOToken, loanId, guarantor } = ENV;

        await guarantor.OpenSkyOToken.approve(OpenSkyGuarantor.address, parseEther('2'));
        await guarantor.OpenSkyGuarantor.guarantee(loanId);

        // expect(
        //     await OpenSkyOToken.balanceOf(OpenSkyGuarantor.address)
        // ).to.be.equal(
        //     await OpenSkyGuarantor.getGuaranteeAmount(loanId)
        // );
        expect(
            await OpenSkyOToken.balanceOf(await OpenSkyGuarantor.userProxies(guarantor.address))
        ).to.be.equal(
            await OpenSkyGuarantor.getGuaranteeAmount(loanId)
        );
        expect(await OpenSkyGuarantor.ownerOf(loanId)).to.be.equal(guarantor.address);
    });

    it('should not guarantee', async function () {
        const { OpenSkyGuarantor, loanId, user002 } = ENV;

        expect((await OpenSkyGuarantor.ownerOf(loanId))).to.not.equal(user002.address);

        await user002.OpenSkyOToken.approve(OpenSkyGuarantor.address, parseEther('2'));
        await expect(
            user002.OpenSkyGuarantor.guarantee(loanId)
        ).to.revertedWith('ERC721: token already minted');
    });

    it('should not claim underlying asset if loan has not been repaid', async function () {
        const { loanId, guarantor } = ENV;

        await expect(
            guarantor.OpenSkyGuarantor.claimUnderlyingAsset(loanId)
        ).to.revertedWith('LOAN_HAS_NOT_BEEN_REPAID');
    });

    it('should not claim NFT if loan is not default', async function () {
        const { guarantor, loanId } = ENV;
        await expect(
            guarantor.OpenSkyGuarantor.claimNFT(loanId)
        ).to.revertedWith(Errors.START_LIQUIDATION_STATUS_ERROR);
    });

    it('should claim underlying asset if loan has been repaid', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyGuarantor, OpenSkyOToken, OpenSkyPool, borrower, guarantor, loanId } = ENV;

        await advanceTimeAndBlock(30 * 24 * 3600);

        await borrower.WNative.deposit({ value: parseEther('2') });
        await borrower.WNative.approve(OpenSkyPool.address, parseEther('2'));
        await borrower.OpenSkyPool.repay(loanId);

        await guarantor.OpenSkyGuarantor.claimUnderlyingAsset(loanId);
        await expect(
            OpenSkyGuarantor.ownerOf(loanId)
        ).to.revertedWith('ERC721: owner query for nonexistent token');
        // expect(await OpenSkyOToken.balanceOf(guarantor.address)).to.be.equal(parseEther('2'));

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should claim NFT if pool liquidity is sufficient', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyNFT, OpenSkyPool, OpenSkyGuarantor, guarantor, user002, loanId } = ENV;

        await advanceTimeAndBlock(ONE_YEAR + 100000);

        await guarantor.OpenSkyGuarantor.claimNFT(loanId);

        await expect(
            OpenSkyGuarantor.ownerOf(loanId)
        ).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(guarantor.address);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should claim NFT if pool liquidity is insufficient', async function () {
        const { OpenSkyNFT, AAVELendingPool, WNative, OpenSkyGuarantor, guarantor, user002, loanId } = ENV;

        await user002.OpenSkyPool.withdraw(1, parseEther('5'), user002.address);
        await user002.WNative.approve(AAVELendingPool.address, parseEther('5'));
        await user002.AAVELendingPool.deposit(WNative.address, parseEther('5'), user002.address, 0);

        await advanceTimeAndBlock(ONE_YEAR + 100000);

        await guarantor.OpenSkyGuarantor.claimNFT(loanId);

        await expect(
            OpenSkyGuarantor.ownerOf(loanId)
        ).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(guarantor.address);
    });

});
