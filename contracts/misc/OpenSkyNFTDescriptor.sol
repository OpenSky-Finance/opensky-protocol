// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IOpenSkyNFTDescriptor.sol";
import "../interfaces/IACLManager.sol";

contract OpenSkyNFTDescriptor is IOpenSkyNFTDescriptor {
    using Strings for uint256;

    IACLManager public immutable ACLManager;
    string public baseURI;

    modifier onlyGovernance() {
        require(ACLManager.isGovernance(msg.sender), "ACL_ONLY_GOVERNANCE_CAN_CALL");
        _;
    }

    constructor(address _aclManager) {
        ACLManager = IACLManager(_aclManager);
    }

    function setBaseURI(string memory _baseURI) external onlyGovernance {
        baseURI = _baseURI;
    }

    function tokenURI(uint256 tokenId) external override view returns (string memory) {
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }
}