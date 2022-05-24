// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library BespokeTypes {
    struct BorrowOffer {
        uint256 reserveId;
        address nftAddress;
        uint256 tokenId;
        uint256 tokenAmount; // 1 for ERC721, 1+ for ERC1155
        address borrower;
        uint256 amount;
        uint128 borrowRate;
        uint40 borrowDuration;
        address currency;
        uint256 nonce;
        uint256 deadline;
        bytes params; // additional parameters
        uint8 v; // v: parameter (27 or 28)
        bytes32 r; // r: parameter
        bytes32 s; // s: parameter
    }

    struct LoanData {
        uint256 reserveId;
        address nftAddress;
        uint256 tokenId;
        uint256 tokenAmount; // 1 for ERC721, 1+ for ERC1155
        address borrower;
        uint256 amount;
        uint128 borrowRate;
        uint128 interestPerSecond;
        address currency;
        uint40 borrowDuration;
        // after accept offer
        uint256 borrowBegin;
        uint40 borrowOverdueTime;
        uint40 liquidatableTime;
        address lender;
        LoanStatus status;
    }

    enum LoanStatus {
        NONE,
        BORROWING,
        OVERDUE,
        LIQUIDATABLE
        // the following statuses are not stored onchain
        // END,
        // CANCELED,
        // LIQUIDATED
    }

    struct WhitelistInfo {
        bool enabled;
        uint256 minBorrowDuration;
        uint256 maxBorrowDuration;
        uint256 overdueDuration;
    }
}
