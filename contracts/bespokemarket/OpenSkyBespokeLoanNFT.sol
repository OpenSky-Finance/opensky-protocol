// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
//import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../libraries/math/PercentageMath.sol';
import '../libraries/math/WadRayMath.sol';
import '../libraries/math/MathUtils.sol';
import '../interfaces/IOpenSkyIncentivesController.sol';
import '../interfaces/IOpenSkySettings.sol';

import './interfaces/IOpenSkyBespokeSettings.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';

contract OpenSkyBespokeLoanNFT is
    Context,
    ERC721Enumerable,
    Ownable,
    ERC721Holder,
    ERC1155Holder,
    IOpenSkyBespokeLoanNFT
{
    using Counters for Counters.Counter;
    using SafeMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20 for IERC20;
    using WadRayMath for uint128;

    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;
    
    uint256 public totalBorrows;
    mapping(address => uint256) public userBorrows;

    Counters.Counter private _tokenIdTracker;

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

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

    // TODO check incentive logic
    function mint(address borrower) external override onlyMarket returns (uint256 loanId) {
        loanId = _mint(borrower);
        emit Mint(loanId, borrower);
    }

    function burn(uint256 tokenId) external onlyMarket {
        _burn(tokenId);
        emit Burn(tokenId);
    }

    function onReceiveNFTFromMarket(address nftAddress, uint256 tokenId) external override onlyMarket {
        IERC721(nftAddress).approve(BESPOKE_SETTINGS.marketAddress(), tokenId);
    }

    function _mint(address recipient) internal returns (uint256 tokenId) {
        _tokenIdTracker.increment();
        tokenId = _tokenIdTracker.current();
        _safeMint(recipient, tokenId);
        _triggerIncentive(recipient);
    }

    function _triggerIncentive(address borrower) internal {
        address incentiveControllerAddress = BESPOKE_SETTINGS.incentiveControllerAddress();
        if (incentiveControllerAddress != address(0)) {
            IOpenSkyIncentivesController incentivesController = IOpenSkyIncentivesController(
                incentiveControllerAddress
            );
            incentivesController.handleAction(borrower, userBorrows[borrower], totalBorrows);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165, ERC1155Receiver, ERC721Enumerable)
        returns (bool)
    {
        return supportsInterface(interfaceId);
    }
}
