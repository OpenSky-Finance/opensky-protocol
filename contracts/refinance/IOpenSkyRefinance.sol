// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '../bespokemarket/libraries/BespokeTypes.sol';

interface IOpenSkyRefinance {

    function refinance(
        address adapter,
        address flashBorrowAssetAddress,
        uint256 flashBorrowAmount,
        bytes calldata data
    ) external;
}
