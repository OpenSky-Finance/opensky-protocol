pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import './dependencies/token/ERC20/IERC20.sol';
import './interfaces/IAToken.sol';

import './dependencies/token/ERC20/SafeERC20.sol';

import {ILendingPool} from './interfaces/ILendingPool.sol';

contract AAVELendingPool {
    using SafeERC20 for IERC20;

    mapping(address => ILendingPool.ReserveData) internal _reserves;

    constructor() {}

    // helper
    function addReserve(address underlyingAsset, address aToken) external {
        _reserves[underlyingAsset].aTokenAddress = aToken;
    }

    function deposit(
        address underlyingAsset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        address aToken = _reserves[underlyingAsset].aTokenAddress;
        IERC20(underlyingAsset).safeTransferFrom(msg.sender, aToken, amount);

        IAToken(aToken).mint(onBehalfOf, amount);
    }

    function simulateInterestIncrease(address underlyingAsset, address onBehalfOf, uint256 amount) external {
        address aToken = _reserves[underlyingAsset].aTokenAddress;
        IAToken(aToken).mint(onBehalfOf, amount);
    }

    function withdraw(
        address underlyingAsset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        uint256 amountToWithdraw = amount;

        address aToken = _reserves[underlyingAsset].aTokenAddress;
        IAToken(aToken).burn(msg.sender, to, amountToWithdraw);

        return amountToWithdraw;
    }

    function getReserveData(address underlyingAsset) public view returns (ILendingPool.ReserveData memory) {
        return _reserves[underlyingAsset];
    }
}
