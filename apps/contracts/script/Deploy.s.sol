// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Shop} from "../src/Shop.sol";
import {CommerceHub} from "../src/CommerceHub.sol";

/// @title Deploy
/// @notice Deployment script for the onchain-commerce protocol on Optimism
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeRecipient = vm.envAddress("PROTOCOL_FEE_RECIPIENT");
        uint256 protocolFee = vm.envOr("PROTOCOL_FEE_BPS", uint256(250)); // default 2.5%

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Shop implementation
        Shop shopImpl = new Shop();
        console2.log("Shop implementation:", address(shopImpl));

        // 2. Deploy CommerceHub
        CommerceHub hub = new CommerceHub(address(shopImpl), protocolFee, feeRecipient);
        console2.log("CommerceHub:", address(hub));

        vm.stopBroadcast();
    }
}
