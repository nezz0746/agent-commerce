import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ProductCreated,
  ProductUpdated,
  ProductDeactivated,
  CategoryCreated,
  CategoryUpdated,
  CollectionCreated,
  VariantAdded,
  EmployeeAdded,
  EmployeeRemoved,
  OrderCreated,
  OrderFulfilled,
  OrderCancelled,
  OrderRefunded,
  FeedbackLeft,
  DigitalDelivery as DigitalDeliveryEvent,
  DiscountCreated,
  DiscountUsed,
  PaymentSplitUpdated,
} from "../../generated/templates/Shop/Shop";
import {
  Product,
  Category,
  Collection,
  Variant,
  Order,
  Customer,
  Employee,
  Discount,
  Shop,
  DigitalDelivery,
} from "../../generated/schema";

function shopId(event: ethereum.Event): string {
  return event.address.toHexString();
}

function entityId(shopAddr: string, type: string, id: BigInt): string {
  return shopAddr + "-" + type + "-" + id.toString();
}

export function handleProductCreated(event: ProductCreated): void {
  let sid = shopId(event);
  let id = entityId(sid, "product", event.params.productId);
  let product = new Product(id);
  product.productId = event.params.productId;
  product.shop = sid;
  product.name = event.params.name;
  product.price = event.params.price;
  product.stock = event.params.stock;
  product.category = entityId(sid, "category", event.params.categoryId);
  product.metadataURI = "";
  product.active = true;
  product.createdAt = event.block.timestamp;
  product.save();
}

export function handleProductUpdated(event: ProductUpdated): void {
  let id = entityId(shopId(event), "product", event.params.productId);
  let product = Product.load(id);
  if (product != null) {
    product.price = event.params.price;
    product.stock = event.params.stock;
    product.metadataURI = event.params.metadataURI;
    product.save();
  }
}

export function handleProductDeactivated(event: ProductDeactivated): void {
  let id = entityId(shopId(event), "product", event.params.productId);
  let product = Product.load(id);
  if (product != null) {
    product.active = false;
    product.save();
  }
}

export function handleCategoryCreated(event: CategoryCreated): void {
  let sid = shopId(event);
  let id = entityId(sid, "category", event.params.categoryId);
  let category = new Category(id);
  category.categoryId = event.params.categoryId;
  category.shop = sid;
  category.name = event.params.name;
  category.metadataURI = "";
  category.active = true;
  category.save();
}

export function handleCategoryUpdated(event: CategoryUpdated): void {
  let id = entityId(shopId(event), "category", event.params.categoryId);
  let category = Category.load(id);
  if (category != null) {
    category.name = event.params.name;
    category.metadataURI = event.params.metadataURI;
    category.save();
  }
}

export function handleCollectionCreated(event: CollectionCreated): void {
  let sid = shopId(event);
  let id = entityId(sid, "collection", event.params.collectionId);
  let collection = new Collection(id);
  collection.collectionId = event.params.collectionId;
  collection.shop = sid;
  collection.name = event.params.name;
  collection.productIds = event.params.productIds;
  collection.metadataURI = "";
  collection.active = true;
  collection.save();
}

export function handleVariantAdded(event: VariantAdded): void {
  let sid = shopId(event);
  let id = sid + "-variant-" + event.params.productId.toString() + "-" + event.params.variantId.toString();
  let variant = new Variant(id);
  variant.variantId = event.params.variantId;
  variant.product = entityId(sid, "product", event.params.productId);
  variant.name = event.params.name;
  variant.price = event.params.price;
  variant.stock = event.params.stock;
  variant.active = true;
  variant.save();
}

export function handleEmployeeAdded(event: EmployeeAdded): void {
  let sid = shopId(event);
  let id = sid + "-employee-" + event.params.employee.toHexString();
  let employee = new Employee(id);
  employee.address = event.params.employee;
  employee.shop = sid;
  employee.role = event.params.role;
  employee.active = true;
  employee.save();
}

export function handleEmployeeRemoved(event: EmployeeRemoved): void {
  let sid = shopId(event);
  let id = sid + "-employee-" + event.params.employee.toHexString();
  let employee = Employee.load(id);
  if (employee != null) {
    employee.active = false;
    employee.save();
  }
}

function getOrCreateCustomer(address: Bytes): Customer {
  let id = address.toHexString();
  let customer = Customer.load(id);
  if (customer == null) {
    customer = new Customer(id);
    customer.address = address;
    customer.save();
  }
  return customer;
}

export function handleOrderCreated(event: OrderCreated): void {
  let sid = shopId(event);
  let customer = getOrCreateCustomer(event.params.customer);

  let id = entityId(sid, "order", event.params.orderId);
  let order = new Order(id);
  order.orderId = event.params.orderId;
  order.shop = sid;
  order.customer = customer.id;
  order.totalAmount = event.params.totalAmount;
  order.status = "Paid";
  order.createdAt = event.block.timestamp;
  order.save();
}

export function handleOrderFulfilled(event: OrderFulfilled): void {
  let id = entityId(shopId(event), "order", event.params.orderId);
  let order = Order.load(id);
  if (order != null) {
    order.status = "Fulfilled";
    order.save();
  }
}

export function handleOrderCancelled(event: OrderCancelled): void {
  let id = entityId(shopId(event), "order", event.params.orderId);
  let order = Order.load(id);
  if (order != null) {
    order.status = "Cancelled";
    order.save();
  }
}

export function handleOrderRefunded(event: OrderRefunded): void {
  let id = entityId(shopId(event), "order", event.params.orderId);
  let order = Order.load(id);
  if (order != null) {
    order.status = "Refunded";
    order.save();
  }
}

export function handleFeedbackLeft(event: FeedbackLeft): void {
  // Feedback is tracked primarily in the ReputationRegistry data source
  // This handler is for linking feedback events to shop orders
}

export function handleDigitalDelivery(event: DigitalDeliveryEvent): void {
  let sid = shopId(event);
  let id = entityId(sid, "delivery", event.params.orderId);
  let delivery = new DigitalDelivery(id);
  delivery.order = entityId(sid, "order", event.params.orderId);
  delivery.shop = sid;
  delivery.createdAt = event.block.timestamp;
  delivery.save();

  // Update order status to Completed
  let order = Order.load(entityId(sid, "order", event.params.orderId));
  if (order != null) {
    order.status = "Completed";
    order.save();
  }
}

export function handleDiscountCreated(event: DiscountCreated): void {
  let sid = shopId(event);
  let id = entityId(sid, "discount", event.params.discountId);
  let discount = new Discount(id);
  discount.discountId = event.params.discountId;
  discount.shop = sid;
  discount.code = event.params.code;
  discount.basisPoints = event.params.basisPoints;
  discount.maxUses = event.params.maxUses;
  discount.usedCount = BigInt.fromI32(0);
  discount.expiresAt = event.params.expiresAt;
  discount.active = true;
  discount.save();
}

export function handleDiscountUsed(event: DiscountUsed): void {
  let sid = shopId(event);
  let id = entityId(sid, "discount", event.params.discountId);
  let discount = Discount.load(id);
  if (discount != null) {
    discount.usedCount = discount.usedCount.plus(BigInt.fromI32(1));
    discount.save();
  }
}

export function handlePaymentSplitUpdated(event: PaymentSplitUpdated): void {
  let shop = Shop.load(shopId(event));
  if (shop != null) {
    shop.paymentSplitAddress = event.params.splitAddress;
    shop.save();
  }
}
