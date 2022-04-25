// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/utils/Context.sol';
import '../interfaces/IOpenSkySettings.sol';
import '../interfaces/IACLManager.sol';
import '../libraries/types/DataTypes.sol';
import '../libraries/helpers/Errors.sol';

contract OpenSkySettings is IOpenSkySettings, Context {
    uint256 public constant MAX_RESERVE_FACTOR = 2000;

    // whitelist
    bool public override isWhitelistOn = true;
    // nftAddress=>data
    mapping(address => DataTypes.WhitelistInfo) internal _whitelist;

    address public override moneyMarketAddress;
    address public override treasuryAddress;
    address public override ACLAdminAddress;
    address public override ACLManagerAddress;
    address public override incentiveControllerAddress;

    address public override poolAddress;
    address public override vaultFactoryAddress;
    address public override loanAddress;
    address public override loanDescriptorAddress;
    address public override nftPriceOracleAddress;
    address public override interestRateStrategyAddress;
    address public override punkGatewayAddress;

    // treasury reserveFactor
    uint256 public override reserveFactor = 50;

    uint256 public override liquidateReserveFactor = 50;

    uint256 public override prepaymentFeeFactor = 0;
    uint256 public override overdueLoanFeeFactor = 100;

    constructor(address _ACLManagerAddress) {
        ACLManagerAddress = _ACLManagerAddress;
    }

    modifier onlyAddressAdmin() {
        IACLManager ACLManager = IACLManager(ACLManagerAddress);
        require(ACLManager.isAddressAdmin(_msgSender()), Errors.ACL_ONLY_ADDRESS_ADMIN_CAN_CALL);
        _;
    }

    modifier onlyGovernance() {
        IACLManager ACLManager = IACLManager(ACLManagerAddress);
        require(ACLManager.isGovernance(_msgSender()), Errors.ACL_ONLY_GOVERNANCE_CAN_CALL);
        _;
    }

    function setMoneyMarketAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        moneyMarketAddress = address_;
        emit SetMoneyMarketAddress(msg.sender, address_);
    }

    function setTreasuryAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        treasuryAddress = address_;
        emit SetTreasuryAddress(msg.sender, address_);
    }

    function setACLAdminAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        ACLAdminAddress = address_;
        emit SetACLAdminAddress(msg.sender, address_);
    }

    function setACLManagerAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        ACLManagerAddress = address_;
        emit SetACLManagerAddress(msg.sender, address_);
    }

    function setIncentiveControllerAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        incentiveControllerAddress = address_;
        emit SetIncentiveControllerAddress(msg.sender, address_);
    }

    // cannot be changed once initialized
    function setPoolAddress(address address_) external onlyAddressAdmin {
        require(poolAddress == address(0) && address_ != address(0));
        poolAddress = address_;
        emit SetPoolAddress(msg.sender, address_);
    }

    function setVaultFactoryAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        vaultFactoryAddress = address_;
        emit SetVaultFactoryAddress(msg.sender, address_);
    }

    // cannot be changed once initialized
    function setLoanAddress(address address_) external onlyAddressAdmin {
        require(loanAddress == address(0) && address_ != address(0));
        loanAddress = address_;
        emit SetLoanAddress(msg.sender, address_);
    }

    function setLoanDescriptorAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        loanDescriptorAddress = address_;
        emit SetLoanDescriptorAddress(msg.sender, address_);
    }

    function setNftPriceOracleAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        nftPriceOracleAddress = address_;
        emit SetNftPriceOracleAddress(msg.sender, address_);
    }

    function setInterestRateStrategyAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        interestRateStrategyAddress = address_;
        emit SetInterestRateStrategyAddress(msg.sender, address_);
    }

    function setPunkGatewayAddress(address address_) external onlyAddressAdmin {
        require(address_ != address(0));
        punkGatewayAddress = address_;
        emit SetPunkGatewayAddress(msg.sender, address_);
    }

    function setReserveFactor(uint256 factor) external onlyGovernance {
        require(factor <= MAX_RESERVE_FACTOR);
        reserveFactor = factor;
        emit SetReserveFactor(msg.sender, factor);
    }

    function setLiquidateReserveFactor(uint256 factor) external onlyGovernance {
        liquidateReserveFactor = factor;
        emit SetLiquidateReserveFactor(msg.sender, factor);
    }

    function setPrepaymentFeeFactor(uint256 factor) external onlyGovernance {
        prepaymentFeeFactor = factor;
        emit SetPrepaymentFeeFactor(msg.sender, factor);
    }

    function setOverdueLoanFeeFactor(uint256 factor) external onlyGovernance {
        overdueLoanFeeFactor = factor;
        emit SetOverdueLoanFeeFactor(msg.sender, factor);
    }

    function inWhitelist(address nft) external view override returns (bool) {
        require(nft != address(0));
        return !isWhitelistOn || _whitelist[nft].enabled;
    }

    function openWhitelist() external onlyGovernance {
        isWhitelistOn = true;
        emit OpenWhitelist(msg.sender);
    }

    function closeWhitelist() external onlyGovernance {
        isWhitelistOn = false;
        emit CloseWhitelist(msg.sender);
    }

    function addToWhitelist(
        address nft,
        string memory name,
        string memory symbol,
        uint256 LTV,
        uint256 minBorrowDuration,
        uint256 maxBorrowDuration,
        uint256 extendableDuration,
        uint256 overdueDuration
    ) external onlyGovernance {
        require(nft != address(0));
        _whitelist[nft] = DataTypes.WhitelistInfo({
            enabled: true,
            name: name,
            symbol: symbol,
            LTV: LTV,
            minBorrowDuration: minBorrowDuration,
            maxBorrowDuration: maxBorrowDuration,
            extendableDuration: extendableDuration,
            overdueDuration: overdueDuration
        });
        emit AddToWhitelist(msg.sender, nft);
    }

    function removeFromWhitelist(address nft) external onlyGovernance {
        if (_whitelist[nft].enabled) {
            _whitelist[nft].enabled = false;
            emit RemoveFromWhitelist(msg.sender, nft);
        }
    }

    function getWhitelistDetail(address nft) external view override returns (DataTypes.WhitelistInfo memory) {
        return _whitelist[nft];
    }

}
