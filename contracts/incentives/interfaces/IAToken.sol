pragma solidity 0.8.10;

interface IAToken {
    function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256);
}
