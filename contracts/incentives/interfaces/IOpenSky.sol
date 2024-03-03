// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

    
interface IOpenSky {
    struct ReserveData {
        uint256 reserveId;
        address underlyingAsset;
        address oTokenAddress;
        address moneyMarketAddress;
        uint128 lastSupplyIndex;
        uint256 borrowingInterestPerSecond;
        uint256 lastMoneyMarketBalance;
        uint40 lastUpdateTimestamp;
        uint256 totalBorrows;
        address interestModelAddress;
        uint256 treasuryFactor;
        bool isMoneyMarketOn;
    }
    
    //oToken
    function SETTINGS() external view returns (address);

    function reserveId() external view returns (uint256);

    //settings
    function loanAddress() external view returns (address);

    function poolAddress() external view returns (address);

    //loan
    function totalBorrows(uint256 reserveId) external view returns (uint256);

    function userBorrows(uint256 reserveId, address account) external view returns (uint256);

    //pool
    function getReserveData(uint256 reserveId) external view returns (ReserveData memory);

}
