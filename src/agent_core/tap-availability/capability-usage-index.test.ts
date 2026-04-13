import assert from "node:assert/strict";
import test from "node:test";

import {
  createTapCapabilityUsageIndex,
  renderTapCapabilityUsageIndexForCore,
} from "./capability-usage-index.js";

test("createTapCapabilityUsageIndex keeps first hardened capabilities in declared order", () => {
  const index = createTapCapabilityUsageIndex({
    availableCapabilityKeys: [
      "code.edit",
      "test.run",
      "search.fetch",
      "docs.read",
    ],
    now: () => new Date("2026-04-11T00:00:00.000Z"),
  });

  assert.equal(index.generatedAt, "2026-04-11T00:00:00.000Z");
  assert.deepEqual(
    index.entries.map((entry) => entry.capabilityKey),
    ["docs.read", "code.edit", "test.run", "search.fetch"],
  );
  assert.match(index.entries[0]?.coreHint ?? "", /docs/u);
});

test("renderTapCapabilityUsageIndexForCore emits concise capability guidance", () => {
  const text = renderTapCapabilityUsageIndexForCore(
    createTapCapabilityUsageIndex({
      availableCapabilityKeys: ["code.edit", "search.fetch"],
    }),
  );

  assert.match(text, /code\.edit/u);
  assert.match(text, /search\.fetch/u);
  assert.match(text, /example:/u);
  assert.match(text, /input:/u);
  assert.match(text, /next:route_readback_by_path_kind/u);
  assert.match(text, /next:report_backend_and_page_facts/u);
  assert.match(text, /do:/u);
  assert.match(text, /avoid:/u);
});

test("createTapCapabilityUsageIndex can surface read, git, and mcp guidance together", () => {
  const index = createTapCapabilityUsageIndex({
    availableCapabilityKeys: [
      "code.read",
      "git.status",
      "mcp.readResource",
      "search.fetch",
    ],
  });

  assert.deepEqual(
    index.entries.map((entry) => entry.capabilityKey),
    ["code.read", "git.status", "search.fetch", "mcp.readResource"],
  );
  assert.match(index.entries[0]?.coreHint ?? "", /repo-local source/u);
  assert.equal(index.entries[1]?.defaultNextAction, "decide_next_git_step");
  assert.equal(index.entries[3]?.defaultNextAction, "summarize_resource_contents");
});

test("createTapCapabilityUsageIndex can surface mp family guidance when mp capabilities are registered", () => {
  const index = createTapCapabilityUsageIndex({
    availableCapabilityKeys: [
      "mp.search",
      "mp.resolve",
      "mp.history.request",
      "mp.materialize",
    ],
  });

  assert.deepEqual(
    index.entries.map((entry) => entry.capabilityKey),
    ["mp.search", "mp.resolve", "mp.history.request", "mp.materialize"],
  );
  assert.equal(index.entries[0]?.defaultNextAction, "report_memory_hits");
  assert.equal(index.entries[1]?.defaultNextAction, "report_memory_bundle");
  assert.equal(index.entries[2]?.defaultNextAction, "report_history_bundle");
  assert.equal(index.entries[3]?.defaultNextAction, "report_materialized_memory");
});

test("createTapCapabilityUsageIndex includes second-wave execution and user-io capabilities in declared order", () => {
  const index = createTapCapabilityUsageIndex({
    availableCapabilityKeys: [
      "request_permissions",
      "code.patch",
      "shell.restricted",
      "repo.write",
      "skill.doc.generate",
      "request_user_input",
    ],
  });

  assert.deepEqual(
    index.entries.map((entry) => entry.capabilityKey),
    [
      "repo.write",
      "code.patch",
      "shell.restricted",
      "skill.doc.generate",
      "request_user_input",
      "request_permissions",
    ],
  );
  assert.equal(index.entries[0]?.defaultNextAction, "verify_written_files");
  assert.equal(index.entries[1]?.defaultNextAction, "verify_patch_effects");
  assert.equal(index.entries[2]?.defaultNextAction, "inspect_command_result");
  assert.equal(index.entries[3]?.defaultNextAction, "read_back_generated_doc");
  assert.equal(index.entries[4]?.defaultNextAction, "wait_for_user_reply");
  assert.equal(index.entries[5]?.defaultNextAction, "wait_for_permission_decision");
});

test("renderTapCapabilityUsageIndexForCore includes next actions for second-wave capabilities", () => {
  const text = renderTapCapabilityUsageIndexForCore(
    createTapCapabilityUsageIndex({
      availableCapabilityKeys: [
        "repo.write",
        "shell.restricted",
        "request_permissions",
      ],
    }),
  );

  assert.match(text, /repo\.write/u);
  assert.match(text, /next:verify_written_files/u);
  assert.match(text, /shell\.restricted/u);
  assert.match(text, /next:inspect_command_result/u);
  assert.match(text, /request_permissions/u);
  assert.match(text, /next:wait_for_permission_decision/u);
});
