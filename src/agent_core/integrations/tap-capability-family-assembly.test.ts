import assert from "node:assert/strict";
import test from "node:test";

import { registerTapCapabilityFamilyAssembly } from "./tap-capability-family-assembly.js";

test("registerTapCapabilityFamilyAssembly wires foundation, search, skill, MCP, MP, and userio families together", () => {
  const registeredCapabilityKeys: string[] = [];
  const activationFactories = new Set<string>();

  const result = registerTapCapabilityFamilyAssembly({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        registeredCapabilityKeys.push(manifest.capabilityKey);
        return {
          bindingId: `binding:${manifest.capabilityKey}`,
          adapterId: adapter.id,
        };
      },
      registerTaActivationFactory(ref) {
        activationFactories.add(ref);
      },
    },
    foundation: {
      workspaceRoot: "/tmp/praxis",
    },
  });

  assert.deepEqual(result.familyKeys.foundation, [
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
  assert.deepEqual(result.familyKeys.websearch, [
    "search.web",
    "search.fetch",
    "search.ground",
  ]);
  assert.deepEqual(result.familyKeys.skill, [
    "skill.use",
    "skill.mount",
    "skill.prepare",
  ]);
  assert.deepEqual(result.familyKeys.mcp, [
    "mcp.listTools",
    "mcp.listResources",
    "mcp.readResource",
    "mcp.call",
    "mcp.native.execute",
  ]);
  assert.deepEqual(result.familyKeys.mp, [
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
  assert.deepEqual(result.familyKeys.userio, [
    "request_user_input",
    "request_permissions",
  ]);
  assert.equal(result.packages.length, 51);
  assert.equal(result.bindings.length, 51);
  assert.equal(result.activationFactoryRefs.length, activationFactories.size);
  assert.equal(result.registrationAudit.length, 51);
  assert.equal(result.activationFactoryAudit.length, activationFactories.size);
  assert.equal(registeredCapabilityKeys.includes("search.web"), true);
  assert.equal(registeredCapabilityKeys.includes("search.fetch"), true);
  assert.equal(registeredCapabilityKeys.includes("search.ground"), true);
  assert.equal(registeredCapabilityKeys.includes("skill.use"), true);
  assert.equal(registeredCapabilityKeys.includes("mcp.native.execute"), true);
  assert.equal(registeredCapabilityKeys.includes("mp.search"), true);
  assert.equal(registeredCapabilityKeys.includes("request_user_input"), true);

  const codeReadAudit = result.registrationAudit.find(
    (entry) => entry.capabilityKey === "code.read",
  );
  assert.ok(codeReadAudit);
  assert.equal(codeReadAudit.familyKey, "foundation");
  assert.equal(codeReadAudit.bindingId, "binding:code.read");
  assert.equal(codeReadAudit.supportsPrepare, true);
  assert.equal(codeReadAudit.hasHealthCheck, false);

  const searchAudit = result.registrationAudit.find(
    (entry) => entry.capabilityKey === "search.ground",
  );
  assert.ok(searchAudit);
  assert.equal(searchAudit.familyKey, "websearch");
  assert.equal(searchAudit.hasHealthCheck, true);

  const searchFetchAudit = result.registrationAudit.find(
    (entry) => entry.capabilityKey === "search.fetch",
  );
  assert.ok(searchFetchAudit);
  assert.equal(searchFetchAudit.familyKey, "websearch");
  assert.equal(searchFetchAudit.hasHealthCheck, true);

  const nativeExecuteFactory = result.activationFactoryAudit.find(
    (entry) => entry.capabilityKey === "mcp.native.execute",
  );
  assert.ok(nativeExecuteFactory);
  assert.equal(nativeExecuteFactory.familyKey, "mcp");

  const mpSearchFactory = result.activationFactoryAudit.find(
    (entry) => entry.capabilityKey === "mp.search",
  );
  assert.ok(mpSearchFactory);
  assert.equal(mpSearchFactory.familyKey, "mp");
  const requestPermissionsAudit = result.registrationAudit.find(
    (entry) => entry.capabilityKey === "request_permissions",
  );
  assert.ok(requestPermissionsAudit);
  assert.equal(requestPermissionsAudit.familyKey, "userio");
  assert.equal(requestPermissionsAudit.hasHealthCheck, true);
});
