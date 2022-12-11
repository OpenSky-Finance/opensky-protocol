// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../interfaces/IOpenSkyBespokeSettings.sol';
import '../interfaces/ITransferAdapterCurrency.sol';
import '../interfaces/ITransferAdapterNFT.sol';

import './BespokeTypes.sol';
import './BespokeLogic.sol';

library TakeBorrowOfferLogic {
    using SafeERC20 for IERC20;

    event TakeBorrowOffer(
        bytes32 offerHash,
        uint256 indexed loanId,
        address indexed lender,
        address indexed borrower,
        uint256 nonce
    );

    struct TakeBorrowOfferLocalVars {
        bytes32 offerHash;
        bytes32 domainSeparator;
        address nftManager;
        address currencyTransferAdapter;
        uint256 loanId;
    }

    function executeTakeBorrowOffer(
        mapping(address => mapping(uint256 => BespokeTypes.NonceInfo)) storage _nonce,
        mapping(address => uint256) storage minNonce,
        mapping(uint256 => BespokeTypes.LoanData) storage _loans,
        BespokeTypes.Counter storage _loanIdTracker,
        BespokeTypes.Offer memory offerData,
        BespokeTypes.TakeBorrowInfo memory params,
        IOpenSkyBespokeSettings BESPOKE_SETTINGS
    ) public returns (uint256) {
        TakeBorrowOfferLocalVars memory vars;
        vars.offerHash = BespokeLogic.hashOffer(offerData);
        vars.domainSeparator = BespokeLogic.getDomainSeparator();
        
        require(offerData.offerType == BespokeTypes.OfferType.BORROW, 'BM_TAKE_OFFER_INVALID_OFFER_TYPE');
        
        // comment validation
        BespokeLogic.validateOfferCommon(
            _nonce,
            minNonce,
            offerData,
            vars.offerHash,
            params.borrowAmount,
            params.borrowDuration,
            vars.domainSeparator,
            BESPOKE_SETTINGS
        );
        
        // prevents replay
        _nonce[offerData.signer][offerData.nonce].invalid = true;

        vars.nftManager = BESPOKE_SETTINGS.getNftTransferAdapter(offerData.tokenAddress);
        require(vars.nftManager != address(0), 'BM_TRANSFER_NFT_ADAPTER_NOT_AVAILABLE');
        ITransferAdapterNFT(vars.nftManager).transferCollateralIn(
            offerData.tokenAddress,
            offerData.signer,
            offerData.tokenId,
            offerData.tokenAmount
        );

        vars.currencyTransferAdapter = BESPOKE_SETTINGS.getCurrencyTransferAdapter(offerData.lendAsset);
        IERC20(offerData.lendAsset).safeTransferFrom(msg.sender, address(this), params.borrowAmount);
        IERC20(offerData.lendAsset).approve(vars.currencyTransferAdapter, params.borrowAmount);
        ITransferAdapterCurrency(vars.currencyTransferAdapter).transferOnLend(
            offerData.lendAsset,
            address(this),
            offerData.signer,
            params.borrowAmount,
            offerData
        );

        vars.loanId = BespokeLogic.mintLoanNFT(_loanIdTracker, offerData.signer, msg.sender, BESPOKE_SETTINGS);

        BespokeLogic.createLoan(
            _loans,
            offerData,
            vars.loanId,
            params.borrowAmount,
            params.borrowDuration,
            vars.nftManager,
            offerData.tokenId,
            BESPOKE_SETTINGS
        );

        emit TakeBorrowOffer(vars.offerHash, vars.loanId, msg.sender, offerData.signer, offerData.nonce);
        return vars.loanId;
    }
}
