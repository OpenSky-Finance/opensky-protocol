// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import './UserProxy.sol';

abstract contract OpenSkyIncentivesProxy {
    mapping(address => UserProxy) public userProxies;

    function _getUserProxy(address user) internal returns (address) {
        UserProxy userProxy = userProxies[user];
        if (address(userProxy) == address(0)) {
            userProxy = new UserProxy();
            userProxies[user] = userProxy;
        }
        return address(userProxy);
    }

    function _callUserProxy(
        address user,
        address target,
        bytes memory data
    ) internal {
        userProxies[user].execute(target, data, 0);
    }

    function claimRewards(
        address incentivesController,
        address[] calldata assets,
        uint256 amount,
        address to
    ) external {
        require(address(userProxies[msg.sender]) != address(0), "HAS_NO_PROXY");
        bytes memory data = abi.encodeWithSignature("claimRewards(address[],uint256,address,bool)", assets, amount, to, false);
        userProxies[msg.sender].execute(address(incentivesController), data, 0);
    }
}
