import { expect } from '../helpers/chai';
import _ from 'lodash';

import { setupWithStakingNFT, __setup, checkPoolEquation } from './__setup';
import { parseEther } from 'ethers/lib/utils';
import { advanceTimeAndBlock } from '../helpers/utils';

describe('pool emergency', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    async function setup() {
        const ENV = await setupWithStakingNFT();
        const { ACLManager, deployer, buyer001: emergencyAdmin } = ENV;
        await ACLManager.addEmergencyAdmin(emergencyAdmin.address);
        await ACLManager.removeEmergencyAdmin(deployer.address);
        return { ...ENV, emergencyAdmin };
    }

    it('pause fail if caller is not emergency admin', async function () {
        const { OpenSkyPool } = await setup();
        await expect(OpenSkyPool.pause()).to.revertedWith('ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL');
    });

    it('deposit fail', async function () {
        const { emergencyAdmin, buyer002 } = await setup();
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') })).to.revertedWith(
            'Pausable: paused'
        );
    });

    it('withdraw fail', async function () {
        const { emergencyAdmin, buyer002 } = await setup();

        await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') });

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(buyer002.OpenSkyPool.withdraw(1, parseEther('0.1'))).to.revertedWith('Pausable: paused');
    });

    it('borrow fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, buyer002, buyer003, nftStaker } = await setup();

        await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('1.1') });
        await buyer003.OpenSkyPool.deposit(1, 0, { value: parseEther('0.8') });

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            nftStaker.OpenSkyPool.borrow(
                1,
                parseEther('1.5'),
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                nftStaker.address
            )
        ).to.revertedWith('Pausable: paused');
    });

    it('repay fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, buyer002, buyer003, nftStaker } = await setup();

        await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('1.1') });
        await buyer003.OpenSkyPool.deposit(1, 0, { value: parseEther('0.8') });

        await nftStaker.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );

        await advanceTimeAndBlock(364 * 24 * 3600);

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(nftStaker.OpenSkyPool.repay(1, { value: parseEther('1.55') })).to.revertedWith('Pausable: paused');
    });

    it('extend fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, buyer002, buyer003, nftStaker } = await setup();

        await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('1.1') });
        await buyer003.OpenSkyPool.deposit(1, 0, { value: parseEther('0.8') });

        await nftStaker.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );

        await advanceTimeAndBlock(360 * 24 * 3600);
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            nftStaker.OpenSkyPool.extend(1, parseEther('1.8'), 30 * 24 * 3600, {
                value: parseEther('0.8'),
            })
        ).to.revertedWith('Pausable: paused');
    });
});
