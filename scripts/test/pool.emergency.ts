import { expect } from '../helpers/chai';
import _ from 'lodash';

import { __setup, checkPoolEquation, deposit } from './__setup';
import { parseEther } from 'ethers/lib/utils';
import { advanceTimeAndBlock } from '../helpers/utils';
import { Errors } from "../helpers/constants"

describe('pool emergency', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { ACLManager, deployer, buyer001: emergencyAdmin } = ENV;
        await ACLManager.addEmergencyAdmin(emergencyAdmin.address);
        await ACLManager.removeEmergencyAdmin(deployer.address);
        ENV.emergencyAdmin = emergencyAdmin;
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('pause fail if caller is not emergency admin', async function () {
        const { OpenSkyPool } = ENV;
        await expect(OpenSkyPool.pause()).to.revertedWith(Errors.ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL);
    });

    it('deposit fail', async function () {
        const { emergencyAdmin, user002 } = ENV;
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(deposit(user002, 1, parseEther('0.1'))).to.revertedWith(
            'Pausable: paused'
        );
    });

    it('withdraw fail', async function () {
        const { emergencyAdmin, user002 } = ENV;

        // await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') });
        await deposit(user002, 1, parseEther('0.1'));

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(user002.OpenSkyPool.withdraw(1, parseEther('0.1'), user002.address)).to.revertedWith('Pausable: paused');
    });

    it('borrow fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user003, 1, parseEther('0.8'));

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            borrower.OpenSkyPool.borrow(
                1,
                parseEther('1.5'),
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                borrower.address
            )
        ).to.revertedWith('Pausable: paused');
    });

    it('repay fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user002, 1, parseEther('0.8'));

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        await advanceTimeAndBlock(364 * 24 * 3600);

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(borrower.OpenSkyPool.repay(1)).to.revertedWith('Pausable: paused');
    });

    it('extend fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user002, 1, parseEther('0.8'));

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        await advanceTimeAndBlock(360 * 24 * 3600);
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            borrower.OpenSkyPool.extend(1, parseEther('1.8'), 30 * 24 * 3600, borrower.address)
        ).to.revertedWith('Pausable: paused');
    });
});
