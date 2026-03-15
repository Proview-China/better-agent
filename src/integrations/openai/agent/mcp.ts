import type { McpProviderShell } from "../../../rax/mcp-types.js";

export const OPENAI_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "openai-mcp-agent-shell",
  provider: "openai",
  defaultLayer: "agent",
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  supportsServe: false,
  supportsResources: true,
  supportsPrompts: true,
  notes: [
    "OpenAI MCP is modeled as an agent-runtime concern in rax.",
    "First phase uses shared MCP runtime core; provider shell only supplies route metadata."
  ]
};
