// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../interfaces/IOpenSkyIncentivesController.sol';
import '../interfaces/IOpenSkySettings.sol'; // TODO remove
import '../interfaces/IACLManager.sol';
import '../interfaces/IOpenSkyNFTDescriptor.sol';

import './libraries/BespokeTypes.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';

contract OpenSkyBespokeLoanNFT is Context, ERC721Enumerable, Ownable, IOpenSkyBespokeLoanNFT {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    Counters.Counter private _tokenIdTracker;

    // TODO move to market
    uint256 public totalBorrows;
    mapping(address => uint256) public userBorrows;

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
    function mint(BespokeTypes.BorrowOffer memory offerData) external override onlyMarket returns (uint256 loanId) {
        loanId = _mint(offerData);
        emit Mint(loanId, offerData.borrower);
    }

    function burn(uint256 tokenId) external onlyMarket {
        BespokeTypes.LoanData memory loanData = getLoanData(tokenId);

        if (loanData.status == BespokeTypes.LoanStatus.LIQUIDATABLE) {
            // lender forclose
            // TODO incentive?
        } else {
            // borrower repay
            address owner = ownerOf(tokenId);
            _triggerIncentive(owner);
            userBorrows[owner] = userBorrows[owner].sub(loanData.amount);
            totalBorrows = totalBorrows.sub(loanData.amount);
        }
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
        _triggerIncentive(offerData.borrower);

        totalBorrows = totalBorrows.add(offerData.amount);
        userBorrows[offerData.borrower] = userBorrows[offerData.borrower].add(offerData.amount);
    }

    /**
     * @notice Transfers the loan between two users. Calls the function of the incentives controller contract.
     * @param from The source address
     * @param to The destination address
     * @param tokenId The id of the loan
     **/
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._transfer(from, to, tokenId);
        BespokeTypes.LoanData memory loanData = getLoanData(tokenId);

        // TODO check incentive logic
        if (loanData.status == BespokeTypes.LoanStatus.BORROWING) {
            address incentiveControllerAddress = BESPOKE_SETTINGS.incentiveControllerAddress();
            if (incentiveControllerAddress != address(0)) {
                IOpenSkyIncentivesController incentivesController = IOpenSkyIncentivesController(
                    incentiveControllerAddress
                );
                incentivesController.handleAction(from, userBorrows[from], totalBorrows);
                if (from != to) {
                    incentivesController.handleAction(to, userBorrows[to], totalBorrows);
                }
            }
            userBorrows[from] = userBorrows[from].sub(loanData.amount);
            userBorrows[to] = userBorrows[to].add(loanData.amount);
        }
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
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (BESPOKE_SETTINGS.loanDescriptorAddress() != address(0)) {
            return IOpenSkyNFTDescriptor(BESPOKE_SETTINGS.loanDescriptorAddress()).tokenURI(tokenId);
        } else {
            return '';
        }
    }
}
