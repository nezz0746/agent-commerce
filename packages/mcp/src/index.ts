import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerERC8004Tools } from "./tools/erc8004.js";
import { registerEscrowTools } from "./tools/escrow.js";

const server = new McpServer({
  name: "onchain-commerce",
  version: "0.1.0",
});

// Register all tools
registerReadTools(server);
registerWriteTools(server);
registerAdminTools(server);
registerERC8004Tools(server);
registerEscrowTools(server);

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
