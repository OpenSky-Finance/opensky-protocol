// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

import '../../interfaces/IOpenSkyFlashClaimReceiver.sol';

interface IBAYCSewerPass {
    function mintIndex() external view returns (uint256);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

interface IBAYCSewerPassClaim {
    function claimBaycBakc(uint256 baycTokenId, uint256 bakcTokenId) external;

    function claimBayc(uint256 baycTokenId) external;

    function claimMaycBakc(uint256 maycTokenId, uint256 bakcTokenId) external;

    function claimMayc(uint256 maycTokenId) external;
}

contract OpenSkyBAYCSewerPassClaimHelper is IOpenSkyFlashClaimReceiver, ERC721Holder {
    IBAYCSewerPassClaim public immutable BAYCSewerPassClaim;
    IBAYCSewerPass public immutable BAYCSewerPass;
    address public immutable instantLoanCollateralHolder;
    address public immutable bespokeLoanCollateralHolder;

    constructor(
        address _BAYCSewerPassClaim,
        address _BAYCSewerPass,
        address _instantLoanCollateralHolder,
        address _bespokeLoanCollateralHolder
    ) {
        BAYCSewerPassClaim = IBAYCSewerPassClaim(_BAYCSewerPassClaim);
        BAYCSewerPass = IBAYCSewerPass(_BAYCSewerPass);
        instantLoanCollateralHolder = _instantLoanCollateralHolder;
        bespokeLoanCollateralHolder = _bespokeLoanCollateralHolder;
    }

    function executeOperation(
        address[] calldata nftAddresses,
        uint256[] calldata tokenIds,
        address initiator,
        address operator,
        bytes calldata params
    ) external override returns (bool) {
        require(nftAddresses.length == 1 && tokenIds.length == 1, 'PARAMS_ERROR_NFT');

        require(initiator != address(0), 'PARAMS_ERROR_INITIATOR');

        // check operator
        require(msg.sender == operator);
        require(operator == instantLoanCollateralHolder || operator == bespokeLoanCollateralHolder);

        // underlying nft
        address nftAddress = nftAddresses[0];
        uint256 tokenId = tokenIds[0];

        (uint256 tier, uint256 bakcTokenId) = abi.decode(params, (uint256, uint256));

        // Get pass id
        uint256 mintIndex = BAYCSewerPass.mintIndex();

        // Claim
        if (tier == 1) {
            BAYCSewerPassClaim.claimMayc(tokenId); // ignore bakcTokenId
        } else if (tier == 2) {
            BAYCSewerPassClaim.claimMaycBakc(tokenId, bakcTokenId);
        } else if (tier == 3) {
            BAYCSewerPassClaim.claimBayc(tokenId);
        } else if (tier == 4) {
            BAYCSewerPassClaim.claimBaycBakc(tokenId, bakcTokenId);
        }

        // Transfer pass to  initiator
        BAYCSewerPass.safeTransferFrom(address(this), initiator, mintIndex);

        IERC721(nftAddress).approve(operator, tokenId);
        return true;
    }
}
