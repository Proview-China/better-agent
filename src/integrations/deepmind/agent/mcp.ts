import type { McpProviderShell } from "../../../rax/mcp-types.js";

export const DEEPMIND_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "deepmind-mcp-agent-shell",
  provider: "deepmind",
  defaultLayer: "agent",
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  supportsServe: false,
  supportsResources: true,
  supportsPrompts: true,
  notes: [
    "DeepMind MCP is modeled as an ADK/runtime concern in rax.",
    "First phase uses shared MCP runtime core and currently exposes tools/resources/prompts via the facade."
  ]
};
