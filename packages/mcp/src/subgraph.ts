import { getConfig } from "./types.js";

async function query(q: string, variables?: Record<string, unknown>) {
  const { subgraphUrl } = getConfig();
  const res = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, variables }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(", "));
  return json.data as Record<string, unknown>;
}

export async function listShops() {
  return query(`{
    shops(first: 100) {
      id address owner name metadataURI createdAt
      products { id }
      orders { id }
    }
  }`);
}

export async function getShop(address: string) {
  const id = address.toLowerCase();
  return query(
    `query($id: ID!) {
      shop(id: $id) {
        id address owner name metadataURI createdAt paymentSplitAddress
        products(first: 100) {
          id productId name price stock category { id name } metadataURI active
          variants { id variantId name price stock active }
        }
        categories(first: 100) { id categoryId name metadataURI active }
        collections(first: 100) { id collectionId name productIds metadataURI active }
        orders(first: 100, orderBy: createdAt, orderDirection: desc) {
          id orderId customer { address } totalAmount status createdAt
          items { product { productId name } variant { variantId name } quantity }
        }
        reviews(first: 100) { id reviewId rating metadataURI createdAt customer { address } order { orderId } }
        discounts(first: 100) { id discountId code basisPoints maxUses usedCount expiresAt active }
      }
    }`,
    { id }
  );
}

export async function getProduct(shopAddress: string, productId: string) {
  const id = `${shopAddress.toLowerCase()}-${productId}`;
  return query(
    `query($id: ID!) {
      product(id: $id) {
        id productId name price stock category { id name } metadataURI active createdAt
        shop { address name }
        variants { id variantId name price stock active }
      }
    }`,
    { id }
  );
}

export async function getOrders(customerAddress: string) {
  const id = customerAddress.toLowerCase();
  return query(
    `query($id: ID!) {
      customer(id: $id) {
        address
        orders(first: 100, orderBy: createdAt, orderDirection: desc) {
          id orderId shop { address name } totalAmount status createdAt
          items { product { productId name } variant { variantId name } quantity }
        }
        reviews { id reviewId rating shop { address name } order { orderId } }
      }
    }`,
    { id }
  );
}

export async function searchProducts(searchName: string) {
  // The Graph supports name_contains_nocase for text search
  return query(
    `query($name: String!) {
      products(first: 50, where: { name_contains_nocase: $name, active: true }) {
        id productId name price stock metadataURI active
        shop { address name }
        category { name }
        variants { variantId name price stock active }
      }
    }`,
    { name: searchName }
  );
}

export async function getProductPrices(
  shopAddress: string,
  items: { productId: string; variantId: string }[]
) {
  // Fetch product and variant prices for order total calculation
  const productIds = [...new Set(items.map((i) => `${shopAddress.toLowerCase()}-${i.productId}`))];
  const data = await query(
    `query($ids: [ID!]!) {
      products(where: { id_in: $ids }) {
        id productId price
        variants { variantId price }
      }
    }`,
    { ids: productIds }
  );
  return data.products as Array<{
    productId: string;
    price: string;
    variants: Array<{ variantId: string; price: string }>;
  }>;
}
