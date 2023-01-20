// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

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

contract OpenSkyBAYCSewerPassClaimHelper is IOpenSkyFlashClaimReceiver, ERC721Holder, Ownable {
    IBAYCSewerPassClaim public immutable BAYCSewerPassClaim;
    IBAYCSewerPass public immutable BAYCSewerPass;
    IERC721 public immutable BAKC;

    address public immutable instantLoanCollateralHolder;
    address public immutable bespokeLoanCollateralHolder;

    constructor(
        address _BAYCSewerPassClaim,
        address _BAYCSewerPass,
        address _BAKCAddress,
        address _instantLoanCollateralHolder,
        address _bespokeLoanCollateralHolder
    ) {
        BAYCSewerPassClaim = IBAYCSewerPassClaim(_BAYCSewerPassClaim);
        BAYCSewerPass = IBAYCSewerPass(_BAYCSewerPass);
        BAKC = IERC721(_BAKCAddress);
        instantLoanCollateralHolder = _instantLoanCollateralHolder;
        bespokeLoanCollateralHolder = _bespokeLoanCollateralHolder;
    }

    /**
     @notice flash claim execution logic. See IOpenSkyLoan#flashClaim for detail
    */
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
            // need bakc
            BAKC.safeTransferFrom(initiator, address(this), bakcTokenId);
            // claim
            BAYCSewerPassClaim.claimMaycBakc(tokenId, bakcTokenId);
            // return bakc
            BAKC.safeTransferFrom(address(this), initiator, bakcTokenId);
        } else if (tier == 3) {
            BAYCSewerPassClaim.claimBayc(tokenId);
        } else if (tier == 4) {
            // need bakc
            BAKC.safeTransferFrom(initiator, address(this), bakcTokenId);
            // claim
            BAYCSewerPassClaim.claimBaycBakc(tokenId, bakcTokenId);
            // return bakc
            BAKC.safeTransferFrom(address(this), initiator, bakcTokenId);
        }

        // Transfer pass to  initiator
        BAYCSewerPass.safeTransferFrom(address(this), initiator, mintIndex);

        IERC721(nftAddress).approve(operator, tokenId);
        return true;
    }

    /**
     * @notice Withdraw erc-20 tokens sent to the contract by error
     * @param tokenAddress the erc-20 contract address
     */
    function withdraw(address tokenAddress) external onlyOwner {
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        if (balance > 0) {
            IERC20(tokenAddress).transfer(owner(), balance);
        }
    }

    /**
     * @notice Withdraw eth sent to the contract by error
     */
    function withdrawETH(address receiver) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = receiver.call{value: balance}('');
            require(success, 'ETH_TRANSFER_FAILED');
        }
    }

    /**
     * @notice Withdraw erc-721 tokens sent to the contract by error
     * @param tokenAddress the erc-721 contract address
     */
    function withdrawNFT(address tokenAddress, uint256 tokenId) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner(), tokenId);
    }
}
