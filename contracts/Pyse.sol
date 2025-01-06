// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Pyse is ERC721, ERC721URIStorage, Pausable, AccessControl {
    bytes32 public constant POOL_MANAGER = keccak256("POOL_MANAGER");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 poolAvailability;
    uint256 tokenCounter = 0;
    address immutable rewardTokenAddress;
    uint256 public tokenId;
    uint256 immutable rateOfReturn;
    uint256 immutable poolValue;
    address immutable ownerAddress;
    address poolManager;
    uint immutable startTime;
    uint immutable endTime;
    uint256 minValue;

    //List of events used within the contract
    event InvestedEvent(
        string orderId,
        address indexed sender,
        uint256 value,
        uint256 indexed tokenId,
        string cid,
        uint256 poolAvailability
    );
    event WithdrawEvent(
        string orderId,
        address indexed sender,
        uint256 value,
        uint256 indexed tokenId,
        uint256 contractBalance
    );
    event FinalWithdrawalEvent(
        string orderId,
        address indexed walletAddress,
        uint256 indexed tokenId,
        string cid,
        uint256 finalTokenId
    );
    event SplitEvent(
        string orderId,
        address indexed sender,
        uint256 indexed tokenId,
        uint256[] newTokenIds,
        uint256 numberOfSplits
    );
    event TransferEvent(
        address indexed from,
        address indexed to,
        uint indexed id
    );

    constructor(
        uint256 poolSize,
        uint256 rate,
        address poolManagerAddress,
        uint startDate,
        uint endDate,
        uint256 minimum,
        address _rewardTokenAddress
    ) ERC721("Pyse", "PSE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        claimPoolManager(poolManagerAddress);

        ownerAddress = msg.sender;
        rateOfReturn = rate;
        poolAvailability = poolSize;
        poolValue = poolSize;
        startTime = startDate;
        endTime = endDate;
        minValue = minimum;
        rewardTokenAddress = _rewardTokenAddress;
    }

    //Main functionality

    //Mints an ERC721 NFT for the investor. Assumes that payment has already been made, and transaction hash has been verified.
    function invest(
        string memory orderId,
        uint256 usdcAmount,
        address investor,
        string memory cid
    ) public onlyRole(POOL_MANAGER) {
        require(
            usdcAmount <= poolAvailability,
            "Investment amount larger than pool availability."
        );
        tokenId = tokenCounter;
        tokenCounter += 1;
        safeMint(investor, tokenId, cid);
        poolAvailability -= usdcAmount;

        emit InvestedEvent(
            orderId,
            investor,
            usdcAmount,
            tokenId,
            cid,
            poolAvailability
        );
    }

    //Allows users to withdraw their accured rewards. Metadata change is done off-chain.
    function withdraw(
        string memory orderId,
        uint256 rewardAmount,
        address walletAddress,
        uint256 ownerTokenId
    ) public onlyRole(POOL_MANAGER) {
        address payable recipient = payable(walletAddress);
        require(
            IERC20(rewardTokenAddress).balanceOf(address(this)) >= rewardAmount,
            "Insufficient balance, try again later."
        );
        bool success = IERC20(rewardTokenAddress).transfer(
            recipient,
            rewardAmount
        );
        require(success, "Withdrawal failed");

        uint256 contractBalance = IERC20(rewardTokenAddress).balanceOf(
            address(this)
        );

        emit WithdrawEvent(
            orderId,
            walletAddress,
            rewardAmount,
            ownerTokenId,
            contractBalance
        );
    }

    //To be called on final withdrawal to provide the special carbon-offset NFT.
    function finalWithdrawal(
        string memory orderId,
        address walletAddress,
        uint256 initialTokenId,
        string memory cid
    ) public onlyRole(POOL_MANAGER) {
        _burn(initialTokenId);
        tokenId = tokenCounter;
        tokenCounter += 1;
        safeMint(walletAddress, tokenId, cid);

        emit FinalWithdrawalEvent(
            orderId,
            walletAddress,
            initialTokenId,
            cid,
            tokenId
        );
    }

    //Allows users to split their investment into multiple parts. This is done by burning the original ERC721 NFT and batch minting new ones.
    function split(
        string memory orderId,
        uint256 initialTokenId,
        uint256 initialAmount,
        uint256[] memory amounts,
        string[] memory cid,
        address nftOwner
    ) public onlyRole(POOL_MANAGER) {
        require(amounts.length == cid.length, "Invalid split details.");
        uint256 count = amounts.length;
        uint256[] memory newTokenIds = new uint256[](count);
        string memory uri = "";
        uint256 total = 0;

        for (uint256 i = 0; i < count; i++) {
            require(
                amounts[i] >= minValue,
                "Individual split values are not above the minimum investable value."
            );
            total += amounts[i];
        }
        require(
            initialAmount == total,
            "The split values do not add up to the initial token value."
        );

        _burn(initialTokenId);

        for (uint256 i = 0; i < count; i++) {
            uri = cid[i];
            tokenId = tokenCounter;
            newTokenIds[i] = tokenId;
            tokenCounter += 1;

            safeMint(nftOwner, tokenId, uri);
        }

        emit SplitEvent(orderId, nftOwner, initialTokenId, newTokenIds, count);
    }

    //As a form of exit, users can transfer the ownership of their ERC721 NFT to a third party.
    function transfer(address from, address to, uint256 id) public {
        require(
            msg.sender == from,
            "Only the sender can initiate the transfer."
        );
        _safeTransfer(from, to, id, "");

        emit TransferEvent(from, to, id);
    }

    //View function to check pool details
    function checkPoolDetails()
        public
        view
        returns (uint256, uint256, uint256, uint, uint, uint256)
    {
        return (
            poolValue,
            poolAvailability,
            rateOfReturn,
            startTime,
            endTime,
            minValue
        );
    }

    //Function for claiming the POOL_MANAGER role
    function claimPoolManager(address newOwner) public onlyRole(ADMIN_ROLE) {
        require(newOwner != address(0), "New owner is a zero address");
        _grantRole(POOL_MANAGER, newOwner);
        poolManager = newOwner;
    }

    //Function for revoking the POOL_MANAGER role
    function revokePoolManager(
        address compromisedAddress
    ) public onlyRole(ADMIN_ROLE) {
        _revokeRole(POOL_MANAGER, compromisedAddress);
    }

    //Function to update the minimum investment value
    function updateMinValue(uint256 newValue) public onlyRole(POOL_MANAGER) {
        minValue = newValue;
    }

    //Helper functions

    function _baseURI() internal pure override returns (string memory) {
        return "https://ipfs.filebase.io/ipfs/";
    }

    function pause() public onlyRole(POOL_MANAGER) {
        _pause();
    }

    function unpause() public onlyRole(POOL_MANAGER) {
        _unpause();
    }

    function updateUri(
        uint256 nftId,
        string memory cid
    ) public onlyRole(POOL_MANAGER) {
        _setTokenURI(nftId, cid);
    }

    function safeMint(
        address to,
        uint256 tokenIdNew,
        string memory uri
    ) public onlyRole(POOL_MANAGER) {
        _safeMint(to, tokenIdNew);
        _setTokenURI(tokenIdNew, uri);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenIdNew,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenIdNew, batchSize);
    }

    // The following functions are overrides required by Solidity.

    function _burn(
        uint256 tokenIdNew
    ) internal override(ERC721, ERC721URIStorage) onlyRole(POOL_MANAGER) {
        super._burn(tokenIdNew);
    }

    function burn(uint256 tokenIdNew) public virtual onlyRole(POOL_MANAGER) {
        _burn(tokenIdNew);
    }

    function tokenURI(
        uint256 tokenIdNew
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenIdNew);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
