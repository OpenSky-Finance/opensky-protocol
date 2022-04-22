// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '../OpenSkyLoan.sol';

contract OpenSkyLoanMock is OpenSkyLoan {
    constructor(
        string memory name,
        string memory symbol,
        address _settings
    ) OpenSkyLoan(name, symbol, _settings) {}
    
    function updateStatus(uint256 tokenId, DataTypes.LoanStatus status) external onlyPool {
        _updateStatus(tokenId, status);
    }
}
