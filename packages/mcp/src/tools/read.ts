import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as subgraph from "../subgraph.js";

export function registerReadTools(server: McpServer) {
  server.tool(
    "list_shops",
    "List all shops on the Onchain Commerce protocol",
    {},
    async () => {
      const data = await subgraph.listShops();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_shop",
    "Get detailed shop info including products, categories, collections, orders, and reviews",
    { shopAddress: z.string().describe("Shop contract address") },
    async ({ shopAddress }) => {
      const data = await subgraph.getShop(shopAddress);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_product",
    "Get product details with variants",
    {
      shopAddress: z.string().describe("Shop contract address"),
      productId: z.string().describe("Product ID"),
    },
    async ({ shopAddress, productId }) => {
      const data = await subgraph.getProduct(shopAddress, productId);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_orders",
    "Get all orders for a customer address",
    { customerAddress: z.string().describe("Customer wallet address") },
    async ({ customerAddress }) => {
      const data = await subgraph.getOrders(customerAddress);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "search_products",
    "Search products by name across all shops",
    { query: z.string().describe("Search query for product name") },
    async ({ query }) => {
      const data = await subgraph.searchProducts(query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
