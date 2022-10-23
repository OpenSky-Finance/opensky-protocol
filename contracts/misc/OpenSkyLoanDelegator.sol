// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../dependencies/weth/IWETH.sol";
import "../interfaces/IOpenSkySettings.sol";
import "../interfaces/IOpenSkyPool.sol";
import "../interfaces/IOpenSkyLoan.sol";

contract OpenSkyLoanDelegator is ERC721Holder {
    using SafeERC20 for IERC20;

    IWETH public WETH;
    IOpenSkySettings public SETTINGS;

    mapping(address => mapping(address => mapping(uint256 => address))) public delegators;
    mapping(address => mapping(uint256 => address)) public loanOwners;

    event Delegate(address indexed sender, address indexed delegator, uint256 indexed loanId);
    event ExtendETH(address indexed sender, uint256 indexed loanId, uint256 amount, uint256 duration);
    event Extend(
        address indexed sender,
        uint256 indexed loanId,
        address indexed underlyingAsset,
        uint256 amount,
        uint256 duration
    );
    event RepayETH(address indexed sender, uint256 indexed loanId, uint256 amount);
    event Repay(address indexed sender, uint256 indexed loanId, address indexed underlyingAsset, uint256 amount);
    event ClaimNFT(address indexed sender, address indexed nftAddress, uint256 indexed tokenId);
    event SetDelegatorForAll(address indexed sender, address indexed delegator, bool isDelegated);

    event Received(address indexed sender, uint256 amount);

    constructor(IWETH weth, IOpenSkySettings settings) {
        WETH = weth;
        SETTINGS = settings;
    }

    function delegate(address delegator, uint256 loanId) external {
        if (delegator != address(0)) {
            _delegate(delegator, loanId);
        } else {
            _undelegate(loanId);
        }
        emit Delegate(msg.sender, delegator, loanId);
    }

    function _delegate(address delegator, uint256 loanId) internal {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loan = loanNFT.getLoanData(loanId);
        require(loanNFT.ownerOf(loanId) == msg.sender || getLoanOwner(loan.nftAddress, loan.tokenId) == msg.sender, "ONLY_OWNER");
        address owner = msg.sender;

        if (loanOwners[loan.nftAddress][loan.tokenId] != owner) {
            loanOwners[loan.nftAddress][loan.tokenId] = owner;
        }

        if (loanNFT.ownerOf(loanId) != address(this)) {
            loanNFT.safeTransferFrom(owner, address(this), loanId);
        }

        delegators[owner][loan.nftAddress][loan.tokenId] = delegator;
    }

    function _undelegate(uint256 loanId) internal {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loan = loanNFT.getLoanData(loanId);
        address owner = getLoanOwner(loan.nftAddress, loan.tokenId);
        require(owner == msg.sender, "ONLY_OWNER");

        loanNFT.safeTransferFrom(address(this), owner, loanId);

        delete delegators[owner][loan.nftAddress][loan.tokenId];
        delete loanOwners[loan.nftAddress][loan.tokenId];
    }

    function getDelegator(address owner, address nftAddress, uint256 tokenId) public view returns (address) {
        return delegators[owner][nftAddress][tokenId];
    }

    function getLoanOwner(address nftAddress, uint256 tokenId) public view returns (address) {
        return loanOwners[nftAddress][tokenId];
    }

    function extendETH(
        uint256 loanId,
        uint256 amount,
        uint256 duration
    ) external payable {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loan = loanNFT.getLoanData(loanId);

        require(_isDelegatorOrOwner(msg.sender, loan.nftAddress, loan.tokenId), "ONLY_OWNER_OR_DELEGATOR");

        WETH.deposit{value: msg.value}();

        IOpenSkyPool lendingPool = IOpenSkyPool(SETTINGS.poolAddress());
        IERC20(address(WETH)).approve(SETTINGS.poolAddress(), msg.value);
        (uint256 inAmount, uint256 outAmount) = lendingPool.extend(loanId, amount, duration, address(this));

        require(msg.value >= inAmount, "EXTEND_MSG_VALUE_ERROR");

        if (msg.value > inAmount) {
            uint256 refundAmount = msg.value - inAmount;
            WETH.withdraw(refundAmount);
            _safeTransferETH(msg.sender, refundAmount);
        }
        if (outAmount > 0) {
            WETH.withdraw(outAmount);
            _safeTransferETH(getLoanOwner(loan.nftAddress, loan.tokenId), outAmount);
        }

        emit ExtendETH(msg.sender, loanId, amount, duration);
    }

    function extend(
        uint256 loanId,
        uint256 extendAmount,
        uint256 duration,
        uint256 amount
    ) external {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loan = loanNFT.getLoanData(loanId);

        require(_isDelegatorOrOwner(msg.sender, loan.nftAddress, loan.tokenId), "ONLY_OWNER_OR_DELEGATOR");

        IOpenSkyPool lendingPool = IOpenSkyPool(SETTINGS.poolAddress());
        DataTypes.ReserveData memory reserve = lendingPool.getReserveData(loan.reserveId);

        if (amount > 0) {
            IERC20(reserve.underlyingAsset).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(reserve.underlyingAsset).approve(SETTINGS.poolAddress(), amount);
        }

        (uint256 inAmount, uint256 outAmount) = lendingPool.extend(loanId, extendAmount, duration, address(this));

        if (amount > inAmount) {
            uint256 refundAmount = amount - inAmount;
            IERC20(reserve.underlyingAsset).safeTransfer(msg.sender, refundAmount);
        }
        if (outAmount > 0) {
            IERC20(reserve.underlyingAsset).safeTransfer(getLoanOwner(loan.nftAddress, loan.tokenId), outAmount);
        }

        emit Extend(msg.sender, loanId, reserve.underlyingAsset, amount, duration);
    }

    function repayETH(uint256 loanId) external payable {
        DataTypes.LoanData memory loan = IOpenSkyLoan(SETTINGS.loanAddress()).getLoanData(loanId);
        require(_hasDelegator(loan.nftAddress, loan.tokenId), "NO_DELEGATOR");

        WETH.deposit{value: msg.value}();

        IOpenSkyPool lendingPool = IOpenSkyPool(SETTINGS.poolAddress());

        IERC20(address(WETH)).approve(SETTINGS.poolAddress(), msg.value);
        uint256 repayAmount = lendingPool.repay(loanId);

        require(msg.value >= repayAmount, "REPAY_MSG_VALUE_ERROR");

        address owner = getLoanOwner(loan.nftAddress, loan.tokenId);
        IERC721(loan.nftAddress).safeTransferFrom(address(this), owner, loan.tokenId);

        if (msg.value > repayAmount) {
            uint256 refundAmount = msg.value - repayAmount;
            WETH.withdraw(refundAmount);
            _safeTransferETH(msg.sender, refundAmount);
        }

        delete delegators[owner][loan.nftAddress][loan.tokenId];
        delete loanOwners[loan.nftAddress][loan.tokenId];

        emit RepayETH(msg.sender, loanId, repayAmount);
    }

    function repay(uint256 loanId, uint256 amount) external {
        IOpenSkyLoan loanNFT = IOpenSkyLoan(SETTINGS.loanAddress());
        DataTypes.LoanData memory loan = loanNFT.getLoanData(loanId);
        require(_hasDelegator(loan.nftAddress, loan.tokenId), "NO_DELEGATOR");

        IOpenSkyPool lendingPool = IOpenSkyPool(SETTINGS.poolAddress());
        DataTypes.ReserveData memory reserve = lendingPool.getReserveData(loan.reserveId);

        IERC20(reserve.underlyingAsset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(reserve.underlyingAsset).approve(SETTINGS.poolAddress(), amount);

        uint256 repayAmount = lendingPool.repay(loanId);

        require(amount >= repayAmount, "REPAY_MSG_VALUE_ERROR");

        address owner = getLoanOwner(loan.nftAddress, loan.tokenId);
        IERC721(loan.nftAddress).safeTransferFrom(address(this), owner, loan.tokenId);

        if (amount > repayAmount) {
            uint256 refundAmount = amount - repayAmount;
            IERC20(reserve.underlyingAsset).safeTransfer(msg.sender, refundAmount);
        }

        delete delegators[owner][loan.nftAddress][loan.tokenId];
        delete loanOwners[loan.nftAddress][loan.tokenId];

        emit Repay(msg.sender, loanId, reserve.underlyingAsset, repayAmount);
    }

    function claimNFT(address nftAddress, uint256 tokenId) external {
        require(_isDelegatorOrOwner(msg.sender, nftAddress, tokenId), "ONLY_OWNER_OR_DELEGATOR");

        address owner = getLoanOwner(nftAddress, tokenId);
        IERC721(nftAddress).safeTransferFrom(address(this), owner, tokenId);

        delete delegators[owner][nftAddress][tokenId];
        delete loanOwners[nftAddress][tokenId];

        emit ClaimNFT(msg.sender, nftAddress, tokenId);
    }

    function _isDelegatorOrOwner(address sender, address nftAddress, uint256 tokenId) internal view returns (bool) {
        address owner = getLoanOwner(nftAddress, tokenId);
        return owner == sender || getDelegator(owner, nftAddress, tokenId) == sender;
    }

    function _hasDelegator(address nftAddress, uint256 tokenId) internal view returns (bool) {
        address owner = getLoanOwner(nftAddress, tokenId);
        return delegators[owner][nftAddress][tokenId] != address(0);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "ETH_TRANSFER_FAILED");
    }

    receive() external payable {
        require(msg.sender == address(WETH), "RECEIVE_NOT_ALLOWED");
        emit Received(msg.sender, msg.value);
    }
}
