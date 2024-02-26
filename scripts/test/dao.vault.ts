import { ethers, deployments } from 'hardhat';
import { parseEther, formatEther, formatUnits, parseUnits, arrayify } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { expect } from '../helpers/chai';
import _ from 'lodash';

import { __setup } from './__setup';
import { ONE_ETH } from '../helpers/constants';

describe('OpenSkyDaoVaultUniswapV2Adapter', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });

    it('it can swapExactTokensForTokens, erc20=>[weth]', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyDaoVaultUniswapV2Adapter,
            OpenSkyDaoLiquidator,
            UniswapV2Router02,
            WNative,
            TestERC20,
            deployer,
        } = ENV;

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
        } = ENV;

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

describe('OpenSkyDaoVault approve assets', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });
    it('approve erc20 successfully', async function () {
        const {
            OpenSkyDaoVault,
            WNative,
            deployer: governance,
            user001,
            user002
        } = ENV;
        await user001.WNative.deposit({ value: parseEther('10') });
        await user001.WNative.transfer(OpenSkyDaoVault.address, parseEther('10'));
        const approveAmount = parseEther('2');
        await governance.OpenSkyDaoVault.approveERC20(WNative.address, user002.address, approveAmount);
        expect(await WNative.allowance(OpenSkyDaoVault.address, user002.address)).to.be.equal(approveAmount);
    });

    it('approve erc721 successfully', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyNFT,
            deployer: governance,
            user001,
            user002
        } = ENV;
        await user001.OpenSkyNFT.awardItem(user001.address);
        const tokenId = await OpenSkyNFT.totalSupply();
        await user001.OpenSkyNFT.transferFrom(user001.address, OpenSkyDaoVault.address, tokenId);
        await governance.OpenSkyDaoVault.approveERC721(OpenSkyNFT.address, user002.address, tokenId);
        expect(await OpenSkyNFT.getApproved(tokenId)).to.be.equal(user002.address);

        await governance.OpenSkyDaoVault.approveERC721ForAll(OpenSkyNFT.address, user002.address, true);
        expect(await OpenSkyNFT.isApprovedForAll(OpenSkyDaoVault.address, user002.address)).to.be.true;

        await governance.OpenSkyDaoVault.approveERC721ForAll(OpenSkyNFT.address, user002.address, false);
        expect(await OpenSkyNFT.isApprovedForAll(OpenSkyDaoVault.address, user002.address)).to.be.false;
    });

    it('approve erc1155 successfully', async function () {
        const {
            OpenSkyDaoVault,
            OpenSkyERC1155Mock,
            deployer: governance,
            user001,
            user002
        } = ENV;
        await user001.OpenSkyERC1155Mock.mint(OpenSkyDaoVault.address, 1, 10, []);
        await governance.OpenSkyDaoVault.approveERC1155ForAll(OpenSkyERC1155Mock.address, user002.address, true);
        expect(await OpenSkyERC1155Mock.isApprovedForAll(OpenSkyDaoVault.address, user002.address)).to.be.true;

        await governance.OpenSkyDaoVault.approveERC1155ForAll(OpenSkyERC1155Mock.address, user002.address, false);
        expect(await OpenSkyERC1155Mock.isApprovedForAll(OpenSkyDaoVault.address, user002.address)).to.be.false;
    });
});

describe('OpenSkyDaoVault withdraw assets', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
    });

    it('it can withdraw assets', async function () {
        const {
            OpenSkyDaoVault,
            WNative,
            OpenSkyNFT,
            OpenSkyERC1155Mock,
            TestERC20,
            deployer,
            buyer001,
            buyer002,
        } = ENV;

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
        await deployer.WNative.deposit({ value: parseEther('10') });
        await deployer.WNative.transfer(OpenSkyDaoVault.address, parseEther('10'));
        await TestERC20.mint(OpenSkyDaoVault.address, parseEther('1000000'));
        await (await OpenSkyNFT.awardItem(OpenSkyDaoVault.address)).wait();
        const tokenId = await OpenSkyNFT.totalSupply();
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

        await expect(deployer.OpenSkyDaoVault.withdrawERC721(OpenSkyNFT.address, tokenId, buyer001.address))
            .to.emit(OpenSkyDaoVault,'WithdrawERC721')
        expect(await OpenSkyNFT.ownerOf(tokenId)).to.be.eq(buyer001.address)
        
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
        } = ENV;

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

describe('flash claim', function () {
    let ENV: any;
    
    const NFT_ID = 4
    beforeEach(async () => {
        ENV = await __setup();
        const { OpenSkyDaoVault, user001 } = ENV;
        await user001.OpenSkyNFT['safeTransferFrom(address,address,uint256)'](user001.address, OpenSkyDaoVault.address, NFT_ID);
    });

    it('execute flash loan successfully', async function () {
        const { OpenSkyDaoVault, OpenSkyNFT, user001, deployer } = ENV;
        const ApeCoinMock = await ethers.getContract('ApeCoinMock');
        expect(await ApeCoinMock.balanceOf(OpenSkyDaoVault.address)).to.be.equal(0);
        
        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');

        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.be.equal(OpenSkyDaoVault.address);
        await deployer.OpenSkyDaoVault.flashClaim(ApeCoinFlashLoanMock.address, [OpenSkyNFT.address], [NFT_ID], arrayify('0x00'));
        expect(await OpenSkyNFT.ownerOf(NFT_ID)).to.be.equal(OpenSkyDaoVault.address);

        expect(await ApeCoinMock.balanceOf(deployer.address)).to.be.equal(ONE_ETH.mul(10));
    });

    it('execute flash loan failed if caller is not owner', async function () {
        const { OpenSkyDaoVault, OpenSkyNFT, ACLManager, user001, deployer } = ENV;
        const ApeCoinMock = await ethers.getContract('ApeCoinMock');

        const ApeCoinFlashLoanMock = await ethers.getContract('ApeCoinFlashLoanMock');
        
        expect(await ACLManager.isGovernance(deployer.address)).to.be.eq(true)
        expect(await ACLManager.isGovernance(user001.address)).to.be.eq(false)

        await expect(
            user001.OpenSkyDaoVault.flashClaim(ApeCoinFlashLoanMock.address, [OpenSkyNFT.address], [NFT_ID], arrayify('0x00'))
        ).to.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        
        const preBalance = await ApeCoinMock.balanceOf(deployer.address)
        console.log('preBalance',preBalance)
        await deployer.OpenSkyDaoVault.flashClaim(ApeCoinFlashLoanMock.address, [OpenSkyNFT.address], [NFT_ID], arrayify('0x00'))
        expect(await ApeCoinMock.balanceOf(deployer.address)).to.be.equal(ONE_ETH.mul(10));

    });
});
