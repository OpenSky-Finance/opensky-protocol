// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../dependencies/cryptopunk/ICryptoPunk.sol';
import '../dependencies/cryptopunk/IWrappedPunk.sol';
import '../dependencies/weth/IWETH.sol';

import '../libraries/types/DataTypes.sol';
import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyPool.sol';
import '../interfaces/IOpenSkyLoan.sol';
import '../interfaces/IOpenSkyPunkGateway.sol';

contract OpenSkyPunkGateway is Context, ERC721Holder, IOpenSkyPunkGateway {
    using SafeERC20 for IERC20;

    IOpenSkySettings public SETTINGS;
    ICryptoPunk public PUNK;
    IWrappedPunk public WPUNK;
    IWETH public immutable WETH;

    address public WPUNK_PROXY_ADDRESS;

    constructor(
        address SETTINGS_,
        address PUNK_,
        address WPUNK_,
        address WETH_
    ) {
        SETTINGS = IOpenSkySettings(SETTINGS_);
        PUNK = ICryptoPunk(PUNK_);
        WPUNK = IWrappedPunk(WPUNK_);
        WETH = IWETH(WETH_);

        WPUNK.registerProxy();
        WPUNK_PROXY_ADDRESS = WPUNK.proxyInfo(address(this));

        IERC721(address(WPUNK)).setApprovalForAll(SETTINGS.poolAddress(), true);
    }

    function borrow(
        uint256 reserveId,
        uint256 amount,
        uint256 duration,
        uint256 punkIndex
    ) external override {
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(reserveId).underlyingAsset;

        _borrow(reserveId, amount, duration, punkIndex);
        IERC20(underlyingAsset).safeTransfer(_msgSender(), amount);
    }

    function borrowETH(
        uint256 reserveId,
        uint256 amount,
        uint256 duration,
        uint256 punkIndex
    ) external {
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress()).getReserveData(reserveId).underlyingAsset;
        require(underlyingAsset == address(WETH), 'BORROW_ETH_RESERVE_ASSET_NOT_MATCH');

        uint256 loanId = _borrow(reserveId, amount, duration, punkIndex);

        WETH.withdraw(amount);
        _safeTransferETH(_msgSender(), amount);

        emit BorrowETH(reserveId, _msgSender(), amount, duration, punkIndex, loanId);
    }

    /// @notice Only loan NFT owner can repay
    function repay(uint256 loanId) external payable override {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);

        require(IERC20(underlyingAsset).balanceOf(_msgSender()) >= borrowBalance, 'REPAY_UNDERLYINGASSET_NOT_ENOUGH');

        IERC20(underlyingAsset).safeTransferFrom(_msgSender(), address(this), borrowBalance);

        _repay(loanId, loanData, underlyingAsset, borrowBalance);
    }

    function repayETH(uint256 loanId) external payable {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);

        address underlyingAsset = IOpenSkyPool(SETTINGS.poolAddress())
            .getReserveData(loanData.reserveId)
            .underlyingAsset;
        require(underlyingAsset == address(WETH), 'REPAY_ETH_RESERVE_ASSET_NOT_MATCH');

        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);

        require(msg.value >= borrowBalance, 'REPAY_ETH_NOT_ENOUGH');

        address owner = IERC721(SETTINGS.loanAddress()).ownerOf(loanId);
        require(_msgSender() == owner, 'REPAY_USER_NOT_OWN_THE_LOAN');
        require(loanData.nftAddress == address(WPUNK), 'REPAY_NOT_A_PUNK_LOAN');

        // prepare weth
        WETH.deposit{value: borrowBalance}();

        _repay(loanId, loanData, underlyingAsset, borrowBalance);

        if (msg.value > borrowBalance) {
            _safeTransferETH(_msgSender(), msg.value - borrowBalance);
        }

        emit RepayETH(loanData.reserveId, _msgSender(), loanData.tokenId, loanId);
    }

    function _borrow(
        uint256 reserveId,
        uint256 amount,
        uint256 duration,
        uint256 punkIndex
    ) internal returns (uint256) {
        address owner = PUNK.punkIndexToAddress(punkIndex);
        require(owner == _msgSender(), 'DEPOSIT_PUNK_NOT_OWNER_OF_PUNK');

        // deposit punk
        PUNK.buyPunk(punkIndex);
        PUNK.transferPunk(WPUNK_PROXY_ADDRESS, punkIndex);
        WPUNK.mint(punkIndex);

        // borrow
        uint256 loanId = IOpenSkyPool(SETTINGS.poolAddress()).borrow(
            reserveId,
            amount,
            duration,
            address(WPUNK),
            punkIndex,
            _msgSender()
        );
        emit Borrow(reserveId, owner, amount, duration, punkIndex, loanId);
        return loanId;
    }

    function _repay(
        uint256 loanId,
        DataTypes.LoanData memory loanData,
        address underlyingAsset,
        uint256 borrowBalance
    ) internal {
        address owner = IERC721(SETTINGS.loanAddress()).ownerOf(loanId);
        require(_msgSender() == owner, 'REPAY_USER_NOT_OWN_THE_LOAN');
        require(loanData.nftAddress == address(WPUNK), 'REPAY_NOT_A_PUNK_LOAN');

        // approve underlyingAsset
        IERC20(underlyingAsset).approve(SETTINGS.poolAddress(), borrowBalance);

        IOpenSkyPool(SETTINGS.poolAddress()).repay(loanId);

        // withdrawPunk
        WPUNK.burn(loanData.tokenId);
        PUNK.transferPunk(owner, loanData.tokenId);

        emit Repay(loanData.reserveId, _msgSender(), loanData.tokenId, loanId);
    }

    function _safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}('');
        require(success, 'ETH_TRANSFER_FAILED');
    }

    event Received(address, uint256);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
