// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

interface IOpenSkyBespokeLoanNFT is IERC721 {
    event Mint(uint256 indexed tokenId, address indexed recipient);
    event Burn(uint256 tokenId);

    function mint(address borrower) external returns (uint256 loanId);

    function burn(uint256 tokenId) external;

    function onReceiveNFTFromMarket(address nftAddress, uint256 tokenId) external;
    
}
