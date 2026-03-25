import assert from "node:assert/strict";
import test from "node:test";

import { createCmpProjectDbBootstrapContract, createCmpProjectDbBootstrapReceipt, listCmpProjectDbReadbackTargets } from "../cmp-db/index.js";
import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
  createCmpGitProjectRepoBootstrapPlan,
} from "../cmp-git/index.js";
import { createCmpRedisProjectBootstrap } from "../cmp-mq/redis-bootstrap.js";
import {
  createCmpProjectInfraBootstrapPlan,
  executeCmpProjectInfraBootstrap,
} from "./infra-bootstrap.js";
import {
  createCmpRuntimeInfraState,
  getCmpRuntimeInfraProjectState,
  hydrateCmpRuntimeInfraState,
  recordCmpProjectInfraBootstrapReceipt,
  summarizeCmpRuntimeInfraProjectState,
} from "./infra-state.js";

test("cmp runtime infra state can record one bootstrap receipt and read it back by project", async () => {
  const plan = createCmpProjectInfraBootstrapPlan({
    projectId: "proj-infra-state",
    repoName: "proj-infra-state",
    repoRootPath: "/tmp/praxis/proj-infra-state",
    agents: [{ agentId: "main", depth: 0 }],
  });
  const receipt = await executeCmpProjectInfraBootstrap({
    plan,
    gitBackend: {
      bootstrapProjectRepo(gitPlan) {
        return {
          projectRepo: gitPlan.projectRepo,
          repoRootPath: gitPlan.repoRootPath,
          defaultBranchName: gitPlan.defaultBranchName,
          createdBranchNames: gitPlan.branchKinds.map((kind) => `${kind}/${gitPlan.projectRepo.defaultAgentId}`),
          status: "bootstrapped" as const,
        };
      },
      bootstrapAgentBranchRuntime(runtime) {
        return [runtime.branchFamily.cmp.fullRef] as const;
      },
      readBranchHead(runtime) {
        return { branchRef: runtime.branchFamily.cmp };
      },
      writeCheckedRef(runtime, commitSha) {
        return {
          branchRef: runtime.branchFamily.cmp,
          checkedRefName: runtime.checkedRefName,
          checkedCommitSha: commitSha,
        };
      },
      writePromotedRef(runtime, commitSha) {
        return {
          branchRef: runtime.branchFamily.cmp,
          promotedRefName: runtime.promotedRefName,
          promotedCommitSha: commitSha,
        };
      },
    },
    mqAdapter: {
      bootstrapProject(input) {
        return createCmpRedisProjectBootstrap(input);
      },
      readProjectBootstrap() {
        return undefined;
      },
      readDeliveryTruth() {
        return undefined;
      },
      acknowledgeDelivery() {
        throw new Error("not implemented");
      },
      publishEnvelope() {
        throw new Error("not implemented");
      },
      publishCriticalEscalation() {
        throw new Error("not implemented");
      },
    },
  });

  const state = recordCmpProjectInfraBootstrapReceipt({
    receipt,
    updatedAt: "2026-03-24T12:00:00.000Z",
  });

  const project = getCmpRuntimeInfraProjectState(state, "proj-infra-state");
  assert.ok(project);
  assert.equal(project?.git?.status, "bootstrapped");
  assert.equal(project?.dbReceipt?.status, "readback_incomplete");
  assert.equal(project?.mqBootstraps.length, 1);
  assert.equal(project?.branchRuntimes.length, 1);
});

