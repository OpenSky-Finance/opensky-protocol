// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import './BespokeTypes.sol';
import './SignatureChecker.sol';
import '../interfaces/IOpenSkyBespokeSettings.sol';

library BespokeLogic {
    // keccak256("BorrowOffer(uint256 reserveId,address nftAddress,uint256 tokenId,uint256 tokenAmount,address borrower,uint256 amount,uint128 borrowRate,uint40 borrowDuration,address currency,uint256 nonce,uint256 deadline,bytes params)")
    bytes32 internal constant BORROW_OFFER_HASH = 0x71c250d0adf21aff86e82a289e43cfb27864dda4c2bbe98b4c669556501fc4d7;

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
                    offerData.amount,
                    offerData.borrowDuration,
                    offerData.borrowRate,
                    offerData.currency,
                    offerData.nonce,
                    offerData.deadline,
                    keccak256(offerData.params)
                )
            );
    }

    function validateTakeBorrowOffer(
        BespokeTypes.BorrowOffer calldata offerData,
        bytes32 offerHash,
        bytes32 DOMAIN_SEPARATOR,
        IOpenSkyBespokeSettings BESPOKE_SETTINGS
    ) public {
        require(BESPOKE_SETTINGS.isCurrencyWhitelisted(offerData.currency), 'BP_CURRENCY_NOT_IN_WHITELIST');

        require(
            !BESPOKE_SETTINGS.isWhitelistOn() || BESPOKE_SETTINGS.inWhitelist(offerData.nftAddress),
            'BP_NFT_NOT_IN_WHITELIST'
        );

        require(block.timestamp <= offerData.deadline, 'BP_SIGNING_EXPIRATION');

        (uint256 minBorrowDuration, uint256 maxBorrowDuration, ) = BESPOKE_SETTINGS.getBorrowDurationConfig(
            offerData.nftAddress
        );
        require(
            offerData.borrowDuration >= minBorrowDuration && offerData.borrowDuration <= maxBorrowDuration,
            'BP_BORROW_DURATION_NOT_ALLOWED'
        );

        // TODO add approved check?
        require(
            IERC721(offerData.nftAddress).ownerOf(offerData.tokenId) == offerData.borrower,
            'BP_BORROWER_NOT_OWNER_OF_NFT'
        );

        require(
            IERC721(offerData.nftAddress).isApprovedForAll(offerData.borrower, address(this)),
            'BP_NFT_NOT_APPROVED_FOR_ALL'
        );

    

        require(
            SignatureChecker.verify(
                offerHash,
                offerData.borrower,
                offerData.v,
                offerData.r,
                offerData.s,
                DOMAIN_SEPARATOR
            ),
            'BP_SIGNATURE_INVALID'
        );
    }
}
