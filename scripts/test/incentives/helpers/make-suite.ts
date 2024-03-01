import { Signer } from 'ethers';
import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { solidity } from 'ethereum-waffle';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import _ from 'lodash';
import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUser, setupUsers, waitForTx, getTxCost, evmRevert, evmSnapshot } from '../../../helpers/utils';

import {__setup} from "../__setup";

const ENV:any ={ }

export async function initializeMakeSuite(){
    const env = await __setup()
    _.merge( ENV, env);
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
    buidlerevmSnapshotId = id;
};

export function makeSuite(name: string, tests: (testEnv: any) => void) {
    
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

