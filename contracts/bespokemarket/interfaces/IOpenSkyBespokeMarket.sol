// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '../libraries/BespokeTypes.sol';

interface IOpenSkyBespokeMarket {
    event CancelAllOffers(address indexed sender, uint256 nonce);

    event CancelMultipleOffers(address indexed sender, uint256[] nonces);

    event TakeBorrowOffer(uint256 indexed loanId, address indexed lender);

    event TakeBorrowOfferETH(uint256 indexed loanId, address indexed lender);

    event Repay(uint256 indexed loanId, address indexed borrower);

    event RepayETH(uint256 indexed loanId, address indexed borrower);

    event Forclose(uint256 indexed loanId, address indexed lender);

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
