// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

// aave-v2
interface IAaveLendPoolAddressesProvider {
    function getLendingPool() external view returns (address);
    
}
