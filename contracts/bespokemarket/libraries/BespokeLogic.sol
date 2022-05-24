// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import './BespokeTypes.sol';

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
}
