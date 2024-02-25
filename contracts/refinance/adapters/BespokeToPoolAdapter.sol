// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

import '../interfaces/IAaveFlashLoanReceiver.sol';
import '../interfaces/IAaveLendPoolAddressesProvider.sol';
import '../interfaces/IAaveLendPool.sol';

import '../../bespokemarket/interfaces/IOpenSkyBespokeSettings.sol';
import '../../bespokemarket/interfaces/IOpenSkyBespokeMarket.sol';
import '../../bespokemarket/libraries/BespokeTypes.sol';

import '../../interfaces/IOpenSkySettings.sol';
import '../../interfaces/IOpenSkyPool.sol';

contract BespokeToPoolAdapter is IAaveFlashLoanReceiver, ERC721Holder {
    using SafeERC20 for IERC20;

    IAaveLendPoolAddressesProvider public immutable AAVE2_ADDRESSES_PROVIDER;
    IOpenSkySettings public immutable SETTINGS;
    IOpenSkyBespokeSettings public immutable BESPOKE_SETTINGS;

    event RefinanceBespokeToPool(address indexed asset, address indexed borrower, uint256 oldLoanId, uint256 newLoanId);

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
        uint256 reserveId;
        uint256 borrowAmount;
        uint256 borrowDuration;
        address onBehalfOf;
        address borrower;
        uint256 needInput;
        bytes params;
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

        (vars.params, vars.borrower) = abi.decode(params, (bytes, address));

        (vars.loanId, vars.reserveId, vars.borrowAmount, vars.borrowDuration, vars.onBehalfOf) = abi.decode(
            vars.params,
            (uint256, uint256, uint256, uint256, address)
        );

        // get loan info before repay
        BespokeTypes.LoanData memory loan = IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getLoanData(
            vars.loanId
        );

        // repay bespoke
        // OpenSkyBespokeBorrowNFT
        vars.repayAmount =
            IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getPenalty(vars.loanId) +
            IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).getBorrowBalance(vars.loanId);

        IERC721(BESPOKE_SETTINGS.borrowLoanAddress()).safeTransferFrom(vars.borrower, address(this), vars.loanId);

        IERC20(assets[0]).approve(BESPOKE_SETTINGS.marketAddress(), vars.repayAmount);
        IOpenSkyBespokeMarket(BESPOKE_SETTINGS.marketAddress()).repay(vars.loanId);

        // borrow again
        IERC721(loan.tokenAddress).approve(SETTINGS.poolAddress(), loan.tokenId);

        vars.newLoanId = IOpenSkyPool(SETTINGS.poolAddress()).borrow(
            vars.reserveId,
            vars.borrowAmount,
            vars.borrowDuration,
            loan.tokenAddress,
            loan.tokenId,
            vars.onBehalfOf // can  get loan nft
        );

        vars.needInput = vars.repayAmount + premiums[0];

        // transfer erc20
        if (vars.borrowAmount > vars.needInput) {
            IERC20(assets[0]).safeTransfer(vars.borrower, vars.borrowAmount - vars.needInput);
        } else if (vars.borrowAmount < vars.needInput) {
            IERC20(assets[0]).safeTransferFrom(vars.borrower, address(this), vars.needInput - vars.borrowAmount);
        }

        // no need to transfer  loan nft
        // repay flashloan
        IERC20(assets[0]).approve(address(aavePool()), amounts[0] + premiums[0]);

        emit RefinanceBespokeToPool(assets[0], vars.borrower, vars.loanId, vars.newLoanId);
        return true;
    }
}
