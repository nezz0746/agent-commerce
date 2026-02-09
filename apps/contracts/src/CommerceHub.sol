// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Shop} from "./Shop.sol";
import {ICommerceHub} from "./interfaces/ICommerceHub.sol";
import {IdentityRegistry} from "./erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "./erc8004/ReputationRegistry.sol";

/// @title CommerceHub
/// @author onchain-commerce
/// @notice Protocol singleton that deploys and registers shops using ERC-1167 minimal proxies
/// @dev Uses OpenZeppelin Clones for gas-efficient shop deployment
contract CommerceHub is ICommerceHub, Ownable, IERC721Receiver {
    using Clones for address;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Shop implementation contract used for cloning
    address public shopImplementation;

    /// @notice Protocol fee in basis points (e.g., 250 = 2.5%)
    uint256 public protocolFee;

    /// @notice Address that receives protocol fees
    address public protocolFeeRecipient;

    /// @notice All deployed shop addresses
    address[] public shops;

    /// @notice Whether an address is a registered shop
    mapping(address => bool) public isShop;

    /// @notice Identity registry for ERC-8004 agent registration
    IdentityRegistry public identityRegistry;

    /// @notice Reputation registry for ERC-8004 feedback
    ReputationRegistry public reputationRegistry;

    /// @notice Shop address → agentId in the identity registry
    mapping(address => uint256) public shopAgentId;
    
    /// @notice agentId → authorized shop contract for ERC-8004 responses
    mapping(uint256 => address) public agentIdToShop;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ShopCreated(address indexed shop, address indexed owner, string name, string metadataURI, uint256 agentId);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event ProtocolFeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ShopImplementationUpdated(address oldImpl, address newImpl);
    event IdentityRegistryUpdated(address oldRegistry, address newRegistry);
    event ReputationRegistryUpdated(address oldRegistry, address newRegistry);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidFee();
    error ZeroAddress();
    error NotRegisteredAgent();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @param _shopImplementation Address of the Shop implementation contract
    /// @param _protocolFee Initial protocol fee in basis points
    /// @param _protocolFeeRecipient Address to receive protocol fees
    /// @param _identityRegistry Address of the ERC-8004 IdentityRegistry
    /// @param _reputationRegistry Address of the ERC-8004 ReputationRegistry
    constructor(
        address _shopImplementation,
        uint256 _protocolFee,
        address _protocolFeeRecipient,
        address _identityRegistry,
        address _reputationRegistry
    ) Ownable(msg.sender) {
        if (_shopImplementation == address(0)) revert ZeroAddress();
        if (_protocolFeeRecipient == address(0)) revert ZeroAddress();
        if (_identityRegistry == address(0)) revert ZeroAddress();
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        if (_protocolFee > 1000) revert InvalidFee(); // max 10%

        shopImplementation = _shopImplementation;
        protocolFee = _protocolFee;
        protocolFeeRecipient = _protocolFeeRecipient;
        identityRegistry = IdentityRegistry(_identityRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @notice Require the caller to be a registered agent in the ERC-8004 IdentityRegistry
    modifier requireRegisteredAgent() {
        if (identityRegistry.balanceOf(msg.sender) == 0) revert NotRegisteredAgent();
        _;
    }

    // ──────────────────────────────────────────────
    //  Shop Creation
    // ──────────────────────────────────────────────

    /// @notice Deploy a new shop using minimal proxy (ERC-1167)
    /// @param name Shop name
    /// @param metadataURI URI pointing to shop metadata (IPFS or similar)
    /// @return shop Address of the newly created shop
    function createShop(string calldata name, string calldata metadataURI) external requireRegisteredAgent returns (address shop) {
        shop = shopImplementation.clone();
        Shop(payable(shop)).initialize(msg.sender, name, metadataURI, address(this));

        // Register the shop as an agent in the identity registry
        uint256 agentId = identityRegistry.register(metadataURI);
        shopAgentId[shop] = agentId;
        agentIdToShop[agentId] = shop;

        // Set ERC-8004 references on the shop
        Shop(payable(shop)).setERC8004(address(reputationRegistry), agentId);

        // Transfer the agent NFT to the shop owner
        identityRegistry.transferFrom(address(this), msg.sender, agentId);

        shops.push(shop);
        isShop[shop] = true;

        emit ShopCreated(shop, msg.sender, name, metadataURI, agentId);
    }

    /// @notice Get the agentId for a shop
    function getShopAgentId(address shop) external view returns (uint256) {
        return shopAgentId[shop];
    }
    
    /// @notice Check if a shop contract is authorized for an agent (for ERC-8004 responses)
    function isShopAuthorizedForAgent(uint256 agentId, address shop) external view returns (bool) {
        return agentIdToShop[agentId] == shop;
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Update the protocol fee
    /// @param _protocolFee New fee in basis points (max 1000 = 10%)
    function setProtocolFee(uint256 _protocolFee) external onlyOwner {
        if (_protocolFee > 1000) revert InvalidFee();
        uint256 oldFee = protocolFee;
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(oldFee, _protocolFee);
    }

    /// @notice Update the protocol fee recipient
    /// @param _recipient New recipient address
    function setProtocolFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        address old = protocolFeeRecipient;
        protocolFeeRecipient = _recipient;
        emit ProtocolFeeRecipientUpdated(old, _recipient);
    }

    /// @notice Update the shop implementation for future clones
    /// @param _impl New Shop implementation address
    function setShopImplementation(address _impl) external onlyOwner {
        if (_impl == address(0)) revert ZeroAddress();
        address old = shopImplementation;
        shopImplementation = _impl;
        emit ShopImplementationUpdated(old, _impl);
    }

    /// @notice Update the identity registry address (for multi-chain deployments)
    /// @param _identityRegistry New IdentityRegistry address
    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        address old = address(identityRegistry);
        identityRegistry = IdentityRegistry(_identityRegistry);
        emit IdentityRegistryUpdated(old, _identityRegistry);
    }

    /// @notice Update the reputation registry address
    /// @param _reputationRegistry New ReputationRegistry address
    function setReputationRegistry(address _reputationRegistry) external onlyOwner {
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        address old = address(reputationRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        emit ReputationRegistryUpdated(old, _reputationRegistry);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    /// @notice Get the total number of shops
    function shopCount() external view returns (uint256) {
        return shops.length;
    }

    /// @notice Get all shop addresses
    function getShops() external view returns (address[] memory) {
        return shops;
    }

    /// @notice Get the reputation registry address (used by Shop via ICommerceHub)
    function reputationRegistryAddress() external view returns (address) {
        return address(reputationRegistry);
    }

    /// @notice ERC721Receiver implementation to accept agent NFTs during shop creation
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
