// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
pragma experimental ABIEncoderV2;

import '../interfaces/IOpenSkyMoneymarket.sol';

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '../dependencies/compound/ICEther.sol';
import '../libraries/math/WadRayMath.sol';

interface InterestRateModel {
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) external view returns (uint256);

    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactorMantissa
    ) external view returns (uint256);
}

contract CompoundMoneyMarket is IOpenSkyMoneymarket {
    using SafeMath for uint256;
    using WadRayMath for uint256;
    using PowerMath for uint256;
    address private immutable original;

    uint256 constant blocksPerYear = 2102400; // same as compound

    ICEther public immutable compoundCEther;

    constructor(ICEther compoundCEther_) public {
        compoundCEther = compoundCEther_;
        original = address(this);
    }

    function _requireDelegateCall() private view {
        require(address(this) != original);
    }

    modifier requireDelegateCall() {
        _requireDelegateCall();
        _;
    }

    function depositCall(uint256 amount) external payable override requireDelegateCall {
        compoundCEther.mint{value: amount}();
    }

    function withdrawCall(uint256 amount) external override requireDelegateCall {
        compoundCEther.redeemUnderlying(amount);
    }

    function getBalance(address account) external view override returns (uint256) {
        uint256 exchangeRate = getExchangeRate();
        uint256 balanceOfoToken = compoundCEther.balanceOf(account);

        return exchangeRate.mul(balanceOfoToken).div(1e18);
    }

    function getExchangeRate() public view returns (uint256 exchangeRate) {
        uint256 deltaBlocks = block.number.sub(compoundCEther.accrualBlockNumber());

        uint256 totalCash = address(compoundCEther).balance;
        uint256 totalBorrows = compoundCEther.totalBorrows();
        uint256 totalReserves = compoundCEther.totalReserves();
        uint256 totalSupply = compoundCEther.totalSupply();

        uint256 interestAccumulated = compoundCEther.borrowRatePerBlock().mul(deltaBlocks).mul(totalBorrows).div(1e18);
        totalBorrows = totalBorrows.add(interestAccumulated);
        totalReserves = compoundCEther.reserveFactorMantissa().mul(interestAccumulated).add(totalReserves);

        exchangeRate = (totalCash.add(totalBorrows).sub(totalReserves)).mul(1e18).div(totalSupply);
    }

    // ray
    function getSupplyRate() external view override returns (uint256) {
        uint256 supplyRatePerBlock = compoundCEther.supplyRatePerBlock();
        uint256 blocksPerDay = 6570; // 13.15 seconds per block
        uint256 daysPerYear = 365;
        return (supplyRatePerBlock.mul(blocksPerDay).add(1e18).power(daysPerYear).sub(1e18)).wadToRay();
    }

    function getBlockNumber() public view virtual returns (uint256) {
        return block.number;
    }

    receive() external payable {
        revert('RECEIVE_NOT_ALLOWED');
    }

    fallback() external payable {
        revert('FALLBACK_NOT_ALLOWED');
    }
}

library PowerMath {
    function power(uint256 a, uint256 b) internal pure returns (uint256) {
        if (b == 1) {
            return a;
        }
        uint256 half = power(a, b / 2);
        if (b % 2 == 1) {
            return (((half * half) / 1 ether) * a) / 1 ether;
        } else {
            return (half * half) / 1 ether;
        }
    }
}
