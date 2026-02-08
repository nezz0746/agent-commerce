// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "./IdentityRegistry.sol";

/// @title ValidationRegistry (ERC-8004)
/// @notice Request/response validation for agents. Validators confirm or deny agent claims.
contract ValidationRegistry {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    struct ValidationRecord {
        address validatorAddress;
        uint256 agentId;
        string requestURI;
        bytes32 requestHash;
        uint8 response; // 0 = pending, 1 = pass, 2 = fail
        string responseURI;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    IdentityRegistry public identityRegistry;

    /// @dev requestHash → ValidationRecord
    mapping(bytes32 => ValidationRecord) private _validations;

    /// @dev agentId → list of request hashes
    mapping(uint256 => bytes32[]) private _agentValidations;

    /// @dev validatorAddress → list of request hashes
    mapping(address => bytes32[]) private _validatorRequests;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ValidationRequested(
        bytes32 indexed requestHash, uint256 indexed agentId, address indexed validatorAddress, string requestURI
    );
    event ValidationResponded(bytes32 indexed requestHash, uint8 response, string tag);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error NotAgentOwner();
    error NotValidator();
    error RequestAlreadyExists();
    error RequestNotFound();

    // ──────────────────────────────────────────────
    //  Constructor / Initialize
    // ──────────────────────────────────────────────

    constructor() {}

    function initialize(address identityRegistry_) external {
        require(address(identityRegistry) == address(0), "Already initialized");
        identityRegistry = IdentityRegistry(identityRegistry_);
    }

    // ──────────────────────────────────────────────
    //  Request / Response
    // ──────────────────────────────────────────────

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        if (!identityRegistry.isOwnerOrApproved(agentId, msg.sender)) revert NotAgentOwner();
        if (_validations[requestHash].lastUpdate != 0) revert RequestAlreadyExists();

        _validations[requestHash] = ValidationRecord({
            validatorAddress: validatorAddress,
            agentId: agentId,
            requestURI: requestURI,
            requestHash: requestHash,
            response: 0,
            responseURI: "",
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp
        });

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequested(requestHash, agentId, validatorAddress, requestURI);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationRecord storage v = _validations[requestHash];
        if (v.lastUpdate == 0) revert RequestNotFound();
        if (v.validatorAddress != msg.sender) revert NotValidator();

        v.response = response;
        v.responseURI = responseURI;
        v.responseHash = responseHash;
        v.tag = tag;
        v.lastUpdate = block.timestamp;

        emit ValidationResponded(requestHash, response, tag);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        ValidationRecord storage v = _validations[requestHash];
        return (v.validatorAddress, v.agentId, v.response, v.responseHash, v.tag, v.lastUpdate);
    }

    function getSummary(uint256 agentId, address[] calldata validatorAddresses, string calldata tag)
        external
        view
        returns (uint256 count, uint256 averageResponse)
    {
        bytes32[] storage hashes = _agentValidations[agentId];
        bool filterTag = bytes(tag).length > 0;
        bytes32 tagHash = keccak256(bytes(tag));
        uint256 total;

        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationRecord storage v = _validations[hashes[i]];
            if (v.response == 0) continue; // pending
            if (filterTag && keccak256(bytes(v.tag)) != tagHash) continue;

            bool matchValidator = validatorAddresses.length == 0;
            for (uint256 j = 0; j < validatorAddresses.length && !matchValidator; j++) {
                if (v.validatorAddress == validatorAddresses[j]) matchValidator = true;
            }
            if (!matchValidator) continue;

            total += v.response;
            count++;
        }
        if (count > 0) averageResponse = total / count;
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }
}
