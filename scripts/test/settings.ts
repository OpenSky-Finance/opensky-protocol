import { expect } from '../helpers/chai';
import { __setup } from './__setup';
import { randomAddress } from '../helpers/utils';
import { parseEther } from 'ethers/lib/utils';

describe('settings', function () {
    async function setup() {
        const ENV = await __setup();
        const { ACLManager, nftStaker: addressAdmin, buyer001: governance } = ENV; 
        await ACLManager.addAddressAdmin(addressAdmin.address);
        await ACLManager.addGovernance(governance.address);
        return { ...ENV, addressAdmin, governance };
    }
          
    it('set address successfully', async function () {
        const { addressAdmin, OpenSkySettings } = await setup();
        const MoneyMarketAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setMoneyMarketAddress(MoneyMarketAddress));
        expect(await OpenSkySettings.moneyMarketAddress()).to.be.equal(MoneyMarketAddress);

        const TreasuryAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setTreasuryAddress(TreasuryAddress));
        expect(await OpenSkySettings.treasuryAddress()).to.be.equal(TreasuryAddress);

        const IncentiveController = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setIncentiveControllerAddress(IncentiveController));
        expect(await OpenSkySettings.incentiveControllerAddress()).to.be.equal(IncentiveController);

        const PoolAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setPoolAddress(PoolAddress));
        expect(await OpenSkySettings.poolAddress()).to.be.equal(PoolAddress);

        const VaultFactoryAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setVaultFactoryAddress(VaultFactoryAddress));
        expect(await OpenSkySettings.vaultFactoryAddress()).to.be.equal(VaultFactoryAddress);

        const LoanAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setLoanAddress(LoanAddress));
        expect(await OpenSkySettings.loanAddress()).to.be.equal(LoanAddress);

        const LoanDescriptorAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setLoanDescriptorAddress(LoanDescriptorAddress));
        expect(await OpenSkySettings.loanDescriptorAddress()).to.be.equal(LoanDescriptorAddress);

        const NFTPriceOracleAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setNftPriceOracleAddress(NFTPriceOracleAddress));
        expect(await OpenSkySettings.nftPriceOracleAddress()).to.be.equal(NFTPriceOracleAddress);

        const InterestRateStrategyAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setInterestRateStrategyAddress(InterestRateStrategyAddress));
        expect(await OpenSkySettings.interestRateStrategyAddress()).to.be.equal(InterestRateStrategyAddress);

        const PunkGatewayAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setPunkGatewayAddress(PunkGatewayAddress));
        expect(await OpenSkySettings.punkGatewayAddress()).to.be.equal(PunkGatewayAddress);

        const ACLManagerAddress = randomAddress();
        expect(await addressAdmin.OpenSkySettings.setACLManagerAddress(ACLManagerAddress));
        expect(await OpenSkySettings.ACLManagerAddress()).to.be.equal(ACLManagerAddress);
    });

    it('set address fail if caller is not address admin', async function () {
        const { governance } = await setup();
        await expect(governance.OpenSkySettings.setMoneyMarketAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setACLManagerAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setTreasuryAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setIncentiveControllerAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setPoolAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setVaultFactoryAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setLoanAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setLoanDescriptorAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setNftPriceOracleAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
        await expect(governance.OpenSkySettings.setInterestRateStrategyAddress(randomAddress())).to.be.revertedWith('ACL_ONLY_ADDRESS_ADMIN_CAN_CALL');
    });

    it('set governance parameter successfully', async function () {
        const { governance } = await setup();
        expect(await governance.OpenSkySettings.setReserveFactor(1));
        expect(await governance.OpenSkySettings.reserveFactor()).to.be.equal(1);
        expect(await governance.OpenSkySettings.setLiquidateReserveFactor(10));
        expect(await governance.OpenSkySettings.liquidateReserveFactor()).to.be.equal(10);
        expect(await governance.OpenSkySettings.setPrepaymentFeeFactor(5));
        expect(await governance.OpenSkySettings.prepaymentFeeFactor()).to.be.equal(5);
        expect(await governance.OpenSkySettings.setOverdueLoanFeeFactor(5));
        expect(await governance.OpenSkySettings.overdueLoanFeeFactor()).to.be.equal(5);
        expect(await governance.OpenSkySettings.setOverdueDuration(60));
        expect(await governance.OpenSkySettings.overdueDuration()).to.be.equal(60);
        expect(await governance.OpenSkySettings.setExtendableDuration(10));
        expect(await governance.OpenSkySettings.extendableDuration()).to.be.equal(10);
        expect(await governance.OpenSkySettings.setMinBorrowDuration(600));
        expect(await governance.OpenSkySettings.minBorrowDuration()).to.be.equal(600);
        expect(await governance.OpenSkySettings.setMaxBorrowDuration(6000));
        expect(await governance.OpenSkySettings.maxBorrowDuration()).to.be.equal(6000);
    });

    it('set governance parameter fail if caller is not governance', async function () {
        const { addressAdmin } = await setup();
        await expect(addressAdmin.OpenSkySettings.setReserveFactor(1)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setLiquidateReserveFactor(10)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setPrepaymentFeeFactor(5)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setOverdueLoanFeeFactor(5)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setOverdueDuration(60)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setExtendableDuration(10)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setMinBorrowDuration(600)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.setMaxBorrowDuration(6000)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
    });

    it('update whitelist successfully', async function () {
        const { governance, OpenSkySettings } = await setup();

        // close whitelist
        expect(await governance.OpenSkySettings.closeWhitelist());
        expect(await governance.OpenSkySettings.isWhitelistOn()).to.be.false;

        // open whitelist
        expect(await governance.OpenSkySettings.openWhitelist());
        expect(await governance.OpenSkySettings.isWhitelistOn()).to.be.true;

        // add to whitelist
        const nftAddress = randomAddress(), nftName = 'Dummy NFT', nftSymbol = 'DN', LTV = 8000;
        expect(await governance.OpenSkySettings.addToWhitelist(
            nftAddress, nftName, nftSymbol, LTV
        ));
        expect(await OpenSkySettings.inWhitelist(nftAddress)).to.be.true;

        // check whitelist detail
        const whitelistInfo = await OpenSkySettings.getWhitelistDetail(nftAddress);
        expect(whitelistInfo.enabled).to.be.true;
        expect(whitelistInfo.name).to.be.equal(nftName);
        expect(whitelistInfo.symbol).to.be.equal(nftSymbol);
        expect(whitelistInfo.LTV).to.be.equal(LTV);

        // remove whitelist
        expect(await governance.OpenSkySettings.removeFromWhitelist(nftAddress));
        expect(await OpenSkySettings.inWhitelist(nftAddress)).to.be.false;
    });

    it('update whitelist fail if caller is not governance', async function () {
        const { addressAdmin } = await setup();
        await expect(addressAdmin.OpenSkySettings.closeWhitelist()).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.openWhitelist()).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        const nftAddress = randomAddress(), nftName = 'Dummy NFT', nftSymbol = 'DN', LTV = 8000;
        await expect(addressAdmin.OpenSkySettings.addToWhitelist(
            nftAddress, nftName, nftSymbol, LTV
        )).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
        await expect(addressAdmin.OpenSkySettings.removeFromWhitelist(nftAddress)).to.be.revertedWith('ACL_ONLY_GOVERNANCE_CAN_CALL');
    });
});