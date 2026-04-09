import assert from "node:assert/strict";
import test from "node:test";

import {
  createTapFormalFamilyInventory,
  getTapFormalFamilyInventoryFamily,
  listTapFormalFamilyInventoryEntries,
} from "./formal-family-inventory.js";

test("createTapFormalFamilyInventory freezes the six formal TAP families and capability keys", () => {
  const inventory = createTapFormalFamilyInventory();

  assert.deepEqual(inventory.familyKeys, [
    "foundation",
    "websearch",
    "skill",
    "mcp",
    "mp",
    "userio",
  ]);
  assert.equal(inventory.entries.length, 51);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("foundation")?.capabilityKeys, [
    "code.read",
    "code.ls",
    "code.glob",
    "code.grep",
    "code.read_many",
    "code.symbol_search",
    "code.lsp",
    "spreadsheet.read",
    "read_pdf",
    "read_notebook",
    "view_image",
    "docs.read",
    "repo.write",
    "code.edit",
    "code.patch",
    "shell.restricted",
    "shell.session",
    "test.run",
    "git.status",
    "git.diff",
    "git.commit",
    "git.push",
    "code.diff",
    "browser.playwright",
    "skill.doc.generate",
    "write_todos",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("websearch")?.capabilityKeys, [
    "search.web",
    "search.fetch",
    "search.ground",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("skill")?.capabilityKeys, [
    "skill.use",
    "skill.mount",
    "skill.prepare",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("mcp")?.capabilityKeys, [
    "mcp.listTools",
    "mcp.listResources",
    "mcp.readResource",
    "mcp.call",
    "mcp.native.execute",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("mp")?.capabilityKeys, [
    "mp.ingest",
    "mp.align",
    "mp.resolve",
    "mp.history.request",
    "mp.search",
    "mp.materialize",
    "mp.promote",
    "mp.archive",
    "mp.split",
    "mp.merge",
    "mp.reindex",
    "mp.compact",
  ]);
  assert.deepEqual(getTapFormalFamilyInventoryFamily("userio")?.capabilityKeys, [
    "request_user_input",
    "request_permissions",
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
    "integrations/tap-vendor-network-adapter#registerTapVendorNetworkCapabilityFamily",
  );
  assert.equal(
    searchGround?.assemblyRef,
    "integrations/tap-capability-family-assembly#registerTapCapabilityFamilyAssembly",
  );
  assert.deepEqual(searchGround?.activationFactoryRefs, [
    "factory:tap.vendor-network:search.ground",
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
  const mcpCall = entries.find((entry) => entry.capabilityKey === "mcp.call");
  const skillUse = entries.find((entry) => entry.capabilityKey === "skill.use");
  const requestUserInput = entries.find((entry) => entry.capabilityKey === "request_user_input");
  assert.ok(mcpCall);
  assert.ok(skillUse);
  assert.ok(requestUserInput);
  assert.equal(
    skillUse?.registerHelperRef,
    "integrations/rax-skill-adapter#registerRaxSkillCapabilityFamily",
  );
  assert.equal(
    skillUse?.packageSourceRef,
    "capability-package/skill-family-capability-package#createRaxSkillCapabilityPackageCatalog",
  );
  assert.equal(
    mcpCall?.registerHelperRef,
    "integrations/rax-mcp-adapter#registerRaxMcpCapabilities",
  );
  assert.equal(
    mcpCall?.packageSourceRef,
    "capability-package/capability-package#createMcpCapabilityPackage",
  );
  assert.equal(
    requestUserInput?.registerHelperRef,
    "integrations/tap-vendor-user-io-adapter#registerTapVendorUserIoFamily",
  );
  assert.equal(
    requestUserInput?.packageSourceRef,
    "capability-package/vendor-user-io-capability-package#createTapVendorUserIoCapabilityPackageCatalog",
  );
});
