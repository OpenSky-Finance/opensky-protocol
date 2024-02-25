// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';

import '../interfaces/IAaveFlashLoanReceiver.sol';
import '../interfaces/IAaveLendPoolAddressesProvider.sol';
import '../interfaces/IAaveLendPool.sol';

import '../../bespokemarket/interfaces/IOpenSkyBespokeSettings.sol';
import '../../bespokemarket/interfaces/IOpenSkyBespokeMarket.sol';
import '../../bespokemarket/libraries/BespokeTypes.sol';

contract BespokeToBespokeAdapter is IAaveFlashLoanReceiver, ERC721Holder, ERC1155Holder {
    using SafeERC20 for IERC20;

    IAaveLendPoolAddressesProvider public immutable AAVE2_ADDRESSES_PROVIDER;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;

    event RefinanceBespokeToBespoke(
        address indexed asset,
        address indexed borrower,
        uint256 oldLoanId,
        uint256 newLoanId
    );

    constructor(IAaveLendPoolAddressesProvider provider, IOpenSkyBespokeSettings bespokeSettings) {
        AAVE2_ADDRESSES_PROVIDER = provider;
        BESPOKE_SETTINGS = bespokeSettings;
    }

    function aavePool() public view returns (IAaveLendPool) {
        return IAaveLendPool(AAVE2_ADDRESSES_PROVIDER.getLendingPool());
    }

    struct LocalVars {
        uint256 loanId;
        uint256 repayAmount;
        address assetAddress;
        uint256 borrowAmount;
        uint256 borrowDuration;
        address borrower;
        uint256 needInput;
        bytes params;
        bytes params2;
        BespokeTypes.Offer offer;
        uint256 newLoanId;
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(
            assets.length == 1 && amounts.length == 1 && premiums.length == 1,
            'BM_FLASH_LOAN_MULTIPLE_ASSETS_NOT_SUPPORTED'
        );
        require(address(aavePool()) == msg.sender, 'BM_FLASH_LOAN_INVALID_CALLER');

        LocalVars memory vars;

        // decode
        (vars.params, vars.borrower) = abi.decode(params, (bytes, address));
        (vars.loanId, vars.borrowAmount, vars.borrowDuration, vars.params2) = abi.decode(
            vars.params,
            (uint256, uint256, uint256, bytes)
        );
        vars.offer = abi.decode(vars.params2, (BespokeTypes.Offer));

        // get loan data before repay
        BespokeTypes.LoanData memory loan = IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getLoanData(
            vars.loanId
        );

        require(loan.currency == vars.offer.currency, 'BM_FLASH_LOAN_CURRENCY_NOT_MATCH');
        require(loan.tokenAddress == vars.offer.tokenAddress, 'BM_FLASH_LOAN_TOKEN_ADDRESS_NOT_MATCH');

        // OpenSkyBespokeBorrowNFT
        IERC721(BESPOKE_SETTINGS.borrowLoanAddress()).safeTransferFrom(vars.borrower, address(this), vars.loanId);

        // repay loan
        vars.repayAmount =
            IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getPenalty(vars.loanId) +
            IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getBorrowBalance(vars.loanId);

        require(vars.repayAmount <= amounts[0], 'BP_FLASH_LOAN_RECEIVE_MONEY_NOT_ENOUGH');

        IERC20(assets[0]).approve(BESPOKE_SETTINGS.marketAddress(), vars.repayAmount);
        IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).repay(vars.loanId);

        // borrow again
        IERC721(loan.tokenAddress).approve(BESPOKE_SETTINGS.getNftTransferAdapter(loan.tokenAddress), loan.tokenId);

        // only support single or colletcion offer
        vars.newLoanId = IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).takeLendOffer(
            vars.offer,
            loan.tokenId,
            vars.borrowAmount,
            vars.borrowDuration,
            address(this),
            ''
        );

        vars.needInput = vars.repayAmount + premiums[0];

        // transfer erc20
        if (vars.borrowAmount > vars.needInput) {
            IERC20(assets[0]).safeTransfer(vars.borrower, vars.borrowAmount - vars.needInput);
        } else if (vars.borrowAmount < vars.needInput) {
            IERC20(assets[0]).safeTransferFrom(vars.borrower, address(this), vars.needInput - vars.borrowAmount);
        }

        // transfer OpenSkyBespokeBorrowNFT
        IERC721(BESPOKE_SETTINGS.borrowLoanAddress()).safeTransferFrom(address(this), vars.borrower, vars.newLoanId);

        // repay flashloan
        IERC20(assets[0]).approve(address(aavePool()), amounts[0] + premiums[0]);

        emit RefinanceBespokeToBespoke(assets[0], vars.borrower, vars.loanId, vars.newLoanId);
        return true;
    }
}
