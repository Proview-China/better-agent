import assert from "node:assert/strict";
import test from "node:test";

import {
  createTapFormalFamilyInventory,
  getTapFormalFamilyInventoryFamily,
  listTapFormalFamilyInventoryEntries,
} from "./formal-family-inventory.js";

test("createTapFormalFamilyInventory freezes the five formal TAP families and capability keys", () => {
  const inventory = createTapFormalFamilyInventory();

  assert.deepEqual(inventory.familyKeys, [
    "foundation",
    "websearch",
    "skill",
    "mcp",
    "mp",
  ]);
  assert.equal(inventory.entries.length, 22);
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
  assert.deepEqual(getTapFormalFamilyInventoryFamily("mp")?.capabilityKeys, [
    "mp.search",
    "mp.materialize",
    "mp.promote",
    "mp.archive",
    "mp.split",
    "mp.merge",
    "mp.reindex",
    "mp.compact",
  ]);
});

test("inventory entries keep package source refs, register helpers, and activation factories attached", () => {
  const entries = listTapFormalFamilyInventoryEntries();
  const repoWrite = entries.find((entry) => entry.capabilityKey === "repo.write");
  const searchGround = entries.find((entry) => entry.capabilityKey === "search.ground");
  const mpSearch = entries.find((entry) => entry.capabilityKey === "mp.search");

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

  assert.ok(mpSearch);
  assert.equal(
    mpSearch?.registerHelperRef,
    "integrations/rax-mp-adapter#registerRaxMpCapabilityFamily",
  );
  assert.equal(
    mpSearch?.packageSourceRef,
    "capability-package/mp-family-capability-package#createRaxMpCapabilityPackageCatalog",
  );
  assert.deepEqual(mpSearch?.activationFactoryRefs, [
    "factory:rax.mp:search",
  ]);
});
