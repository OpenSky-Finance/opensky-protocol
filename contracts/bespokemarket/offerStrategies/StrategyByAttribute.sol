// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import {MerkleProof} from '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';

import '../libraries/BespokeTypes.sol';

contract StrategyByAttribute {
    function validate(BespokeTypes.Offer memory offerData, BespokeTypes.TakeLendInfoForStrategy memory takeInfo)
        external
        view
    {
        // Precomputed merkleRoot (that contains the tokenIds that match a common characteristic)
        bytes32 merkleRoot = abi.decode(offerData.params, (bytes32));

        // MerkleProof + indexInTree + tokenId
        bytes32[] memory merkleProof = abi.decode(takeInfo.params, (bytes32[]));

        // Compute the node
        bytes32 node = keccak256(abi.encodePacked(takeInfo.tokenId));

        require(MerkleProof.verify(merkleProof, merkleRoot, node), 'BM_STRATEGY_BY_ATTRIBUTE_FAILED');
    }
}
