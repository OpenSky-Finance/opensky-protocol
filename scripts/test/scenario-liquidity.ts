import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
// import { MarketStatus } from '../helpers/constants';
import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost } from '../helpers/utils';

import { __setup, formatEtherAttrs, formatObjNumbers, checkPoolEquation, deposit } from './__setup';
import { ENV } from './__types';

describe('OpenSkyPool.availableLiquidity', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('Check oToken burn 1', async function () {
        const { OpenSkyNFT, OpenSkyPool, OpenSkyOToken, nftStaker, deployer, buyer001, buyer002, liquidator } = ENV;
        const DEPOSIT_AMOUNT = parseEther('1');
        const INFO: any = {};

        // deposit
        await deposit(buyer001, 1, DEPOSIT_AMOUNT);
        INFO.l1 = await OpenSkyPool.getAvailableLiquidity(1);

        // borrow
        await nftStaker.OpenSkyPool.borrow(
            1,
            parseEther('0.5'),
            24 * 3600 * 7,
            OpenSkyNFT.address,
            1,
            nftStaker.address
        );

        INFO.l2 = await OpenSkyPool.getAvailableLiquidity(1);

        // not overdue
        await advanceTimeAndBlock(24 * 3600);

        // check time
        //
        INFO.l3 = await OpenSkyPool.getAvailableLiquidity(1);

        // console.log(formatEtherAttrs(INFO));

        //  check all interest for oToken and treasury are released after overdue
    });
});
