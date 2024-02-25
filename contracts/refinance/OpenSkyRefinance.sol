// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import './interfaces/IAaveLendPoolAddressesProvider.sol';
import './interfaces/IAaveLendPool.sol';

import './IOpenSkyRefinance.sol';

contract OpenSkyRefinance is IOpenSkyRefinance {
    IAaveLendPoolAddressesProvider public immutable AAVE2_ADDRESSES_PROVIDER;

    constructor(IAaveLendPoolAddressesProvider provider) {
        AAVE2_ADDRESSES_PROVIDER = provider;
    }

    function aavePool() public view returns (IAaveLendPool) {
        return IAaveLendPool(AAVE2_ADDRESSES_PROVIDER.getLendingPool());
    }

    function refinance(
        address adapter,
        address flashBorrowAssetAddress,
        uint256 flashBorrowAmount,
        bytes calldata data
    ) public override {
        address[] memory assets = new address[](1);
        assets[0] = flashBorrowAssetAddress;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashBorrowAmount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;
        bytes memory params = abi.encode(data, msg.sender);
        aavePool().flashLoan(adapter, assets, amounts, modes, address(0), params, 0);
    }
}
