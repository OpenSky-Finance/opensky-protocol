import { BigNumber, Contract, ContractTransaction, Transaction } from 'ethers';
// @ts-ignore
import { ethers } from 'hardhat';
import { defaultAbiCoder, formatUnits, keccak256, solidityPack,
 } from 'ethers/lib/utils';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { _TypedDataEncoder } from '@ethersproject/hash';
const { BigNumber: BN } = require('@ethersproject/bignumber');
import { expect } from './chai';
import crypto from 'crypto';

export async function setupUsers<T extends { [contractName: string]: Contract }>(
    addresses: string[],
    contracts: T
): Promise<({ address: string } & T)[]> {
    const users: ({ address: string } & T)[] = [];
    for (const address of addresses) {
        users.push(await setupUser(address, contracts));
    }
    return users;
}

export async function setupUser<T extends { [contractName: string]: Contract }>(address: string, contracts: T): Promise<{ address: string } & T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = { address };
    for (const key of Object.keys(contracts)) {
        user[key] = contracts[key].connect(await ethers.getSigner(address));
    }

    user.gasSpent = new BN.from(0);
    user.getETHBalance = async () => {
        return await ethers.provider.getBalance(address);
    };

    return user as { address: string } & T;
}

export const waitForTx = async (tx: ContractTransaction) => await tx.wait(1);

export const getETHBalance = async (address: string) => {
    return await ethers.provider.getBalance(address);
};

export const advanceBlock = async (timestamp?: number) => await ethers.provider.send('evm_mine', timestamp ? [timestamp] : []);

export const advanceBlocks = async (amount: number, timestamp?: number) => {
    console.log('\n >>>>>>>>>>> advanceBlocks:', amount, timestamp);
    for (let i = 0; i < amount; i++) {
        await ethers.provider.send('evm_mine', timestamp ? [timestamp] : []);
    }
};

export const increaseTime = async (secondsToIncrease: number) => {
    await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
    await ethers.provider.send('evm_mine', []);
};

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

    if (currentBlock === null) {
        /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183*/
        await ethers.provider.send('evm_increaseTime', [forwardTime]);
        await ethers.provider.send('evm_mine', []);
        //Set the next blocktime back to 15 seconds
        await ethers.provider.send('evm_increaseTime', [15]);
        return;
    }
    const currentTime = currentBlock.timestamp;
    const futureTime = currentTime + forwardTime;
    await ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
    await ethers.provider.send('evm_mine', []);
};

export const getTxCost = async (tx: any) => {
    const receipt = await tx.wait();
    return tx.gasPrice.mul(receipt.gasUsed);
};

export const getTxGasUsed = async (tx: any) => {
    const receipt = await tx.wait();
    return receipt.gasUsed;
};

export const getCurrentBlockAndTimestamp = async () => {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
    return {
        timestamp: currentBlock.timestamp,
        blockNumber: currentBlock.number,
    };
};

export const formatTraderAccountData = function (data: any) {
    const ret = {
        oTokenAmount: formatUnits(data.oTokenAmount, 1),
        cumulativeScore: formatUnits(data.cumulativeScore, 1),
        lastSupplyCumulativeIndex: formatUnits(data.lastSupplyCumulativeIndex, 27),
        supplyRate: formatUnits(data.supplyRate, 27),
    };
    return ret;
};

export function almostEqual(num1: BigNumber, num2: BigNumber, tolerance: number = 10) {
    return num1.gt(num2) ? num1.sub(num2).lt(tolerance) : num2.sub(num1).lt(tolerance);
}

export async function checkEvent(tx: ContractTransaction, name: string, args: any[] = []) {
    const receipt = await waitForTx(tx);
    let event: any;
    if (receipt.events && receipt.events.length > 0) {
        event = receipt.events.find(({event}) => event === name);
    }
    expect(event.event).to.be.equal(name, `Incorrect event emitted`);
    expect(event.args?.length || 0 / 2).to.be.equal(args.length, `${name} signature are wrong`);
    args.forEach((arg, index) => {
        expect(event.args && event.args[index].toString()).to.be.equal(
            arg.toString(),
            `${name} has incorrect value on position ${index}`
        );
    });
}

export async function checkETHBalance(sender: any, txPromise: any, diff: BigNumber): Promise<ContractTransaction> {
    let ethBalanceBeforeTx = await sender.getETHBalance();
    let tx = await txPromise;
    let gasCost = await getTxCost(tx);
    let ethBalanceAfterTx = await sender.getETHBalance();
    if (ethBalanceAfterTx.gt(ethBalanceBeforeTx)) {
        expect(almostEqual(
            ethBalanceAfterTx.sub(ethBalanceBeforeTx),
            diff.sub(gasCost)
        )).to.be.true;
    } else {
        expect(almostEqual(
            ethBalanceBeforeTx.sub(ethBalanceAfterTx),
            diff.add(gasCost)
        )).to.be.true;
    }
    return tx;
}

export function randomAddress() {
    let id = crypto.randomBytes(32).toString('hex');
    let privateKey = "0x"+id;
    let wallet = new ethers.Wallet(privateKey);
    return wallet.address;
}

export function signBorrowOffer(offerData: any, signer: any) {
    const types = [
        'bytes32',
        'uint256', //reserveId
        'address', //nftAddress
        'uint256', //tokenId
        'uint256', //tokenAmount
        'address', //borrower
        'uint256', //amount
        'uint256', //amount2
        'uint256', //borrowDuration
        'uint256', //borrowDuration2
        'uint256', //borrowRate
        'address', //currency
        'uint256', //nonce
        'uint256', //deadline
        // 'bytes32',
    ];

    const values = [
        '0xacdf87371514724eb8e74db090d21dbc2361a02a72e2facac480fe7964ae4feb',
        offerData.reserveId,
        offerData.nftAddress,
        offerData.tokenId,
        offerData.tokenAmount,
        offerData.borrower,
        offerData.borrowAmountMin,
        offerData.borrowAmountMax,
        offerData.borrowDurationMin,
        offerData.borrowDurationMax,
        offerData.borrowRate,
        offerData.currency,
        offerData.nonce,
        offerData.deadline,
        // keccak256(offerData.params),
    ];

    const domain: TypedDataDomain = {
        name: 'OpenSkyBespokeMarket',
        version: '1',
        chainId: '31337', // HRE
        verifyingContract: offerData.verifyingContract,
    };
    const domainSeparator = _TypedDataEncoder.hashDomain(domain);
    const hash = keccak256(defaultAbiCoder.encode(types, values));

    // Compute the digest
    const digest = keccak256(
        solidityPack(['bytes1', 'bytes1', 'bytes32', 'bytes32'], ['0x19', '0x01', domainSeparator, hash])
    );

    return { ...signer._signingKey().signDigest(digest) };
}

