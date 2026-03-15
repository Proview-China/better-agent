import assert from "node:assert/strict";
import test from "node:test";

import { getCapabilityDefinition } from "./registry.js";

test("registry includes the currently implemented MCP surface beyond tools", () => {
  const expectedKeys = [
    "mcp.connect",
    "mcp.listConnections",
    "mcp.listTools",
    "mcp.listResources",
    "mcp.readResource",
    "mcp.listPrompts",
    "mcp.getPrompt",
    "mcp.call",
    "mcp.disconnect",
    "mcp.disconnectAll"
  ] as const;

  for (const key of expectedKeys) {
    assert.ok(getCapabilityDefinition(key), `Expected registry to include ${key}.`);
  }
});
