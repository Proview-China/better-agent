import assert from "node:assert/strict";
import test from "node:test";

import {
  createTapFormalFamilyInventory,
  getTapFormalFamilyInventoryFamily,
  listTapFormalFamilyInventoryEntries,
} from "./formal-family-inventory.js";

test("createTapFormalFamilyInventory freezes the four formal TAP families and capability keys", () => {
  const inventory = createTapFormalFamilyInventory();

  assert.deepEqual(inventory.familyKeys, [
    "foundation",
    "websearch",
    "skill",
    "mcp",
  ]);
  assert.equal(inventory.entries.length, 14);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("websearch")?.capabilityKeys, ["search.ground"]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("skill")?.capabilityKeys, [
    "skill.use",
    "skill.mount",
    "skill.prepare",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("mcp")?.capabilityKeys, [
    "mcp.listTools",
    "mcp.readResource",
    "mcp.call",
    "mcp.native.execute",
  ]);
});

test("inventory entries keep package source refs, register helpers, and activation factories attached", () => {
  const entries = listTapFormalFamilyInventoryEntries();
  const repoWrite = entries.find((entry) => entry.capabilityKey === "repo.write");
  const searchGround = entries.find((entry) => entry.capabilityKey === "search.ground");

  assert.ok(repoWrite);
  assert.equal(
    repoWrite?.registerHelperRef,
    "integrations/tap-tooling-adapter#registerTapToolingBaseline",
  );
  assert.equal(
    repoWrite?.packageSourceRef,
    "capability-package/tap-tooling-baseline#createTapToolingBaselineCapabilityPackages",
  );
  assert.equal(repoWrite?.activationFactoryRefs[0]?.startsWith("factory:tap-tooling:"), true);

  assert.ok(searchGround);
  assert.equal(
    searchGround?.registerHelperRef,
    "integrations/rax-websearch-adapter#registerRaxWebsearchCapability",
  );
  assert.equal(
    searchGround?.assemblyRef,
    "integrations/tap-capability-family-assembly#registerTapCapabilityFamilyAssembly",
  );
  assert.deepEqual(searchGround?.activationFactoryRefs, [
    "factory:search.ground.rax-websearch",
  ]);
});
