import { Signer } from 'ethers';
import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { solidity } from 'ethereum-waffle';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import _ from 'lodash';
import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUser, setupUsers, waitForTx, getTxCost, evmRevert, evmSnapshot, getBlockTimestamp } from '../../../helpers/utils';
import { MAX_UINT_AMOUNT } from '../helpers/constants';

import {__setup} from "./__setup";

const ENV:any ={ }

export async function initializeMakeSuite(){
    const ENV_ = await __setup()

    // settings for all suite
    const aaveToken= await ethers.getContract('AaveToken')
    ENV_.aaveToken =aaveToken
    ENV_.rewardsVault = ENV_.user005

    const {OpenSkyPoolIncentivesControllerLender, OpenSkySettings,  rewardsVault} = ENV_
    await OpenSkyPoolIncentivesControllerLender.initialize(rewardsVault.address)

    // adapt cases from aave
    ENV_.pullRewardsIncentivesController = ENV_.OpenSkyPoolIncentivesControllerLender
    ENV_.aDaiBaseMock = ENV_.aDAI

    console.log('settings===', aaveToken.address, rewardsVault.address)

    // prepare reward
    await waitForTx(await aaveToken.connect(rewardsVault.signer).mint(ethers.utils.parseEther('2000000')));
    // set controller
    await waitForTx(
        await aaveToken.connect(rewardsVault.signer).approve(OpenSkyPoolIncentivesControllerLender.address, MAX_UINT_AMOUNT)
    );
    const distributionDuration = ((await getBlockTimestamp()) + 1000 * 60 * 60).toString();
    await OpenSkyPoolIncentivesControllerLender.setDistributionEnd(distributionDuration)

    _.merge( ENV, ENV_);
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
    buidlerevmSnapshotId = id;
};

export function _makeSuite(name: string, tests: (testEnv: any) => void) {
    
    describe(name, () => {
        
        before(async () => {
            await initializeMakeSuite()
            setBuidlerevmSnapshotId(await evmSnapshot());

            console.log('\n***************');
            console.log('Setup and snapshot finished');
            console.log('***************\n');
        });

        tests(ENV);
        
        after(async () => {
            await evmRevert(buidlerevmSnapshotId);
        });
    });
}

