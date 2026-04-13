import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLiveChatPromptBlocks,
  buildLiveChatPromptMessages,
  renderLiveChatPromptAssembly,
} from "./live-chat-assembly.js";

test("renderLiveChatPromptAssembly renders system development and contextual sections", () => {
  const prompt = renderLiveChatPromptAssembly({
    developmentInput: {
      tapMode: "bapr",
      automationDepth: "prefer_auto",
      uiMode: "direct",
    },
    contextualInput: {
      currentObjective: "继续推进 core prompt engineering",
      recentTranscript: "user: ...\nassistant: ...",
      cmpContextPackage: {
        schemaVersion: "core-cmp-context-package/v1",
        deliveryStatus: "available",
        identity: {
          packageId: "cmp-1",
          packageRef: "cmp-package:1",
        },
      },
      overlayIndex: {
        schemaVersion: "core-overlay-index/v1",
        capabilityFamilies: [
          {
            id: "tap-capability-usage-index",
            label: "TAP capability usage index",
            summary: "search.ground => latest/current web facts",
          },
        ],
      },
      mpRoutedPackage: {
        schemaVersion: "core-mp-routed-package/v1",
        deliveryStatus: "available",
        packageId: "mp-resolve:1",
        sourceClass: "mp_resolve_bundle",
        summary: "MP routed primary and supporting memories for this task.",
      },
    },
    modeInstructions: ["Execution mode is active."],
    contractInstructions: ["Return strict JSON only."],
  });

  assert.match(prompt, /^<core_system>/);
  assert.match(prompt, /<core_development>/);
  assert.match(prompt, /<core_overlay_index>/);
  assert.match(prompt, /<core_contextual_user>/);
  assert.match(prompt, /<mp_routed_package>/);
  assert.match(prompt, /<core_mode_instructions>/);
  assert.match(prompt, /<core_contract_instructions>/);
  assert.match(prompt, /You are Praxis Core\./);
  assert.match(prompt, /You are currently operating inside the Praxis runtime discipline layer\./);
  assert.match(prompt, /继续推进 core prompt engineering/);
});

test("buildLiveChatPromptMessages emits layered system developer user messages", () => {
  const messages = buildLiveChatPromptMessages({
    developmentInput: {
      tapMode: "bapr",
      automationDepth: "prefer_auto",
    },
    contextualInput: {
      currentObjective: "推进 action planner 分层消息",
      recentTranscript: "user: ...",
      mpRoutedPackage: {
        schemaVersion: "core-mp-routed-package/v1",
        deliveryStatus: "available",
        packageId: "mp-resolve:1",
        sourceClass: "mp_resolve_bundle",
        summary: "MP routed primary and supporting memories for this task.",
      },
      overlayIndex: {
        schemaVersion: "core-overlay-index/v1",
        capabilityFamilies: [
          {
            id: "tap-capability-usage-index",
            label: "TAP capability usage index",
            summary: "search.ground => latest/current web facts",
          },
        ],
      },
    },
    modeInstructions: ["Execution mode is active."],
    contractInstructions: ["Return strict JSON only."],
  });

  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "developer");
  assert.equal(messages[2]?.role, "user");
  assert.match(messages[1]?.content ?? "", /Execution mode is active\./);
  assert.match(messages[2]?.content ?? "", /<core_overlay_index>/);
  assert.match(messages[2]?.content ?? "", /推进 action planner 分层消息/);
});

test("buildLiveChatPromptBlocks emits stable semantic sections", () => {
  const blocks = buildLiveChatPromptBlocks({
    developmentInput: {
      tapMode: "bapr",
      automationDepth: "prefer_auto",
    },
    contextualInput: {
      currentObjective: "继续推进 promptBlocks",
      recentTranscript: "user: ...",
      cmpContextPackage: {
        schemaVersion: "core-cmp-context-package/v1",
        deliveryStatus: "available",
        identity: {
          packageId: "cmp-1",
          packageRef: "cmp-package:1",
        },
      },
      overlayIndex: {
        schemaVersion: "core-overlay-index/v1",
        capabilityFamilies: [
          {
            id: "tap-capability-usage-index",
            label: "TAP capability usage index",
            summary: "search.ground => latest/current web facts",
          },
        ],
      },
    },
    modeInstructions: ["Execution mode is active."],
    contractInstructions: ["Return strict JSON only."],
  });

  assert.deepEqual(
    blocks.map((block) => block.key),
    [
      "core_system",
      "core_development",
      "core_overlay_index",
      "core_contextual_user",
      "core_mode_instructions",
      "core_contract_instructions",
    ],
  );
});
