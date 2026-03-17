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

test("registry includes the current skill carrier surface", () => {
  const expectedKeys = [
    "skill.define",
    "skill.discover",
    "skill.list",
    "skill.create",
    "skill.bind",
    "skill.read",
    "skill.update",
    "skill.activate",
    "skill.use",
    "skill.load",
    "skill.remove"
  ] as const;

  for (const key of expectedKeys) {
    assert.ok(getCapabilityDefinition(key), `Expected registry to include ${key}.`);
  }
});

test("registry marks Google ADK managed skill lifecycle as unsupported", () => {
  const expectedUnsupportedKeys = [
    "skill.list",
    "skill.create",
    "skill.read",
    "skill.update",
    "skill.remove"
  ] as const;

  for (const key of expectedUnsupportedKeys) {
    const definition = getCapabilityDefinition(key);
    assert.ok(definition, `Expected registry to include ${key}.`);
    assert.equal(definition.providerSupport.deepmind.status, "unsupported");
  }
});

test("registry truthfulness maps helper lifecycle names back onto the same unsupported Google managed directions", () => {
  const lifecycleDirectionMap = {
    get: "skill.read",
    publish: "skill.create",
    remove: "skill.remove",
    listVersions: "skill.list",
    getVersion: "skill.read",
    publishVersion: "skill.create",
    removeVersion: "skill.remove",
    setDefaultVersion: "skill.update"
  } as const;

  for (const key of Object.values(lifecycleDirectionMap)) {
    const definition = getCapabilityDefinition(key);
    assert.ok(definition, `Expected registry to include ${key}.`);
    assert.equal(
      definition.providerSupport.deepmind.status,
      "unsupported",
      `Expected Google ADK managed lifecycle ${key} to stay unsupported.`
    );
  }
});

test("registry notes keep OpenAI hosted shell wording attached to bind and activate", () => {
  const bindDefinition = getCapabilityDefinition("skill.bind");
  const activateDefinition = getCapabilityDefinition("skill.activate");

  assert.ok(bindDefinition);
  assert.ok(activateDefinition);
  assert.match(
    bindDefinition.providerSupport.openai.notes ?? "",
    /inline skill bundles|hosted shell skill_reference/i
  );
  assert.match(
    activateDefinition.providerSupport.openai.notes ?? "",
    /inline skill bundles|hosted shell settings/i
  );
});

test("registry notes keep Anthropic upload beta wording attached to skill.create", () => {
  const createDefinition = getCapabilityDefinition("skill.create");

  assert.ok(createDefinition);
  assert.match(
    createDefinition.providerSupport.anthropic.notes ?? "",
    /files-api betas/i
  );
});
