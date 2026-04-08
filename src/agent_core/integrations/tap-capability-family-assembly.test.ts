import assert from "node:assert/strict";
import test from "node:test";

import { registerTapCapabilityFamilyAssembly } from "./tap-capability-family-assembly.js";

test("registerTapCapabilityFamilyAssembly wires foundation, search, skill, MCP, and MP families together", () => {
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
    "docs.read",
    "repo.write",
    "shell.restricted",
    "test.run",
    "skill.doc.generate",
  ]);
  assert.deepEqual(result.familyKeys.websearch, ["search.ground"]);
  assert.deepEqual(result.familyKeys.skill, [
    "skill.use",
    "skill.mount",
    "skill.prepare",
  ]);
  assert.deepEqual(result.familyKeys.mcp, [
    "mcp.listTools",
    "mcp.readResource",
    "mcp.call",
    "mcp.native.execute",
  ]);
  assert.deepEqual(result.familyKeys.mp, [
    "mp.search",
    "mp.materialize",
    "mp.promote",
    "mp.archive",
    "mp.split",
    "mp.merge",
    "mp.reindex",
    "mp.compact",
  ]);
  assert.equal(result.packages.length, 22);
  assert.equal(result.bindings.length, 22);
  assert.equal(result.activationFactoryRefs.length, activationFactories.size);
  assert.equal(result.registrationAudit.length, 22);
  assert.equal(result.activationFactoryAudit.length, activationFactories.size);
  assert.equal(registeredCapabilityKeys.includes("search.ground"), true);
  assert.equal(registeredCapabilityKeys.includes("skill.use"), true);
  assert.equal(registeredCapabilityKeys.includes("mcp.native.execute"), true);
  assert.equal(registeredCapabilityKeys.includes("mp.search"), true);

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
});
