import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from './../helpers/chai';
import { __setup, formatEtherAttrs, checkPoolEquation } from './__setup';
import { LOAN_STATUS, AUCTION_STATUS, ONE_YEAR, ONE_ETH, ZERO_ADDRESS } from './../helpers/constants';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp, getTxCost } from './../helpers/utils';
import { rayMul } from '../helpers/ray-math';

describe('loan helper', function () {
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

    it('should repay', async function () {
        const { OpenSkyLoanHelper, OpenSkyNFT, OpenSkyLoan, borrower, TokenId, LoanID } = ENV;

        let borrowTime = (await getCurrentBlockAndTimestamp()).timestamp;

        await advanceTimeAndBlock(364 * 24 * 3600);

        await borrower.OpenSkyLoan.approve(OpenSkyLoanHelper.address, LoanID);

        const oldLoan = await OpenSkyLoan.getLoanData(LoanID);
        const BalanceBeforeTx = await borrower.getETHBalance();
        const tx = await borrower.OpenSkyLoanHelper.repay(LoanID, { value: parseEther('1.7') });
        let repayTime = (await getCurrentBlockAndTimestamp()).timestamp;
        const gasCost = await getTxCost(tx);
        const BalanceAfterTx = await borrower.getETHBalance();
        const interest = rayMul(oldLoan.interestPerSecond, BigNumber.from(repayTime - borrowTime));

        expect(await OpenSkyNFT.ownerOf(TokenId)).to.eq(borrower.address);
        expect(BalanceBeforeTx.sub(parseEther('1.5').add(interest))).to.eq(BalanceAfterTx.add(gasCost));
    });

});