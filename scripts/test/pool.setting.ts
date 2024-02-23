import { expect } from '../helpers/chai';
import _ from 'lodash';

import { __setup } from './__setup';
import { Errors, RANDOM_ADDRESSES, MAX_UINT_256 } from '../helpers/constants';
import { ethers } from 'hardhat';

describe('pool setting', function () {
    it('create successully', async function () {
        const { WNative, OpenSkyPool } = await __setup();
        await OpenSkyPool.create(WNative.address, 'OpenSky ETH 2', 'OETH2', 18);

        // const reserve = await OpenSkyPool.getReserveData(2);
        // expect(reserve.reserveId).to.be.equal(2);
        // const oToken = await ethers.getContractAt('OpenSkyOToken', reserve.oTokenAddress);
        // expect(await oToken.name()).to.be.equal('OpenSky ETH 2');
        // expect(await oToken.symbol()).to.be.equal('OETH2');
        //
        // await expect(OpenSkyPool.getReserveData(3)).to.be.revertedWith(Errors.RESERVE_DOES_NOT_EXIST);
    });

    it('create fail if caller is not admin', async function () {
        const { WNative, user001: fakeAdmin } = await __setup();
        await expect(fakeAdmin.OpenSkyPool.create(WNative.address, 'OpenSky ETH 2', 'OETH2', 18)).to.be.revertedWith(
            Errors.ACL_ONLY_POOL_ADMIN_CAN_CALL
        );
    });

    it('set treasury factor successfully', async function () {
        const { OpenSkyPool } = await __setup();
        await OpenSkyPool.setTreasuryFactor(1, 10);

        const reserve = await OpenSkyPool.getReserveData(1);
        expect(reserve.treasuryFactor).to.be.equal(10);

        await OpenSkyPool.setTreasuryFactor(1, 2000);
        const reserve2 = await OpenSkyPool.getReserveData(1);
        expect(reserve2.treasuryFactor).to.be.equal(2000);
    });

    it('set treasury factor more than MAX_RESERVE_FACTOR failed', async function () {
        const { OpenSkyPool, OpenSkySettings } = await __setup();

        const MAX_RESERVE_FACTOR = await OpenSkySettings['MAX_RESERVE_FACTOR()']();
        console.log('MAX_RESERVE_FACTOR', MAX_RESERVE_FACTOR);

        await expect(OpenSkyPool.setTreasuryFactor(1, MAX_RESERVE_FACTOR.add(1))).to.be.reverted;
        await expect(OpenSkyPool.setTreasuryFactor(1, MAX_UINT_256)).to.be.reverted;
    });

    it('set treasury factor fail if caller is not admin', async function () {
        const { buyer001 } = await __setup();
        await expect(buyer001.OpenSkyPool.setTreasuryFactor(1, 10)).to.be.revertedWith(
            Errors.ACL_ONLY_POOL_ADMIN_CAN_CALL
        );
    });

    it('set interest model address successfully', async function () {
        const { OpenSkyPool } = await __setup();
        await OpenSkyPool.setInterestModelAddress(1, RANDOM_ADDRESSES[0]);

        const reserve = await OpenSkyPool.getReserveData(1);
        expect(reserve.interestModelAddress).to.be.equal(RANDOM_ADDRESSES[0]);
    });

    it('set interest model address fail if caller is not admin', async function () {
        const { buyer001 } = await __setup();
        await expect(buyer001.OpenSkyPool.setInterestModelAddress(1, RANDOM_ADDRESSES[0])).to.be.revertedWith(
            Errors.ACL_ONLY_POOL_ADMIN_CAN_CALL
        );
    });
});
