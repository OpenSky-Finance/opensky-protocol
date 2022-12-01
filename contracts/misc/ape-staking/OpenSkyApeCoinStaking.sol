// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IApeCoinStaking.sol";
import "../UserProxies.sol";
import "../../interfaces/IOpenSkySettings.sol";
import "../../interfaces/IACLManager.sol";
import "../../interfaces/IOpenSkyIncentivesController.sol";

contract OpenSkyApeCoinStaking is UserProxies, ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable APE_COIN;
    IApeCoinStaking public immutable APE_COIN_STAKING;
    IOpenSkySettings public immutable SETTINGS;
    address public apeCoinAdapter;

    constructor(
        IERC20 apeCoin,
        IApeCoinStaking apeCoinStaking,
        IOpenSkySettings settings
    ) ERC20("OpenSky Ape Coin Staking", "OAPE") {
        APE_COIN = apeCoin;
        APE_COIN_STAKING = apeCoinStaking;
        SETTINGS = settings;
    }

    modifier onlyGovernance() {
        IACLManager ACLManager = IACLManager(SETTINGS.ACLManagerAddress());
        require(ACLManager.isGovernance(_msgSender()), "ONLY_GOVERNANCE");
        _;
    }

    function setApeCoinAdapter(address _apeCoinAdapter) external onlyGovernance {
        apeCoinAdapter = _apeCoinAdapter;
    }

    function deposit(uint256 _amount, address _recipient) external {
        _mint(_recipient, _amount);

        APE_COIN.safeTransferFrom(_recipient, address(this), _amount);
        APE_COIN.approve(address(APE_COIN_STAKING), _amount);
        APE_COIN_STAKING.depositApeCoin(_amount, _getUserProxy(_recipient));
    }

    function withdraw(uint256 _amount, address _recipient) external {
        _burn(msg.sender, _amount);

        bytes memory data = abi.encodeWithSignature("withdrawApeCoin(uint256,address)", _amount, _recipient);
        _callUserProxy(msg.sender, address(APE_COIN_STAKING), data);
    }

    function withdraw(uint256 _amount, address _from, address _recipient) public {
        if (_from != address(0)) {
            require(msg.sender == apeCoinAdapter);
        }
        _burn(msg.sender, _amount);

        bytes memory data = abi.encodeWithSignature("withdrawApeCoin(uint256,address)", _amount, _recipient);
        _callUserProxy(_from, address(APE_COIN_STAKING), data);
    }

    function claim(address _recipient) public {
        bytes memory data = abi.encodeWithSignature("claimApeCoin(address)", _recipient);
        _callUserProxy(msg.sender, address(APE_COIN_STAKING), data);
    }

    function claim(address _from, address _recipient) public {
        if (_from != address(0)) {
            require(msg.sender == apeCoinAdapter);
        }

        bytes memory data = abi.encodeWithSignature("claimApeCoin(address)", _recipient);
        _callUserProxy(_from, address(APE_COIN_STAKING), data);
    }

    function _mint(address account, uint256 amount) internal virtual override {
        uint256 previousBalance = balanceOf(account);
        uint256 previousTotalSupply = totalSupply();

        super._mint(account, amount);

        address incentiveControllerAddress = SETTINGS.incentiveControllerAddress();
        if (incentiveControllerAddress != address(0)) {
            IOpenSkyIncentivesController(incentiveControllerAddress).handleAction(
                account,
                previousBalance,
                previousTotalSupply
            );
        }
    }

    function _burn(address account, uint256 amount) internal virtual override {
        uint256 previousBalance = balanceOf(account);
        uint256 previousTotalSupply = totalSupply();

        super._burn(account, amount);

        address incentiveControllerAddress = SETTINGS.incentiveControllerAddress();
        if (incentiveControllerAddress != address(0)) {
            IOpenSkyIncentivesController(incentiveControllerAddress).handleAction(
                account,
                previousBalance,
                previousTotalSupply
            );
        }
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override {
        uint256 previousSenderBalance = balanceOf(sender);
        uint256 previousRecipientBalance = balanceOf(recipient);

        super._transfer(sender, recipient, amount);

        address incentiveControllerAddress = SETTINGS.incentiveControllerAddress();
        if (incentiveControllerAddress != address(0)) {
            uint256 currentTotalSupply = totalSupply();
            IOpenSkyIncentivesController(incentiveControllerAddress).handleAction(
                sender,
                previousSenderBalance,
                currentTotalSupply
            );
            if (sender != recipient) {
                IOpenSkyIncentivesController(incentiveControllerAddress).handleAction(
                    recipient,
                    previousRecipientBalance,
                    currentTotalSupply
                );
            }
        }
    }
}
