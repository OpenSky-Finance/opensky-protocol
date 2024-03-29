// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

// copy from compound src
interface CErc20Interface {
    
    /*** User Interface ***/
    function transfer(address dst, uint256 amount) external returns (bool);
    function transferFrom(address src, address dst, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function getAccountSnapshot(address account) external view returns (uint256, uint256, uint256, uint256);

    function borrowRatePerBlock() external view returns (uint256);
    function supplyRatePerBlock() external view returns (uint256);

    function totalBorrowsCurrent() external returns (uint256);

    function borrowBalanceCurrent(address account) external returns (uint256);
    function borrowBalanceStored(address account) external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);
    function exchangeRateStored() external view returns (uint256);

    function getCash() external view returns (uint256);
    function accrueInterest() external returns (uint256);
    function seize(address liquidator, address borrower, uint256 seizeTokens) external returns (uint256);
    
    // add
    function name() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function totalBorrows() external view returns (uint256);

    function totalReserves() external view returns (uint256);

    function accrualBlockNumber() external view returns (uint256);

    
    // CETHer
    function mint() external payable;

    /*** User Interface ***/
    
    function redeem(uint256 redeemTokens) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);


}
