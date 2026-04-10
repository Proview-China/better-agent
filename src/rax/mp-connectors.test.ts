import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryMpLanceDbAdapter } from "../agent_core/index.js";
import {
  createMpLanceConnector,
  createMpSharedInfraConnectors,
} from "./mp-connectors.js";

test("mp lance connector keeps shared ownership and can bootstrap project tables", async () => {
  const connector = createMpLanceConnector({
    adapter: createInMemoryMpLanceDbAdapter(),
  });
  const plan = connector.createBootstrapPlan({
    projectId: "proj-rax-mp",
    agentIds: ["main", "child-a"],
    rootPath: "/tmp/proj-rax-mp",
  });
  const receipt = await connector.bootstrapProject(plan);

  assert.equal(connector.metadata.ownership, "shared_infra");
  assert.equal(connector.metadata.scope, "multi_agent_system");
  assert.equal(receipt.status, "bootstrapped");
  assert.equal(
    connector.resolveTableName({
      projectId: "proj-rax-mp",
      agentId: "main",
      scopeLevel: "project",
    }),
    "mp_project_proj_rax_mp_memories",
  );
});

test("mp shared infra connector bundle can compose lance connector together", () => {
  const bundle = createMpSharedInfraConnectors({
    adapter: createInMemoryMpLanceDbAdapter(),
  });

  assert.equal(bundle.lance.kind, "shared_lancedb");
});
