import assert from "node:assert/strict";
import test from "node:test";

import {
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
    "docs.read",
  ]);
  assert.deepEqual(FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS, [
    "read_file",
    "read_lines",
    "list_dir",
    "stat_path",
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
  assert.equal(packages.length, 2);
  assert.deepEqual(
    packages.map((entry) => entry.manifest.capabilityKey),
    ["code.read", "docs.read"],
  );
});

test("first-class tooling capability descriptors expose reviewer-readable scope metadata", () => {
  const descriptors = listFirstClassToolingCapabilityBaselineDescriptors();
  assert.deepEqual(
    descriptors.map((entry) => entry.capabilityKey),
    ["code.read", "docs.read"],
  );

  const codeRead =
    getFirstClassToolingCapabilityBaselineDescriptor("code.read");
  assert.equal(codeRead.scopeKind, "workspace-code");
  assert.match(codeRead.reviewerSummary, /cannot patch files/i);
  assert.deepEqual(codeRead.allowedOperations, [
    ...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS,
  ]);
});

test("capability package worker consumers stay aligned with ta-pool baseline consumer names", () => {
  const docsRead = createDocsReadCapabilityPackage();
  assert.deepEqual(docsRead.manifest.metadata?.workerConsumers, [
    ...FIRST_CLASS_TOOLING_BASELINE_CONSUMERS,
  ]);
});
