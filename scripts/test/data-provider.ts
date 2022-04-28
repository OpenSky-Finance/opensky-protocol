import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost } from '../helpers/utils';
import _ from 'lodash';

import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';
import { ENV } from './__types';
describe('data provider', function () {
    afterEach(async () => {
        await checkPoolEquation();
    });
    it('it can get loans of a user', async function () {
        const { OpenSkyNFT, OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } =
            await __setup();

        await (await OpenSkyNFT.awardItem(nftStaker.address)).wait();
        await (await OpenSkyNFT.awardItem(nftStaker.address)).wait();
        await (await OpenSkyNFT.awardItem(nftStaker.address)).wait();

        await (await OpenSkyNFT.awardItem(buyer001.address)).wait();
        await (await OpenSkyNFT.awardItem(buyer001.address)).wait();

        await nftStaker.OpenSkyNFT.approve(OpenSkyPool.address, '1');
        await nftStaker.OpenSkyNFT.approve(OpenSkyPool.address, '2');
        await nftStaker.OpenSkyNFT.approve(OpenSkyPool.address, '3');

        await buyer001.OpenSkyNFT.approve(OpenSkyPool.address, '4');
        await buyer001.OpenSkyNFT.approve(OpenSkyPool.address, '5');

        const ONE_ETH = parseEther('1');
        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        await buyer001.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 4, buyer001.address);
        await buyer001.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 5, buyer001.address);

        await nftStaker.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 1, nftStaker.address);
        await nftStaker.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 2, nftStaker.address);
        await nftStaker.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 3, nftStaker.address);

        await advanceTimeAndBlock(1000)
        const INFO: any = {};
        INFO.balanceOf_nftStaker = await OpenSkyLoan.balanceOf(nftStaker.address);
        INFO.balanceOf_buyer001 = await OpenSkyLoan.balanceOf(buyer001.address);

        // INFO.tokenOfOwnerByIndex = await OpenSkyLoan.tokenOfOwnerByIndex(nftStaker.address, 1);

        INFO.getLoansByUser_nftStaker = await OpenSkyDataProvider.getLoansByUser(nftStaker.address);
        INFO.getLoansByUser_buyer001 = await OpenSkyDataProvider.getLoansByUser(buyer001.address);

        expect(INFO.balanceOf_nftStaker).to.eq(3);
        expect(INFO.balanceOf_buyer001).to.eq(2);

        expect(INFO.getLoansByUser_nftStaker[0]).eq(BigNumber.from('3'));
        expect(INFO.getLoansByUser_nftStaker[1]).eq(BigNumber.from('4'));
        expect(INFO.getLoansByUser_nftStaker[2]).eq(BigNumber.from('5'));

        expect(INFO.getLoansByUser_buyer001[0]).eq(BigNumber.from('1'));
        expect(INFO.getLoansByUser_buyer001[1]).eq(BigNumber.from('2'));

        // console.log(INFO);
    });

    it('get loan data', async function () {
        const { OpenSkyNFT, OpenSkyDataProvider, OpenSkyPool, OpenSkyLoan, buyer001, buyer002, nftStaker } =
            await __setup();

        await (await OpenSkyNFT.awardItem(buyer001.address)).wait();

        await buyer001.OpenSkyNFT.approve(OpenSkyPool.address, '1');

        const ONE_ETH = parseEther('1');
        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));
        expect(await buyer001.OpenSkyPool.deposit(1, 0, { value: ONE_ETH }));

        await buyer001.OpenSkyPool.borrow(1, parseEther('0.1'), 3600 * 24, OpenSkyNFT.address, 1, buyer001.address);
        const loanFromLoanNFT = await OpenSkyLoan.getLoanData(1);
        const loanFromDataProvider = await OpenSkyDataProvider.getLoanData(1);
        expect(loanFromLoanNFT.interestPerSecond).to.be.equal(loanFromDataProvider.interestPerSecond);

    })
});
