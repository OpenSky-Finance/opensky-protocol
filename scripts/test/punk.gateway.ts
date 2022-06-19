import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { __setup, formatEtherAttrs, checkPoolEquation } from './__setup';
import { ENV } from './__types';
import { LOAN_STATUS, AUCTION_STATUS, ONE_YEAR } from '../helpers/constants';
import { advanceTimeAndBlock, getCurrentBlockAndTimestamp, getTxCost } from '../helpers/utils';

describe('punk-gateway borrow', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyPunkGateway, borrower, user001, user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);

        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);

        await user002.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user002.OpenSkyERC20Pool.deposit('1', ONE_ETH, user002.address, 0);

        ENV.PUNK_INDEX = 0;

        await borrower.CryptoPunksMarket.offerPunkForSaleToAddress(ENV.PUNK_INDEX, 0, OpenSkyPunkGateway.address);
    });

    // afterEach(async () => {
    //     await checkPoolEquation();
    // });
    // borrow from gateway and repay to gateway using ETH interface [x]
    // borrow from gateway and repay to gateway using ERC20 interface [x]
    // borrow from gateway and repay to gateway using ERC20/ETH interface [x]
    // borrow from pool and repay to pool [ignore]
    // borrow from gateway and repay to pool  [x]
    // borrow from pool and repay to gateway  [x]
    // borrow from gateway and extend in pool [x]
    // borrow from gateway and liquidated in pool [x]

    it('borrow WETH successfully', async function () {
        const { borrower, CryptoPunksMarket, WrappedPunk, OpenSkyLoan, WNative, PUNK_INDEX } = ENV;
        // borrow
        const BORROW_AMOUNT = parseEther('0.5');
        const WNativeBalanceBeforeTx = await WNative.balanceOf(borrower.address);
        const PunkBalanceBeforeTx = await CryptoPunksMarket.balanceOf(borrower.address);
        const WPunkBalanceBeforeTx = await CryptoPunksMarket.balanceOf(WrappedPunk.address);
        let tx = await borrower.OpenSkyPunkGateway.borrow(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);
        const WNativeBalanceAfterTx = await WNative.balanceOf(borrower.address);
        const PunkBalanceAfterTx = await CryptoPunksMarket.balanceOf(borrower.address);
        const WPunkBalanceAfterTx = await CryptoPunksMarket.balanceOf(WrappedPunk.address);

        expect(WNativeBalanceAfterTx).eq(WNativeBalanceBeforeTx.add(BORROW_AMOUNT));

        expect(PunkBalanceBeforeTx).eq(PunkBalanceAfterTx.add(1));
        expect(WPunkBalanceBeforeTx).eq(WPunkBalanceAfterTx.sub(1));

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).eq(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).eq(borrower.address);
    });

    it('borrow ETH successfully', async function () {
        const { borrower, CryptoPunksMarket, WrappedPunk, OpenSkyLoan, WNative, PUNK_INDEX } = ENV;

        const BORROW_AMOUNT = parseEther('0.5');
        const ETHBalanceBeforeTx = await borrower.getETHBalance();
        const PunkBalanceBeforeTx = await CryptoPunksMarket.balanceOf(borrower.address);
        const WPunkBalanceBeforeTx = await CryptoPunksMarket.balanceOf(WrappedPunk.address);
        const tx = await borrower.OpenSkyPunkGateway.borrowETH(1, BORROW_AMOUNT, 365 * 24 * 3600, PUNK_INDEX);
        const GasCost = await getTxCost(tx);
        const ETHBalanceAfterTx = await borrower.getETHBalance();
        const PunkBalanceAfterTx = await CryptoPunksMarket.balanceOf(borrower.address);
        const WPunkBalanceAfterTx = await CryptoPunksMarket.balanceOf(WrappedPunk.address);

        expect(ETHBalanceAfterTx).eq(ETHBalanceBeforeTx.add(BORROW_AMOUNT).sub(GasCost));

        expect(PunkBalanceBeforeTx).eq(PunkBalanceAfterTx.add(1));
        expect(WPunkBalanceBeforeTx).eq(WPunkBalanceAfterTx.sub(1));

        expect(await WrappedPunk.ownerOf(PUNK_INDEX)).eq(OpenSkyLoan.address);
        expect(await OpenSkyLoan.ownerOf(1)).eq(borrower.address);
    });
});

