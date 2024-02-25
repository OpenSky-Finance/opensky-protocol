// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import '../libraries/BespokeTypes.sol';

contract StrategyAnyInSet {
    function validate(BespokeTypes.Offer memory offerData, BespokeTypes.TakeLendInfoForStrategy memory takeInfo)
        external
        view
    {
        uint256[] memory tokenIds = abi.decode(takeInfo.params, (uint256[]));

        bool inSet = false;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == takeInfo.tokenId) {
                inSet = true;
                break;
            }
        }

        require(inSet, 'BM_STRATEGY_ANYINSET_FAILED');
    }
}
