// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

import '../dependencies/weth/IWETH.sol';
import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IACLManager.sol';
import '../interfaces/IOpenSkyDaoVault.sol';

/**
 * @title OpenSkyDaoVault contract
 * @author OpenSky Labs
 * @notice Implementation of vault for OpenSky Dao
 **/
contract OpenSkyDaoVault is Context, ERC165, IERC721Receiver, IERC1155Receiver, IOpenSkyDaoVault {
    using SafeERC20 for IERC20;

    IOpenSkySettings immutable SETTINGS;
    IWETH internal immutable WETH;

    modifier onlyGovernance() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isGovernance(_msgSender()), 'ACL_ONLY_GOVERNANCE_CAN_CALL');
        _;
    }

    constructor(address SETTINGS_, address WETH_) {
        SETTINGS = IOpenSkySettings(SETTINGS_);
        WETH = IWETH(WETH_);
    }

    function approveERC20(
        address token,
        address spender,
        uint256 amount
    ) external onlyGovernance {
        IERC20(token).approve(spender, amount);
        emit ApproveERC20(token, spender, amount);
    }

    function withdrawETH(uint256 amount, address to) external onlyGovernance {
        require(amount > 0);
        require(address(this).balance >= amount);

        _safeTransferETH(to, amount);
        emit WithdrawETH(amount, to);
    }

    function withdrawERC20(
        address token,
        uint256 amount,
        address to
    ) external onlyGovernance {
        IERC20(token).safeTransfer(to, amount);
        emit WithdrawERC20(token, amount, to);
    }

    function approveERC721(
        address token,
        address spender,
        uint256 tokenId
    ) external onlyGovernance {
        IERC721(token).approve(spender, tokenId);
        emit ApproveERC721(token, spender, tokenId);
    }

    function approveERC721ForAll(
        address token,
        address spender,
        bool approved
    ) external onlyGovernance {
        IERC721(token).setApprovalForAll(spender, approved);
        emit ApproveERC721ForAll(token, spender, approved);
    }

    function withdrawERC721(
        address token,
        uint256 tokenId,
        address to
    ) external onlyGovernance {
        IERC721(token).safeTransferFrom(address(this), to, tokenId);
        emit WithdrawERC721(token, tokenId, to);
    }

    function approveERC1155ForAll(
        address token,
        address spender,
        bool approved
    ) external onlyGovernance {
        IERC1155(token).setApprovalForAll(spender, approved);
        emit ApproveERC1155ForAll(token, spender, approved);
    }

    function withdrawERC1155(
        address to,
        address token,
        uint256 tokenId,
        uint256 amount
    ) external onlyGovernance {
        IERC1155(token).safeTransferFrom(address(this), to, tokenId, amount, '0');
        emit WithdrawERC1155(token, tokenId, amount, to);
    }

    function convertETHToWETH(uint256 amount) external onlyGovernance {
        WETH.deposit{value: amount}();
        emit ConvertETHToWETH(amount);
    }

    function onERC721Received(
        address,
        address from,
        uint256 id,
        bytes memory
    ) public virtual override returns (bytes4) {
        emit DepositERC721(msg.sender, id, from);
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address,
        address from,
        uint256 id,
        uint256 amount,
        bytes memory
    ) public virtual override returns (bytes4) {
        emit DepositERC1155(msg.sender, id, amount, from);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory
    ) public virtual override returns (bytes4) {
        emit DepositERC1155Bulk(msg.sender, ids, amounts, from);
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'ETH_TRANSFER_FAILED');
    }

    receive() external payable {
        emit DepositETH(msg.value, msg.sender);
    }
}
