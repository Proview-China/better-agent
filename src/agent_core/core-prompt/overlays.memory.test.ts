import assert from "node:assert/strict";
import test from "node:test";

import { createLiveChatOverlayIndex } from "./live-chat-overlays.js";
import { renderCoreOverlayIndexBodyV1 } from "./overlays.js";

test("memory producer emits stable seed entries before optional worklog expansion", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续当前 repo 的交接、history 回顾和 worklog 对齐",
    includeSkillIndex: false,
  });

  assert.equal(overlay?.memories?.[0]?.id, "memory:current-context");
  assert.ok(
    (overlay?.memories?.some((entry) => entry.id.startsWith("memory:decisions/"))) ?? false,
  );
  assert.ok(
    (overlay?.memories?.some((entry) => entry.id.startsWith("memory:worklog/"))) ?? false,
  );
  assert.ok(
    (overlay?.memories?.every((entry) => entry.bodyRef?.startsWith("memory-body:"))) ?? false,
  );
});

test("memory-only overlay render keeps memory section stable without capability or skill groups", () => {
  const overlay = createLiveChatOverlayIndex({
    userMessage: "继续当前实现，不需要交接",
    includeSkillIndex: false,
  });

  assert.equal(overlay?.capabilityFamilies, undefined);
  assert.equal(overlay?.skills, undefined);

  const rendered = renderCoreOverlayIndexBodyV1(overlay!);

  assert.match(rendered, /^schema_version: core-overlay-index\/v1/iu);
  assert.match(
    rendered,
    /memories:[\s\S]*- id: memory:current-context[\s\S]*- id: memory:decisions\//iu,
  );
  assert.doesNotMatch(rendered, /capability_families:/iu);
  assert.doesNotMatch(rendered, /skills:/iu);
  assert.match(rendered, /body_ref: memory-body:current-context\.md/iu);
  assert.match(rendered, /body_ref: memory-body:decisions\//iu);
});
