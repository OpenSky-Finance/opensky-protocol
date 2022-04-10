import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from '../helpers/chai';

import { __setup, checkPoolEquation } from './__setup';
import { checkEvent, waitForTx } from '../helpers/utils';
import { RAY } from '../helpers/constants';

describe('interest rate strategy', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('set base rate successfully', async function () {
        const { OpenSkyInterestRateStrategy } = await __setup();
        const tx = await OpenSkyInterestRateStrategy.setBaseBorrowRate(1, parseUnits('0.02', 27));
        await checkEvent(tx, 'SetBaseBorrowRate', [1, parseUnits('0.02', 27)]);
        expect(await OpenSkyInterestRateStrategy.getBaseBorrowRate(1)).to.be.equal(parseUnits('0.02', 27));
    });

    it('set base rate fail, if not owner', async function () {
        const { nftStaker } = await __setup();
        await expect(
            nftStaker.OpenSkyInterestRateStrategy.setBaseBorrowRate(1, parseUnits('0.02', 27))
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('get borrow rate data successfully when utilization rate is less than OPTIMAL_UTILIZATION_RATE', async function () {
        const { OpenSkyInterestRateStrategy } = await __setup();
        let optimalUtilizationRate = await OpenSkyInterestRateStrategy.OPTIMAL_UTILIZATION_RATE();
        let excessUtilizationRate = await OpenSkyInterestRateStrategy.EXCESS_UTILIZATION_RATE();
        let rateSlope1 = await OpenSkyInterestRateStrategy.rateSlope1();
        let rateSlope2 = await OpenSkyInterestRateStrategy.rateSlope2();
        let baseBorrowRate = await OpenSkyInterestRateStrategy.getBaseBorrowRate(1);
        let utilizationRate = parseEther('0.6').mul(RAY).div(parseEther('1.0'));
        expect(baseBorrowRate.add(rateSlope1.mul(utilizationRate).div(optimalUtilizationRate))).to.be.equal(
            await OpenSkyInterestRateStrategy.getBorrowRate(1, parseEther('1.0'), parseEther('0.6'))
        );
    });

    it('get borrow rate data successfully when utilization rate is greater than OPTIMAL_UTILIZATION_RATE', async function () {
        const { OpenSkyInterestRateStrategy } = await __setup();
        let optimalUtilizationRate = await OpenSkyInterestRateStrategy.OPTIMAL_UTILIZATION_RATE();
        let excessUtilizationRate = await OpenSkyInterestRateStrategy.EXCESS_UTILIZATION_RATE();
        let rateSlope1 = await OpenSkyInterestRateStrategy.rateSlope1();
        let rateSlope2 = await OpenSkyInterestRateStrategy.rateSlope2();
        let baseBorrowRate = await OpenSkyInterestRateStrategy.getBaseBorrowRate(1);
        let utilizationRate = parseEther('0.89').mul(RAY).div(parseEther('1.1'));
        let excessUtilizationRateRatio = utilizationRate
            .sub(optimalUtilizationRate)
            .mul(RAY)
            .div(excessUtilizationRate);
        let borrowRate = baseBorrowRate.add(rateSlope1).add(rateSlope2.mul(excessUtilizationRateRatio).div(RAY));
        expect(borrowRate).to.be.equal(
            await OpenSkyInterestRateStrategy.getBorrowRate(1, parseEther('1.1'), parseEther('0.89'))
        );
    });
});
