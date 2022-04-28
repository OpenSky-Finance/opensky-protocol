import { deposit, withdraw, borrow, repay, extend, passTime } from './actions';

export interface Action {
    name: string;
    args?: any;
    expected: string;
    revertMessage?: string;
}

export interface Story {
    description: string;
    actions: Action[];
}

export interface Scenario {
    title: string;
    description: string;
    stories: Story[];
}

export const executeStory = async (story: Story, testEnv: any) => {
    for (const action of story.actions) {
        // const { users } = testEnv;
        await executeAction(action, testEnv);
    }
};

const executeAction = async (action: Action, testEnv: any) => {
    const { reserveId } = action.args;
    const { name, expected, revertMessage } = action;
    if (!name || name === '') {
        throw 'Action name is missing';
    }
    if (!reserveId || reserveId === '') {
        throw 'Invalid reserve selected for deposit';
    }
    if (!expected || expected === '') {
        throw `An expected resut for action ${name} is required`;
    }

    switch (name) {
        case 'deposit':
            {
                const { reserveId, referralCode, user, amount } = action.args;
                if (!amount || amount === '') {
                    throw `Invalid amount to deposit into the ${reserveId} reserve`;
                }
                await deposit(testEnv, reserveId, referralCode, user, amount, expected, revertMessage);
            }
            break;

        case 'withdraw':
            {
                const { reserveId, user, amount } = action.args;
                if (!amount || amount === '') {
                    throw `Invalid amount to deposit into the ${reserveId} reserve`;
                }
                await withdraw(testEnv, reserveId, user, amount, expected, revertMessage);
            }
            break;

        case 'borrow':
            {
                const { reserveId, user, amount, duration, nftAddress, tokenId, onBehalfOf } = action.args;
                if (!amount || amount === '' || !duration || !testEnv[nftAddress] || !testEnv[onBehalfOf]) {
                    throw `Invalid parmas for borrow `;
                }

                await borrow(
                    testEnv,
                    reserveId,
                    user,
                    amount,
                    duration,
                    nftAddress,
                    tokenId,
                    onBehalfOf,
                    expected,
                    revertMessage
                );
            }
            break;

        case 'repay':
            {
                const { reserveId, user, amount, loanId } = action.args;
                if (!loanId || loanId === '') {
                    throw `Invalid parmas for repay`;
                }
                await repay(testEnv, reserveId, user, amount, loanId, expected, revertMessage);
            }
            break;

        case 'extend':
            {
                const { reserveId, user, loanId, amount, duration } = action.args;
                if (!loanId || loanId === '' || !amount || !duration) {
                    throw `Invalid parmas for extend`;
                }
                await extend(testEnv, reserveId, user, loanId, amount, duration, expected, revertMessage);
            }
            break;

        case 'passTime': {
            const { duration } = action.args;
            await passTime(duration);
        }

        default:
            throw `Invalid action requested: ${name}`;
    }
};
