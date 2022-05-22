import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';

import { expect } from '../helpers/chai';
import {
    checkEvent,
} from '../helpers/utils';
import _, { before } from 'lodash';
import { ONE_ETH } from '../helpers/constants';

import { __setup } from './__setup';

describe('pool lending deposit', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, buyer001: user001, buyer002: user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
    });

    it('user deposit 1 eth', async function () {
        const { WNative, OpenSkyERC20Pool, OpenSkyOToken, buyer001: user001, buyer002: user002, MoneyMarket } = ENV;

        const ONE_ETH = parseEther('1');

        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);

        let tx = await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);

        await checkEvent(tx, 'Deposit', [1, user001.address, ONE_ETH, 0]);

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(ONE_ETH);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(ONE_ETH);
        expect(await WNative.balanceOf(OpenSkyOToken.address)).to.be.equal(0);
        expect(await WNative.balanceOf(user001.address)).to.be.equal(parseEther('9'));
        expect(await MoneyMarket.getBalance(WNative.address, OpenSkyOToken.address)).to.be.equal(ONE_ETH);
        expect(await MoneyMarket.getBalance(WNative.address, user001.address)).to.be.equal(0);
    });
});

describe('pool lending withdraw', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyERC20Pool, buyer001: user001, buyer002: user002 } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user002.WNative.deposit({ value: parseEther('10') });

        const oTokenAddress = (await OpenSkyERC20Pool.getReserveData('1')).oTokenAddress;
        ENV.OpenSkyOToken = await ethers.getContractAt('OpenSkyOToken', oTokenAddress);
        
        const ONE_ETH = parseEther('1');
        await user001.WNative.approve(OpenSkyERC20Pool.address, ONE_ETH);
        await user001.OpenSkyERC20Pool.deposit('1', ONE_ETH, user001.address, 0);
    });

    it('user withdraw 1 eth', async function () {
        const { WNative, OpenSkyERC20Pool, OpenSkyOToken, buyer001: user001, buyer002: user002, MoneyMarket } = ENV;
        await user001.OpenSkyERC20Pool.withdraw('1', ONE_ETH, user001.address);

        expect(await OpenSkyOToken.totalSupply()).to.be.equal(0);
        expect(await OpenSkyOToken.balanceOf(user001.address)).to.be.equal(0);
        expect(await WNative.balanceOf(OpenSkyOToken.address)).to.be.equal(0);
        expect(await WNative.balanceOf(user001.address)).to.be.equal(parseEther('10'));
        expect(await MoneyMarket.getBalance(WNative.address, OpenSkyOToken.address)).to.be.equal(0);
        expect(await MoneyMarket.getBalance(WNative.address, user001.address)).to.be.equal(0);
    });
});
