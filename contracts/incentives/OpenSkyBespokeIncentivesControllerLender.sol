// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;


import {IERC20} from './interfaces/IERC20.sol';
import {SafeERC20} from './lib/SafeERC20.sol';
import {SafeMath} from './lib/SafeMath.sol';

import {BaseIncentivesController} from './base/BaseIncentivesController.sol';
import {IScaledBalanceToken} from './interfaces/IScaledBalanceToken.sol';

import {IOpenSkyBespoke} from './interfaces/IOpenSkyBespoke.sol';

contract OpenSkyBespokeIncentivesControllerLender is
BaseIncentivesController
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address internal _rewardsVault;
    address public OPENSKY_BESPOKE_MARKET;

    event RewardsVaultUpdated(address indexed vault);

    constructor(IERC20 rewardToken, address emissionManager)
    BaseIncentivesController(rewardToken, emissionManager)
    {}

    /**
     * @dev Initialize AaveIncentivesController
   * @param rewardsVault rewards vault to pull ERC20 funds
   **/
    function initialize(address rewardsVault, address OPENSKY_BESPOKE_MARKET_) external initializer {
        _rewardsVault = rewardsVault;
        OPENSKY_BESPOKE_MARKET = OPENSKY_BESPOKE_MARKET_; // TODO event?
        emit RewardsVaultUpdated(_rewardsVault);
    }

    /**
     * @dev returns the current rewards vault contract
   * @return address
   */
    function getRewardsVault() external view returns (address) {
        return _rewardsVault;
    }

    /**
     * @dev update the rewards vault address, only allowed by the Rewards admin
   * @param rewardsVault The address of the rewards vault
   **/
    function setRewardsVault(address rewardsVault) external onlyEmissionManager {
        _rewardsVault = rewardsVault;
        emit RewardsVaultUpdated(rewardsVault);
    }

    /// @inheritdoc BaseIncentivesController
    function _transferRewards(address to, uint256 amount) internal override {
        IERC20(REWARD_TOKEN).safeTransferFrom(_rewardsVault, to, amount);
    }
    
    function _getUserBalanceAndSupply(address asset, address user) internal view override returns (uint256, uint256) {
        
        return (
            IOpenSkyBespoke(OPENSKY_BESPOKE_MARKET).userLend(asset, user),
            IOpenSkyBespoke(OPENSKY_BESPOKE_MARKET).totalLend(asset)
        );
    }

    function _getTotalSupply(address asset) internal view override returns (uint256){
        return IOpenSkyBespoke(OPENSKY_BESPOKE_MARKET).totalLend(asset);
    }

    // customize
    function handleAction(
        address user,
        uint256 totalSupply,
        uint256 userBalance,
        bytes calldata params //address currency
    ) external override{
        address currency = abi.decode(params,(address));
        uint256 accruedRewards = _updateUserAssetInternal(user, currency, userBalance, totalSupply);
        if (accruedRewards != 0) {
            _usersUnclaimedRewards[user] = _usersUnclaimedRewards[user].add(accruedRewards);
            emit RewardsAccrued(user, accruedRewards);
        }
    }
}
