// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '../libraries/BespokeTypes.sol';

interface IOpenSkyBespokeMarket {
    event MakeBorrowOffer(
        uint256 loanId,
        address borrower,
        uint256 reserveId,
        address nftAddress,
        uint256 tokenId,
        uint256 tokenAmount,
        uint256 amount,
        uint256 duration,
        uint256 borrowRate
    );

    event CancelAllOffers(address user, uint256 nonce);

    event CancelMultipleOffers(address user, uint256[] nonces);

    event TakeBorrowOffer(
        uint256 loanId,
        address lender,
        uint256 borrowBegin,
        uint256 borrowOverdueTime,
        uint256 liquidatableTime
    );

    event TakeBorrowOfferETH(
        uint256 loanId,
        address lender,
        uint256 borrowBegin,
        uint256 borrowOverdueTime,
        uint256 liquidatableTime
    );
    event Repay(uint256 loanId, address operator);

    event RepayETH(uint256 loanId, address operator);

    event Forclose(uint256 loanId, address operator);

    function takeBorrowOffer(BespokeTypes.BorrowOffer memory offerData) external;

    function takeBorrowOfferETH(BespokeTypes.BorrowOffer memory offerData) external payable;

    function repay(uint256 loanId) external;

    function repayETH(uint256 loanId) external payable;

    function forclose(uint256 loanId) external;

    function getLoanData(uint256 loanId) external view returns (BespokeTypes.LoanData memory);

    function getStatus(uint256 loanId) external view returns (BespokeTypes.LoanStatus);

    function getBorrowInterest(uint256 loanId) external view returns (uint256);

    function getBorrowBalance(uint256 loanId) external view returns (uint256);

    function getPenalty(uint256 loanId) external view returns (uint256);
}
