import { parseEther, formatEther, formatUnits } from 'ethers/lib/utils';

import chai from '../../helpers/chai';
import { waitForTx, getTxCost, advanceTimeAndBlock } from '../../helpers/utils';
const { expect } = chai;

export const deposit = async (
    testEnv: any,
    reserveId: number,
    referralCode: number,
    user: string,
    amount: string,
    expected: string,
    revertMessage?: string
) => {
    if (expected === 'success') {
        await waitForTx(
            await testEnv[user].OpenSkyPool.deposit(reserveId, referralCode, { value: parseEther(amount) })
        );
    } else if (expected === 'revert') {
        if (revertMessage != null) {
            await expect(
                testEnv[user].OpenSkyPool.deposit(reserveId, referralCode, { value: parseEther(amount) })
            ).to.revertedWith(revertMessage);
        } else {
            await expect(
                testEnv[user].OpenSkyPool.deposit(reserveId, referralCode, { value: parseEther(amount) }),
                revertMessage
            ).to.be.reverted;
        }
    }
};

export const withdraw = async (
    testEnv: any,
    reserveId: number,
    user: string,
    amount: string,
    expected: string,
    revertMessage?: string
) => {
    if (expected === 'success') {
        await waitForTx(await testEnv[user].OpenSkyPool.withdraw(reserveId, parseEther(amount)));
    } else if (expected === 'revert') {
        if (revertMessage != null) {
            await expect(testEnv[user].OpenSkyPool.withdraw(reserveId, parseEther(amount))).to.revertedWith(
                revertMessage
            );
        } else {
            await expect(testEnv[user].OpenSkyPool.withdraw(reserveId, parseEther(amount)), revertMessage).to.be
                .reverted;
        }
    }
};

export const borrow = async (
    testEnv: any,
    reserveId: number,
    user: string,
    amount: string,
    duration: number,
    nftAddress: string,
    tokenId: number,
    onBehalfOf: string,
    expected: string,
    revertMessage?: string
) => {
    if (expected === 'success') {
        await waitForTx(
            await testEnv[user].OpenSkyPool.borrow(
                reserveId,
                parseEther(amount),
                duration,
                testEnv[nftAddress].address,
                tokenId,
                testEnv[onBehalfOf].address
            )
        );
    } else if (expected === 'revert') {
        if (revertMessage != null) {
            await expect(
                testEnv[user].OpenSkyPool.borrow(
                    reserveId,
                    parseEther(amount),
                    duration,
                    nftAddress,
                    tokenId,
                    onBehalfOf
                )
            ).to.revertedWith(revertMessage);
        } else {
            await expect(
                testEnv[user].OpenSkyPool.borrow(
                    reserveId,
                    parseEther(amount),
                    duration,
                    nftAddress,
                    tokenId,
                    onBehalfOf
                ),
                revertMessage
            ).to.be.reverted;
        }
    }
};

export const repay = async (
    testEnv: any,
    reserveId: number,
    user: string,
    amount: string,
    loanId: number,
    expected: string,
    revertMessage?: string
) => {
    if (expected === 'success') {
        await waitForTx(await testEnv[user].OpenSkyPool.repay(loanId, { value: parseEther(amount) }));
    } else if (expected === 'revert') {
        if (revertMessage != null) {
            await expect(testEnv[user].OpenSkyPool.repay(loanId, { value: parseEther(amount) })).to.revertedWith(
                revertMessage
            );
        } else {
            await expect(testEnv[user].OpenSkyPool.repay(loanId, { value: parseEther(amount) }), revertMessage).to.be
                .reverted;
        }
    }
};

export const extend = async (
    testEnv: any,
    reserveId: number,
    user: string,
    oldLoanId: number,
    amount: string,
    duration: number,
    expected: string,
    revertMessage?: string
) => {
    if (expected === 'success') {
        await waitForTx(
            await testEnv[user].OpenSkyPool.extend(oldLoanId, parseEther(amount), duration, {
                value: parseEther(amount),
            })
        );
    } else if (expected === 'revert') {
        if (revertMessage != null) {
            await expect(
                testEnv[user].OpenSkyPool.extend(oldLoanId, parseEther(amount), duration, { value: parseEther(amount) })
            ).to.revertedWith(revertMessage);
        } else {
            await expect(
                testEnv[user].OpenSkyPool.extend(oldLoanId, parseEther(amount), duration, {
                    value: parseEther(amount),
                }),
                revertMessage
            ).to.be.reverted;
        }
    }
};

export const passTime = async (time: number) => {
    await advanceTimeAndBlock(time);
};
