const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.3";

// ─── Types ───

export interface SubgraphShop {
  id: string;
  address: string;
  owner: string;
  name: string;
  metadataURI: string;
  paymentSplitAddress: string;
  agentId: string;
  createdAt: string;
  products: SubgraphProduct[];
  categories: SubgraphCategory[];
  collections: SubgraphCollection[];
  orders: SubgraphOrder[];
  reviews: SubgraphReview[];
  employees: SubgraphEmployee[];
  discounts: SubgraphDiscount[];
}

export interface SubgraphProduct {
  id: string;
  productId: string;
  name: string;
  price: string;
  stock: string;
  metadataURI: string;
  active: boolean;
  createdAt: string;
  category: { id: string; categoryId: string; name: string } | null;
  variants: SubgraphVariant[];
  shop: { id: string; address: string };
}

export interface SubgraphVariant {
  id: string;
  variantId: string;
  name: string;
  price: string;
  stock: string;
  active: boolean;
}

export interface SubgraphCategory {
  id: string;
  categoryId: string;
  name: string;
  metadataURI: string;
  active: boolean;
}

export interface SubgraphCollection {
  id: string;
  collectionId: string;
  name: string;
  productIds: string[];
  metadataURI: string;
  active: boolean;
}

export interface SubgraphOrder {
  id: string;
  orderId: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  customer: { id: string; address: string };
  shop: { id: string; address: string; name: string };
  items: SubgraphOrderItem[];
}

export interface SubgraphOrderItem {
  id: string;
  product: { id: string; productId: string; name: string };
  variant: { id: string; variantId: string; name: string } | null;
  quantity: string;
}

export interface SubgraphReview {
  id: string;
  reviewId: string;
  rating: number;
  metadataURI: string;
  createdAt: string;
  customer: { id: string; address: string };
  order: { id: string; orderId: string };
  shop: { id: string; address: string };
}

export interface SubgraphFeedback {
  id: string;
  clientAddress: string;
  feedbackIndex: string;
  value: string;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
  createdAt: string;
  agent: { id: string; agentId: string };
}

export interface SubgraphAgent {
  id: string;
  agentId: string;
  owner: string;
  agentURI: string;
  createdAt: string;
  feedbackReceived: SubgraphFeedback[];
}

export interface SubgraphEmployee {
  id: string;
  address: string;
  role: string;
  active: boolean;
}

export interface SubgraphDiscount {
  id: string;
  discountId: string;
  code: string;
  basisPoints: string;
  maxUses: string;
  usedCount: string;
  expiresAt: string;
  active: boolean;
}

// ─── Fetcher ───

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ─── Query Functions ───

export async function fetchShops(): Promise<SubgraphShop[]> {
  const data = await query<{ shops: SubgraphShop[] }>(`{
    shops(first: 100, orderBy: createdAt, orderDirection: desc) {
      id address owner name metadataURI paymentSplitAddress agentId createdAt
      products { id }
      reviews(first: 3, orderBy: createdAt, orderDirection: desc) { id rating customer createdAt }
      categories { id }
      collections { id }
      orders { id }
      employees { id }
      discounts { id }
    }
  }`);
  return data.shops;
}

export async function fetchShop(address: string): Promise<SubgraphShop | null> {
  const addr = address.toLowerCase();
  const data = await query<{ shops: SubgraphShop[] }>(`
    query Shop($addr: Bytes!) {
      shops(where: { address: $addr }) {
        id address owner name metadataURI paymentSplitAddress agentId createdAt
        products(orderBy: productId, orderDirection: asc) {
          id productId name price stock metadataURI active createdAt
          category { id categoryId name }
          variants(orderBy: variantId) { id variantId name price stock active }
        }
        categories(orderBy: categoryId) { id categoryId name metadataURI active }
        collections(orderBy: collectionId) { id collectionId name productIds metadataURI active }
        reviews(orderBy: createdAt, orderDirection: desc) {
          id reviewId rating metadataURI createdAt
          customer { id address }
          order { id orderId }
        }
        orders(orderBy: orderId, orderDirection: desc) {
          id orderId totalAmount status createdAt
          customer { id address }
          items { id product { id productId name } variant { id variantId name } quantity }
        }
        employees { id address role active }
        discounts(orderBy: discountId) { id discountId code basisPoints maxUses usedCount expiresAt active }
      }
    }
  `, { addr });
  return data.shops[0] ?? null;
}

