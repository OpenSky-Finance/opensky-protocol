// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IOpenSkyDaoLiquidator {
    event Liquidate(uint256 indexed loanId, address indexed nftAddress, uint256 tokenId, address operator);

    event TransferToAnotherLiquidator(
        uint256 indexed loanId,
        address indexed newLiquidator,
        address indexed nftAddress,
        uint256 tokenId,
        bool startLiquidate,
        address operator
    );

    function startLiquidate(uint256 loanId) external;

    function transferToAnotherLiquidator(
        uint256 loanId,
        address liquidator,
        bool startLiquidate
    ) external;
}
