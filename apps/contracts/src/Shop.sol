// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ICommerceHub} from "./interfaces/ICommerceHub.sol";
import {ReputationRegistry} from "./erc8004/ReputationRegistry.sol";

/// @title Shop
/// @author onchain-commerce
/// @notice Per-shop contract deployed as an ERC-1167 clone. Manages products, categories,
///         collections, variants, orders, reviews, and discounts.
/// @dev Initialized via `initialize()` called by CommerceHub on clone deployment.
contract Shop is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    // ──────────────────────────────────────────────
    //  Reentrancy Guard
    // ──────────────────────────────────────────────

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant EMPLOYEE_ROLE = keccak256("EMPLOYEE_ROLE");

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct Product {
        string name;
        uint256 price;
        uint256 stock;
        uint256 categoryId;
        string metadataURI;
        bool active;
    }

    struct Variant {
        string name;
        uint256 price;
        uint256 stock;
        bool active;
    }

    struct Category {
        string name;
        string metadataURI;
        bool active;
    }

    struct Collection {
        string name;
        uint256[] productIds;
        string metadataURI;
        bool active;
    }

    struct OrderItem {
        uint256 productId;
        uint256 variantId; // 0 = no variant
        uint256 quantity;
    }

    enum OrderStatus {
        Created,
        Paid,
        Fulfilled,
        Completed,
        Cancelled,
        Refunded
    }

    struct Order {
        address customer;
        uint256 totalAmount;
        uint256 protocolFeeAmount;
        uint256 escrowAmount;
        OrderStatus status;
        uint256 createdAt;
        bytes32 shippingHash;
    }

    struct Discount {
        bytes32 code;
        uint256 basisPoints;
        uint256 maxUses;
        uint256 usedCount;
        uint256 expiresAt;
        bool active;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    ICommerceHub public hub;
    string public name;
    string public metadataURI;
    address public paymentSplitAddress;

    uint256 public nextProductId;
    uint256 public nextCategoryId;
    uint256 public nextCollectionId;
    uint256 public nextOrderId;
    uint256 public nextDiscountId;

    mapping(uint256 => Product) public products;
    mapping(uint256 => mapping(uint256 => Variant)) public variants; // productId => variantId => Variant
    mapping(uint256 => uint256) public nextVariantId; // productId => next variant id
    mapping(uint256 => Category) public categories;
    mapping(uint256 => Collection) private _collections;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => OrderItem[]) private _orderItems;
    mapping(uint256 => Discount) public discounts;
    mapping(bytes32 => uint256) public discountCodeToId;

    // Track customer orders for review verification
    mapping(uint256 => address) public orderCustomer;

    // ERC-8004 Reputation
    ReputationRegistry public reputationRegistry;
    uint256 public agentId;

    // Escrow
    uint256 public escrowTimeout; // seconds; default set in initialize
    uint256 public constant MIN_ESCROW_TIMEOUT = 1 days;

    // Digital delivery
    mapping(uint256 => bytes) private _deliveries;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ProductCreated(uint256 indexed productId, string name, uint256 price, uint256 stock, uint256 categoryId);
    event ProductUpdated(uint256 indexed productId, uint256 price, uint256 stock, string metadataURI);
    event ProductDeactivated(uint256 indexed productId);
    event CategoryCreated(uint256 indexed categoryId, string name);
    event CategoryUpdated(uint256 indexed categoryId, string name, string metadataURI);
    event CollectionCreated(uint256 indexed collectionId, string name, uint256[] productIds);
    event VariantAdded(uint256 indexed productId, uint256 indexed variantId, string name, uint256 price, uint256 stock);
    event EmployeeAdded(address indexed employee, bytes32 role);
    event EmployeeRemoved(address indexed employee, bytes32 role);
    event OrderCreated(uint256 indexed orderId, address indexed customer, uint256 totalAmount);
    event OrderPaid(uint256 indexed orderId, uint256 totalAmount, uint256 protocolFee);
    event OrderFulfilled(uint256 indexed orderId);
    event OrderCancelled(uint256 indexed orderId);
    event OrderRefunded(uint256 indexed orderId);
    event ShippingUpdated(uint256 indexed orderId, bytes32 shippingHash);
    event FeedbackLeft(uint256 indexed orderId, address indexed customer, uint256 indexed agentId, int128 value);
    event DigitalDelivery(uint256 indexed orderId, bytes payload);
    event DiscountCreated(uint256 indexed discountId, bytes32 code, uint256 basisPoints, uint256 maxUses, uint256 expiresAt);
    event DiscountUsed(uint256 indexed discountId, uint256 indexed orderId);
    event PaymentSplitUpdated(address indexed splitAddress);
    event ShopMetadataUpdated(string metadataURI);
    event EscrowReleased(uint256 indexed orderId, uint256 shopRevenue, uint256 protocolFee);
    event RefundClaimed(uint256 indexed orderId, address indexed customer, uint256 amount);
    event EscrowTimeoutUpdated(uint256 newTimeout);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidProduct();
    error InvalidVariant();
    error InsufficientStock();
    error InsufficientPayment();
    error InvalidOrderStatus();
    error NotOrderCustomer();
    error OrderNotFulfilled();
    error InvalidDiscount();
    error DiscountExpired();
    error DiscountMaxUsed();
    error TransferFailed();
    error ZeroAddress();
    error EscrowNotExpired();
    error InvalidTimeout();

    // ──────────────────────────────────────────────
    //  Initializer
    // ──────────────────────────────────────────────

    /// @notice Initialize the shop clone
    /// @param owner Shop owner address
    /// @param _name Shop name
    /// @param _metadataURI Shop metadata URI
    /// @param _hub CommerceHub address
    function initialize(address owner, string calldata _name, string calldata _metadataURI, address _hub) external initializer {
        __AccessControl_init();
        __Pausable_init();
        _reentrancyStatus = _NOT_ENTERED;

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(OWNER_ROLE, owner);
        _grantRole(MANAGER_ROLE, owner);
        _shopOwner = owner;

        name = _name;
        metadataURI = _metadataURI;
        hub = ICommerceHub(_hub);

        nextProductId = 1;
        nextCategoryId = 1;
        nextCollectionId = 1;
        nextOrderId = 1;
        nextDiscountId = 1;
        escrowTimeout = 7 days;
    }

    /// @notice Set ERC-8004 integration (called by hub after agent registration)
    function setERC8004(address _reputationRegistry, uint256 _agentId) external {
        require(msg.sender == address(hub), "Only hub");
        require(address(reputationRegistry) == address(0), "Already set");
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        agentId = _agentId;
    }

    // ──────────────────────────────────────────────
    //  Categories
    // ──────────────────────────────────────────────

    /// @notice Create a new category
    function createCategory(string calldata _name, string calldata _metadataURI) external onlyRole(MANAGER_ROLE) returns (uint256 categoryId) {
        categoryId = nextCategoryId++;
        categories[categoryId] = Category({name: _name, metadataURI: _metadataURI, active: true});
        emit CategoryCreated(categoryId, _name);
    }

    /// @notice Update an existing category
    function updateCategory(uint256 categoryId, string calldata _name, string calldata _metadataURI) external onlyRole(MANAGER_ROLE) {
        Category storage cat = categories[categoryId];
        cat.name = _name;
        cat.metadataURI = _metadataURI;
        emit CategoryUpdated(categoryId, _name, _metadataURI);
    }

    // ──────────────────────────────────────────────
    //  Products
    // ──────────────────────────────────────────────

    /// @notice Create a new product
    function createProduct(
        string calldata _name,
        uint256 _price,
        uint256 _stock,
        uint256 _categoryId,
        string calldata _metadataURI
    ) external onlyRole(MANAGER_ROLE) whenNotPaused returns (uint256 productId) {
        productId = nextProductId++;
        products[productId] = Product({
            name: _name,
            price: _price,
            stock: _stock,
            categoryId: _categoryId,
            metadataURI: _metadataURI,
            active: true
        });
        nextVariantId[productId] = 1;
        emit ProductCreated(productId, _name, _price, _stock, _categoryId);
    }

    /// @notice Update a product's price, stock, and metadata
    function updateProduct(uint256 productId, uint256 _price, uint256 _stock, string calldata _metadataURI) external onlyRole(MANAGER_ROLE) {
        Product storage p = products[productId];
        if (!p.active) revert InvalidProduct();
        p.price = _price;
        p.stock = _stock;
        p.metadataURI = _metadataURI;
        emit ProductUpdated(productId, _price, _stock, _metadataURI);
    }

    /// @notice Deactivate a product
    function deactivateProduct(uint256 productId) external onlyRole(MANAGER_ROLE) {
        products[productId].active = false;
        emit ProductDeactivated(productId);
    }

    /// @notice Restock a product
    function restockProduct(uint256 productId, uint256 additionalStock) external onlyRole(MANAGER_ROLE) {
        products[productId].stock += additionalStock;
    }

    // ──────────────────────────────────────────────
    //  Variants
    // ──────────────────────────────────────────────

    /// @notice Add a variant to a product
    function addVariant(uint256 productId, string calldata _name, uint256 _price, uint256 _stock)
        external
        onlyRole(MANAGER_ROLE)
        returns (uint256 variantId)
    {
        if (!products[productId].active) revert InvalidProduct();
        variantId = nextVariantId[productId]++;
        variants[productId][variantId] = Variant({name: _name, price: _price, stock: _stock, active: true});
        emit VariantAdded(productId, variantId, _name, _price, _stock);
    }

    // ──────────────────────────────────────────────
    //  Collections
    // ──────────────────────────────────────────────

    /// @notice Create a curated collection of products
    function createCollection(string calldata _name, uint256[] calldata _productIds, string calldata _metadataURI)
        external
        onlyRole(MANAGER_ROLE)
        returns (uint256 collectionId)
    {
        collectionId = nextCollectionId++;
        _collections[collectionId] = Collection({name: _name, productIds: _productIds, metadataURI: _metadataURI, active: true});
        emit CollectionCreated(collectionId, _name, _productIds);
    }

    /// @notice Get collection details
    function getCollection(uint256 collectionId) external view returns (Collection memory) {
        return _collections[collectionId];
    }

    // ──────────────────────────────────────────────
    //  Orders
    // ──────────────────────────────────────────────

    /// @notice Place an order and pay with ETH
    function createOrder(OrderItem[] calldata items) external payable whenNotPaused nonReentrant returns (uint256 orderId) {
        return _createOrder(items, bytes32(0));
    }

    /// @notice Place an order with a discount code
    function createOrderWithDiscount(OrderItem[] calldata items, bytes32 discountCode) external payable whenNotPaused nonReentrant returns (uint256 orderId) {
        return _createOrder(items, discountCode);
    }

    function _createOrder(OrderItem[] calldata items, bytes32 discountCode) internal returns (uint256 orderId) {
        uint256 total = 0;

        // Calculate total and validate/decrement stock
        for (uint256 i = 0; i < items.length; i++) {
            OrderItem calldata item = items[i];
            Product storage p = products[item.productId];
            if (!p.active) revert InvalidProduct();

            uint256 itemPrice;
            if (item.variantId > 0) {
                Variant storage v = variants[item.productId][item.variantId];
                if (!v.active) revert InvalidVariant();
                if (v.stock < item.quantity) revert InsufficientStock();
                v.stock -= item.quantity;
                itemPrice = v.price;
            } else {
                if (p.stock < item.quantity) revert InsufficientStock();
                p.stock -= item.quantity;
                itemPrice = p.price;
            }

            total += itemPrice * item.quantity;
        }

        // Apply discount
        uint256 discountId = 0;
        if (discountCode != bytes32(0)) {
            discountId = discountCodeToId[discountCode];
            if (discountId == 0) revert InvalidDiscount();
            Discount storage d = discounts[discountId];
            if (!d.active) revert InvalidDiscount();
            if (block.timestamp > d.expiresAt) revert DiscountExpired();
            if (d.usedCount >= d.maxUses) revert DiscountMaxUsed();
            d.usedCount++;
            total = total - (total * d.basisPoints / 10000);
        }

        if (msg.value < total) revert InsufficientPayment();

        // Calculate protocol fee
        uint256 pFee = total * hub.protocolFee() / 10000;
        uint256 shopRevenue = total - pFee;

        orderId = nextOrderId++;
        orders[orderId] = Order({
            customer: msg.sender,
            totalAmount: total,
            protocolFeeAmount: pFee,
            escrowAmount: total,
            status: OrderStatus.Paid,
            createdAt: block.timestamp,
            shippingHash: bytes32(0)
        });

        // Store order items
        for (uint256 i = 0; i < items.length; i++) {
            _orderItems[orderId].push(items[i]);
        }

        orderCustomer[orderId] = msg.sender;

        // Hold funds in contract (escrow). Refund excess only.
        if (msg.value > total) {
            (bool sent,) = msg.sender.call{value: msg.value - total}("");
            if (!sent) revert TransferFailed();
        }

        emit OrderCreated(orderId, msg.sender, total);
        emit OrderPaid(orderId, total, pFee);

        if (discountId > 0) {
            emit DiscountUsed(discountId, orderId);
        }
    }

    /// @notice Mark an order as fulfilled and release escrowed funds
    function fulfillOrder(uint256 orderId) external nonReentrant {
        if (!hasRole(MANAGER_ROLE, msg.sender) && !hasRole(EMPLOYEE_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, EMPLOYEE_ROLE);
        }
        Order storage o = orders[orderId];
        if (o.status != OrderStatus.Paid) revert InvalidOrderStatus();
        o.status = OrderStatus.Fulfilled;

        _releaseEscrow(orderId, o);

        emit OrderFulfilled(orderId);
    }

    /// @notice Customer cancels an order (only if not yet fulfilled)
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        if (o.customer != msg.sender) revert NotOrderCustomer();
        if (o.status != OrderStatus.Paid) revert InvalidOrderStatus();

        o.status = OrderStatus.Cancelled;
        uint256 refund = o.escrowAmount;
        o.escrowAmount = 0;

        // Full refund from escrow (including protocol fee since nothing was sent)
        (bool sent,) = msg.sender.call{value: refund}("");
        if (!sent) revert TransferFailed();

        emit OrderCancelled(orderId);
    }

    /// @notice Shop initiates a refund
    function refundOrder(uint256 orderId) external onlyRole(MANAGER_ROLE) nonReentrant {
        Order storage o = orders[orderId];
        if (o.status != OrderStatus.Paid && o.status != OrderStatus.Fulfilled) revert InvalidOrderStatus();

        o.status = OrderStatus.Refunded;
        uint256 refund = o.escrowAmount;
        o.escrowAmount = 0;

        // Full refund from escrow
        if (refund > 0) {
            (bool sent,) = o.customer.call{value: refund}("");
            if (!sent) revert TransferFailed();
        }

        emit OrderRefunded(orderId);
    }

    /// @notice Update shipping info for an order
    function updateShipping(uint256 orderId, bytes32 _shippingHash) external {
        if (!hasRole(MANAGER_ROLE, msg.sender) && !hasRole(EMPLOYEE_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, EMPLOYEE_ROLE);
        }
        orders[orderId].shippingHash = _shippingHash;
        emit ShippingUpdated(orderId, _shippingHash);
    }

    /// @notice Get order items
    function getOrderItems(uint256 orderId) external view returns (OrderItem[] memory) {
        return _orderItems[orderId];
    }

    // ──────────────────────────────────────────────
    //  Feedback (ERC-8004 Reputation)
    // ──────────────────────────────────────────────

    /// @notice Leave feedback for a fulfilled order via the ERC-8004 Reputation Registry
    function leaveFeedback(
        uint256 orderId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata feedbackURI
    ) external {
        if (orderCustomer[orderId] != msg.sender) revert NotOrderCustomer();
        Order storage o = orders[orderId];
        if (o.status != OrderStatus.Fulfilled && o.status != OrderStatus.Completed) revert OrderNotFulfilled();

        reputationRegistry.giveFeedback(agentId, value, valueDecimals, tag1, "", "", feedbackURI, bytes32(0));
        emit FeedbackLeft(orderId, msg.sender, agentId, value);
    }

    // ──────────────────────────────────────────────
    //  Digital Delivery
    // ──────────────────────────────────────────────

    /// @notice Deliver digital goods for an order (manager/employee only)
    function deliverDigital(uint256 orderId, bytes calldata payload) external nonReentrant {
        if (!hasRole(MANAGER_ROLE, msg.sender) && !hasRole(EMPLOYEE_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, EMPLOYEE_ROLE);
        }
        Order storage o = orders[orderId];
        if (o.status != OrderStatus.Paid && o.status != OrderStatus.Fulfilled) revert InvalidOrderStatus();

        // Release escrow if still held (status was Paid)
        if (o.escrowAmount > 0) {
            _releaseEscrow(orderId, o);
        }

        _deliveries[orderId] = payload;
        o.status = OrderStatus.Completed;
        emit DigitalDelivery(orderId, payload);
    }

    /// @notice Get the digital delivery payload for an order
    function getDelivery(uint256 orderId) external view returns (bytes memory) {
        return _deliveries[orderId];
    }

    // ──────────────────────────────────────────────
    //  Discounts
    // ──────────────────────────────────────────────

    /// @notice Create a discount code
    function createDiscount(bytes32 code, uint256 basisPoints, uint256 maxUses, uint256 expiresAt)
        external
        onlyRole(MANAGER_ROLE)
        returns (uint256 discountId)
    {
        if (basisPoints == 0 || basisPoints > 10000) revert InvalidDiscount();
        discountId = nextDiscountId++;
        discounts[discountId] = Discount({
            code: code,
            basisPoints: basisPoints,
            maxUses: maxUses,
            usedCount: 0,
            expiresAt: expiresAt,
            active: true
        });
        discountCodeToId[code] = discountId;
        emit DiscountCreated(discountId, code, basisPoints, maxUses, expiresAt);
    }

    // ──────────────────────────────────────────────
    //  Employee Management
    // ──────────────────────────────────────────────

    /// @notice Add an employee with a specific role
    function addEmployee(address employee, bytes32 role) external onlyRole(OWNER_ROLE) {
        if (employee == address(0)) revert ZeroAddress();
        _grantRole(role, employee);
        emit EmployeeAdded(employee, role);
    }

    /// @notice Remove an employee's role
    function removeEmployee(address employee, bytes32 role) external onlyRole(OWNER_ROLE) {
        _revokeRole(role, employee);
        emit EmployeeRemoved(employee, role);
    }

    // ──────────────────────────────────────────────
    //  Shop Config
    // ──────────────────────────────────────────────

    /// @notice Set the payment split address (0xSplits or similar)
    function setPaymentSplit(address splitAddress) external onlyRole(OWNER_ROLE) {
        paymentSplitAddress = splitAddress;
        emit PaymentSplitUpdated(splitAddress);
    }

    /// @notice Update shop metadata
    function setMetadataURI(string calldata _metadataURI) external onlyRole(OWNER_ROLE) {
        metadataURI = _metadataURI;
        emit ShopMetadataUpdated(_metadataURI);
    }

    /// @notice Pause the shop
    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    /// @notice Unpause the shop
    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    // ──────────────────────────────────────────────
    //  Escrow
    // ──────────────────────────────────────────────

    /// @notice Set escrow timeout (minimum 1 day)
    function setEscrowTimeout(uint256 _timeout) external onlyRole(OWNER_ROLE) {
        if (_timeout < MIN_ESCROW_TIMEOUT) revert InvalidTimeout();
        escrowTimeout = _timeout;
        emit EscrowTimeoutUpdated(_timeout);
    }

    /// @notice Customer claims refund after escrow timeout
    function claimRefund(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        if (o.customer != msg.sender) revert NotOrderCustomer();
        if (o.status != OrderStatus.Paid) revert InvalidOrderStatus();
        if (block.timestamp < o.createdAt + escrowTimeout) revert EscrowNotExpired();

        o.status = OrderStatus.Refunded;
        uint256 refund = o.escrowAmount;
        o.escrowAmount = 0;

        (bool sent,) = msg.sender.call{value: refund}("");
        if (!sent) revert TransferFailed();

        emit RefundClaimed(orderId, msg.sender, refund);
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    /// @notice Release escrowed funds to protocol fee recipient and shop owner
    function _releaseEscrow(uint256 orderId, Order storage o) internal {
        uint256 escrowed = o.escrowAmount;
        if (escrowed == 0) return;
        o.escrowAmount = 0;

        uint256 pFee = o.protocolFeeAmount;
        uint256 shopRevenue = escrowed - pFee;

        if (pFee > 0) {
            (bool sent,) = hub.protocolFeeRecipient().call{value: pFee}("");
            if (!sent) revert TransferFailed();
        }

        address recipient = paymentSplitAddress != address(0) ? paymentSplitAddress : _getOwner();
        if (shopRevenue > 0) {
            (bool sent,) = recipient.call{value: shopRevenue}("");
            if (!sent) revert TransferFailed();
        }

        emit EscrowReleased(orderId, shopRevenue, pFee);
    }

    address private _shopOwner;

    function _getOwner() internal view returns (address) {
        return _shopOwner;
    }

    /// @notice Allow the contract to receive ETH (for refunds)
    receive() external payable {}
}