export async function fetchProducts(shopAddress: string): Promise<SubgraphProduct[]> {
  const addr = shopAddress.toLowerCase();
  const data = await query<{ products: SubgraphProduct[] }>(`
    query Products($addr: Bytes!) {
      products(where: { shop_: { address: $addr } }, orderBy: productId, first: 1000) {
        id productId name price stock metadataURI active createdAt
        category { id categoryId name }
        variants(orderBy: variantId) { id variantId name price stock active }
        shop { id address }
      }
    }
  `, { addr });
  return data.products;
}

export async function fetchOrders(customerAddress?: string): Promise<SubgraphOrder[]> {
  if (customerAddress) {
    const addr = customerAddress.toLowerCase();
    const data = await query<{ orders: SubgraphOrder[] }>(`
      query Orders($addr: Bytes!) {
        orders(where: { customer_: { address: $addr } }, orderBy: createdAt, orderDirection: desc, first: 100) {
          id orderId totalAmount status createdAt
          customer { id address }
          shop { id address name }
          items { id product { id productId name } variant { id variantId name } quantity }
        }
      }
    `, { addr });
    return data.orders;
  }
  const data = await query<{ orders: SubgraphOrder[] }>(`{
    orders(orderBy: createdAt, orderDirection: desc, first: 100) {
      id orderId totalAmount status createdAt
      customer { id address }
      shop { id address name }
      items { id product { id productId name } variant { id variantId name } quantity }
    }
  }`);
  return data.orders;
}

export async function fetchShopOrders(shopAddress: string): Promise<SubgraphOrder[]> {
  const addr = shopAddress.toLowerCase();
  const data = await query<{ orders: SubgraphOrder[] }>(`
    query ShopOrders($addr: Bytes!) {
      orders(where: { shop_: { address: $addr } }, orderBy: createdAt, orderDirection: desc, first: 100) {
        id orderId totalAmount status createdAt
        customer { id address }
        shop { id address name }
        items { id product { id productId name } variant { id variantId name } quantity }
      }
    }
  `, { addr });
  return data.orders;
}

export async function fetchFeedbacks(agentId: string): Promise<SubgraphFeedback[]> {
  const data = await query<{ feedbacks: SubgraphFeedback[] }>(`
    query Feedbacks($agentId: BigInt!) {
      feedbacks(where: { agent_: { agentId: $agentId } }, orderBy: createdAt, orderDirection: desc, first: 100) {
        id clientAddress feedbackIndex value valueDecimals tag1 tag2 isRevoked createdAt
        agent { id agentId }
      }
    }
  `, { agentId });
  return data.feedbacks;
}

export async function fetchAgent(agentId: string): Promise<SubgraphAgent | null> {
  const data = await query<{ agents: SubgraphAgent[] }>(`
    query Agent($agentId: BigInt!) {
      agents(where: { agentId: $agentId }) {
        id agentId owner agentURI createdAt
        feedbackReceived(orderBy: createdAt, orderDirection: desc, first: 50) {
          id clientAddress feedbackIndex value valueDecimals tag1 tag2 isRevoked createdAt
          agent { id agentId }
        }
      }
    }
  `, { agentId });
  return data.agents[0] ?? null;
}

export async function fetchReviews(shopAddress: string): Promise<SubgraphReview[]> {
  const addr = shopAddress.toLowerCase();
  const data = await query<{ reviews: SubgraphReview[] }>(`
    query Reviews($addr: Bytes!) {
      reviews(where: { shop_: { address: $addr } }, orderBy: createdAt, orderDirection: desc, first: 100) {
        id reviewId rating metadataURI createdAt
        customer { id address }
        order { id orderId }
        shop { id address }
      }
    }
  `, { addr });
  return data.reviews;
}
