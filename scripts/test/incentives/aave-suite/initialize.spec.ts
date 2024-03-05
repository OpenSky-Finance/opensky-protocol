import {MAX_UINT_AMOUNT, ZERO_ADDRESS} from '../helpers/constants';
import {__setup} from "../__setup";

const {expect} = require('chai');

import {_makeSuite} from './_make-suite'


_makeSuite('initialize',function(ENV:any){
    // TODO: useless or not?
    it('Tries to call initialize second time, should be reverted', async () => {
        const {OpenSkyPoolIncentivesControllerLender: pullRewardsIncentivesController} = ENV;
        await expect(pullRewardsIncentivesController.initialize(ZERO_ADDRESS)).to.be.reverted;
    });
})
