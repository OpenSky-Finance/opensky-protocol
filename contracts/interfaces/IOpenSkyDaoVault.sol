// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IOpenSkyDaoVault {
    event ApproveERC20(address token, address spender, uint256 amount);
    event ApproveERC721(address token, address spender, uint256 tokenId);
    event ApproveERC721ForAll(address token, address spender, bool approved);
    event ApproveERC1155ForAll(address token, address spender, bool approved);
    event ConvertETHToWETH(uint256 amount);

    event DepositETH(uint256 amount, address indexed from);
    event DepositERC721(address indexed token, uint256 tokenId, address indexed from);
    event DepositERC1155(address indexed token, uint256 tokenId, uint256 amount, address indexed from);
    event DepositERC1155Bulk(address indexed token, uint256[] tokenId, uint256[] amount, address indexed from);

    event WithdrawETH(uint256 amount, address to);
    event WithdrawERC20(address indexed token, uint256 amount, address to);
    event WithdrawERC721(address indexed token, uint256 tokenId, address indexed to);
    event WithdrawERC1155(address indexed token, uint256 tokenId, uint256 amount, address indexed from);

    function approveERC20(
        address token,
        address spender,
        uint256 amount
    ) external;

    function withdrawETH(uint256 amount, address to) external;

    function withdrawERC20(
        address token,
        uint256 amount,
        address to
    ) external;

    function withdrawERC721(
        address token,
        uint256 tokenId,
        address to
    ) external;

    function withdrawERC1155(
        address to,
        address token,
        uint256 tokenId,
        uint256 amount
    ) external;

    function convertETHToWETH(uint256 amount) external;
}
