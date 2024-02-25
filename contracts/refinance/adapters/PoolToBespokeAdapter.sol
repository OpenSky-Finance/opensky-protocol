// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

import '../interfaces/IAaveFlashLoanReceiver.sol';
import '../interfaces/IAaveLendPoolAddressesProvider.sol';
import '../interfaces/IAaveLendPool.sol';

import '../../bespokemarket/interfaces/IOpenSkyBespokeMarket.sol';
import '../../bespokemarket/interfaces/IOpenSkyBespokeSettings.sol';
import '../../bespokemarket/libraries/BespokeTypes.sol';

import '../../interfaces/IOpenSkySettings.sol';
import '../../interfaces/IOpenSkyPool.sol';
import '../../interfaces/IOpenSkyLoan.sol';

contract PoolToBespokeAdapter is IAaveFlashLoanReceiver, ERC721Holder {
    using SafeERC20 for IERC20;

    IAaveLendPoolAddressesProvider public immutable AAVE2_ADDRESSES_PROVIDER;
    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;

    event RefinancePoolToBespoke(address indexed asset, address indexed borrower, uint256 oldLoanId, uint256 newLoanId);

    constructor(
        IAaveLendPoolAddressesProvider provider,
        IOpenSkyBespokeSettings bespokeSettings,
        IOpenSkySettings poolSettings
    ) {
        AAVE2_ADDRESSES_PROVIDER = provider;
        BESPOKE_SETTINGS = bespokeSettings;
        SETTINGS = poolSettings;
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

        // logic
        // repay
        // OpenSkyLoan
        IERC721(SETTINGS.loanAddress()).safeTransferFrom(vars.borrower, address(this), vars.loanId);

        DataTypes.LoanData memory loan = IOpenSkyLoan(SETTINGS.loanAddress()).getLoanData(vars.loanId);

        require(loan.nftAddress == vars.offer.tokenAddress, 'BM_FLASH_LOAN_TOKEN_ADDRESS_NOT_MATCH');

        // repay loan
        vars.repayAmount =
            IOpenSkyLoan(SETTINGS.loanAddress()).getPenalty(vars.loanId) +
            IOpenSkyLoan(SETTINGS.loanAddress()).getBorrowBalance(vars.loanId);
        IERC20(assets[0]).approve(SETTINGS.poolAddress(), vars.repayAmount);
        IOpenSkyPool(SETTINGS.poolAddress()).repay(vars.loanId);

        // borrow again
        IERC721(loan.nftAddress).approve(BESPOKE_SETTINGS.getNftTransferAdapter(loan.nftAddress), loan.tokenId);

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

        //repay flashloan
        IERC20(assets[0]).approve(address(aavePool()), amounts[0] + premiums[0]);

        emit RefinancePoolToBespoke(assets[0], vars.borrower, vars.loanId, vars.newLoanId);

        return true;
    }
}
