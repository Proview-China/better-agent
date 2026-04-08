import assert from "node:assert/strict";
import test from "node:test";

import {
  MP_LANCE_BOOTSTRAP_RECEIPT_STATUSES,
  MP_LANCE_TABLE_KINDS,
  createMpLanceTableDescriptor,
  validateMpLanceBootstrapReceipt,
} from "./index.js";

test("mp lancedb protocol constants expose the frozen bootstrap enums", () => {
  assert.deepEqual(MP_LANCE_TABLE_KINDS, [
    "global_memories",
    "project_memories",
    "agent_memories",
  ]);
  assert.deepEqual(MP_LANCE_BOOTSTRAP_RECEIPT_STATUSES, [
    "bootstrapped",
    "partial",
  ]);
});

test("mp lancedb descriptors require stable names and paths", () => {
  const descriptor = createMpLanceTableDescriptor({
    kind: "project_memories",
    scopeLevel: "project",
    tableName: "mp_project_praxis_memories",
    storagePath: "/tmp/mp_project_praxis_memories.lance",
    ownership: "project",
    projectId: "project.praxis",
    schemaVersion: 1,
  });

  assert.equal(descriptor.tableName, "mp_project_praxis_memories");

  assert.throws(() => createMpLanceTableDescriptor({
    ...descriptor,
    tableName: "",
  }), /tableName/i);

  assert.throws(() => validateMpLanceBootstrapReceipt({
    projectId: "project.praxis",
    schemaVersion: 1,
    status: "bootstrapped",
    expectedTableCount: 3,
    presentTableCount: 3,
    createdTables: [],
  }), /createdTables/i);
});
