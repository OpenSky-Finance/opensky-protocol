import BigNumber from 'bignumber.js';
import { BigNumber as BigNumberEthers, BigNumberish } from 'ethers';
import { formatEther, formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';

// ----------------
// MATH
// ----------------

export const PERCENTAGE_FACTOR = '10000';
export const HALF_PERCENTAGE = '5000';
export const WAD = Math.pow(10, 18).toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO = Math.pow(10, 9).toString();
export const MAX_UINT_AMOUNT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
export const MAX_UINT_128_AMOUNT = '340282366920938463463374607431768211455';
// export const ONE_ETH = new BigNumber(Math.pow(10, 18));
export const ONE_YEAR = 31536000;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';

// eth
export const ONE_ETH = parseEther('1');

// ethers big number
export const MAX_UINT_128 = BigNumberEthers.from('340282366920938463463374607431768211455');
export const MAX_UINT_256 = BigNumberEthers.from(
    '115792089237316195423570985008687907853269984665640564039457584007913129639935'
);

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY).toFixed();
export const RATE_SLOPE1 = new BigNumber(0.08).times(RAY).toFixed();
export const RATE_SLOPE2 = new BigNumber(1).times(RAY).toFixed();
export const BASE_RATE = new BigNumber(0.02).times(RAY).toFixed();
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY).toFixed();

export const RANDOM_ADDRESSES = [
    '0x0000000000000000000000000000000000000221',
    '0x0000000000000000000000000000000000000321',
    '0x0000000000000000000000000000000000000211',
    '0x0000000000000000000000000000000000000251',
    '0x0000000000000000000000000000000000000271',
    '0x0000000000000000000000000000000000000291',
    '0x0000000000000000000000000000000000000321',
    '0x0000000000000000000000000000000000000421',
    '0x0000000000000000000000000000000000000521',
    '0x0000000000000000000000000000000000000621',
    '0x0000000000000000000000000000000000000721',
];

export const enum LOAN_STATUS {
    BORROWING,
    EXTENDABLE,
    OVERDUE,
    LIQUIDATABLE,
    LIQUIDATING,
    END,
}

export const enum AUCTION_STATUS {
    LIVE,
    END, // bought
    CANCELED,
}

export const POOL_ID = 1;