test("cmp runtime infra state replaces one project receipt with newer readback state", () => {
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "proj-infra-state-2",
    agentIds: ["main"],
  });
  const completeReceipt = createCmpProjectDbBootstrapReceipt({
    contract,
    readbackRows: listCmpProjectDbReadbackTargets(contract).map((target) => ({
      target,
      tableRef: target,
    })),
  });

  const state = createCmpRuntimeInfraState({
    projects: [
      (() => {
        const repo = createCmpGitProjectRepo({
          projectId: "proj-infra-state-2",
          repoName: "proj-infra-state-2",
        });
        const lineage = createCmpGitLineageNode({
          projectId: "proj-infra-state-2",
          agentId: "main",
        });
        return {
          projectId: "proj-infra-state-2",
          git: {
            projectRepo: repo,
            repoRootPath: "/tmp/praxis/proj-infra-state-2",
            defaultBranchName: "main",
            createdBranchNames: ["cmp/main"],
            status: "bootstrapped" as const,
          },
          gitBranchBootstraps: [{ agentId: "main", createdBranchNames: ["cmp/main"] }],
          branchRuntimes: [createCmpGitAgentBranchRuntime({
            projectRepo: repo,
            lineage,
            repoRootPath: "/tmp/praxis/proj-infra-state-2",
          })],
          db: contract,
          dbReceipt: createCmpProjectDbBootstrapReceipt({ contract }),
          mqBootstraps: [createCmpRedisProjectBootstrap({
            projectId: "proj-infra-state-2",
            agentId: "main",
          })],
          lineages: [lineage],
          updatedAt: "2026-03-24T12:00:00.000Z",
        };
      })(),
    ],
  });

  const next = recordCmpProjectInfraBootstrapReceipt({
    state,
    receipt: {
      git: {
        projectRepo: createCmpGitProjectRepo({
          projectId: "proj-infra-state-2",
          repoName: "proj-infra-state-2",
        }),
        repoRootPath: "/tmp/praxis/proj-infra-state-2",
        defaultBranchName: "main",
        createdBranchNames: ["cmp/main", "work/main"],
        status: "already_exists",
      },
      gitBranchBootstraps: [{ agentId: "main", createdBranchNames: ["cmp/main", "work/main"] }],
      db: contract,
      dbReceipt: completeReceipt,
      mqBootstraps: [createCmpRedisProjectBootstrap({
        projectId: "proj-infra-state-2",
        agentId: "main",
      })],
      lineages: [createCmpGitLineageNode({
        projectId: "proj-infra-state-2",
        agentId: "main",
      })],
      branchRuntimes: [createCmpGitAgentBranchRuntime({
        projectRepo: createCmpGitProjectRepo({
          projectId: "proj-infra-state-2",
          repoName: "proj-infra-state-2",
        }),
        lineage: createCmpGitLineageNode({
          projectId: "proj-infra-state-2",
          agentId: "main",
        }),
        repoRootPath: "/tmp/praxis/proj-infra-state-2",
      })],
    },
    updatedAt: "2026-03-24T12:05:00.000Z",
  });

  const project = getCmpRuntimeInfraProjectState(next, "proj-infra-state-2");
  assert.ok(project);
  assert.equal(project?.git?.status, "already_exists");
  assert.equal(project?.dbReceipt?.status, "bootstrapped");
});

test("cmp runtime infra hydration builds a project map and rejects duplicates", () => {
  const state = createCmpRuntimeInfraState({
    projects: [
      {
        projectId: "proj-hydrate",
        git: undefined,
        gitBranchBootstraps: [],
        branchRuntimes: [],
        db: undefined,
        dbReceipt: undefined,
        mqBootstraps: [],
        lineages: [],
        updatedAt: "2026-03-24T12:10:00.000Z",
      },
    ],
  });

  const hydrated = hydrateCmpRuntimeInfraState(state);
  assert.equal(hydrated.projects.size, 1);
  assert.ok(hydrated.projects.has("proj-hydrate"));

  assert.throws(() => {
    hydrateCmpRuntimeInfraState({
      projects: [
        {
          projectId: "dup-project",
          git: undefined,
          gitBranchBootstraps: [],
          branchRuntimes: [],
          db: undefined,
          dbReceipt: undefined,
          mqBootstraps: [],
          lineages: [],
          updatedAt: "2026-03-24T12:10:00.000Z",
        },
        {
          projectId: "dup-project",
          git: undefined,
          gitBranchBootstraps: [],
          branchRuntimes: [],
          db: undefined,
          dbReceipt: undefined,
          mqBootstraps: [],
          lineages: [],
          updatedAt: "2026-03-24T12:11:00.000Z",
        },
      ],
    });
  }, /Duplicate CMP infra project state detected/);
});

test("cmp runtime infra summary reports git db and redis readback coverage", () => {
  const summary = summarizeCmpRuntimeInfraProjectState({
    projectId: "proj-summary",
    git: {
      projectRepo: createCmpGitProjectRepo({
        projectId: "proj-summary",
        repoName: "proj-summary",
      }),
      repoRootPath: "/tmp/praxis/proj-summary",
      defaultBranchName: "main",
      createdBranchNames: ["cmp/main", "work/main"],
      status: "bootstrapped",
    },
    gitBranchBootstraps: [{ agentId: "main", createdBranchNames: ["cmp/main", "work/main"] }],
    branchRuntimes: [createCmpGitAgentBranchRuntime({
      projectRepo: createCmpGitProjectRepo({
        projectId: "proj-summary",
        repoName: "proj-summary",
      }),
      lineage: createCmpGitLineageNode({
        projectId: "proj-summary",
        agentId: "main",
      }),
      repoRootPath: "/tmp/praxis/proj-summary",
    })],
    db: undefined,
    dbReceipt: createCmpProjectDbBootstrapReceipt({
      contract: createCmpProjectDbBootstrapContract({
        projectId: "proj-summary",
        agentIds: ["main"],
      }),
    }),
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-summary",
      agentId: "main",
    })],
    lineages: [createCmpGitLineageNode({
      projectId: "proj-summary",
      agentId: "main",
    })],
    updatedAt: "2026-03-25T10:00:00.000Z",
  });

  assert.equal(summary.gitStatus, "bootstrapped");
  assert.equal(summary.gitBranchBootstrapCount, 1);
  assert.equal(summary.branchRuntimeCount, 1);
  assert.equal(summary.dbReceiptStatus, "readback_incomplete");
  assert.equal(summary.mqBootstrapCount, 1);
  assert.equal(summary.hydratedLineageCount, 1);
});
