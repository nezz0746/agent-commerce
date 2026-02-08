// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Shop} from "./Shop.sol";
import {ICommerceHub} from "./interfaces/ICommerceHub.sol";

/// @title CommerceHub
/// @author onchain-commerce
/// @notice Protocol singleton that deploys and registers shops using ERC-1167 minimal proxies
/// @dev Uses OpenZeppelin Clones for gas-efficient shop deployment
contract CommerceHub is ICommerceHub, Ownable {
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

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ShopCreated(address indexed shop, address indexed owner, string name, string metadataURI);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event ProtocolFeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ShopImplementationUpdated(address oldImpl, address newImpl);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidFee();
    error ZeroAddress();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @param _shopImplementation Address of the Shop implementation contract
    /// @param _protocolFee Initial protocol fee in basis points
    /// @param _protocolFeeRecipient Address to receive protocol fees
    constructor(address _shopImplementation, uint256 _protocolFee, address _protocolFeeRecipient) Ownable(msg.sender) {
        if (_shopImplementation == address(0)) revert ZeroAddress();
        if (_protocolFeeRecipient == address(0)) revert ZeroAddress();
        if (_protocolFee > 1000) revert InvalidFee(); // max 10%

        shopImplementation = _shopImplementation;
        protocolFee = _protocolFee;
        protocolFeeRecipient = _protocolFeeRecipient;
    }

    // ──────────────────────────────────────────────
    //  Shop Creation
    // ──────────────────────────────────────────────

    /// @notice Deploy a new shop using minimal proxy (ERC-1167)
    /// @param name Shop name
    /// @param metadataURI URI pointing to shop metadata (IPFS or similar)
    /// @return shop Address of the newly created shop
    function createShop(string calldata name, string calldata metadataURI) external returns (address shop) {
        shop = shopImplementation.clone();
        Shop(payable(shop)).initialize(msg.sender, name, metadataURI, address(this));

        shops.push(shop);
        isShop[shop] = true;

        emit ShopCreated(shop, msg.sender, name, metadataURI);
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
}
