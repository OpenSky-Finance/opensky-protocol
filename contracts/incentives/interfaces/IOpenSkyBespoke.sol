// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface IOpenSkyBespoke {

    //settings
    function marketAddress() external view returns (address);

    // market
    function totalBorrow(address currency) external view returns (uint256);
    function userBorrow(address currency, address account) external view returns (uint256);
    function totalLend(address currency) external view returns (uint256);
    function userLend(address currency, address account) external view returns (uint256);
    
}
