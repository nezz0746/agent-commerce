// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Shop} from "../src/Shop.sol";
import {CommerceHub} from "../src/CommerceHub.sol";

contract CommerceHubTest is Test {
    CommerceHub public hub;
    Shop public shopImpl;
    address public owner = address(this);
    address public feeRecipient = makeAddr("feeRecipient");
    address public shopOwner = makeAddr("shopOwner");
    address public customer = makeAddr("customer");

    function setUp() public {
        shopImpl = new Shop();
        hub = new CommerceHub(address(shopImpl), 250, feeRecipient);
        vm.deal(customer, 100 ether);
    }

    function test_createShop() public {
        vm.prank(shopOwner);
        address shop = hub.createShop("Test Shop", "ipfs://metadata");

        assertEq(hub.shopCount(), 1);
        assertTrue(hub.isShop(shop));
        assertEq(Shop(payable(shop)).name(), "Test Shop");
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

    function test_fulfillAndReview() public {
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
        shop.leaveReview(orderId, 5, "ipfs://review");
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
