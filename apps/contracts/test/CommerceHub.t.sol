// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Shop} from "../src/Shop.sol";
import {CommerceHub} from "../src/CommerceHub.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/erc8004/ValidationRegistry.sol";

contract CommerceHubTest is Test {
    CommerceHub public hub;
    Shop public shopImpl;
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;
    address public owner = address(this);
    address public feeRecipient = makeAddr("feeRecipient");
    address public shopOwner = makeAddr("shopOwner");
    address public customer = makeAddr("customer");

    function setUp() public {
        identityRegistry = new IdentityRegistry();
        reputationRegistry = new ReputationRegistry();
        reputationRegistry.initialize(address(identityRegistry));
        validationRegistry = new ValidationRegistry();
        validationRegistry.initialize(address(identityRegistry));

        shopImpl = new Shop();
        hub = new CommerceHub(
            address(shopImpl), 250, feeRecipient, address(identityRegistry), address(reputationRegistry)
        );
        vm.deal(customer, 100 ether);
    }

    function test_createShop() public {
        vm.prank(shopOwner);
        address shop = hub.createShop("Test Shop", "ipfs://metadata");

        assertEq(hub.shopCount(), 1);
        assertTrue(hub.isShop(shop));
        assertEq(Shop(payable(shop)).name(), "Test Shop");

        // Check agent was registered
        uint256 agentId = hub.getShopAgentId(shop);
        assertGt(agentId, 0);
        assertEq(identityRegistry.ownerOf(agentId), shopOwner);
    }

    function test_createProductAndOrder() public {
        vm.prank(shopOwner);
        address shopAddr = hub.createShop("Test Shop", "ipfs://metadata");
        Shop shop = Shop(payable(shopAddr));

        // Create category and product
        vm.startPrank(shopOwner);
        uint256 catId = shop.createCategory("Electronics", "ipfs://cat");
        uint256 prodId = shop.createProduct("Widget", 1 ether, 10, catId, "ipfs://widget");
        vm.stopPrank();

        // Place order
        Shop.OrderItem[] memory items = new Shop.OrderItem[](1);
        items[0] = Shop.OrderItem({productId: prodId, variantId: 0, quantity: 2});

        vm.prank(customer);
        uint256 orderId = shop.createOrder{value: 2 ether}(items);

        (address orderCustomer, uint256 total,, Shop.OrderStatus status,,) = shop.orders(orderId);
        assertEq(orderCustomer, customer);
        assertEq(total, 2 ether);
        assertTrue(status == Shop.OrderStatus.Paid);
    }

    function test_fulfillAndFeedback() public {
        vm.prank(shopOwner);
        address shopAddr = hub.createShop("Test Shop", "ipfs://metadata");
        Shop shop = Shop(payable(shopAddr));

        vm.startPrank(shopOwner);
        shop.createCategory("Cat", "");
        shop.createProduct("Item", 0.5 ether, 5, 1, "");
        vm.stopPrank();

        Shop.OrderItem[] memory items = new Shop.OrderItem[](1);
        items[0] = Shop.OrderItem({productId: 1, variantId: 0, quantity: 1});

        vm.prank(customer);
        uint256 orderId = shop.createOrder{value: 0.5 ether}(items);

        vm.prank(shopOwner);
        shop.fulfillOrder(orderId);

        vm.prank(customer);
        shop.leaveFeedback(orderId, 5, 0, "quality", "ipfs://review");
    }

    function test_digitalDelivery() public {
        vm.prank(shopOwner);
        address shopAddr = hub.createShop("Test Shop", "ipfs://metadata");
        Shop shop = Shop(payable(shopAddr));

        vm.startPrank(shopOwner);
        shop.createCategory("Digital", "");
        shop.createProduct("eBook", 0.01 ether, 100, 1, "");
        vm.stopPrank();

        Shop.OrderItem[] memory items = new Shop.OrderItem[](1);
        items[0] = Shop.OrderItem({productId: 1, variantId: 0, quantity: 1});

        vm.prank(customer);
        uint256 orderId = shop.createOrder{value: 0.01 ether}(items);

        bytes memory payload = abi.encodePacked("ipfs://QmDigitalContent");

        vm.prank(shopOwner);
        shop.deliverDigital(orderId, payload);

        // Check status is Completed
        (,,,Shop.OrderStatus status,,) = shop.orders(orderId);
        assertTrue(status == Shop.OrderStatus.Completed);

        // Check delivery payload
        assertEq(shop.getDelivery(orderId), payload);
    }

    function test_protocolFees() public {
        uint256 balBefore = feeRecipient.balance;

        vm.prank(shopOwner);
        address shopAddr = hub.createShop("Test Shop", "ipfs://metadata");
        Shop shop = Shop(payable(shopAddr));

        vm.startPrank(shopOwner);
        shop.createCategory("Cat", "");
        shop.createProduct("Item", 1 ether, 10, 1, "");
        vm.stopPrank();

        Shop.OrderItem[] memory items = new Shop.OrderItem[](1);
        items[0] = Shop.OrderItem({productId: 1, variantId: 0, quantity: 1});

        vm.prank(customer);
        shop.createOrder{value: 1 ether}(items);

        // 2.5% of 1 ether = 0.025 ether
        assertEq(feeRecipient.balance - balBefore, 0.025 ether);
    }
}
