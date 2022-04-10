import { expect } from '../helpers/chai';
import _ from 'lodash';

import { __setup } from './__setup';
import { RANDOM_ADDRESSES } from '../helpers/constants';
import { ethers } from 'hardhat';

describe('pool setting', function () {
  
    it('create successully', async function () {
        const { OpenSkyPool } = await __setup();
        await OpenSkyPool.create('OpenSky ETH 2', 'OETH2');

        const reserve = await OpenSkyPool.getReserveData(2);
        expect(reserve.reserveId).to.be.equal(2);
        const oToken = await ethers.getContractAt('OpenSkyOToken', reserve.oTokenAddress);
        expect(await oToken.name()).to.be.equal('OpenSky ETH 2');
        expect(await oToken.symbol()).to.be.equal('OETH2');

        await expect(OpenSkyPool.getReserveData(3)).to.be.revertedWith('RESERVE_DOES_NOT_EXISTS');
    });

    it('create fail if caller is not admin', async function () {
        const { buyer001: fakeAdmin } = await __setup();
        await expect(fakeAdmin.OpenSkyPool.create('OpenSky ETH 2', 'OETH2')).to.be.revertedWith(
            'ACL_ONLY_POOL_ADMIN_CAN_CALL'
        );
    });

    it('set treasury factor successfully', async function () {
        const { OpenSkyPool } = await __setup();
        await OpenSkyPool.setTreasuryFactor(1, 10);

        const reserve = await OpenSkyPool.getReserveData(1);
        expect(reserve.treasuryFactor).to.be.equal(10);
    });

    it('set treasury factor fail if caller is not admin', async function () {
        const { buyer001 } = await __setup();
        await expect(buyer001.OpenSkyPool.setTreasuryFactor(1, 10)).to.be.revertedWith('ACL_ONLY_POOL_ADMIN_CAN_CALL');
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
            'ACL_ONLY_POOL_ADMIN_CAN_CALL'
        );
    });
});
