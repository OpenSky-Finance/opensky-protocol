import { expect } from '../helpers/chai';
import _ from 'lodash';
import { ZERO_ADDRESS } from '../helpers/constants';

import { __setup, checkPoolEquation, deposit } from './__setup';
import { parseEther } from 'ethers/lib/utils';
import { advanceTimeAndBlock } from '../helpers/utils';
import { Errors } from "../helpers/constants"

describe('pool emergency', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { ACLManager, deployer, buyer001: emergencyAdmin } = ENV;
        await ACLManager.addEmergencyAdmin(emergencyAdmin.address);
        await ACLManager.removeEmergencyAdmin(deployer.address);
        ENV.emergencyAdmin = emergencyAdmin;
    });

    afterEach(async () => {
        await checkPoolEquation();
    });

    it('pause fail if caller is not emergency admin', async function () {
        const { OpenSkyPool } = ENV;
        await expect(OpenSkyPool.pause()).to.revertedWith(Errors.ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL);
    });

    it('deposit fail', async function () {
        const { emergencyAdmin, user002 } = ENV;
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(deposit(user002, 1, parseEther('0.1'))).to.revertedWith(
            'Pausable: paused'
        );
    });

    it('withdraw fail', async function () {
        const { emergencyAdmin, user002 } = ENV;

        // await buyer002.OpenSkyPool.deposit(1, 0, { value: parseEther('0.1') });
        await deposit(user002, 1, parseEther('0.1'));

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(user002.OpenSkyPool.withdraw(1, parseEther('0.1'), user002.address)).to.revertedWith('Pausable: paused');
    });

    it('borrow fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user003, 1, parseEther('0.8'));

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            borrower.OpenSkyPool.borrow(
                1,
                parseEther('1.5'),
                365 * 24 * 3600,
                OpenSkyNFT.address,
                1,
                borrower.address
            )
        ).to.revertedWith('Pausable: paused');
    });

    it('repay fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user002, 1, parseEther('0.8'));

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        await advanceTimeAndBlock(364 * 24 * 3600);

        await emergencyAdmin.OpenSkyPool.pause();

        await expect(borrower.OpenSkyPool.repay(1)).to.revertedWith('Pausable: paused');
    });

    it('extend fail', async function () {
        const { OpenSkyNFT, emergencyAdmin, user002, user003, borrower } = ENV;

        await deposit(user002, 1, parseEther('1.1'));
        await deposit(user002, 1, parseEther('0.8'));

        await borrower.OpenSkyPool.borrow(
            1,
            parseEther('1.5'),
            365 * 24 * 3600,
            OpenSkyNFT.address,
            1,
            borrower.address
        );

        await advanceTimeAndBlock(360 * 24 * 3600);
        await emergencyAdmin.OpenSkyPool.pause();

        await expect(
            borrower.OpenSkyPool.extend(1, parseEther('1.8'), 30 * 24 * 3600, borrower.address)
        ).to.revertedWith('Pausable: paused');
    });
});

