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
import '../interfaces/IOpenSkyFlashLoanReceiver.sol';
import '../interfaces/IACLManager.sol';
import '../interfaces/IOpenSkyNFTDescriptor.sol';

import './libraries/BespokeTypes.sol';
import './interfaces/IOpenSkyBespokeSettings.sol';
import './interfaces/IOpenSkyBespokeLoanNFT.sol';
import './interfaces/IOpenSkyBespokeMarket.sol';

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

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    Counters.Counter private _tokenIdTracker;

    uint256 public totalBorrows;

    mapping(address => uint256) public userBorrows;

    modifier onlyMarket() {
        require(_msgSender() == BESPOKE_SETTINGS.marketAddress(), 'BM_ACL_ONLY_BESPOKR_MARKET_CAN_CALL');
        _;
    }

    modifier onlyAirdropOperator() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isAirdropOperator(_msgSender()), 'BM_ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL');
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
            //lender forclose
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

    function onReceiveNFTFromMarket(address nftAddress, uint256 tokenId) external override onlyMarket {
        IERC721(nftAddress).approve(BESPOKE_SETTINGS.marketAddress(), tokenId);
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

    /// @inheritdoc IOpenSkyBespokeLoanNFT
    function flashLoan(
        address receiverAddress,
        uint256[] calldata loanIds,
        bytes calldata params
    ) external override {
        uint256 i;
        IOpenSkyFlashLoanReceiver receiver = IOpenSkyFlashLoanReceiver(receiverAddress);
        // !!!CAUTION: receiver contract may reentry mint, burn, flashloan again

        // only loan owner can do flashloan
        address[] memory nftAddresses = new address[](loanIds.length);
        uint256[] memory tokenIds = new uint256[](loanIds.length);
        for (i = 0; i < loanIds.length; i++) {
            require(ownerOf(loanIds[i]) == _msgSender(), 'BM_LOAN_CALLER_IS_NOT_OWNER');
            BespokeTypes.LoanData memory loanData = getLoanData(loanIds[i]);
            require(loanData.status != BespokeTypes.LoanStatus.LIQUIDATABLE, 'BM_FLASHLOAN_STATUS_ERROR');
            nftAddresses[i] = loanData.nftAddress;
            tokenIds[i] = loanData.tokenId;
        }

        // step 1: moving underlying asset forward to receiver contract
        for (i = 0; i < loanIds.length; i++) {
            IERC721(nftAddresses[i]).safeTransferFrom(address(this), receiverAddress, tokenIds[i]);
        }

        // setup 2: execute receiver contract, doing something like aidrop
        require(
            receiver.executeOperation(nftAddresses, tokenIds, _msgSender(), address(this), params),
            'BM_FLASHLOAN_EXECUTOR_ERROR'
        );

        // setup 3: moving underlying asset backword from receiver contract
        for (i = 0; i < loanIds.length; i++) {
            IERC721(nftAddresses[i]).safeTransferFrom(receiverAddress, address(this), tokenIds[i]);
            emit FlashLoan(receiverAddress, _msgSender(), nftAddresses[i], tokenIds[i]);
        }
    }

    /// @inheritdoc IOpenSkyBespokeLoanNFT
    function claimERC20Airdrop(
        address token,
        address to,
        uint256 amount
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        IERC20(token).safeTransfer(to, amount);
        emit ClaimERC20Airdrop(token, to, amount);
    }

    /// @inheritdoc IOpenSkyBespokeLoanNFT
    function claimERC721Airdrop(
        address token,
        address to,
        uint256[] calldata ids
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        for (uint256 i = 0; i < ids.length; i++) {
            IERC721(token).safeTransferFrom(address(this), to, ids[i]);
        }
        emit ClaimERC721Airdrop(token, to, ids);
    }

    /// @inheritdoc IOpenSkyBespokeLoanNFT
    function claimERC1155Airdrop(
        address token,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override onlyAirdropOperator {
        // make sure that params are checked in admin contract
        IERC1155(token).safeBatchTransferFrom(address(this), to, ids, amounts, data);
        emit ClaimERC1155Airdrop(token, to, ids, amounts, data);
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

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (BESPOKE_SETTINGS.loanDescriptorAddress() != address(0)) {
            return IOpenSkyNFTDescriptor(BESPOKE_SETTINGS.loanDescriptorAddress()).tokenURI(tokenId);
        } else {
            return '';
        }
    }
}
