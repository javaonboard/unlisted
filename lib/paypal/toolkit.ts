import { PayPalAgentToolkit } from "@paypal/agent-toolkit/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mcpTools } from "@anthropic-ai/sdk/helpers/beta/mcp";
import { paypalAccessToken } from "./client";

// The only PayPal tools the agent gets. Nothing here moves money.
const ALLOWED = {
  orders: { get: true },
  payments: { getRefunds: true },
  disputes: { list: true, get: true },
};

// Starts PayPal's toolkit in-process and connects an MCP client to it.
// Created per request so the access token is always fresh. Callers can narrow the actions further.
export async function connectPayPalTools(actions: Record<string, Record<string, boolean>> = ALLOWED) {
  const server = new PayPalAgentToolkit({
    accessToken: await paypalAccessToken(),
    configuration: { actions, context: { sandbox: true } },
  });

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "unlisted", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), mcp.connect(clientSide)]);

  const { tools } = await mcp.listTools();
  // The MCP client's types are wider than the helper expects; the shape matches at runtime.
  const claudeTools = mcpTools(tools, mcp as Parameters<typeof mcpTools>[1]);
  return { tools: claudeTools, names: tools.map((t) => t.name), close: () => mcp.close() };
}
