// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IOpenSkyWETHGateway {
    function deposit(
        uint256 reserveId,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    function withdraw(
        uint256 reserveId,
        uint256 amount,
        address onBehalfOf
    ) external;

    function borrow(
        uint256 reserveId,
        uint256 amount,
        uint256 duration,
        address nftAddress,
        uint256 tokenId,
        address onBehalfOf
    ) external;

    function repay(
        uint256 loanId
    ) external payable;

    function extend(
        uint256 loanId,
        uint256 amount,
        uint256 duration
    ) external payable;
}
