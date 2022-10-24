// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/IOpenSkyFlashClaimReceiver.sol";
import "./IApeCoinStaking.sol";

contract OpenSkyApeCoinStaking is IOpenSkyFlashClaimReceiver, ERC721Holder {
    using SafeERC20 for IERC20;

    IApeCoinStaking public immutable apeCoinStaking;
    IERC20 public immutable apeCoin;
    IERC721 public immutable bakc;

    modifier onlySelf(){
        require(msg.sender == address(this), "ONLY_SELF");
        _;
    }

    constructor(address _apeCoinStakingContractAddress, address _apeCoinContractAddress, address _bakcContractAddress) {
        apeCoinStaking = IApeCoinStaking(_apeCoinStakingContractAddress);
        apeCoin = IERC20(_apeCoinContractAddress);
        bakc = IERC721(_bakcContractAddress);
    }

    function executeOperation(
        address[] calldata nftAddresses,
        uint256[] calldata tokenIds,
        address initiator,
        address operator,
        bytes calldata params
    ) external override returns (bool) {
        require(nftAddresses.length != 0 && nftAddresses.length == tokenIds.length, "PARAMS_ERROR");
        require(initiator != address(0));
        require(operator != address(0));

        for (uint256 i = 0; i < nftAddresses.length; i++) {
            (bool success, ) = address(this).call(params);
            require(success, "CALL_FAIL");

            IERC721(nftAddresses[i]).approve(operator, tokenIds[i]);
        }

        return true;
    }

    function depositBAYC(IApeCoinStaking.SingleNft[] calldata _nfts, address _recipient) public onlySelf {
        uint256 amount;
        for (uint256 i; i < _nfts.length; ++i) {
            amount += _nfts[i].amount;
        }

        apeCoin.safeTransferFrom(_recipient, address(this), amount);
        apeCoin.safeApprove(address(apeCoinStaking), amount);

        apeCoinStaking.depositBAYC(_nfts);
    }

    function depositMAYC(IApeCoinStaking.SingleNft[] calldata _nfts, address _recipient) public onlySelf {
        uint256 amount;
        for (uint256 i; i < _nfts.length; ++i) {
            amount += _nfts[i].amount;
        }

        apeCoin.safeTransferFrom(_recipient, address(this), amount);
        apeCoin.safeApprove(address(apeCoinStaking), amount);

        apeCoinStaking.depositMAYC(_nfts);
    }

    function depositBAKC(
        IApeCoinStaking.PairNftWithAmount[] calldata _baycPairs,
        IApeCoinStaking.PairNftWithAmount[] calldata _maycPairs,
        address _recipient
    ) public onlySelf {
        uint256 amount;
        for (uint256 i; i < _baycPairs.length; ++i) {
            amount += _baycPairs[i].amount;
            bakc.safeTransferFrom(_recipient, address(this), _baycPairs[i].bakcTokenId);    
        }
        for (uint256 i; i < _maycPairs.length; ++i) {
            amount += _maycPairs[i].amount;
            bakc.safeTransferFrom(_recipient, address(this), _maycPairs[i].bakcTokenId);    
        }

        apeCoin.safeTransferFrom(_recipient, address(this), amount);
        apeCoin.safeApprove(address(apeCoinStaking), amount);

        apeCoinStaking.depositBAKC(_baycPairs, _maycPairs);

        for (uint256 i; i < _baycPairs.length; ++i) {
            bakc.safeTransferFrom(address(this), _recipient, _baycPairs[i].bakcTokenId);    
        }
        for (uint256 i; i < _maycPairs.length; ++i) {
            bakc.safeTransferFrom(address(this), _recipient, _maycPairs[i].bakcTokenId);    
        }
    }

    function claimBAYC(uint256[] calldata _nfts, address _recipient) public onlySelf {
        apeCoinStaking.claimBAYC(_nfts, _recipient);
    }

    function claimMAYC(uint256[] calldata _nfts, address _recipient) public onlySelf {
        apeCoinStaking.claimMAYC(_nfts, _recipient);
    }

    function claimBAKC(
        IApeCoinStaking.PairNft[] calldata _baycPairs,
        IApeCoinStaking.PairNft[] calldata _maycPairs,
        address _recipient
    ) public onlySelf {
        apeCoinStaking.claimBAKC(_baycPairs, _maycPairs, _recipient);
    }

    function withdrawBAYC(IApeCoinStaking.SingleNft[] calldata _nfts, address _recipient) public onlySelf {
        apeCoinStaking.withdrawBAYC(_nfts, _recipient);
    }

    function withdrawMAYC(IApeCoinStaking.SingleNft[] calldata _nfts, address _recipient) public onlySelf {
        apeCoinStaking.withdrawMAYC(_nfts, _recipient);
    }

    function withdrawBAKC(
        IApeCoinStaking.PairNftWithAmount[] calldata _baycPairs,
        IApeCoinStaking.PairNftWithAmount[] calldata _maycPairs,
        address _recipient
    ) public onlySelf {
        apeCoinStaking.withdrawBAKC(_baycPairs, _maycPairs);
        apeCoin.safeTransferFrom(msg.sender, _recipient, apeCoin.balanceOf(address(this)));
    }
}
