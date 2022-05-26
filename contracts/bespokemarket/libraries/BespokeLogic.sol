// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import './BespokeTypes.sol';
import './SignatureChecker.sol';
import '../interfaces/IOpenSkyBespokeSettings.sol';

library BespokeLogic {
    // keccak256("BorrowOffer(uint256 reserveId,address nftAddress,uint256 tokenId,uint256 tokenAmount,address borrower,uint256 borrowAmountMin,uint256 borrowAmountMax,uint40 borrowDurationMin,uint40 borrowDurationMax,uint128 borrowRate,address currency,uint256 nonce,uint256 deadline)")
    bytes32 internal constant BORROW_OFFER_HASH = 0xacdf87371514724eb8e74db090d21dbc2361a02a72e2facac480fe7964ae4feb;

    function hashBorrowOffer(BespokeTypes.BorrowOffer memory offerData) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    BORROW_OFFER_HASH,
                    offerData.reserveId,
                    offerData.nftAddress,
                    offerData.tokenId,
                    offerData.tokenAmount,
                    offerData.borrower,
                    offerData.borrowAmountMin,
                    offerData.borrowAmountMax,
                    offerData.borrowDurationMin,
                    offerData.borrowDurationMax,
                    offerData.borrowRate,
                    offerData.currency,
                    offerData.nonce,
                    offerData.deadline
                )
            );
    }

    function validateTakeBorrowOffer(
        BespokeTypes.BorrowOffer calldata offerData,
        uint256 supplyAmount,
        uint256 supplyDuration,
        bytes32 DOMAIN_SEPARATOR,
        IOpenSkyBespokeSettings BESPOKE_SETTINGS
    ) public {
        require(BESPOKE_SETTINGS.isCurrencyWhitelisted(offerData.currency), 'BM_CURRENCY_NOT_IN_WHITELIST');

        require(
            !BESPOKE_SETTINGS.isWhitelistOn() || BESPOKE_SETTINGS.inWhitelist(offerData.nftAddress),
            'BM_NFT_NOT_IN_WHITELIST'
        );

        require(block.timestamp <= offerData.deadline, 'BM_SIGNING_EXPIRATION');

        (uint256 minBorrowDuration, uint256 maxBorrowDuration, ) = BESPOKE_SETTINGS.getBorrowDurationConfig(
            offerData.nftAddress
        );

        // check borrow duration
        require(
            offerData.borrowDurationMin <= offerData.borrowDurationMax &&
                offerData.borrowDurationMin >= minBorrowDuration &&
                offerData.borrowDurationMax <= maxBorrowDuration,
            'BM_BORROW_DURATION_NOT_ALLOWED'
        );

        require(
            supplyDuration > 0 &&
                supplyDuration >= offerData.borrowDurationMin &&
                supplyDuration <= offerData.borrowDurationMax,
            'BM_BORROW_DURATION_NOT_ALLOWED'
        );

        // check borrow amount
        require(
            offerData.borrowAmountMin > 0 && offerData.borrowAmountMin <= offerData.borrowAmountMax,
            'BM_BORROW_DURATION_NOT_ALLOWED'
        );

        require(
            supplyAmount >= offerData.borrowAmountMin && supplyAmount <= offerData.borrowAmountMax,
            'BM_BORROW_DURATION_NOT_ALLOWED'
        );

        require(
            IERC721(offerData.nftAddress).ownerOf(offerData.tokenId) == offerData.borrower,
            'BM_BORROWER_NOT_OWNER_OF_NFT'
        );

        require(
            IERC721(offerData.nftAddress).isApprovedForAll(offerData.borrower, address(this)) ||
                IERC721(offerData.nftAddress).getApproved(offerData.tokenId) == address(this),
            'BM_NFT_NOT_APPROVED'
        );

        bytes32 offerHash = hashBorrowOffer(offerData);
        require(
            SignatureChecker.verify(
                offerHash,
                offerData.borrower,
                offerData.v,
                offerData.r,
                offerData.s,
                DOMAIN_SEPARATOR
            ),
            'BM_SIGNATURE_INVALID'
        );
    }
}