describe('pool switch money market on/off', function () {
    let ENV: any;
    beforeEach(async () => {
        ENV = await __setup();
        const { ACLManager, deployer:governance,  user001: emergencyAdmin, user002, user003 , MoneyMarket} = ENV;
        await ACLManager.addEmergencyAdmin(emergencyAdmin.address);
        ENV.emergencyAdmin = emergencyAdmin;

        await deposit(user002, 1, parseEther('1.23211217'));
        await deposit(user003, 1, parseEther('3.36232616'));
    });

    it('switch money market off successfully', async function () {
        const { UnderlyingAsset, OpenSkyOToken, emergencyAdmin, user002 } = ENV;
        const totalSupply = await OpenSkyOToken.totalSupply();

        expect(await UnderlyingAsset.balanceOf(OpenSkyOToken.address)).to.be.equal(0);

        // await emergencyAdmin.OpenSkyPool.switchMoneyMarket(1, false);
        await emergencyAdmin.OpenSkyPool.closeMoneyMarket(1);

        expect(await UnderlyingAsset.balanceOf(OpenSkyOToken.address)).to.be.equal(totalSupply);

        await user002.OpenSkyPool.withdraw(1, parseEther('1.23211217'), user002.address);
    });

    it('switch money market on successfully', async function () {
        const { UnderlyingAsset, OpenSkyOToken, MoneyMarket, emergencyAdmin } = ENV;
        const totalSupply = await OpenSkyOToken.totalSupply();

        // await emergencyAdmin.OpenSkyPool.switchMoneyMarket(1, false);
        await emergencyAdmin.OpenSkyPool.closeMoneyMarket(1);

        expect(await UnderlyingAsset.balanceOf(OpenSkyOToken.address)).to.be.equal(totalSupply);
        expect(await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address)).to.be.equal(0);

        // await emergencyAdmin.OpenSkyPool.switchMoneyMarket(1, true);
        await emergencyAdmin.OpenSkyPool.openMoneyMarket(1);

        expect(await UnderlyingAsset.balanceOf(OpenSkyOToken.address)).to.be.equal(0);
        expect(await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address)).to.be.equal(totalSupply);
    });

    it('get money market balance, if money market is off', async function () {
        const { OpenSkyPool, OpenSkyOToken, emergencyAdmin } = ENV;
        const totalSupply = await OpenSkyOToken.totalSupply();

        // await emergencyAdmin.OpenSkyPool.switchMoneyMarket(1, false);
        await emergencyAdmin.OpenSkyPool.closeMoneyMarket(1);

        expect(await OpenSkyPool.getAvailableLiquidity(1)).to.be.equal(totalSupply);
    });

    it('get money market balance, if money market is on', async function () {
        const { OpenSkyPool, OpenSkyOToken, UnderlyingAsset, MoneyMarket, emergencyAdmin, user002 } = ENV;

        await deposit(user002, 1, parseEther('2.18932832'));

        const totalSupply = await OpenSkyOToken.totalSupply();
        expect(await MoneyMarket.getBalance(UnderlyingAsset.address, OpenSkyOToken.address)).to.be.equal(totalSupply);
    });

    it('switch money market on/off fail, if caller is not emergency admin', async function () {
        const { user002: fakePoolAdmin } = ENV;
        await expect(fakePoolAdmin.OpenSkyPool.openMoneyMarket(1)).to.revertedWith(Errors.ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL);
        await expect(fakePoolAdmin.OpenSkyPool.closeMoneyMarket(1)).to.revertedWith(Errors.ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL);
    });

    it('set money market fail, if newState == oldState', async function () {
        const { OpenSkyPool, emergencyAdmin } = ENV;

        expect((await OpenSkyPool.getReserveData(1)).isMoneyMarketOn).to.be.true;
        await expect(emergencyAdmin.OpenSkyPool.openMoneyMarket(1)).to.revertedWith(Errors.RESERVE_SWITCH_MONEY_MARKET_STATE_ERROR);

        await emergencyAdmin.OpenSkyPool.closeMoneyMarket(1);

        expect((await OpenSkyPool.getReserveData(1)).isMoneyMarketOn).to.be.false;
        await expect(emergencyAdmin.OpenSkyPool.closeMoneyMarket(1)).to.revertedWith(Errors.RESERVE_SWITCH_MONEY_MARKET_STATE_ERROR);
    });
    
    // creat pool with money market off and open manualy
    it('creat pool with money market off and open manually', async function () {
        const { ACLManager,OpenSkySettings, OpenSkyPool , WNative, deployer:governance,  user001: emergencyAdmin, user002, user003 , MoneyMarket} = ENV;

        await governance.OpenSkySettings.setMoneyMarketAddress(ZERO_ADDRESS)
        
        // creat a new eth reserve  
        await OpenSkyPool.create(WNative.address, 'OpenSky ETH2', 'OETH2', 18);
        
        const RESERVE_ID= 4 // TODO opt
        const oTokenAddress = (await OpenSkyPool.getReserveData(RESERVE_ID)).oTokenAddress
        
        expect((await OpenSkyPool.getReserveData(RESERVE_ID)).isMoneyMarketOn).to.be.false;
        await deposit(user002, RESERVE_ID, parseEther('1.5'));

        expect(await WNative.balanceOf(oTokenAddress)).to.eq(parseEther('1.5'))
        
        await governance.OpenSkyPool.setMoneyMarket(RESERVE_ID, MoneyMarket.address);
        expect((await OpenSkyPool.getReserveData(RESERVE_ID)).isMoneyMarketOn).to.be.true;
        
        //  check balance
        expect(await WNative.balanceOf(oTokenAddress)).to.eq(0)
        
        await emergencyAdmin.OpenSkyPool.closeMoneyMarket(RESERVE_ID);
        expect((await OpenSkyPool.getReserveData(RESERVE_ID)).isMoneyMarketOn).to.be.false;

        // check balance
        expect(await WNative.balanceOf(oTokenAddress)).to.eq(parseEther('1.5'))

        await governance.OpenSkyPool.setMoneyMarket(RESERVE_ID, MoneyMarket.address);
        expect((await OpenSkyPool.getReserveData(RESERVE_ID)).isMoneyMarketOn).to.be.true;

        // check balance
        expect(await WNative.balanceOf(oTokenAddress)).to.eq(0)
    })
    
 
    

});
