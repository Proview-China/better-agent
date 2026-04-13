import assert from "node:assert/strict";
import test from "node:test";

import {
  renderCoreOverlayIndexBodyV1,
  renderCoreOverlayIndexV1,
} from "./overlays.js";

test("renderCoreOverlayIndexV1 renders stable overlay index envelope", () => {
  const rendered = renderCoreOverlayIndexV1({
    schemaVersion: "core-overlay-index/v1",
    capabilityFamilies: [
      {
        id: "tap-capability-usage-index",
        label: "TAP capability usage index",
        summary: "search.ground => latest/current web facts",
        bodyRef: "tap-capability-usage-index",
      },
    ],
  });

  assert.match(rendered, /^<core_overlay_index>/);
  assert.match(rendered, /schema_version: core-overlay-index\/v1/);
  assert.match(rendered, /capability_families:/);
  assert.match(rendered, /body_ref: tap-capability-usage-index/);
  assert.match(rendered, /<\/core_overlay_index>$/);
});

test("renderCoreOverlayIndexBodyV1 omits empty groups", () => {
  const rendered = renderCoreOverlayIndexBodyV1({
    schemaVersion: "core-overlay-index/v1",
    memories: [
      {
        id: "memory-1",
        label: "Recent repo memory",
        summary: "Praxis prompt engineering direction",
      },
    ],
  });

  assert.match(rendered, /schema_version: core-overlay-index\/v1/);
  assert.match(rendered, /memories:/);
  assert.doesNotMatch(rendered, /capability_families:/);
  assert.doesNotMatch(rendered, /skills:/);
});
