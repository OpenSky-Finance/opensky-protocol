import { BigNumber } from 'ethers';
import { BigNumberValue, valueToZDBigNumber } from './bignumber';

export const WAD = valueToZDBigNumber(10).pow(18);
export const HALF_WAD = WAD.dividedBy(2);

export const RAY = valueToZDBigNumber(10).pow(27);
export const HALF_RAY = RAY.dividedBy(2);

export const WAD_RAY_RATIO = valueToZDBigNumber(10).pow(9);

export function wadMul(a: BigNumberValue, b: BigNumberValue): BigNumber {
  return BigNumber.from(HALF_WAD.plus(valueToZDBigNumber(a).multipliedBy(b.toString())).div(WAD).toString());
}

export function wadDiv(a: BigNumberValue, b: BigNumberValue): BigNumber {
  const halfB = valueToZDBigNumber(b).div(2);

  return BigNumber.from(halfB.plus(valueToZDBigNumber(a).multipliedBy(WAD)).div(b.toString()).toString());
}

export function rayMul(a: BigNumberValue, b: BigNumberValue): BigNumber {
  return BigNumber.from(HALF_RAY.plus(valueToZDBigNumber(a).multipliedBy(b.toString())).div(RAY).toString());
}

export function rayDiv(a: BigNumberValue, b: BigNumberValue): BigNumber {
  const halfB = valueToZDBigNumber(b).div(2);

  return BigNumber.from(halfB.plus(valueToZDBigNumber(a).multipliedBy(RAY)).div(b.toString()).toString());
}

export function rayToWad(a: BigNumberValue): BigNumber {
  const halfRatio = valueToZDBigNumber(WAD_RAY_RATIO).div(2);

  return BigNumber.from(halfRatio.plus(a.toString()).div(WAD_RAY_RATIO).toString());
}

export function wadToRay(a: BigNumberValue): BigNumber {
  return BigNumber.from(valueToZDBigNumber(a).multipliedBy(WAD_RAY_RATIO).decimalPlaces(0).toString());
}

export function rayToDecimal(a: BigNumberValue): BigNumber {
  return BigNumber.from(valueToZDBigNumber(a).dividedBy(RAY).toString());
}
