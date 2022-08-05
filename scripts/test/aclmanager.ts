import { expect } from '../helpers/chai';
import { __setup } from './__setup';
import { randomAddress } from '../helpers/utils';
import { parseEther } from 'ethers/lib/utils';
import { Errors, ZERO_ADDRESS } from '../helpers/constants';

describe('ACLManager', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { user003: timelock } = ENV;
        ENV.timelock = timelock;
    })

    it('grant default admin role to timelock successfully', async function () {
        const { ACLManager, deployer, timelock, user002 } = ENV;
        const DefaultRole = await ACLManager.DEFAULT_ADMIN_ROLE();

        console.log('timelock', timelock.address);

        expect(await ACLManager.hasRole(DefaultRole, deployer.address)).to.be.true;

        await deployer.ACLManager.grantRole(DefaultRole, timelock.address);
        await deployer.ACLManager.renounceRole(DefaultRole, deployer.address);

        expect(await ACLManager.hasRole(DefaultRole, timelock.address)).to.be.true;
        expect(await ACLManager.hasRole(DefaultRole, deployer.address)).to.be.false;

        await timelock.ACLManager.grantRole(DefaultRole, user002.address);
        await timelock.ACLManager.addGovernance(user002.address);
        await timelock.ACLManager.addLiquidationOperator(user002.address);
    })

});
