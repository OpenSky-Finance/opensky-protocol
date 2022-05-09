// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/utils/Context.sol';

import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IOpenSkyLoan.sol';
import '../interfaces/IOpenSkyPool.sol';
import '../interfaces/IACLManager.sol';
import '../interfaces/IOpenSkyDaoLiquidator.sol';
import '../libraries/types/DataTypes.sol';
import '../dependencies/weth/IWETH.sol';

contract OpenSkyDaoLiquidator is Context, IOpenSkyDaoLiquidator {
    IOpenSkySettings public immutable SETTINGS;
    IWETH internal immutable WETH;

    modifier onlyLiquidationOperator() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isLiquidationOperator(_msgSender()), 'LIQUIDATION_ONLY_OPERATOR_CAN_CALL');
        _;
    }

    constructor(address settings, address weth) {
        SETTINGS = IOpenSkySettings(settings);
        WETH = IWETH(weth);
    }

    /// @dev Only ETH can be used to liquidate
    function pullWETHFromDaoVaultAndConvertToETH(uint256 amount) internal {
        WETH.transferFrom(SETTINGS.daoVaultAddress(), address(this), amount);
        WETH.withdraw(amount);
    }

    function startLiquidate(uint256 loanId) public override onlyLiquidationOperator {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);

        // may already have own this nft from the other liquidator by transferToAnotherLiquidator
        if (IERC721(loanData.nftAddress).ownerOf(loanData.tokenId) != address(this)) {
            IOpenSkyPool(SETTINGS.poolAddress()).startLiquidation(loanId);
        }

        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);

        // withdraw ETH from dao vault
        pullWETHFromDaoVaultAndConvertToETH(borrowBalance);

        IOpenSkyPool(SETTINGS.poolAddress()).endLiquidation{value: borrowBalance}(loanId);

        // transfer NFT to dao vault
        IERC721(loanData.nftAddress).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), loanData.tokenId);

        emit Liquidate(loanId, loanData.nftAddress, loanData.tokenId, _msgSender());
    }

    /// @dev transfer NFT to another liquidator, Eg. transfer NFT to a dutch auction liquidator.
    /// When 'startLiquidate' is true, the new liquidator should implement the 'startLiquidate' method
    function transferToAnotherLiquidator(
        uint256 loanId,
        address liquidator,
        bool startLiquidate
    ) external onlyLiquidationOperator {
        require(liquidator != address(this), 'LIQUIDATION_TRANSFER_NOT_ALLOWED');
        require(SETTINGS.isLiquidator(liquidator), 'LIQUIDATION_TRANSFER_NOT_LIQUIDATOR');
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loanData = loanNFT.getLoanData(loanId);
        IERC721(loanData.nftAddress).safeTransferFrom(address(this), liquidator, loanData.tokenId);
        if (startLiquidate) {
            IOpenSkyDaoLiquidator(liquidator).startLiquidate(loanId);
        }

        emit TransferToAnotherLiquidator(loanId, liquidator, loanData.nftAddress, loanData.tokenId, startLiquidate, msg.sender);

    }

    receive() external payable {}
}
