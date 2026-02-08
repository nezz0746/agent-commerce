"use client";


export interface CartItem {
  shopAddress: `0x${string}`;
  shopName: string;
  productId: bigint;
  variantId: bigint; // 0 = no variant
  name: string;
  variantName?: string;
  price: bigint;
  quantity: number;
}

// Simple localStorage-backed cart
const CART_KEY = "onchain-commerce-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw, (key, value) => {
      if (
        typeof value === "string" &&
        key &&
        ["productId", "variantId", "price"].includes(key)
      ) {
        return BigInt(value);
      }
      return value;
    });
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const existing = cart.find(
    (i) =>
      i.shopAddress === item.shopAddress &&
      i.productId === item.productId &&
      i.variantId === item.variantId
  );
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  window.dispatchEvent(new Event("cart-updated"));
}

export function removeFromCart(
  shopAddress: string,
  productId: bigint,
  variantId: bigint
) {
  let cart = getCart();
  cart = cart.filter(
    (i) =>
      !(
        i.shopAddress === shopAddress &&
        i.productId === productId &&
        i.variantId === variantId
      )
  );
  saveCart(cart);
  window.dispatchEvent(new Event("cart-updated"));
}

export function updateQuantity(
  shopAddress: string,
  productId: bigint,
  variantId: bigint,
  quantity: number
) {
  const cart = getCart();
  const item = cart.find(
    (i) =>
      i.shopAddress === shopAddress &&
      i.productId === productId &&
      i.variantId === variantId
  );
  if (item) {
    if (quantity <= 0) {
      return removeFromCart(shopAddress, productId, variantId);
    }
    item.quantity = quantity;
    saveCart(cart);
    window.dispatchEvent(new Event("cart-updated"));
  }
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event("cart-updated"));
}
