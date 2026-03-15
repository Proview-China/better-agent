import type { McpProviderShell } from "../../../rax/mcp-types.js";

export const ANTHROPIC_MCP_PROVIDER_SHELL: McpProviderShell = {
  id: "anthropic-mcp-api-shell",
  provider: "anthropic",
  defaultLayer: "api",
  supportedTransports: ["stdio", "streamable-http", "in-memory"],
  supportsServe: false,
  supportsResources: true,
  supportsPrompts: true,
  notes: [
    "Anthropic first-phase MCP is modeled as an API-first connector shell.",
    "Messages API MCP connector is the closest official entrypoint, while shared runtime currently exposes tools/resources/prompts.",
    "For practical local MCP interoperability, the shared runtime also accepts stdio transports under the Anthropic route."
  ]
};
