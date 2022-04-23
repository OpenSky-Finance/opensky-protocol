// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import '../libraries/types/DataTypes.sol';

interface IOpenSkySettings {
    event OpenWhitelist(address operator);
    event CloseWhitelist(address operator);
    event AddToWhitelist(address operator, address nft);
    event RemoveFromWhitelist(address operator, address nft);
    event AddBorrowDuration(address operator, uint256 duration);
    event RemoveBorrowDuration(address operator, uint256 duration);
    event SetReserveFactor(address operator, uint256 factor);
    event SetLiquidateReserveFactor(address operator, uint256 factor);
    event SetPrepaymentFeeFactor(address operator, uint256 factor);
    event SetOverdueLoanFeeFactor(address operator, uint256 factor);

    event SetMoneyMarketAddress(address operator, address address_);
    event SetTreasuryAddress(address operator, address address_);
    event SetACLAdminAddress(address operator, address address_);
    event SetACLManagerAddress(address operator, address address_);
    event SetIncentiveControllerAddress(address operator, address address_);
    event SetPoolAddress(address operator, address address_);
    event SetVaultFactoryAddress(address operator, address address_);
    event SetLoanAddress(address operator, address address_);
    event SetLoanDescriptorAddress(address operator, address address_);
    event SetNftPriceOracleAddress(address operator, address address_);
    event SetInterestRateStrategyAddress(address operator, address address_);
    event SetPunkGatewayAddress(address operator, address address_);

    // whitelist
    function isWhitelistOn() external view returns (bool);

    function inWhitelist(address nft) external view returns (bool);

    function getWhitelistDetail(address nft) external view returns (DataTypes.WhitelistInfo memory);
    // borrow
    function minBorrowDuration() external view returns (uint256);

    function maxBorrowDuration() external view returns (uint256);

    function overdueDuration() external view returns (uint256);

    function extendableDuration() external view returns (uint256);

    function reserveFactor() external view returns (uint256); // treasury ratio

    function MAX_RESERVE_FACTOR() external view returns (uint256);

    function liquidateReserveFactor() external view returns (uint256); // treasury ratio in liquidation case

    function prepaymentFeeFactor() external view returns (uint256);

    function overdueLoanFeeFactor() external view returns (uint256);

    function moneyMarketAddress() external view returns (address);

    function treasuryAddress() external view returns (address);

    function ACLAdminAddress() external view returns (address);

    function ACLManagerAddress() external view returns (address);

    function incentiveControllerAddress() external view returns (address);

    function poolAddress() external view returns (address);

    function vaultFactoryAddress() external view returns (address);

    function loanAddress() external view returns (address);

    function loanDescriptorAddress() external view returns (address);

    function nftPriceOracleAddress() external view returns (address);

    function interestRateStrategyAddress() external view returns (address);

    function punkGatewayAddress() external view returns (address);
}
