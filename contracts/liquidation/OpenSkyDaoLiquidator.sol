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

contract OpenSkyDaoLiquidator is Context, ERC721Holder, IOpenSkyDaoLiquidator {
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

        IOpenSkyPool(SETTINGS.poolAddress()).startLiquidation(loanId);

        uint256 borrowBalance = loanNFT.getBorrowBalance(loanId);

        // withdraw ETH from dao vault
        pullWETHFromDaoVaultAndConvertToETH(borrowBalance);

        IOpenSkyPool(SETTINGS.poolAddress()).endLiquidation(loanId, borrowBalance);

        // transfer NFT to dao vault
        IERC721(loanData.nftAddress).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), loanData.tokenId);

        emit Liquidate(loanId, loanData.nftAddress, loanData.tokenId, _msgSender());
    }

    function withdrawERC721ToDaoVault(address token, uint256 tokenId) external onlyLiquidationOperator {
        IERC721(token).safeTransferFrom(address(this), SETTINGS.daoVaultAddress(), tokenId);
        emit WithdrawERC721(token, tokenId, SETTINGS.daoVaultAddress());
    }

    receive() external payable {}
}
