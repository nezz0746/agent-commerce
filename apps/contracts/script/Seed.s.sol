// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CommerceHub} from "../src/CommerceHub.sol";
import {Shop} from "../src/Shop.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/erc8004/ValidationRegistry.sol";

/// @title Seed
/// @notice Populates the deployed CommerceHub with sample shops, products, categories, etc.
contract Seed is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hubAddr = vm.envAddress("COMMERCE_HUB");
        address reputationAddr = vm.envAddress("REPUTATION_REGISTRY");
        address validationAddr = vm.envAddress("VALIDATION_REGISTRY");

        CommerceHub hub = CommerceHub(hubAddr);
        ReputationRegistry reputation = ReputationRegistry(reputationAddr);
        ValidationRegistry validation = ValidationRegistry(validationAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Create shops (auto-registers as agents via hub)
        address shop1Addr = hub.createShop("Astro Merch", "ipfs://astro-merch-metadata");
        _seedAstroMerch(Shop(payable(shop1Addr)));
        console2.log("Astro Merch:", shop1Addr);
        console2.log("  agentId:", hub.getShopAgentId(shop1Addr));

        address shop2Addr = hub.createShop("Onchain Coffee", "ipfs://onchain-coffee-metadata");
        _seedOnchainCoffee(Shop(payable(shop2Addr)));
        console2.log("Onchain Coffee:", shop2Addr);
        console2.log("  agentId:", hub.getShopAgentId(shop2Addr));

        // Example feedback via reputation registry
        uint256 agent1 = hub.getShopAgentId(shop1Addr);
        reputation.giveFeedback(agent1, 5, 0, "quality", "", "", "ipfs://feedback1", bytes32(0));
        reputation.giveFeedback(agent1, 4, 0, "delivery", "", "", "ipfs://feedback2", bytes32(0));
        console2.log("Example feedback left for Astro Merch");

        // Example validation request
        uint256 agent2 = hub.getShopAgentId(shop2Addr);
        bytes32 reqHash = keccak256(abi.encodePacked("validation-req-1"));
        validation.validationRequest(vm.addr(deployerPrivateKey), agent2, "ipfs://validation-req", reqHash);
        validation.validationResponse(reqHash, 1, "ipfs://validation-resp", keccak256("resp"), "legitimacy");
        console2.log("Example validation for Onchain Coffee");

        vm.stopBroadcast();
        console2.log("Seeding complete!");
    }

    function _seedAstroMerch(Shop shop) internal {
        uint256 cat1 = shop.createCategory("Apparel", "");
        uint256 cat2 = shop.createCategory("Accessories", "");
        uint256 cat3 = shop.createCategory("Collectibles", "");

        uint256 p1 = shop.createProduct("Astro T-Shirt", 0.015 ether, 100, cat1, "");
        shop.addVariant(p1, "Small", 0.015 ether, 30);
        shop.addVariant(p1, "Medium", 0.015 ether, 40);
        shop.addVariant(p1, "Large", 0.015 ether, 30);

        uint256 p2 = shop.createProduct("Galaxy Hoodie", 0.035 ether, 50, cat1, "");
        shop.addVariant(p2, "Medium", 0.035 ether, 25);
        shop.addVariant(p2, "Large", 0.035 ether, 25);

        uint256 p3 = shop.createProduct("Rocket Pin", 0.005 ether, 200, cat2, "");
        uint256 p4 = shop.createProduct("Nebula Sticker Pack", 0.003 ether, 500, cat2, "");
        uint256 p5 = shop.createProduct("Cosmos Cap", 0.02 ether, 75, cat2, "");
        shop.addVariant(p5, "Black", 0.02 ether, 40);
        shop.addVariant(p5, "Navy", 0.02 ether, 35);

        uint256 p6 = shop.createProduct("Moon Rock Replica", 0.05 ether, 25, cat3, "");

        _createAstroCollections(shop, p1, p2, p3, p4, p5, p6);

        shop.createDiscount(keccak256("WELCOME10"), 1000, 100, block.timestamp + 365 days);
        shop.addEmployee(address(0xBEEF0001), shop.MANAGER_ROLE());
    }

    function _createAstroCollections(Shop shop, uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5, uint256 p6) internal {
        uint256[] memory featured = new uint256[](3);
        featured[0] = p1; featured[1] = p2; featured[2] = p6;
        shop.createCollection("Featured", featured, "");

        uint256[] memory newArr = new uint256[](3);
        newArr[0] = p3; newArr[1] = p4; newArr[2] = p5;
        shop.createCollection("New Arrivals", newArr, "");
    }

    function _seedOnchainCoffee(Shop shop) internal {
        uint256 cat1 = shop.createCategory("Drinks", "");
        uint256 cat2 = shop.createCategory("Beans", "");
        uint256 cat3 = shop.createCategory("Merch", "");

        uint256 p1 = shop.createProduct("Espresso Shot", 0.002 ether, 1000, cat1, "");
        uint256 p2 = shop.createProduct("Cold Brew", 0.004 ether, 500, cat1, "");
        shop.addVariant(p2, "Regular", 0.004 ether, 300);
        shop.addVariant(p2, "Large", 0.005 ether, 200);

        uint256 p3 = shop.createProduct("Matcha Latte", 0.005 ether, 300, cat1, "");
        shop.addVariant(p3, "Oat Milk", 0.005 ether, 150);
        shop.addVariant(p3, "Whole Milk", 0.005 ether, 150);

        uint256 p4 = shop.createProduct("Ethiopian Yirgacheffe 250g", 0.01 ether, 100, cat2, "");
        uint256 p5 = shop.createProduct("Colombian Supremo 250g", 0.01 ether, 100, cat2, "");

        uint256 p6 = shop.createProduct("Coffee Mug", 0.008 ether, 150, cat3, "");
        uint256 p7 = shop.createProduct("Tote Bag", 0.012 ether, 80, cat3, "");

        _createCoffeeCollections(shop, p1, p2, p3, p4, p6, p7);

        shop.createDiscount(keccak256("WELCOME10"), 1000, 100, block.timestamp + 365 days);
        shop.addEmployee(address(0xBEEF0002), shop.MANAGER_ROLE());
    }

    function _createCoffeeCollections(Shop shop, uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p6, uint256 p7) internal {
        uint256[] memory featured = new uint256[](3);
        featured[0] = p1; featured[1] = p2; featured[2] = p4;
        shop.createCollection("Featured", featured, "");

        uint256[] memory newArr = new uint256[](3);
        newArr[0] = p3; newArr[1] = p6; newArr[2] = p7;
        shop.createCollection("New Arrivals", newArr, "");
    }
}
