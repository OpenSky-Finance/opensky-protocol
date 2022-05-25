// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../interfaces/IOpenSkyIncentivesController.sol';
import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IACLManager.sol';
import '../interfaces/IOpenSkyNFTDescriptor.sol';

import './libraries/BespokeTypes.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';

contract OpenSkyBespokeLoanNFT is Context, Ownable, ERC721Enumerable, IOpenSkyBespokeLoanNFT {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    IOpenSkySettings public immutable SETTINGS; // TODO remove?
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;

    //uint256 internal constant SECONDS_PER_YEAR = 365 days;

    address public loanDescriptorAddress;

    Counters.Counter private _tokenIdTracker;

    modifier onlyMarket() {
        require(_msgSender() == BESPOKE_SETTINGS.marketAddress(), 'BM_ACL_ONLY_BESPOKR_MARKET_CAN_CALL');
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address settings_,
        address bespokeSettings_
    ) Ownable() ERC721(name, symbol) {
        SETTINGS = IOpenSkySettings(settings_);
        BESPOKE_SETTINGS = IOpenSkyBespokeSettings(bespokeSettings_);
    }

    function setLoanDescriptorAddress(address address_) external onlyOwner {
        require(address_ != address(0));
        loanDescriptorAddress = address_;
        emit SetLoanDescriptorAddress(msg.sender, address_);
    }

    function mint(BespokeTypes.BorrowOffer memory offerData) external override onlyMarket returns (uint256 loanId) {
        loanId = _mint(offerData);
        emit Mint(loanId, offerData.borrower);
    }

    function burn(uint256 tokenId) external onlyMarket {
        BespokeTypes.LoanData memory loanData = getLoanData(tokenId);
        _burn(tokenId);
        emit Burn(tokenId);
    }

    function getLoanData(uint256 tokenId) public returns (BespokeTypes.LoanData memory) {
        return IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getLoanData(tokenId);
    }

    function _mint(BespokeTypes.BorrowOffer memory offerData) internal returns (uint256 tokenId) {
        _tokenIdTracker.increment();
        tokenId = _tokenIdTracker.current();
        _safeMint(offerData.borrower, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (loanDescriptorAddress != address(0)) {
            return IOpenSkyNFTDescriptor(loanDescriptorAddress).tokenURI(tokenId);
        } else {
            return '';
        }
    }
}
