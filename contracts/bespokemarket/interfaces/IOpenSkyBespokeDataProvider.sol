// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import './IOpenSkyBespokeMarket.sol';
import '../libraries/BespokeTypes.sol';

interface IOpenSkyBespokeDataProvider {
    struct LoanDataUI {
        address tokenAddress;
        uint256 tokenId;
        uint256 tokenAmount; // 1 for ERC721, 1+ for ERC1155
        address nftManager;
        address borrower;
        address lender;
        uint256 amount;
        uint128 borrowRate;
        uint128 interestPerSecond;
        address currency;
        address lendAsset;
        uint256 reserveFactor;
        uint256 overdueLoanFeeFactor;
        uint40 borrowDuration;
        uint40 borrowBegin;
        uint40 borrowOverdueTime;
        uint40 liquidatableTime;
        bool isProrated;
        bool autoConvertWhenRepay;
        BespokeTypes.LoanStatus status;
        
        // extra fields
        uint256 loanId;
        uint256 borrowBalance;
        uint256 penalty;
        uint256 borrowInterest;
    }

    function getLoanData(uint256 loanId) external view returns (LoanDataUI memory);
}
