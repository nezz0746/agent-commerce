// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "./IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICommerceHubForReputation {
    function isShopAuthorizedForAgent(uint256 agentId, address shop) external view returns (bool);
}

/// @title ReputationRegistry (ERC-8004)
/// @notice Feedback system for agents. Clients can give, revoke, and respond to feedback.
contract ReputationRegistry is Ownable {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        bool isRevoked;
        uint256 createdAt;
    }

    struct Response {
        string responseURI;
        bytes32 responseHash;
        uint256 createdAt;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    IdentityRegistry public identityRegistry;
    ICommerceHubForReputation public commerceHub;

    /// @dev agentId → clientAddress → feedbackIndex → Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedback;

    /// @dev agentId → clientAddress → next feedback index
    mapping(uint256 => mapping(address => uint64)) private _lastIndex;

    /// @dev agentId → list of client addresses that have given feedback
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    /// @dev agentId → clientAddress → feedbackIndex → Response[]
    mapping(uint256 => mapping(address => mapping(uint64 => Response[]))) private _responses;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex);
    event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error NotAgentOwner();
    error NotFeedbackAuthor();
    error FeedbackAlreadyRevoked();
    error InvalidFeedbackIndex();

    // ──────────────────────────────────────────────
    //  Constructor / Initialize
    // ──────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    function initialize(address identityRegistry_) external onlyOwner {
        require(address(identityRegistry) == address(0), "Already initialized");
        identityRegistry = IdentityRegistry(identityRegistry_);
    }
    
    function setCommerceHub(address commerceHub_) external onlyOwner {
        commerceHub = ICommerceHubForReputation(commerceHub_);
    }

    // ──────────────────────────────────────────────
    //  Feedback
    // ──────────────────────────────────────────────

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        // Ensure agent exists (will revert if not minted)
        identityRegistry.ownerOf(agentId);

        uint64 idx = _lastIndex[agentId][msg.sender];
        _feedback[agentId][msg.sender][idx] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            isRevoked: false,
            createdAt: block.timestamp
        });
        _lastIndex[agentId][msg.sender] = idx + 1;

        if (!_isClient[agentId][msg.sender]) {
            _clients[agentId].push(msg.sender);
            _isClient[agentId][msg.sender] = true;
        }

        emit NewFeedback(agentId, msg.sender, idx, value, valueDecimals, tag1, tag2);
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage fb = _feedback[agentId][msg.sender][feedbackIndex];
        if (fb.createdAt == 0) revert InvalidFeedbackIndex();
        if (fb.isRevoked) revert FeedbackAlreadyRevoked();
        fb.isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external {
        // Allow either NFT owner/approved OR authorized shop contract to respond
        bool isNFTOwner = identityRegistry.isOwnerOrApproved(agentId, msg.sender);
        bool isAuthorizedShop = address(commerceHub) != address(0) && commerceHub.isShopAuthorizedForAgent(agentId, msg.sender);
        if (!isNFTOwner && !isAuthorizedShop) revert NotAgentOwner();
        
        if (_feedback[agentId][clientAddress][feedbackIndex].createdAt == 0) revert InvalidFeedbackIndex();

        _responses[agentId][clientAddress][feedbackIndex].push(
            Response({responseURI: responseURI, responseHash: responseHash, createdAt: block.timestamp})
        );
        emit ResponseAppended(agentId, clientAddress, feedbackIndex);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback storage fb = _feedback[agentId][clientAddress][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    function readAllFeedback(uint256 agentId, address clientAddress)
        external
        view
        returns (
            int128[] memory values,
            uint8[] memory valueDecimals,
            string[] memory tag1s,
            string[] memory tag2s,
            bool[] memory revoked
        )
    {
        uint64 count = _lastIndex[agentId][clientAddress];
        values = new int128[](count);
        valueDecimals = new uint8[](count);
        tag1s = new string[](count);
        tag2s = new string[](count);
        revoked = new bool[](count);
        for (uint64 i = 0; i < count; i++) {
            Feedback storage fb = _feedback[agentId][clientAddress][i];
            values[i] = fb.value;
            valueDecimals[i] = fb.valueDecimals;
            tag1s[i] = fb.tag1;
            tag2s[i] = fb.tag2;
            revoked[i] = fb.isRevoked;
        }
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        returns (uint256 count, int256 summaryValue, uint8 summaryValueDecimals)
    {
        address[] memory clients;
        if (clientAddresses.length > 0) {
            clients = clientAddresses;
        } else {
            clients = _clients[agentId];
        }
        bytes32 t1Hash = bytes(tag1).length > 0 ? keccak256(bytes(tag1)) : bytes32(0);
        bytes32 t2Hash = bytes(tag2).length > 0 ? keccak256(bytes(tag2)) : bytes32(0);
        (count, summaryValue) = _computeSummary(agentId, clients, t1Hash, t2Hash);
    }

    function _computeSummary(uint256 agentId, address[] memory clients, bytes32 t1Hash, bytes32 t2Hash)
        internal
        view
        returns (uint256 count, int256 summaryValue)
    {
        for (uint256 c = 0; c < clients.length; c++) {
            uint64 last = _lastIndex[agentId][clients[c]];
            for (uint64 i = 0; i < last; i++) {
                Feedback storage fb = _feedback[agentId][clients[c]][i];
                if (fb.isRevoked) continue;
                if (t1Hash != bytes32(0) && keccak256(bytes(fb.tag1)) != t1Hash) continue;
                if (t2Hash != bytes32(0) && keccak256(bytes(fb.tag2)) != t2Hash) continue;
                summaryValue += fb.value;
                count++;
            }
        }
    }

    function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (uint256)
    {
        return _responses[agentId][clientAddress][feedbackIndex].length;
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }
}
