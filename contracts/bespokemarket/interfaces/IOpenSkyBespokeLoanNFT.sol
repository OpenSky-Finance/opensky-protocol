// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '../libraries/BespokeTypes.sol';

interface IOpenSkyBespokeLoanNFT is IERC721 {
    event Mint(uint256 indexed tokenId, address indexed recipient);
    event Burn(uint256 tokenId);

    event ClaimERC20Airdrop(address indexed token, address indexed to, uint256 amount);
    event ClaimERC721Airdrop(address indexed token, address indexed to, uint256[] ids);
    event ClaimERC1155Airdrop(address indexed token, address indexed to, uint256[] ids, uint256[] amounts, bytes data);

    function mint(BespokeTypes.BorrowOffer memory offerData) external returns (uint256 loanId);

    function burn(uint256 tokenId) external;

    function onReceiveNFTFromMarket(address nftAddress, uint256 tokenId) external;

    function getLoanData(uint256 tokenId) external returns (BespokeTypes.LoanData memory);

    /**
     * @notice Claim the ERC20 token which has been airdropped to the loan contract
     * @param token The address of the airdropped token
     * @param to The address which will receive ERC20 token
     * @param amount The amount of the ERC20 token
     **/
    function claimERC20Airdrop(
        address token,
        address to,
        uint256 amount
    ) external;

    /**
     * @notice Claim the ERC721 token which has been airdropped to the loan contract
     * @param token The address of the airdropped token
     * @param to The address which will receive the ERC721 token
     * @param ids The ID of the ERC721 token
     **/
    function claimERC721Airdrop(
        address token,
        address to,
        uint256[] calldata ids
    ) external;

    /**
     * @notice Claim the ERC1155 token which has been airdropped to the loan contract
     * @param token The address of the airdropped token
     * @param to The address which will receive the ERC1155 tokens
     * @param ids The ID of the ERC1155 token
     * @param amounts The amount of the ERC1155 tokens
     * @param data packed params to pass to the receiver as extra information
     **/
    function claimERC1155Airdrop(
        address token,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;
}