describe('punk-gateway reapy', function () {
    let ENV: any;
    beforeEach(async function () {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyPunkGateway, borrower, user001, user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);

        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);

        await user002.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user002.OpenSkyERC20Pool.deposit('1', ONE_ETH, user002.address, 0);

        ENV.PUNK_INDEX = 0;

        await borrower.CryptoPunksMarket.offerPunkForSaleToAddress(ENV.PUNK_INDEX, 0, OpenSkyPunkGateway.address);

        ENV.BORROW_AMOUNT = parseEther('0.5');
        await borrower.OpenSkyPunkGateway.borrow(1, ENV.BORROW_AMOUNT, 365 * 24 * 3600, ENV.PUNK_INDEX);

        ENV.LOAN_ID = 1;
    });

    it('borrow repay ETH from gateway, if penalty == 0', async function () {
        const { CryptoPunksMarket, OpenSkyLoan } = ENV;
        const { borrower } = ENV;
        const INFO: any = {};

        advanceTimeAndBlock(100 * 3600);

        // repay
        const LOAN_ID = 1;
        const borrowBalance = await OpenSkyLoan.getBorrowBalance(LOAN_ID);
        await borrower.OpenSkyPunkGateway.repayETH(LOAN_ID, { value: borrowBalance.add(parseEther('0.1')) });

        INFO.owner_of_punk0_after_repayed = await CryptoPunksMarket.punkIndexToAddress(0);

        await expect(OpenSkyLoan.ownerOf(LOAN_ID)).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(INFO.owner_of_punk0_after_repayed).to.be.equal(borrower.address);
    });

    it('borrow repay ETH from gateway, if penalty > 0', async function () {
        const { CryptoPunksMarket, OpenSkyLoan, LOAN_ID } = ENV;
        const { nftStaker } = ENV;
        const INFO: any = {};

        advanceTimeAndBlock(365 * 24 * 3600 + 100 * 3600);

        // repay
        const borrowBalance = await OpenSkyLoan.getBorrowBalance(LOAN_ID);
        await nftStaker.OpenSkyPunkGateway.repayETH(LOAN_ID, { value: borrowBalance.add(parseEther('0.01')) });

        INFO.owner_of_punk0_after_repayed = await CryptoPunksMarket.punkIndexToAddress(0);

        await expect(OpenSkyLoan.ownerOf(LOAN_ID)).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(INFO.owner_of_punk0_after_repayed).to.be.equal(nftStaker.address);
    });

    it('repay weth by gateway successfully, if penalty == 0', async function () {
        const { CryptoPunksMarket, WrappedPunk, OpenSkyPunkGateway, OpenSkyPool, OpenSkyLoan, PUNK_INDEX, borrower, LOAN_ID } = ENV;
        const INFO: any = {};

        advanceTimeAndBlock(100 * 3600);

        // repay
        await borrower.WNative.deposit({ value: parseEther('10') });
        await borrower.WNative.approve(OpenSkyPunkGateway.address, ethers.constants.MaxUint256);
        await borrower.OpenSkyPunkGateway.repay(LOAN_ID);

        INFO.owner_of_punk0_after_repayed = await CryptoPunksMarket.punkIndexToAddress(0);

        await expect(OpenSkyLoan.ownerOf(LOAN_ID)).to.revertedWith('ERC721: owner query for nonexistent token');
        expect(INFO.owner_of_punk0_after_repayed).to.be.equal(borrower.address);
    });

    it('repay weth by gateway successfully, if penalty > 0', async function () {
        const { CryptoPunksMarket, PUNK_INDEX, LOAN_ID } = ENV;
        const { borrower } = ENV;
        const INFO: any = {};

        advanceTimeAndBlock(365 * 24 * 3600 + 100 * 3600);

        // repay by gateway
        const REPAY_AMOUNT_2 = parseEther('1');
        await borrower.OpenSkyPunkGateway.repayETH(LOAN_ID, { value: REPAY_AMOUNT_2 });

        expect(await CryptoPunksMarket.punkIndexToAddress(PUNK_INDEX)).to.be.equal(borrower.address);
    });
});
