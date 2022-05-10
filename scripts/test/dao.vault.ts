import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import { waitForTx, advanceBlocks, advanceTimeAndBlock, getTxCost } from '../helpers/utils';
import _ from 'lodash';

import { __setup, setupWithStakingNFT, formatEtherAttrs, checkPoolEquation } from './__setup';

describe('OpenSkyDaoVaultUniswapV2Adapter', function () {
    it('it can swapExactTokensForTokens, erc20=>[weth]', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyDaoVaultUniswapV2Adapter,
            OpenSkyDaoLiquidator,
            UniswapV2Router02,
            WNative,
            TestERC20,
            deployer,
        } = await __setup();

        // 1.dao vault has ERC20
        await TestERC20.mint(OpenSkyDaoVault.address, parseEther('1000000'));
        expect(await TestERC20.balanceOf(OpenSkyDaoVault.address)).to.eq(parseEther('1000000'));

        // 2.approve  OpenSkyDaoVaultUniswapV2Adapter
        await deployer.OpenSkyDaoVault.approveERC20(
            TestERC20.address,
            OpenSkyDaoVaultUniswapV2Adapter.address,
            parseEther('500000')
        );

        // 3.OpenSkyDaoVaultUniswapV2Adapter swap erc20=>weth to dao vault
        const TestERC20_INPUT = parseEther('20000');
        const outEstimate = await UniswapV2Router02.getAmountsOut(TestERC20_INPUT, [
            TestERC20.address,
            WNative.address,
        ]);
        const minAmountOut = outEstimate[1];

        await deployer.OpenSkyDaoVaultUniswapV2Adapter.swapExactTokensForTokens(
            TestERC20.address,
            WNative.address,
            TestERC20_INPUT,
            minAmountOut,
            false
        );
        expect(await WNative.balanceOf(OpenSkyDaoVault.address)).to.gte(minAmountOut);
    });

    it('it can swapTokensForExactTokens, [erc20]=>weth', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyDaoVaultUniswapV2Adapter,
            OpenSkyDaoLiquidator,
            UniswapV2Router02,
            WNative,
            TestERC20,
            deployer,
        } = await __setup();

        // 1.dao vault has ERC20
        await TestERC20.mint(OpenSkyDaoVault.address, parseEther('1000000'));
        expect(await TestERC20.balanceOf(OpenSkyDaoVault.address)).to.eq(parseEther('1000000'));

        // 2.approve OpenSkyDaoVaultUniswapV2Adapter
        await deployer.OpenSkyDaoVault.approveERC20(
            TestERC20.address,
            OpenSkyDaoVaultUniswapV2Adapter.address,
            parseEther('500000')
        );

        // 3.OpenSkyDaoVaultUniswapV2Adapter swap erc20=>weth to dao vault. oracle
        const ETH_WANT = parseEther('2');
        const inEstimate = await UniswapV2Router02.getAmountsIn(ETH_WANT, [TestERC20.address, WNative.address]);

        const maxAmountToSwap = inEstimate[0];

        await deployer.OpenSkyDaoVaultUniswapV2Adapter.swapTokensForExactTokens(
            TestERC20.address,
            WNative.address,
            maxAmountToSwap,
            ETH_WANT,
            false
        );
        expect(await WNative.balanceOf(OpenSkyDaoVault.address)).to.eq(ETH_WANT);
    });
});

describe('OpenSkyDaoVault', function () {
    it('it can withdraw assets', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyDaoVaultUniswapV2Adapter,
            OpenSkyDaoLiquidator,
            UniswapV2Router02,
            WNative,
            OpenSkyNFT,
            OpenSkyERC1155Mock,
            TestERC20,
            deployer,
            buyer001,
            buyer002,
        } = await __setup();

        async function transferEthToDaoVault(amount: BigNumber) {
            // @ts-ignore
            const deployerWallet = new ethers.Wallet(process.env.TEST_ACCOUNT_0_KEY, ethers.provider);
            const tx = {
                to: OpenSkyDaoVault.address,
                value: amount,
            };
            await deployerWallet.signTransaction(tx);
            await deployerWallet.sendTransaction(tx);
        }

        // prepare assets
        await transferEthToDaoVault(parseEther('100'));
        deployer.WNative.deposit({ value: parseEther('10') });
        deployer.WNative.transfer(OpenSkyDaoVault.address, parseEther('10'));
        await TestERC20.mint(OpenSkyDaoVault.address, parseEther('1000000'));
        await (await OpenSkyNFT.awardItem(OpenSkyDaoVault.address)).wait();
        await (await deployer.OpenSkyERC1155Mock.mint(OpenSkyDaoVault.address, 1, 10, [])).wait();

        // onlyGovernance
        expect(buyer001.OpenSkyDaoVault.approveERC20(TestERC20.address, buyer002.address, 1)).to.revertedWith(
            'ACL_ONLY_GOVERNANCE_CAN_CALL'
        );
        
        //
        await expect(deployer.OpenSkyDaoVault.withdrawETH(parseEther('1'), buyer001.address))
            .to.emit(OpenSkyDaoVault,'WithdrawETH')

        await expect(deployer.OpenSkyDaoVault.withdrawERC20(TestERC20.address, parseEther('1000'), buyer001.address))
            .to.emit(OpenSkyDaoVault,'WithdrawERC20')

        await expect(deployer.OpenSkyDaoVault.withdrawERC721(OpenSkyNFT.address, 1, buyer001.address))
            .to.emit(OpenSkyDaoVault,'WithdrawERC721')
        expect(await OpenSkyNFT.ownerOf(1)).to.be.eq(buyer001.address)
        
        await expect(deployer.OpenSkyDaoVault.withdrawERC1155(buyer001.address, OpenSkyERC1155Mock.address, 1, 10))
            .to.emit(OpenSkyDaoVault,'WithdrawERC1155')

        await expect(deployer.OpenSkyDaoVault.convertETHToWETH(parseEther('10')))
            .to.emit(OpenSkyDaoVault,'ConvertETHToWETH')
        expect(await WNative.balanceOf(OpenSkyDaoVault.address)).to.be.eq(parseEther('20'))
        
    });

    it('it can prepare weth for liquidator', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyDaoVaultUniswapV2Adapter,
            OpenSkyDaoLiquidator,
            UniswapV2Router02,
            WNative,
            TestERC20,
            deployer,
        } = await __setup();

        // 1.dao vault has ERC20
        await TestERC20.mint(OpenSkyDaoVault.address, parseEther('1000000'));
        expect(await TestERC20.balanceOf(OpenSkyDaoVault.address)).to.eq(parseEther('1000000'));

        // 2.approve  OpenSkyDaoVaultUniswapV2Adapter
        await deployer.OpenSkyDaoVault.approveERC20(
            TestERC20.address,
            OpenSkyDaoVaultUniswapV2Adapter.address,
            parseEther('500000')
        );
        //
        // 3.OpenSkyDaoVaultUniswapV2Adapter swap erc20=>weth to dao vault
        const outEstimate = await UniswapV2Router02.getAmountsOut(parseEther('20000'), [
            TestERC20.address,
            WNative.address,
        ]);
        await deployer.OpenSkyDaoVaultUniswapV2Adapter.swapExactTokensForTokens(
            TestERC20.address,
            WNative.address,
            parseEther('20000'),
            outEstimate[1],
            false
        );
        expect(await WNative.balanceOf(OpenSkyDaoVault.address)).to.gt(0);
        //
        // 4. dao vault approve weth to liquidator
        await deployer.OpenSkyDaoVault.approveERC20(WNative.address, OpenSkyDaoLiquidator.address, parseEther('1'));
    });
});
