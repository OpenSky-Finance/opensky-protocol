import { ethers } from 'hardhat';
import { parseEther, parseUnits } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
  advanceTimeAndBlock,
  almostEqual,
    checkEvent, getCurrentBlockAndTimestamp,
} from '../helpers/utils';
import _, { before } from 'lodash';
import { ONE_ETH, ONE_YEAR } from '../helpers/constants';

import { __setup } from './__setup';
import { rayMul } from '../helpers/ray-math';

describe('pool borrow', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyNFT, buyer001: user001, buyer002: user002, nftStaker } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
        
        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);

        await OpenSkyNFT.awardItem(nftStaker.address);
        await nftStaker.OpenSkyNFT.approve(OpenSkyERC20Pool.address, '1');
    });

    it('user borrow successfully', async function () {
        const { WNative, OpenSkyNFT, OpenSkyERC20Pool, OpenSkyOToken, buyer001: user001, buyer002: user002, nftStaker, MoneyMarket } = ENV;

        await nftStaker.OpenSkyERC20Pool.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address
        );

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(ONE_ETH);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(ONE_ETH);
        expect(await WNative.balanceOf(OpenSkyOToken.address)).to.be.equal(0);
        expect(await WNative.balanceOf(user001.address)).to.be.equal(parseEther('9'));
        expect(await MoneyMarket.getBalance(WNative.address, OpenSkyOToken.address)).to.be.equal(0);
        expect(await MoneyMarket.getBalance(WNative.address, user001.address)).to.be.equal(0);
        expect(await WNative.balanceOf(nftStaker.address)).to.be.equal(ONE_ETH);
    });
});

describe('pool repay', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyNFT, buyer001: user001, buyer002: user002, nftStaker } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
        
        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);

        await OpenSkyNFT.awardItem(nftStaker.address);
        await nftStaker.OpenSkyNFT.approve(OpenSkyERC20Pool.address, '1');
        await nftStaker.OpenSkyERC20Pool.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address
        );
        await nftStaker.WNative.deposit({ value: parseEther('10') });
        await nftStaker.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH.mul(2));
    });

    it('user repay successfully', async function () {
        const { WNative, OpenSkySettings, OpenSkyLoan, OpenSkyOToken, buyer001: user001, buyer002: user002, nftStaker, MoneyMarket } = ENV;

        const loan = await OpenSkyLoan.getLoanData(1);
        await nftStaker.OpenSkyERC20Pool.repay('1');

        const currentTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const interest = rayMul(loan.interestPerSecond, currentTimestamp - loan.borrowBegin);

        const totalSupply = await OpenSkyOToken.totalSupply();
        expect(
            almostEqual(totalSupply, ONE_ETH.add(interest))
        ).to.be.true

        expect(
            (await OpenSkyOToken.balanceOf(user001.address)).add(
                await OpenSkyOToken.balanceOf(await OpenSkySettings.daoVaultAddress())
            )
        ).to.be.equal(totalSupply);
        expect(
            await MoneyMarket.getBalance(WNative.address, OpenSkyOToken.address),
        ).to.be.equal(
            ONE_ETH.add(interest)
        );
        expect(await WNative.balanceOf(user001.address)).to.be.equal(parseEther('9'));
    });
});

describe('pool extend', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, OpenSkyNFT, buyer001: user001, buyer002: user002, nftStaker } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });
 
        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
        
        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH.mul(5));
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH.mul(5), user001.address, 0);

        await user002.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH.mul(5));
        await user002.OpenSkyERC20Pool.deposit('1', ONE_ETH.mul(5), user001.address, 0);
 

        const totalSupply = await ENV.OpenSkyOToken.totalSupply();

        await OpenSkyNFT.awardItem(nftStaker.address);
        await nftStaker.OpenSkyNFT.approve(OpenSkyERC20Pool.address, '1');
        await nftStaker.OpenSkyERC20Pool.borrow(
            '1', ONE_ETH, ONE_YEAR, OpenSkyNFT.address, 1, nftStaker.address
        );
        await nftStaker.WNative.deposit({ value: parseEther('10') });
        await nftStaker.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH.mul(2));
    });

    it('user extend successfully', async function () {
        const { WNative, OpenSkySettings, OpenSkyLoan, OpenSkyOToken, buyer001: user001, buyer002: user002, borrower, MoneyMarket } = ENV;

        const totalSupplyAfterBorrow = ONE_ETH.mul(10);

        await advanceTimeAndBlock(ONE_YEAR);

        const loan = await OpenSkyLoan.getLoanData(1);
        const penalty = await OpenSkyLoan.getPenalty(1);

        const newLoanAmount = ONE_ETH.mul(2);
        await borrower.OpenSkyERC20Pool.extend('1', newLoanAmount, ONE_YEAR, borrower.address);

        const currentTimestamp = (await getCurrentBlockAndTimestamp()).timestamp;
        const interest = rayMul(loan.interestPerSecond, currentTimestamp - loan.borrowBegin);

        const totalSupplyAfterExtend = await OpenSkyOToken.totalSupply();
        expect(
            almostEqual(totalSupplyAfterExtend.sub(totalSupplyAfterBorrow), penalty.add(interest))
        ).to.be.true;

        expect(
            almostEqual(
                (await OpenSkyOToken.balanceOf(user001.address)).add(
                    await OpenSkyOToken.balanceOf(user002.address)
                ).add(
                    await OpenSkyOToken.balanceOf(await OpenSkySettings.daoVaultAddress())
                ),
                totalSupplyAfterExtend
            )
        ).to.be.true;
        expect(
            await MoneyMarket.getBalance(WNative.address, OpenSkyOToken.address),
        ).to.be.equal(
            totalSupplyAfterBorrow.add(interest).add(penalty).sub(newLoanAmount)
        );
    });
});