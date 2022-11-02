import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from './../helpers/chai';
import { __setup, formatEtherAttrs, checkPoolEquation } from './__setup';
import { ENV } from './__types';
import { LOAN_STATUS, AUCTION_STATUS, ONE_YEAR, ONE_ETH, ZERO_ADDRESS } from './../helpers/constants';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp, getTxCost } from './../helpers/utils';

describe('loan delegate', function () {
    let ENV: any;
    before(async () => {
        ENV = await __setup();
        const { OpenSkyPool, OpenSkyNFT, user001, user002, borrower } = ENV;

        await user001.UnderlyingAsset.deposit({ value: ONE_ETH });
        await user002.UnderlyingAsset.deposit({ value: ONE_ETH });

        await user001.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);
        await user002.UnderlyingAsset.approve(OpenSkyPool.address, ONE_ETH);

        await user001.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);
        await user002.OpenSkyPool.deposit(1, ONE_ETH, user001.address, 0);

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            ONE_YEAR,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        ENV.LoanID = 1;
        ENV.NFTAddress = OpenSkyNFT.address;
        ENV.TokenId = 1;
    });

    it('should delegate if delegator is not address 0', async function () {
        const { OpenSkyLoan, OpenSkyLoanDelegator, user001: delegator, borrower, LoanID, NFTAddress, TokenId } = ENV;

        await borrower.OpenSkyLoan.approve(OpenSkyLoanDelegator.address, LoanID);
        await borrower.OpenSkyLoanDelegator.delegate(delegator.address, LoanID);

        expect(await OpenSkyLoan.ownerOf(LoanID)).to.be.equal(OpenSkyLoanDelegator.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(delegator.address);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(borrower.address);
    });

    it('should undelegate', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyLoan, OpenSkyLoanDelegator, borrower, LoanID, NFTAddress, TokenId } = ENV;

        await borrower.OpenSkyLoanDelegator.delegate(ZERO_ADDRESS, LoanID);

        expect(await OpenSkyLoan.ownerOf(LoanID)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should delegate to another delegator', async function () {
        const { OpenSkyLoan, OpenSkyLoanDelegator, user002: anotherDelegator, borrower, LoanID, NFTAddress, TokenId } = ENV;
        await borrower.OpenSkyLoanDelegator.delegate(anotherDelegator.address, LoanID);

        expect(await OpenSkyLoan.ownerOf(LoanID)).to.be.equal(OpenSkyLoanDelegator.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(anotherDelegator.address);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(borrower.address);
    });

    it('should not extend ETH if caller is not delegator or owner', async function () {
        const { user001, user002: delegator, borrower, LoanID } = ENV;

        expect(user001.address).to.not.equal(delegator.address);
        expect(user001.address).to.not.equal(borrower.address);
        await expect(
            user001.OpenSkyLoanDelegator.extendETH(LoanID, parseEther('1'), ONE_YEAR, { value: parseEther('1') })
        ).to.revertedWith('ONLY_OWNER_OR_DELEGATOR');
    });

    it('should extend ETH if caller is delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { user002: delegator, LoanID } = ENV;

        await advanceTimeAndBlock(363 * 24 * 3600);

        await delegator.OpenSkyLoanDelegator.extendETH(LoanID, parseEther('1'), ONE_YEAR, { value: parseEther('1') });

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should not extend if caller is not delegator or owner', async function () {
        const { OpenSkyLoanDelegator, user001, user002: delegator, borrower, LoanID } = ENV;

        expect(user001.address).to.not.equal(delegator.address);
        expect(user001.address).to.not.equal(borrower.address);
        await user001.WNative.deposit({ value: parseEther('1') });
        await user001.WNative.approve(OpenSkyLoanDelegator.address, parseEther('1'));
        await expect(
            user001.OpenSkyLoanDelegator.extend(LoanID, parseEther('1'), ONE_YEAR, parseEther('1'))
        ).to.revertedWith('ONLY_OWNER_OR_DELEGATOR');
    });

    it('should extend if caller is delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyLoan, OpenSkyLoanDelegator, user002: delegator, LoanID } = ENV;

        await advanceTimeAndBlock(363 * 24 * 3600);

        await delegator.WNative.deposit({ value: parseEther('1') });
        await delegator.WNative.approve(OpenSkyLoanDelegator.address, parseEther('1'));
        await delegator.OpenSkyLoanDelegator.extend(LoanID, parseEther('1'), ONE_YEAR, parseEther('1'));

        expect(await OpenSkyLoan.ownerOf(2)).to.be.equal(OpenSkyLoanDelegator.address);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should extend if caller is loan owner', async function () {
        const { OpenSkyLoan, OpenSkyLoanDelegator, borrower, LoanID } = ENV;

        await advanceTimeAndBlock(363 * 24 * 3600);

        await borrower.WNative.deposit({ value: parseEther('1') });
        await borrower.WNative.approve(OpenSkyLoanDelegator.address, parseEther('1'));
        await borrower.OpenSkyLoanDelegator.extend(LoanID, parseEther('1'), ONE_YEAR, parseEther('1'));

        expect(await OpenSkyLoan.ownerOf(2)).to.be.equal(OpenSkyLoanDelegator.address);
    });

    it('should repay eth if the caller is delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyNFT, OpenSkyLoanDelegator, borrower, user002: delegator, NFTAddress, TokenId } = ENV;

        await advanceTimeAndBlock(363 * 24 * 3600);

        await delegator.WNative.deposit({ value: parseEther('2') });
        await delegator.WNative.approve(OpenSkyLoanDelegator.address, parseEther('2'));
        await delegator.OpenSkyLoanDelegator.repayETH(2, { value: parseEther('2') });

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should repay eth if the caller is loan owner', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyLoan, OpenSkyNFT, OpenSkyLoanDelegator, borrower, user002: delegator, NFTAddress, TokenId } = ENV;

        await advanceTimeAndBlock(363 * 24 * 3600);

        await borrower.WNative.deposit({ value: parseEther('2') });
        await borrower.WNative.approve(OpenSkyLoanDelegator.address, parseEther('2'));
        
        await borrower.OpenSkyLoanDelegator.repayETH(
            await OpenSkyLoan.getLoanId(NFTAddress, TokenId),
            { value: parseEther('2') }
        );

        expect(await OpenSkyNFT.ownerOf(1)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should repay if the call is delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);
      
        const { OpenSkyNFT, OpenSkyLoanDelegator, borrower, user002: delegator, NFTAddress, TokenId } = ENV;
      
        await delegator.WNative.deposit({ value: parseEther('2') });
        await delegator.WNative.approve(OpenSkyLoanDelegator.address, parseEther('2'));
        await delegator.OpenSkyLoanDelegator.repay(2, parseEther('2'));
      
        expect(await OpenSkyNFT.ownerOf(TokenId)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
      
        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should repay if the call is owner', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);
      
        const { OpenSkyNFT, OpenSkyLoanDelegator, borrower, user002: delegator, NFTAddress, TokenId } = ENV;
      
        await borrower.WNative.deposit({ value: parseEther('2') });
        await borrower.WNative.approve(OpenSkyLoanDelegator.address, parseEther('2'));
        await borrower.OpenSkyLoanDelegator.repay(2, parseEther('2'));
      
        expect(await OpenSkyNFT.ownerOf(TokenId)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
      
        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should not claim NFT if the caller is not owner or delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoanDelegator, user001, NFTAddress, TokenId } = ENV;
        await user001.WNative.deposit({ value: parseEther('2') });
        await user001.WNative.approve(OpenSkyPool.address, parseEther('2'));
        await user001.OpenSkyPool.repay(2);
        await expect(
            user001.OpenSkyLoanDelegator.claimNFT(NFTAddress, TokenId)
        ).to.revertedWith('ONLY_OWNER_OR_DELEGATOR');

        ethers.provider.send('evm_revert', [SnapshotID]);
    });

    it('should claim NFT if the caller is owner or delegator', async function () {
        const SnapshotID = await ethers.provider.send('evm_snapshot', []);

        const { OpenSkyNFT, OpenSkyPool, OpenSkyLoanDelegator, borrower, user002: delegator, NFTAddress, TokenId } = ENV;
        await borrower.WNative.deposit({ value: parseEther('2') });
        await borrower.WNative.approve(OpenSkyPool.address, parseEther('2'));
        await borrower.OpenSkyPool.repay(2);

        expect(await OpenSkyNFT.ownerOf(TokenId)).to.be.equal(OpenSkyLoanDelegator.address);

        const ClaimNFTSnapshotID = await ethers.provider.send('evm_snapshot', []);
        await borrower.OpenSkyLoanDelegator.claimNFT(NFTAddress, TokenId);
        expect(await OpenSkyNFT.ownerOf(TokenId)).to.be.equal(borrower.address);
        ethers.provider.send('evm_revert', [ClaimNFTSnapshotID]);

        await delegator.OpenSkyLoanDelegator.claimNFT(NFTAddress, TokenId);
        expect(await OpenSkyNFT.ownerOf(TokenId)).to.be.equal(borrower.address);
        expect(await OpenSkyLoanDelegator.getDelegator(borrower.address, NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);
        expect(await OpenSkyLoanDelegator.getLoanOwner(NFTAddress, TokenId)).to.be.equal(ZERO_ADDRESS);

        ethers.provider.send('evm_revert', [SnapshotID]);
    });
});