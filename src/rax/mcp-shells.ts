import type { McpProviderShell } from "./mcp-types.js";

import { ANTHROPIC_MCP_PROVIDER_SHELL } from "../integrations/anthropic/api/mcp.js";
import { ANTHROPIC_AGENT_MCP_PROVIDER_SHELL } from "../integrations/anthropic/agent/mcp.js";
import { DEEPMIND_API_MCP_PROVIDER_SHELL } from "../integrations/deepmind/api/mcp.js";
import { DEEPMIND_MCP_PROVIDER_SHELL } from "../integrations/deepmind/agent/mcp.js";
import { OPENAI_API_MCP_PROVIDER_SHELL } from "../integrations/openai/api/mcp.js";
import { OPENAI_MCP_PROVIDER_SHELL } from "../integrations/openai/agent/mcp.js";

export const MCP_PROVIDER_SHELLS: readonly McpProviderShell[] = [
  OPENAI_API_MCP_PROVIDER_SHELL,
  OPENAI_MCP_PROVIDER_SHELL,
  ANTHROPIC_MCP_PROVIDER_SHELL,
  ANTHROPIC_AGENT_MCP_PROVIDER_SHELL,
  DEEPMIND_API_MCP_PROVIDER_SHELL,
  DEEPMIND_MCP_PROVIDER_SHELL
];
