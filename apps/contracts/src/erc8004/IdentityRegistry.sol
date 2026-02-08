// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title IdentityRegistry (ERC-8004)
/// @notice ERC-721 registry for agent identities. Each agent gets a tokenId (agentId).
contract IdentityRegistry is ERC721URIStorage, EIP712 {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    struct MetadataEntry {
        string key;
        bytes value;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    uint256 private _nextAgentId = 1;

    /// @notice agentId → metadataKey → metadataValue
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @notice agentId → delegated wallet address
    mapping(uint256 => address) private _agentWallet;

    bytes32 private constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);
    event URIUpdated(uint256 indexed agentId, string newURI);
    event MetadataSet(uint256 indexed agentId, string key);
    event AgentWalletSet(uint256 indexed agentId, address newWallet);
    event AgentWalletUnset(uint256 indexed agentId);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error NotAgentOwner();
    error ExpiredSignature();
    error InvalidSignature();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() ERC721("ERC8004 Agent", "AGENT") EIP712("ERC8004IdentityRegistry", "1") {}

    // ──────────────────────────────────────────────
    //  Registration
    // ──────────────────────────────────────────────

    /// @notice Register a new agent with a URI
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, msg.sender, agentURI);
    }

    /// @notice Register with URI and initial metadata entries
    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key);
        }
        emit Registered(agentId, msg.sender, agentURI);
    }

    /// @notice Register with no URI
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        emit Registered(agentId, msg.sender, "");
    }

    // ──────────────────────────────────────────────
    //  URI
    // ──────────────────────────────────────────────

    /// @notice Update the agent URI
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI);
    }

    // ──────────────────────────────────────────────
    //  Metadata
    // ──────────────────────────────────────────────

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey);
    }

    // ──────────────────────────────────────────────
    //  Agent Wallet (EIP-712)
    // ──────────────────────────────────────────────

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert ExpiredSignature();

        bytes32 structHash = keccak256(abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);

        if (signer != ownerOf(agentId)) revert InvalidSignature();

        _agentWallet[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallet[agentId];
    }

    function unsetAgentWallet(uint256 agentId) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        delete _agentWallet[agentId];
        emit AgentWalletUnset(agentId);
    }

    // ──────────────────────────────────────────────
    //  Overrides — clear wallet on transfer
    // ──────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            // Transfer (not mint/burn): clear agent wallet
            delete _agentWallet[tokenId];
        }
        return from;
    }

    /// @notice Check if caller is owner or approved (used by other registries)
    function isOwnerOrApproved(uint256 agentId, address caller) external view returns (bool) {
        address owner_ = ownerOf(agentId);
        return caller == owner_ || getApproved(agentId) == caller || isApprovedForAll(owner_, caller);
    }
}
