import assert from "node:assert/strict";
import test from "node:test";

import {
  createCodeGlobCapabilityPackage,
  createCodeGrepCapabilityPackage,
  createCodeLsCapabilityPackage,
  createCodeReadManyCapabilityPackage,
  createCodeReadCapabilityPackage,
  createDocsReadCapabilityPackage,
  FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS,
  FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS,
  getFirstClassToolingCapabilityBaselineDescriptor,
  listFirstClassToolingBaselineCapabilityPackages,
  listFirstClassToolingCapabilityBaselineDescriptors,
} from "./index.js";
import { FIRST_CLASS_TOOLING_BASELINE_CONSUMERS } from "../ta-pool-model/index.js";

test("first-class tooling baseline exposes the frozen A-group capability keys", () => {
  assert.deepEqual(FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS, [
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
  assert.deepEqual(FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS, [
    "read_file",
    "read_lines",
    "list_dir",
    "stat_path",
    "glob",
    "grep",
    "read_many",
    "workspace_symbol",
    "document_symbol",
    "definition",
    "references",
    "hover",
    "read_spreadsheet",
    "read_document",
    "read_pdf",
    "read_notebook",
    "view_image",
  ]);
});

test("code.read package satisfies the formal capability package template", () => {
  const capabilityPackage = createCodeReadCapabilityPackage();

  assert.equal(capabilityPackage.manifest.capabilityKey, "code.read");
  assert.equal(capabilityPackage.policy.riskLevel, "normal");
  assert.deepEqual(
    capabilityPackage.policy.defaultBaseline.scope?.allowedOperations,
    [...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS],
  );
  const bindingPayload = capabilityPackage.activationSpec?.bindingPayload as
    | {
        allowedPathPatterns?: string[];
      }
    | undefined;
  assert.equal(bindingPayload?.allowedPathPatterns?.[0], "src");
  assert.equal(capabilityPackage.builder.replayCapability, "none");
});

test("docs.read package carries docs-oriented scope and activation metadata", () => {
  const capabilityPackage = createDocsReadCapabilityPackage();

  assert.equal(capabilityPackage.manifest.capabilityKey, "docs.read");
  assert.equal(capabilityPackage.adapter.runtimeKind, "workspace-read");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:docs.read",
  );
  assert.ok(
    capabilityPackage.policy.defaultBaseline.scope?.pathPatterns?.includes(
      "docs/**",
    ),
  );
  assert.equal(
    capabilityPackage.usage.exampleInvocations[0]?.input.path,
    "docs/ability/25-tap-capability-package-template.md",
  );
  assert.equal(
    capabilityPackage.manifest.metadata?.scopeKind,
    "workspace-docs",
  );
  assert.equal(capabilityPackage.adapter.metadata?.readOnly, true);
});

test("first-class tooling baseline package listing stays stable and complete", () => {
  const packages = listFirstClassToolingBaselineCapabilityPackages();
  assert.equal(packages.length, 13);
  assert.deepEqual(
    packages.map((entry) => entry.manifest.capabilityKey),
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );
});

test("first-class tooling capability descriptors expose reviewer-readable scope metadata", () => {
  const descriptors = listFirstClassToolingCapabilityBaselineDescriptors();
  assert.deepEqual(
    descriptors.map((entry) => entry.capabilityKey),
    ["code.read", "code.ls", "code.glob", "code.grep", "code.read_many", "code.symbol_search", "code.lsp", "spreadsheet.read", "doc.read", "read_pdf", "read_notebook", "view_image", "docs.read"],
  );

  const codeRead =
    getFirstClassToolingCapabilityBaselineDescriptor("code.read");
  assert.equal(codeRead.scopeKind, "workspace-code");
  assert.match(codeRead.reviewerSummary, /cannot patch files/i);
  assert.deepEqual(codeRead.allowedOperations, [
    ...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS,
  ]);
});

test("new first-class code discovery packages expose the expected operation families", () => {
  assert.deepEqual(
    createCodeLsCapabilityPackage().adapter.supports,
    ["list_dir", "stat_path"],
  );
  assert.deepEqual(
    createCodeGlobCapabilityPackage().adapter.supports,
    ["glob"],
  );
  assert.deepEqual(
    createCodeGrepCapabilityPackage().adapter.supports,
    ["grep"],
  );
  assert.deepEqual(
    createCodeReadManyCapabilityPackage().adapter.supports,
    ["read_many"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("code.symbol_search").allowedOperations,
    ["workspace_symbol"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("code.lsp").allowedOperations,
    ["workspace_symbol", "document_symbol", "definition", "references", "hover"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("spreadsheet.read").allowedOperations,
    ["read_spreadsheet"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("doc.read").allowedOperations,
    ["read_document"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("read_pdf").allowedOperations,
    ["read_pdf"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("read_notebook").allowedOperations,
    ["read_notebook"],
  );
  assert.deepEqual(
    getFirstClassToolingCapabilityBaselineDescriptor("view_image").allowedOperations,
    ["view_image"],
  );
});

test("capability package worker consumers stay aligned with ta-pool baseline consumer names", () => {
  const docsRead = createDocsReadCapabilityPackage();
  assert.deepEqual(docsRead.manifest.metadata?.workerConsumers, [
    ...FIRST_CLASS_TOOLING_BASELINE_CONSUMERS,
  ]);
});
