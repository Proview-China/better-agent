import assert from "node:assert/strict";
import test from "node:test";

import {
  renderCoreOverlayIndexBodyV1,
  renderCoreOverlayIndexV1,
} from "./overlays.js";

test("renderCoreOverlayIndexBodyV1 keeps group order and entry order across capability skill and memory indexes", () => {
  const rendered = renderCoreOverlayIndexBodyV1({
    schemaVersion: "core-overlay-index/v1",
    capabilityFamilies: [
      {
        id: "cap-1",
        label: "Capability one",
        summary: "First capability summary",
      },
      {
        id: "cap-2",
        label: "Capability two",
        summary: "Second capability summary",
      },
    ],
    skills: [
      {
        id: "skill:playwright",
        label: "playwright",
        summary: "Browser automation skill",
      },
      {
        id: "skill:docx",
        label: "docx",
        summary: "Document editing skill",
      },
    ],
    memories: [
      {
        id: "memory:praxis-git-workflow",
        label: "Praxis git workflow",
        summary: "Git guardrails for this repo",
      },
    ],
  });

  assert.match(
    rendered,
    /capability_families:[\s\S]*- id: cap-1[\s\S]*- id: cap-2[\s\S]*skills:[\s\S]*- id: skill:playwright[\s\S]*- id: skill:docx[\s\S]*memories:[\s\S]*- id: memory:praxis-git-workflow/u,
  );
});

test("renderCoreOverlayIndexBodyV1 omits body_ref lines when body refs are absent", () => {
  const rendered = renderCoreOverlayIndexBodyV1({
    schemaVersion: "core-overlay-index/v1",
    skills: [
      {
        id: "skill:playwright",
        label: "playwright",
        summary: "Browser automation skill",
      },
    ],
    memories: [
      {
        id: "memory:cmp-g",
        label: "Task Pack G memory",
        summary: "Overlay index handoff note",
      },
    ],
  });

  assert.match(rendered, /skills:/u);
  assert.match(rendered, /memories:/u);
  assert.doesNotMatch(rendered, /body_ref:/u);
});

test("renderCoreOverlayIndexV1 renders mixed overlay groups inside one stable envelope", () => {
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
    skills: [
      {
        id: "skill:playwright",
        label: "playwright",
        summary: "Browser automation skill",
        bodyRef: "skill-body:playwright",
      },
    ],
    memories: [
      {
        id: "memory:praxis-git-workflow",
        label: "Praxis git workflow",
        summary: "Git guardrails for this repo",
        bodyRef: "memory-body:praxis-git-workflow",
      },
    ],
  });

  assert.match(rendered, /^<core_overlay_index>/u);
  assert.match(rendered, /body_ref: tap-capability-usage-index/u);
  assert.match(rendered, /body_ref: skill-body:playwright/u);
  assert.match(rendered, /body_ref: memory-body:praxis-git-workflow/u);
  assert.match(rendered, /<\/core_overlay_index>$/u);
});
