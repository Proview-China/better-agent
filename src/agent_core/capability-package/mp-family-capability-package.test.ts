import assert from "node:assert/strict";
import test from "node:test";

import {
  createRaxMpCapabilityPackage,
  createRaxMpCapabilityPackageCatalog,
  MP_FAMILY_CAPABILITY_KEYS,
  RAX_MP_ACTIVATION_FACTORY_REFS,
} from "./index.js";

test("mp family capability package catalog exposes the frozen capability key set", () => {
  assert.deepEqual(MP_FAMILY_CAPABILITY_KEYS, [
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

  const catalog = createRaxMpCapabilityPackageCatalog();
  assert.equal(catalog.length, 12);
  assert.deepEqual(catalog.map((item) => item.manifest.capabilityKey), [...MP_FAMILY_CAPABILITY_KEYS]);
});

test("mp family capability package keeps runtime and activation refs aligned", () => {
  const capabilityPackage = createRaxMpCapabilityPackage({
    capabilityKey: "mp.search",
  });

  assert.equal(capabilityPackage.adapter.runtimeKind, "rax-mp");
  assert.equal(capabilityPackage.adapter.adapterId, "rax.mp.adapter");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    RAX_MP_ACTIVATION_FACTORY_REFS["mp.search"],
  );
  assert.equal(
    capabilityPackage.manifest.routeHints.some((hint) => hint.key === "capability_family" && hint.value === "mp"),
    true,
  );
});
