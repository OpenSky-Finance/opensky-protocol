// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import '../libraries/BespokeTypes.sol';

contract StrategyPrivate {
    function validate(BespokeTypes.Offer memory offerData, BespokeTypes.TakeLendInfoForStrategy memory takeInfo)
        external
        view
    {
        address targetBorrower = abi.decode(offerData.params, (address));

        require(offerData.nonceMaxTimes == 1, 'BM_STRATEGY_PRIVATE_NONCEMAXTIMES_INVALID');

        require(offerData.tokenId == takeInfo.tokenId, 'BM_STRATEGY_PRIVATE_TOKEN_ID_NOT_MATCH');

        require(targetBorrower == takeInfo.taker, 'BM_STRATEGY_PRIVATE_ACCOUNT_NOT_MATCH');
    }
}
