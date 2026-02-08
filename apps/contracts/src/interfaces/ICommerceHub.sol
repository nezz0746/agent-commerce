// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICommerceHub
/// @notice Interface for the CommerceHub protocol singleton
interface ICommerceHub {
    function protocolFee() external view returns (uint256);
    function protocolFeeRecipient() external view returns (address);
}
