import assert from "node:assert/strict";
import test from "node:test";

import { createAgentCapabilityProfile } from "../ta-pool-types/index.js";
import {
  createProfileWithFirstClassToolingBaseline,
  extendProfileWithFirstClassToolingBaseline,
  getFirstClassToolingBaselineDescriptor,
  getFirstClassToolingBaselineCapabilities,
  isFirstClassToolingBaselineCapability,
  listFirstClassToolingBaselineDescriptors,
} from "./index.js";

test("tooling baseline helper returns the same A-group read capabilities for reviewer and TMA lanes", () => {
  assert.deepEqual(getFirstClassToolingBaselineCapabilities("reviewer"), [
    "code.read",
    "code.ls",
    "code.glob",
    "code.grep",
    "code.read_many",
    "code.symbol_search",
    "code.lsp",
    "spreadsheet.read",
    "doc.read",
    "read_pdf",
    "read_notebook",
    "view_image",
    "docs.read",
  ]);
  assert.deepEqual(
    getFirstClassToolingBaselineCapabilities("bootstrap_tma").slice(0, 13),
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );
  assert.equal(
    getFirstClassToolingBaselineCapabilities("bootstrap_tma").includes(
      "repo.write",
    ),
    true,
  );
  assert.equal(
    getFirstClassToolingBaselineCapabilities("bootstrap_tma").includes(
      "skill.doc.generate",
    ),
    true,
  );
  assert.deepEqual(
    getFirstClassToolingBaselineCapabilities("extended_tma").slice(0, 13),
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );
  assert.equal(
    getFirstClassToolingBaselineCapabilities("extended_tma").includes(
      "dependency.install",
    ),
    true,
  );
  assert.equal(
    getFirstClassToolingBaselineCapabilities("extended_tma").includes(
      "network.download",
    ),
    true,
  );
});

test("tooling baseline helper can classify first-class read capabilities", () => {
  assert.equal(isFirstClassToolingBaselineCapability("code.read"), true);
  assert.equal(isFirstClassToolingBaselineCapability("docs.read"), true);
  assert.equal(isFirstClassToolingBaselineCapability("repo.write"), false);
});

test("tooling baseline descriptors explain reviewer vs TMA scope in plain terms", () => {
  const descriptors = listFirstClassToolingBaselineDescriptors();
  assert.deepEqual(
    descriptors.map((entry) => entry.consumer),
    ["reviewer", "bootstrap_tma", "extended_tma"],
  );

  const reviewer = getFirstClassToolingBaselineDescriptor("reviewer");
  assert.equal(reviewer.readOnly, true);
  assert.equal(reviewer.mayProvision, false);
  assert.deepEqual(reviewer.capabilityKeys, [
    "code.read",
    "code.ls",
    "code.glob",
    "code.grep",
    "code.read_many",
    "code.symbol_search",
    "code.lsp",
    "spreadsheet.read",
    "doc.read",
    "read_pdf",
    "read_notebook",
    "view_image",
    "docs.read",
  ]);

  const extended = getFirstClassToolingBaselineDescriptor("extended_tma");
  assert.equal(extended.mayPerformExternalSideEffects, true);
  assert.equal(extended.capabilityKeys.includes("dependency.install"), true);
  assert.match(extended.escalationBoundary, /cannot auto-approve activation/i);
});

test("tooling baseline helper can build and extend capability profiles without duplicate baselines", () => {
  const created = createProfileWithFirstClassToolingBaseline(
    {
      profileId: "profile.tooling.created",
      agentClass: "reviewer",
      baselineCapabilities: ["docs.read"],
      allowedCapabilityPatterns: ["search.*"],
    },
    "reviewer",
  );

  assert.deepEqual(created.baselineCapabilities, [
    "docs.read",
    "code.read",
    "code.ls",
    "code.glob",
    "code.grep",
    "code.read_many",
    "code.symbol_search",
    "code.lsp",
    "spreadsheet.read",
    "doc.read",
    "read_pdf",
    "read_notebook",
    "view_image",
  ]);
  assert.deepEqual(created.allowedCapabilityPatterns, ["search.*"]);

  const extended = extendProfileWithFirstClassToolingBaseline(
    createAgentCapabilityProfile({
      profileId: "profile.tooling.extended",
      agentClass: "tma",
      baselineCapabilities: ["code.read"],
      allowedCapabilityPatterns: ["test.*"],
    }),
    "bootstrap_tma",
  );

  assert.equal(extended.baselineCapabilities?.includes("code.read"), true);
  assert.equal(extended.baselineCapabilities?.includes("docs.read"), true);
  assert.equal(extended.baselineCapabilities?.includes("repo.write"), true);
  assert.equal(
    extended.baselineCapabilities?.includes("shell.restricted"),
    true,
  );
  assert.deepEqual(extended.allowedCapabilityPatterns, ["test.*"]);
});
