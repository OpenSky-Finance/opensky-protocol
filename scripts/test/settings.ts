import { expect } from '../helpers/chai';
import { __setup } from './__setup';
import { randomAddress } from '../helpers/utils';
import { parseEther } from 'ethers/lib/utils';
import { Errors, ZERO_ADDRESS } from '../helpers/constants';

describe('settings', function () {
    async function setup() {
        const ENV = await __setup();
        const { ACLManager, nftStaker: addressAdmin, buyer001: governance } = ENV;
        // await ACLManager.addAddressAdmin(addressAdmin.address);
        await ACLManager.addGovernance(governance.address);
        return { ...ENV, addressAdmin, governance };
    }

    it('set address successfully', async function () {
        const { addressAdmin, governance, OpenSkySettings } = await setup();
        const MoneyMarketAddress = randomAddress();
        expect(await governance.OpenSkySettings.setMoneyMarketAddress(MoneyMarketAddress));
        expect(await OpenSkySettings.moneyMarketAddress()).to.be.equal(MoneyMarketAddress);

        const TreasuryAddress = randomAddress();
        expect(await governance.OpenSkySettings.setTreasuryAddress(TreasuryAddress));
        expect(await OpenSkySettings.treasuryAddress()).to.be.equal(TreasuryAddress);

        // const IncentiveController = randomAddress();
        // expect(await addressAdmin.OpenSkySettings.initIncentiveControllerAddress(IncentiveController));
        // expect(await OpenSkySettings.incentiveControllerAddress()).to.be.equal(IncentiveController);

        // const VaultFactoryAddress = randomAddress();
        // expect(await addressAdmin.OpenSkySettings.initVaultFactoryAddress(VaultFactoryAddress));
        // expect(await OpenSkySettings.vaultFactoryAddress()).to.be.equal(VaultFactoryAddress);

        const LoanDescriptorAddress = randomAddress();
        expect(await governance.OpenSkySettings.setLoanDescriptorAddress(LoanDescriptorAddress));
        expect(await OpenSkySettings.loanDescriptorAddress()).to.be.equal(LoanDescriptorAddress);

        const NFTPriceOracleAddress = randomAddress();
        expect(await governance.OpenSkySettings.setNftPriceOracleAddress(NFTPriceOracleAddress));
        expect(await OpenSkySettings.nftPriceOracleAddress()).to.be.equal(NFTPriceOracleAddress);

        const InterestRateStrategyAddress = randomAddress();
        expect(await governance.OpenSkySettings.setInterestRateStrategyAddress(InterestRateStrategyAddress));
        expect(await OpenSkySettings.interestRateStrategyAddress()).to.be.equal(InterestRateStrategyAddress);

        // const PunkGatewayAddress = randomAddress();
        // expect(await addressAdmin.OpenSkySettings.setPunkGatewayAddress(PunkGatewayAddress));
        // expect(await OpenSkySettings.punkGatewayAddress()).to.be.equal(PunkGatewayAddress);

        // const ACLManagerAddress = randomAddress();
        // expect(await addressAdmin.OpenSkySettings.setACLManagerAddress(ACLManagerAddress));
        // expect(await OpenSkySettings.ACLManagerAddress()).to.be.equal(ACLManagerAddress);
    });

    it('set address should failed', async function () {
        const { addressAdmin, OpenSkySettings } = await setup();

        const PoolAddress = randomAddress();
        expect(addressAdmin.OpenSkySettings.initPoolAddress(PoolAddress)).to.be.reverted;

        const LoanAddress = randomAddress();
        expect(addressAdmin.OpenSkySettings.initLoanAddress(LoanAddress)).to.be.reverted;
    });

    // it('set address fail if caller is not address admin', async function () {
    // const { governance } = await setup();
    // await expect(governance.OpenSkySettings.setMoneyMarketAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setACLManagerAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setTreasuryAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.initIncentiveControllerAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setPoolAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.initVaultFactoryAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.initLoanAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setLoanDescriptorAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setNftPriceOracleAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // await expect(governance.OpenSkySettings.setInterestRateStrategyAddress(randomAddress())).to.be.revertedWith(
    //     Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL
    // );
    // });

    it('set governance parameter successfully', async function () {
        const { governance } = await setup();
        expect(await governance.OpenSkySettings.setReserveFactor(1));
        expect(await governance.OpenSkySettings.reserveFactor()).to.be.equal(1);
        expect(await governance.OpenSkySettings.setPrepaymentFeeFactor(5));
        expect(await governance.OpenSkySettings.prepaymentFeeFactor()).to.be.equal(5);
        expect(await governance.OpenSkySettings.setOverdueLoanFeeFactor(5));
        expect(await governance.OpenSkySettings.overdueLoanFeeFactor()).to.be.equal(5);
    });

    it('set governance parameter fail if caller is not governance', async function () {
        const { addressAdmin } = await setup();
        await expect(addressAdmin.OpenSkySettings.setReserveFactor(1)).to.be.revertedWith(
            Errors.ACL_ONLY_GOVERNANCE_CAN_CALL
        );

        await expect(addressAdmin.OpenSkySettings.setPrepaymentFeeFactor(5)).to.be.revertedWith(
            Errors.ACL_ONLY_GOVERNANCE_CAN_CALL
        );
        await expect(addressAdmin.OpenSkySettings.setOverdueLoanFeeFactor(5)).to.be.revertedWith(
            Errors.ACL_ONLY_GOVERNANCE_CAN_CALL
        );
    });

    it('update whitelist successfully', async function () {
        const { governance, OpenSkySettings } = await setup();

        // add to whitelist
        const nftAddress = randomAddress(),
            nftName = 'Dummy NFT',
            nftSymbol = 'DN',
            LTV = 8000;
        expect(
            await governance.OpenSkySettings.addToWhitelist(
                1,
                nftAddress,
                nftName,
                nftSymbol,
                LTV,
                7 * 24 * 3600,
                365 * 24 * 3600,
                3 * 24 * 3600,
                1 * 24 * 3600
            )
        );
        expect(await OpenSkySettings.inWhitelist(1, nftAddress)).to.be.true;

        // check whitelist detail
        const whitelistInfo = await OpenSkySettings.getWhitelistDetail(1, nftAddress);
        expect(whitelistInfo.enabled).to.be.true;
        expect(whitelistInfo.name).to.be.equal(nftName);
        expect(whitelistInfo.symbol).to.be.equal(nftSymbol);
        expect(whitelistInfo.LTV).to.be.equal(LTV);

        // remove whitelist
        expect(await governance.OpenSkySettings.removeFromWhitelist(1, nftAddress));
        expect(await OpenSkySettings.inWhitelist(1, nftAddress)).to.be.false;
    });

    it('update whitelist fail if caller is not governance', async function () {
        const { addressAdmin } = await setup();
        const nftAddress = randomAddress(),
            nftName = 'Dummy NFT',
            nftSymbol = 'DN',
            LTV = 8000;
        await expect(
            addressAdmin.OpenSkySettings.addToWhitelist(
                1,
                nftAddress,
                nftName,
                nftSymbol,
                LTV,
                7 * 24 * 3600,
                365 * 24 * 3600,
                3 * 24 * 3600,
                1 * 24 * 3600
            )
        ).to.be.revertedWith(Errors.ACL_ONLY_GOVERNANCE_CAN_CALL);
        await expect(addressAdmin.OpenSkySettings.removeFromWhitelist(1, nftAddress)).to.be.revertedWith(
            Errors.ACL_ONLY_GOVERNANCE_CAN_CALL
        );
    });

    it('update whitelist fail if params is not allowed', async function () {
        const { governance, OpenSkySettings } = await setup();

        function addToWhitelist({
            reserveId,
            nftAddress,
            nftNameEmpty,
            nftSymbolEmpty,
            LTV,
            minBorrowDuration,
            maxBorrowDuration,
            extendableDuration,
            overdueDuration,
        }: any) {
            return governance.OpenSkySettings.addToWhitelist(
                reserveId || 1,
                nftAddress || randomAddress(),
                nftNameEmpty ? '' : 'Dummy NFT',
                nftSymbolEmpty ? '' : 'DN',
                LTV || 8000,
                minBorrowDuration || 7 * 24 * 3600,
                maxBorrowDuration || 365 * 24 * 3600,
                extendableDuration || 3 * 24 * 3600,
                overdueDuration || 1 * 24 * 3600
            );
        }
        await expect(addToWhitelist({ reserveId: '0' })).to.be.revertedWith(
            Errors.SETTING_WHITELIST_INVALID_RESERVE_ID
        );
        await expect(addToWhitelist({ nftAddress: ZERO_ADDRESS })).to.be.revertedWith(
            Errors.SETTING_WHITELIST_NFT_ADDRESS_IS_ZERO
        );
        await expect(addToWhitelist({ nftNameEmpty: true })).to.be.revertedWith(
            Errors.SETTING_WHITELIST_NFT_NAME_EMPTY
        );
        await expect(addToWhitelist({ nftSymbolEmpty: true })).to.be.revertedWith(
            Errors.SETTING_WHITELIST_NFT_SYMBOL_EMPTY
        );
        await expect(addToWhitelist({ LTV: '0' })).to.be.revertedWith(Errors.SETTING_WHITELIST_NFT_LTV_NOT_ALLOWED);
        await expect(addToWhitelist({ LTV: 10001 })).to.be.revertedWith(Errors.SETTING_WHITELIST_NFT_LTV_NOT_ALLOWED);
    });
});
