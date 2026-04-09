import assert from "node:assert/strict";
import test from "node:test";

import type {
  CommitContextDeltaInput,
  CommitContextDeltaResult,
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextInput,
  IngestRuntimeContextResult,
  MaterializeContextPackageInput,
  MaterializeContextPackageResult,
  RequestHistoricalContextInput,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotInput,
  ResolveCheckedSnapshotResult,
} from "../agent_core/cmp-types/index.js";
import type {
  CmpFiveAgentCapabilityAccessResolution,
  CmpFiveAgentSummary,
} from "../agent_core/cmp-five-agent/index.js";
import type {
  CmpRuntimeInfraProjectState,
} from "../agent_core/cmp-runtime/infra-state.js";
import type { CmpProjectInfraBootstrapReceipt } from "../agent_core/cmp-runtime/infra-bootstrap.js";
import type { CmpRuntimeSnapshot } from "../agent_core/cmp-runtime/runtime-snapshot.js";
import type { DispatchCmpFiveAgentCapabilityResult } from "../agent_core/runtime.js";
import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
} from "../agent_core/cmp-git/index.js";
import { createCmpRedisProjectBootstrap } from "../agent_core/cmp-mq/redis-bootstrap.js";
import { createRaxCmpFacade } from "./cmp-facade.js";
import type { RaxCmpPort } from "./cmp-types.js";

type LegacyCmpRuntimeStub = Record<string, ((...args: any[]) => any) | undefined>;

function adaptLegacyCmpRuntimeStub(runtime: LegacyCmpRuntimeStub): RaxCmpPort {
  return {
    project: {
      bootstrapProjectInfra(input) {
        if (!runtime.bootstrapCmpProjectInfra) {
          throw new Error("Legacy CMP runtime stub is missing bootstrapCmpProjectInfra.");
        }
        return runtime.bootstrapCmpProjectInfra(input);
      },
      getBootstrapReceipt(projectId) {
        return runtime.getCmpProjectInfraBootstrapReceipt?.(projectId);
      },
      getInfraProjectState(projectId) {
        return runtime.getCmpRuntimeInfraProjectState?.(projectId);
      },
      getRecoverySummary() {
        return runtime.getCmpRuntimeRecoverySummary?.();
      },
      getProjectRecoverySummary(projectId) {
        return runtime.getCmpRuntimeProjectRecoverySummary?.(projectId);
      },
      getDeliveryTruthSummary(projectId) {
        return runtime.getCmpRuntimeDeliveryTruthSummary?.(projectId);
      },
      createSnapshot() {
        return runtime.createCmpRuntimeSnapshot?.() ?? runtime.getCmpRuntimeSnapshot?.();
      },
      recoverSnapshot(snapshot) {
        if (!runtime.recoverCmpRuntimeSnapshot) {
          throw new Error("Legacy CMP runtime stub is missing recoverCmpRuntimeSnapshot.");
        }
        return runtime.recoverCmpRuntimeSnapshot(snapshot);
      },
      advanceDeliveryTimeouts(input) {
        return runtime.advanceCmpMqDeliveryTimeouts?.(input);
      },
    },
    flow: {
      ingest(input) {
        if (!runtime.ingestRuntimeContext) {
          throw new Error("Legacy CMP runtime stub is missing ingestRuntimeContext.");
        }
        return runtime.ingestRuntimeContext(input);
      },
      commit(input) {
        if (!runtime.commitContextDelta) {
          throw new Error("Legacy CMP runtime stub is missing commitContextDelta.");
        }
        return runtime.commitContextDelta(input);
      },
      resolve(input) {
        if (!runtime.resolveCheckedSnapshot) {
          throw new Error("Legacy CMP runtime stub is missing resolveCheckedSnapshot.");
        }
        return runtime.resolveCheckedSnapshot(input);
      },
      materialize(input) {
        if (!runtime.materializeContextPackage) {
          throw new Error("Legacy CMP runtime stub is missing materializeContextPackage.");
        }
        return runtime.materializeContextPackage(input);
      },
      dispatch(input) {
        if (!runtime.dispatchContextPackage) {
          throw new Error("Legacy CMP runtime stub is missing dispatchContextPackage.");
        }
        return runtime.dispatchContextPackage(input);
      },
      requestHistory(input) {
        if (!runtime.requestHistoricalContext) {
          throw new Error("Legacy CMP runtime stub is missing requestHistoricalContext.");
        }
        return runtime.requestHistoricalContext(input);
      },
    },
    fiveAgent: {
      getSummary(agentId) {
        return runtime.getCmpFiveAgentRuntimeSummary?.(agentId);
      },
    },
    roles: {
      resolveCapabilityAccess(input) {
        return runtime.resolveCmpFiveAgentCapabilityAccess?.(input);
      },
      dispatchCapability(input) {
        return runtime.dispatchCmpFiveAgentCapability?.(input);
      },
      approvePeerExchange(input) {
        return runtime.reviewCmpPeerExchangeApproval?.(input);
      },
    },
  };
}

function createCmpRedisNamespaceFixture(projectId: string, agentId: string) {
  const keyPrefix = `cmp:${projectId}:${agentId}`;
  return {
    projectId,
    namespaceRoot: "cmp",
    keyPrefix,
    channelsPrefix: `${keyPrefix}:channel`,
    streamsPrefix: `${keyPrefix}:stream`,
    queuesPrefix: `${keyPrefix}:queue`,
    consumerGroupPrefix: `${keyPrefix}:group`,
  };
}

function createCmpLineageFixture(projectId: string, agentId: string, childAgentIds: string[] = []) {
  return {
    lineageId: `lineage-${agentId}`,
    projectId,
    agentId,
    depth: 0,
    branchFamily: {
      agentId,
      work: { kind: "work" as const, agentId, branchName: `work/${agentId}`, fullRef: `refs/heads/work/${agentId}` },
      cmp: { kind: "cmp" as const, agentId, branchName: `cmp/${agentId}`, fullRef: `refs/heads/cmp/${agentId}` },
      mp: { kind: "mp" as const, agentId, branchName: `mp/${agentId}`, fullRef: `refs/heads/mp/${agentId}` },
      tap: { kind: "tap" as const, agentId, branchName: `tap/${agentId}`, fullRef: `refs/heads/tap/${agentId}` },
    },
    childAgentIds,
    status: "active" as const,
  };
}

function createCmpBranchRuntimeFixture(projectId: string, agentId: string) {
  return createCmpGitAgentBranchRuntime({
    projectRepo: createCmpGitProjectRepo({
      projectId,
      repoName: projectId,
      defaultAgentId: agentId,
    }),
    lineage: createCmpGitLineageNode({
      projectId,
      agentId,
    }),
    repoRootPath: `/tmp/praxis/${projectId}`,
  });
}

function createCmpRuntimeSnapshotFixture(projectId: string, agentId: string): CmpRuntimeSnapshot {
  return {
    projectRepos: [],
    lineages: [],
    events: [],
    deltas: [],
    activeLines: [],
    snapshotCandidates: [],
    checkedSnapshots: [],
    requests: [
      {
        requestId: "request-1",
        projectId,
        requesterAgentId: agentId,
        requestKind: "active_ingest",
        status: "received",
        sourceAnchors: ["msg:1"],
        createdAt: "2026-03-30T00:00:00.000Z",
        updatedAt: "2026-03-30T00:00:00.000Z",
      },
      {
        requestId: "request-2",
        projectId,
        requesterAgentId: agentId,
        requestKind: "materialize_package",
        status: "reviewed",
        sourceAnchors: ["snapshot:1"],
        createdAt: "2026-03-30T00:00:01.000Z",
        updatedAt: "2026-03-30T00:00:01.000Z",
      },
      {
        requestId: "request-3",
        projectId,
        requesterAgentId: agentId,
        requestKind: "dispatch_package",
        status: "served",
        sourceAnchors: ["pkg:1"],
        createdAt: "2026-03-30T00:00:02.000Z",
        updatedAt: "2026-03-30T00:00:02.000Z",
      },
    ],
    sectionRecords: [
      {
        sectionId: "section-raw",
        projectId,
        agentId,
        lifecycle: "raw",
        version: 1,
        source: "core_agent",
        kind: "runtime_context",
        fidelity: "exact",
        lineagePath: [agentId],
        payloadRefs: ["msg:1"],
        sourceAnchors: ["msg:1"],
        ancestorSectionIds: [],
        createdAt: "2026-03-30T00:00:00.000Z",
        updatedAt: "2026-03-30T00:00:00.000Z",
      },
      {
        sectionId: "section-pre",
        projectId,
        agentId,
        lifecycle: "pre",
        version: 1,
        source: "core_agent",
        kind: "runtime_context",
        fidelity: "exact",
        lineagePath: [agentId],
        payloadRefs: ["msg:1"],
        sourceAnchors: ["msg:1"],
        parentSectionId: "section-raw",
        ancestorSectionIds: ["section-raw"],
        createdAt: "2026-03-30T00:00:01.000Z",
        updatedAt: "2026-03-30T00:00:01.000Z",
      },
      {
        sectionId: "section-checked",
        projectId,
        agentId,
        lifecycle: "checked",
        version: 1,
        source: "system",
        kind: "runtime_context",
        fidelity: "checked",
        lineagePath: [agentId],
        payloadRefs: ["checked:1"],
        sourceAnchors: ["msg:1"],
        parentSectionId: "section-pre",
        ancestorSectionIds: ["section-raw", "section-pre"],
        createdAt: "2026-03-30T00:00:02.000Z",
        updatedAt: "2026-03-30T00:00:02.000Z",
      },
      {
        sectionId: "section-persisted",
        projectId,
        agentId,
        lifecycle: "persisted",
        version: 1,
        source: "system",
        kind: "runtime_context",
        fidelity: "checked",
        lineagePath: [agentId],
        payloadRefs: ["persisted:1"],
        sourceAnchors: ["msg:1"],
        parentSectionId: "section-checked",
        ancestorSectionIds: ["section-raw", "section-pre", "section-checked"],
        createdAt: "2026-03-30T00:00:03.000Z",
        updatedAt: "2026-03-30T00:00:03.000Z",
      },
    ],
    snapshotRecords: [
      {
        snapshotId: "snapshot-pre",
        projectId,
        agentId,
        stage: "pre",
        sourceSectionIds: ["section-pre"],
        sourceAnchors: ["msg:1"],
        branchRef: "refs/heads/cmp/main",
        createdAt: "2026-03-30T00:00:01.500Z",
        updatedAt: "2026-03-30T00:00:01.500Z",
      },
      {
        snapshotId: "snapshot-checked",
        projectId,
        agentId,
        stage: "checked",
        sourceSectionIds: ["section-checked"],
        sourceAnchors: ["msg:1"],
        branchRef: "refs/heads/cmp/main",
        commitRef: "cmp-commit-checked",
        createdAt: "2026-03-30T00:00:02.500Z",
        updatedAt: "2026-03-30T00:00:02.500Z",
      },
      {
        snapshotId: "snapshot-persisted",
        projectId,
        agentId,
        stage: "persisted",
        sourceSectionIds: ["section-persisted"],
        sourceAnchors: ["msg:1"],
        branchRef: "refs/heads/cmp/main",
        commitRef: "cmp-commit-persisted",
        createdAt: "2026-03-30T00:00:03.500Z",
        updatedAt: "2026-03-30T00:00:03.500Z",
      },
    ],
    promotedProjections: [],
    packageRecords: [
      {
        packageId: "pkg-materialized",
        projectId,
        sourceProjectionId: "projection-1",
        targetAgentId: "child-1",
        packageKind: "child_seed",
        packageRef: "cmp-package:pkg-materialized",
        fidelityLabel: "checked_high_fidelity",
        status: "materialized",
        sourceSnapshotId: "snapshot-persisted",
        sourceSectionIds: ["section-persisted"],
        sourceAnchors: ["msg:1"],
        createdAt: "2026-03-30T00:00:04.000Z",
        updatedAt: "2026-03-30T00:00:04.000Z",
      },
      {
        packageId: "pkg-dispatched",
        projectId,
        sourceProjectionId: "projection-1",
        targetAgentId: "child-1",
        packageKind: "child_seed",
        packageRef: "cmp-package:pkg-dispatched",
        fidelityLabel: "checked_high_fidelity",
        status: "dispatched",
        sourceSnapshotId: "snapshot-persisted",
        sourceSectionIds: ["section-persisted"],
        sourceAnchors: ["msg:1"],
        createdAt: "2026-03-30T00:00:05.000Z",
        updatedAt: "2026-03-30T00:00:05.000Z",
      },
    ],
    contextPackages: [],
    dispatchReceipts: [],
    syncEvents: [],
    infraState: undefined,
  };
}

test("createRaxCmpFacade creates a session and delegates bootstrap/readback/recover/smoke", async () => {
  const bootstrapCalls: unknown[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra(input: unknown) {
      bootstrapCalls.push(input);
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade",
            repoId: "repo-1",
            repoName: "proj-facade",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "bootstrapped",
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          topology: {
            projectId: "proj-facade",
            databaseName: "cmp_proj_facade",
            schemaName: "cmp_proj_facade",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped" as const,
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          createCmpRedisProjectBootstrap({
            projectId: "proj-facade",
            agentId: "main",
          }),
        ],
        lineages: [
          createCmpLineageFixture("proj-facade", "main"),
        ],
        branchRuntimes: [createCmpBranchRuntimeFixture("proj-facade", "main")],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpProjectInfraBootstrapReceipt() {
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade",
            repoId: "repo-1",
            repoName: "proj-facade",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "bootstrapped",
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          topology: {
            projectId: "proj-facade",
            databaseName: "cmp_proj_facade",
            schemaName: "cmp_proj_facade",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped" as const,
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          createCmpRedisProjectBootstrap({
            projectId: "proj-facade",
            agentId: "main",
          }),
        ],
        lineages: [
          createCmpLineageFixture("proj-facade", "main"),
        ],
        branchRuntimes: [createCmpBranchRuntimeFixture("proj-facade", "main")],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpRuntimeInfraProjectState() {
      return {
        projectId: "proj-facade",
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped" as const,
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          createCmpRedisProjectBootstrap({
            projectId: "proj-facade",
            agentId: "main",
          }),
        ],
        lineages: [
          createCmpLineageFixture("proj-facade", "main"),
        ],
        branchRuntimes: [createCmpBranchRuntimeFixture("proj-facade", "main")],
        updatedAt: "2026-03-24T00:00:00.000Z",
      } satisfies CmpRuntimeInfraProjectState;
    },
    getCmpRuntimeRecoverySummary() {
      return {
        totalProjects: 1,
        alignedProjectIds: ["proj-facade"],
        degradedProjectIds: [],
        snapshotOnlyProjectIds: [],
        infraOnlyProjectIds: [],
        recommendedHydrateFromSnapshot: [],
        recommendedHydrateFromInfra: [],
        recommendedReconcile: [],
      };
    },
    getCmpRuntimeProjectRecoverySummary() {
      return {
        projectId: "proj-facade",
        status: "aligned" as const,
        recommendedAction: "none" as const,
        issues: [],
      };
    },
    getCmpRuntimeDeliveryTruthSummary() {
      return {
        projectId: "proj-facade",
        totalDispatches: 1,
        publishedCount: 0,
        acknowledgedCount: 1,
        retryScheduledCount: 0,
        expiredCount: 0,
        driftCount: 0,
        pendingAckCount: 0,
        status: "ready" as const,
        issues: [],
      };
    },
    getCmpFiveAgentRuntimeSummary() {
      return {
        configurationVersion: "cmp-five-agent-role-catalog/v1",
        roleCounts: {
          icma: 1,
          iterator: 1,
          checker: 1,
          dbagent: 1,
          dispatcher: 1,
        },
        latestStages: {
          icma: "emit",
          iterator: "update_review_ref",
          checker: "checked",
          dbagent: "attach_snapshots",
          dispatcher: "collect_receipt",
        },
        latestRoleMetadata: {
          icma: {
            ingressDiscipline: "append_only_fragment_control",
            structuredOutput: {
              intent: "整理当前主线",
              sourceAnchorRefs: ["msg:1"],
              candidateBodyRefs: ["msg:1"],
              boundary: "preserve_root_system_and_emit_controlled_fragments_only",
              chunkingMode: "multi_auto",
              autoFragmentPolicy: {
                strategy: "llm_infer_from_materials",
                detectedKinds: ["constraint", "flow"],
              },
              intentChunks: [{
                chunkId: "chunk-1",
                taskSummary: "整理当前主线",
                materialRefs: ["msg:1"],
                detectedFragmentKinds: ["constraint", "flow"],
                operatorGuide: "preserve high-signal ingress",
                childGuide: "child seeds enter child icma only",
              }],
              guide: {
                operatorGuide: "preserve high-signal ingress",
                childGuide: "child seeds enter child icma only",
              },
            },
          },
          iterator: {
            reviewDiscipline: { minimumReviewUnit: "commit" },
            reviewOutput: {
              sourceSectionIds: ["section-pre"],
              minimumReviewUnit: "commit",
              progressionVerdict: "advance_commit",
              reviewRefAnnotation: "candidate ready for checker",
              handoffTarget: "checker",
            },
          },
          checker: {
            reviewDiscipline: { checkedDetachedFromPromote: true },
            reviewOutput: {
              trimSummary: "checker trims to section-level high-signal content",
              sourceSectionIds: ["section-pre"],
              checkedSectionIds: ["section-checked"],
              splitDecisionRefs: ["split-1"],
              mergeDecisionRefs: [],
              splitExecutions: [{
                decisionRef: "split-1",
                sourceSectionId: "section-pre",
                proposedSectionIds: ["section-checked"],
                rationale: "split into checked section",
              }],
              shortReason: "checked snapshot is ready",
              detailedReason: "checker separated verified evidence into execution-grade checked sections",
            },
          },
          dbagent: {
            packageAuthority: "dbagent_primary_packer",
            materializationOutput: {
              requestId: "request-1",
              sourceSectionIds: ["section-checked"],
              packageTopology: "active_plus_timeline_plus_task_snapshots",
              bundleSchemaVersion: "cmp-dispatch-bundle/v1",
              primaryPackageStrategy: "active task package is the primary package",
              timelinePackageStrategy: "timeline attachment remains separate",
              taskSnapshotStrategy: "task snapshots stay append-only",
              passivePackagingStrategy: "historical replies stay coarse and high-fidelity",
            },
          },
          dispatcher: {
            routePolicy: { targetIngress: "child_icma_only" },
            bundle: {
              target: { targetIngress: "child_icma_only" },
              body: {
                primaryRef: "cmp-package:pkg-main",
                bodyStrategy: "child_seed_full",
                slimExchangeFields: [],
              },
              governance: {
                scopePolicy: "child_seed_only_to_child_icma",
                routeRationale: "child package only enters child icma",
              },
            },
          },
        },
        checkpointCount: 5,
        overrideCount: 0,
        peerExchangePendingApprovalCount: 0,
        peerExchangeApprovedCount: 0,
        parentPromoteReviewCount: 1,
        configuredRoles: {
          icma: {
            promptPackId: "cmp-five-agent/icma-prompt-pack/v1",
            profileId: "cmp-five-agent/icma-profile/v1",
            capabilityContractId: "cmp-five-agent/icma-capability-contract/v1",
            tapProfileId: "cmp-five-agent/icma-tap-profile/v1",
          },
          iterator: {
            promptPackId: "cmp-five-agent/iterator-prompt-pack/v1",
            profileId: "cmp-five-agent/iterator-profile/v1",
            capabilityContractId: "cmp-five-agent/iterator-capability-contract/v1",
            tapProfileId: "cmp-five-agent/iterator-tap-profile/v1",
          },
          checker: {
            promptPackId: "cmp-five-agent/checker-prompt-pack/v1",
            profileId: "cmp-five-agent/checker-profile/v1",
            capabilityContractId: "cmp-five-agent/checker-capability-contract/v1",
            tapProfileId: "cmp-five-agent/checker-tap-profile/v1",
          },
          dbagent: {
            promptPackId: "cmp-five-agent/dbagent-prompt-pack/v1",
            profileId: "cmp-five-agent/dbagent-profile/v1",
            capabilityContractId: "cmp-five-agent/dbagent-capability-contract/v1",
            tapProfileId: "cmp-five-agent/dbagent-tap-profile/v1",
          },
          dispatcher: {
            promptPackId: "cmp-five-agent/dispatcher-prompt-pack/v1",
            profileId: "cmp-five-agent/dispatcher-profile/v1",
            capabilityContractId: "cmp-five-agent/dispatcher-capability-contract/v1",
            tapProfileId: "cmp-five-agent/dispatcher-tap-profile/v1",
          },
        },
        capabilityMatrix: {
          gitWriters: ["iterator", "checker"],
          dbWriters: ["dbagent"],
          mqPublishers: ["icma", "dispatcher"],
        },
        tapProfiles: {
          icma: {
            role: "icma",
            profileId: "cmp-five-agent/icma-tap-profile/v1",
            agentClass: "cmp-five-agent:icma",
            defaultMode: "balanced",
            baselineTier: "B0",
            baselineCapabilities: ["docs.read", "cmp.db.read", "cmp.mq.publish.ingress_hint"],
            allowedCapabilityPatterns: ["cmp.db.read", "cmp.mq.publish.ingress_hint"],
            deniedCapabilityPatterns: ["cmp.git.*"],
          },
          iterator: {
            role: "iterator",
            profileId: "cmp-five-agent/iterator-tap-profile/v1",
            agentClass: "cmp-five-agent:iterator",
            defaultMode: "strict",
            baselineTier: "B1",
            baselineCapabilities: ["docs.read", "cmp.git.write", "cmp.git.review_ref.write", "cmp.db.read"],
            allowedCapabilityPatterns: ["cmp.git.write", "cmp.git.review_ref.*", "cmp.db.read"],
            deniedCapabilityPatterns: ["cmp.db.write*", "cmp.mq.*"],
          },
          checker: {
            role: "checker",
            profileId: "cmp-five-agent/checker-tap-profile/v1",
            agentClass: "cmp-five-agent:checker",
            defaultMode: "standard",
            baselineTier: "B1",
            baselineCapabilities: ["docs.read", "cmp.git.review_ref.read", "cmp.git.review_ref.annotate", "cmp.db.read"],
            allowedCapabilityPatterns: ["cmp.git.review_ref.*", "cmp.db.read"],
            deniedCapabilityPatterns: ["cmp.db.write*", "cmp.mq.*", "cmp.git.write"],
          },
          dbagent: {
            role: "dbagent",
            profileId: "cmp-five-agent/dbagent-tap-profile/v1",
            agentClass: "cmp-five-agent:dbagent",
            defaultMode: "strict",
            baselineTier: "B1",
            baselineCapabilities: ["docs.read", "cmp.git.read", "cmp.db.write", "cmp.db.package.write", "cmp.db.snapshot.write", "cmp.mq.delivery.read"],
            allowedCapabilityPatterns: ["cmp.git.read", "cmp.db.*", "cmp.mq.delivery.read"],
            deniedCapabilityPatterns: ["cmp.git.write*", "cmp.mq.publish.*"],
          },
          dispatcher: {
            role: "dispatcher",
            profileId: "cmp-five-agent/dispatcher-tap-profile/v1",
            agentClass: "cmp-five-agent:dispatcher",
            defaultMode: "strict",
            baselineTier: "B1",
            baselineCapabilities: ["docs.read", "cmp.db.read", "cmp.mq.publish.delivery", "cmp.mq.publish.child_seed", "cmp.mq.publish.peer_exchange"],
            allowedCapabilityPatterns: ["cmp.db.read", "cmp.mq.publish.*"],
            deniedCapabilityPatterns: ["cmp.git.*", "cmp.db.write*"],
          },
        },
        flow: {
          packageModeCounts: { child_seed_via_icma: 1 },
          childSeedToIcmaCount: 1,
          passiveReturnCount: 0,
          pendingPeerApprovalCount: 0,
          approvedPeerApprovalCount: 0,
          rejectedPeerApprovalCount: 0,
          reinterventionPendingCount: 0,
          reinterventionServedCount: 0,
        },
        recovery: {
          checkpointCoverage: {
            icma: 1,
            iterator: 1,
            checker: 1,
            dbagent: 1,
            dispatcher: 1,
          },
          resumableRoles: ["icma", "iterator", "checker", "dbagent", "dispatcher"],
          missingCheckpointRoles: [],
        },
        live: {
          icma: {
            mode: "llm_assisted",
            status: "succeeded",
            fallbackApplied: false,
            provider: "openai",
            model: "gpt-5.4",
          },
          iterator: {
            mode: "llm_assisted",
            status: "succeeded",
            fallbackApplied: false,
            provider: "openai",
            model: "gpt-5.4",
          },
          checker: {
            mode: "llm_assisted",
            status: "succeeded",
            fallbackApplied: false,
            provider: "openai",
            model: "gpt-5.4",
          },
          dbagent: {
            mode: "llm_assisted",
            status: "succeeded",
            fallbackApplied: false,
            provider: "openai",
            model: "gpt-5.4",
          },
          dispatcher: {
            mode: "llm_assisted",
            status: "succeeded",
            fallbackApplied: false,
            provider: "openai",
            model: "gpt-5.4",
          },
        },
      } satisfies CmpFiveAgentSummary;
    },
    getCmpRuntimeSnapshot() {
      return createCmpRuntimeSnapshotFixture("proj-facade", "main");
    },
    async recoverCmpRuntimeSnapshot(_snapshot: CmpRuntimeSnapshot) {
      return undefined;
    },
    async ingestRuntimeContext(_input: IngestRuntimeContextInput) {
      return {
        status: "accepted",
        acceptedEventIds: ["event-1"],
        nextAction: "commit_context_delta",
      } satisfies IngestRuntimeContextResult;
    },
    async commitContextDelta(_input: CommitContextDeltaInput) {
      return {
        status: "accepted",
        delta: {
          deltaId: "delta-1",
          agentId: "main",
          eventRefs: ["event-1"],
          changeSummary: "delta",
          createdAt: "2026-03-24T00:00:00.000Z",
          syncIntent: "local_record",
        },
      } satisfies CommitContextDeltaResult;
    },
    async resolveCheckedSnapshot(_input: ResolveCheckedSnapshotInput) {
      return {
        status: "resolved",
        found: true,
        snapshot: {
          snapshotId: "snapshot-1",
          agentId: "main",
          lineageRef: "lineage:main",
          branchRef: "refs/heads/cmp/main",
          commitRef: "cmp-commit-1",
          checkedAt: "2026-03-24T00:00:00.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
      } satisfies ResolveCheckedSnapshotResult;
    },
    async materializeContextPackage(_input: MaterializeContextPackageInput) {
      return {
        status: "materialized",
        contextPackage: {
          packageId: "package-1",
          sourceProjectionId: "projection-1",
          targetAgentId: "child-1",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-1:child-1:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies MaterializeContextPackageResult;
    },
    async dispatchContextPackage(_input: DispatchContextPackageInput) {
      return {
        status: "dispatched",
        receipt: {
          dispatchId: "dispatch-1",
          packageId: "package-1",
          sourceAgentId: "main",
          targetAgentId: "child-1",
          status: "delivered",
          deliveredAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies DispatchContextPackageResult;
    },
    async requestHistoricalContext(_input: RequestHistoricalContextInput) {
      return {
        status: "not_found",
        found: false,
      } satisfies RequestHistoricalContextResult;
    },
    async dispatchCmpFiveAgentCapability() {
      return {
        role: "dispatcher" as const,
        profile: {
          profileId: "cmp-five-agent/dispatcher-tap-profile/v1",
          agentClass: "cmp-five-agent:dispatcher",
          defaultMode: "strict" as const,
          canonicalDefaultMode: "standard" as const,
          baselineTier: "B1" as const,
          baselineCapabilities: ["cmp.mq.publish.delivery"],
          allowedCapabilityPatterns: ["cmp.mq.publish.*"],
          deniedCapabilityPatterns: ["cmp.git.*"],
        },
        intent: {
          intentId: "intent-dispatch-role-capability-ready",
          sessionId: "session-ready-dispatch-role-capability",
          runId: "run-dispatch-role-capability-ready",
          kind: "capability_call" as const,
          createdAt: "2026-03-30T00:00:00.000Z",
          priority: "high" as const,
          request: {
            requestId: "request-dispatch-role-capability-ready",
            intentId: "intent-dispatch-role-capability-ready",
            sessionId: "session-ready-dispatch-role-capability",
            runId: "run-dispatch-role-capability-ready",
            capabilityKey: "cmp.mq.publish.delivery",
            input: {},
            priority: "high" as const,
          },
        },
        bridgeMetadata: {
          cmpRole: "dispatcher",
        },
        dispatch: {
          status: "review_required" as const,
        },
      } satisfies DispatchCmpFiveAgentCapabilityResult;
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.session.open({
    config: {
      projectId: "proj-facade",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade",
        repoRootPath: "/tmp/praxis/proj-facade",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  const bootstrap = await cmp.project.bootstrap({
    session,
    payload: {
      agents: [{ agentId: "main", depth: 0 }],
    },
  });
  const readback = await cmp.project.readback({ session });
  const smoke = await cmp.project.smoke({ session });

  assert.equal(session.projectId, "proj-facade");
  assert.equal(bootstrap.status, "bootstrapped");
  assert.equal(bootstrapCalls.length, 1);
  assert.equal(readback.status, "found");
  assert.equal(readback.summary?.status, "ready");
  assert.equal(readback.summary?.truthLayers.length, 3);
  assert.equal(readback.summary?.truthLayers.find((layer) => layer.layer === "git")?.status, "ready");
  assert.equal(readback.summary?.fallbacks.gitHistoryRebuild, "not_needed");
  assert.equal(readback.summary?.fiveAgentSummary?.configurationVersion, "cmp-five-agent-role-catalog/v1");
  assert.deepEqual(readback.summary?.fiveAgentSummary?.capabilityMatrix.mqPublishers, ["icma", "dispatcher"]);
  assert.equal(readback.summary?.fiveAgentSummary?.tapProfiles.dispatcher.profileId, "cmp-five-agent/dispatcher-tap-profile/v1");
  assert.equal(readback.summary?.fiveAgentSummary?.live.dispatcher.status, "succeeded");
  assert.equal(readback.summary?.statusPanel?.roles.icma.semanticSummary, "chunking=multi_auto, chunks=1, fragments=0");
  assert.equal(readback.summary?.statusPanel?.roles.iterator.semanticSummary, "verdict=advance_commit, annotation=candidate ready for checker");
  assert.equal(readback.summary?.statusPanel?.roles.checker.semanticSummary, "split=1, merge=0");
  assert.equal(readback.summary?.statusPanel?.roles.dbagent.semanticSummary, "primary=active task package is the primary package, timeline=timeline attachment remains separate, task=task snapshots stay append-only, passive=historical replies stay coarse and high-fidelity");
  assert.equal(readback.summary?.statusPanel?.roles.dispatcher.latestStage, "collect_receipt");
  assert.equal(readback.summary?.statusPanel?.roles.dispatcher.liveMode, "llm_assisted");
  assert.equal(readback.summary?.statusPanel?.roles.dispatcher.liveStatus, "succeeded");
  assert.equal(readback.summary?.statusPanel?.roles.dispatcher.semanticSummary, "body=child_seed_full, ingress=child_icma_only, slim=0, scope=child_seed_only_to_child_icma");
  assert.equal(readback.summary?.statusPanel?.packageFlow.latestTargetIngress, "child_icma_only");
  assert.equal(readback.summary?.statusPanel?.requests.pendingPeerApprovalCount, 0);
  assert.equal(readback.summary?.statusPanel?.health.readbackStatus, "ready");
  assert.equal(readback.summary?.statusPanel?.health.liveLlmReadyCount, 5);
  assert.equal(readback.summary?.acceptance.objectModel.status, "ready");
  assert.equal(readback.summary?.acceptance.liveLlm.status, "ready");
  assert.equal(readback.summary?.acceptance.finalAcceptance.status, "ready");
  assert.equal(smoke.status, "ready");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.object_model.readiness")?.status, "ready");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.five_agent.live_llm")?.status, "ready");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.live_infra.readiness")?.status, "ready");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.final_acceptance")?.status, "ready");
});

test("createRaxCmpFacade delegates ingest commit and requestHistory to runtime", async () => {
  const calls: string[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext(_input: IngestRuntimeContextInput) {
      calls.push("ingest");
      return {
        status: "accepted",
        acceptedEventIds: ["event-1"],
        nextAction: "commit_context_delta",
      } satisfies IngestRuntimeContextResult;
    },
    async commitContextDelta(_input: CommitContextDeltaInput) {
      calls.push("commit");
      return {
        status: "accepted",
        delta: {
          deltaId: "delta-1",
          agentId: "main",
          eventRefs: ["event-1"],
          changeSummary: "delta",
          createdAt: "2026-03-24T00:00:00.000Z",
          syncIntent: "local_record",
        },
      } satisfies CommitContextDeltaResult;
    },
    async resolveCheckedSnapshot(_input: ResolveCheckedSnapshotInput) {
      calls.push("resolve");
      return {
        status: "resolved",
        found: true,
        snapshot: {
          snapshotId: "snapshot-1",
          agentId: "main",
          lineageRef: "lineage:main",
          branchRef: "refs/heads/cmp/main",
          commitRef: "cmp-commit-1",
          checkedAt: "2026-03-24T00:00:00.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
      } satisfies ResolveCheckedSnapshotResult;
    },
    async materializeContextPackage(_input: MaterializeContextPackageInput) {
      calls.push("materialize");
      return {
        status: "materialized",
        contextPackage: {
          packageId: "package-1",
          sourceProjectionId: "projection-1",
          targetAgentId: "child-1",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-1:child-1:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies MaterializeContextPackageResult;
    },
    async dispatchContextPackage(_input: DispatchContextPackageInput) {
      calls.push("dispatch");
      return {
        status: "dispatched",
        receipt: {
          dispatchId: "dispatch-1",
          packageId: "package-1",
          sourceAgentId: "main",
          targetAgentId: "child-1",
          status: "delivered",
          deliveredAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies DispatchContextPackageResult;
    },
    async requestHistoricalContext(_input: RequestHistoricalContextInput) {
      calls.push("history");
      return {
        status: "not_found",
        found: false,
      } satisfies RequestHistoricalContextResult;
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.session.open({
    config: {
      projectId: "proj-facade-2",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade-2",
        repoRootPath: "/tmp/praxis/proj-facade-2",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  await cmp.flow.ingest({
    session,
    payload: {
      agentId: "main",
      sessionId: "s1",
      lineage: {
        agentId: "main",
        projectId: "proj-facade-2",
        depth: 0,
        branchFamily: {
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        },
        status: "active",
      },
      taskSummary: "ingest",
      materials: [
        {
          kind: "user_input",
          ref: "ctx:1",
        },
      ],
    },
  });
  await cmp.flow.commit({
    session,
    payload: {
      agentId: "main",
      sessionId: "s1",
      eventIds: ["event-1"],
      changeSummary: "delta",
      syncIntent: "local_record",
    },
  });
  await cmp.flow.resolve({
    session,
    payload: {
      agentId: "main",
      projectId: "proj-facade-2",
    },
  });
  await cmp.flow.materialize({
    session,
    payload: {
      agentId: "main",
      snapshotId: "snapshot-1",
      targetAgentId: "child-1",
      packageKind: "child_seed",
    },
  });
  await cmp.flow.dispatch({
    session,
    payload: {
      agentId: "main",
      packageId: "package-1",
      sourceAgentId: "main",
      targetAgentId: "child-1",
      targetKind: "child",
    },
  });
  await cmp.flow.requestHistory({
    session,
    payload: {
      requesterAgentId: "main",
      projectId: "proj-facade-2",
      reason: "history",
      query: {},
    },
  });

  assert.deepEqual(calls, ["ingest", "commit", "resolve", "materialize", "dispatch", "history"]);
});

test("createRaxCmpFacade readback and smoke degrade when DB readback or lineage coverage is incomplete", async () => {
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade-3",
            repoId: "repo-3",
            repoName: "proj-facade-3",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade-3",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "already_exists" as const,
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          topology: {
            projectId: "proj-facade-3",
            databaseName: "cmp_proj_facade_3",
            schemaName: "cmp_proj_facade_3",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          status: "readback_incomplete" as const,
          expectedTargetCount: 3,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade-3",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade-3", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          {
            lineageId: "lineage-main",
            projectId: "proj-facade-3",
            agentId: "main",
            depth: 0,
            branchFamily: {
              agentId: "main",
              work: { kind: "work", agentId: "main", branchName: "work/main", fullRef: "refs/heads/work/main" },
              cmp: { kind: "cmp", agentId: "main", branchName: "cmp/main", fullRef: "refs/heads/cmp/main" },
              mp: { kind: "mp", agentId: "main", branchName: "mp/main", fullRef: "refs/heads/mp/main" },
              tap: { kind: "tap", agentId: "main", branchName: "tap/main", fullRef: "refs/heads/tap/main" },
            },
            childAgentIds: ["child-a"],
            status: "active",
          },
          {
            lineageId: "lineage-child-a",
            projectId: "proj-facade-3",
            agentId: "child-a",
            parentAgentId: "main",
            depth: 1,
            branchFamily: {
              agentId: "child-a",
              work: { kind: "work", agentId: "child-a", branchName: "work/child-a", fullRef: "refs/heads/work/child-a" },
              cmp: { kind: "cmp", agentId: "child-a", branchName: "cmp/child-a", fullRef: "refs/heads/cmp/child-a" },
              mp: { kind: "mp", agentId: "child-a", branchName: "mp/child-a", fullRef: "refs/heads/mp/child-a" },
              tap: { kind: "tap", agentId: "child-a", branchName: "tap/child-a", fullRef: "refs/heads/tap/child-a" },
            },
            childAgentIds: [],
            status: "active",
          },
        ],
        branchRuntimes: [],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpRuntimeInfraProjectState() {
      return {
        projectId: "proj-facade-3",
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        dbReceipt: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          status: "readback_incomplete" as const,
          expectedTargetCount: 3,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade-3",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade-3", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          createCmpLineageFixture("proj-facade-3", "main", ["child-a"]),
        ],
        branchRuntimes: [],
        updatedAt: "2026-03-25T00:00:00.000Z",
      } satisfies CmpRuntimeInfraProjectState;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
    async dispatchCmpFiveAgentCapability() {
      throw new Error("not used");
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.session.open({
    config: {
      projectId: "proj-facade-3",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade-3",
        repoRootPath: "/tmp/praxis/proj-facade-3",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  const readback = await cmp.project.readback({ session });
  const smoke = await cmp.project.smoke({ session });

  assert.equal(readback.status, "found");
  assert.equal(readback.summary?.status, "degraded");
  assert.deepEqual(readback.summary?.issues, [
    "CMP DB bootstrap readback is incomplete.",
    "CMP hydrated lineage coverage is incomplete.",
    "CMP git branch bootstrap coverage is incomplete.",
    "CMP mq bootstrap coverage is incomplete.",
  ]);
  assert.equal(readback.summary?.truthLayers.find((layer) => layer.layer === "git")?.status, "degraded");
  assert.equal(readback.summary?.truthLayers.find((layer) => layer.layer === "db")?.status, "degraded");
  assert.equal(readback.summary?.truthLayers.find((layer) => layer.layer === "redis")?.status, "degraded");
  assert.equal(readback.summary?.fallbacks.gitHistoryRebuild, "available");
  assert.equal(readback.summary?.statusPanel?.health.readbackStatus, "degraded");
  assert.equal(readback.summary?.statusPanel?.readiness.liveInfra, "degraded");
  assert.equal(readback.summary?.acceptance.liveLlm.status, "degraded");
  assert.equal(smoke.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.five_agent.live_llm")?.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.truth.git")?.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.db.readback")?.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.truth.redis")?.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.lineage.coverage")?.status, "degraded");
});

test("createRaxCmpFacade seeds default manual control surface and guided mode disables auto-return and auto-seed", () => {
  const cmp = createRaxCmpFacade();
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
  };

  const automatic = cmp.session.open({
    config: {
      projectId: "proj-control-auto",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-control-auto",
        repoRootPath: "/tmp/praxis/proj-control-auto",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });
  const guided = cmp.session.open({
    config: {
      projectId: "proj-control-guided",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-control-guided",
        repoRootPath: "/tmp/praxis/proj-control-guided",
        defaultBranchName: "main",
      },
    },
    control: {
      executionStyle: "guided",
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });
  const manual = cmp.session.open({
    config: {
      projectId: "proj-control-manual",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-control-manual",
        repoRootPath: "/tmp/praxis/proj-control-manual",
        defaultBranchName: "main",
      },
    },
    control: {
      executionStyle: "manual",
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  assert.equal(automatic.control.executionStyle, "automatic");
  assert.equal(automatic.control.automation.autoReturnToCoreAgent, true);
  assert.equal(automatic.control.automation.autoSeedChildren, true);
  assert.deepEqual(automatic.control.scope.lineage.projectIds, ["proj-control-auto"]);
  assert.deepEqual(automatic.control.scope.lineage.branchFamilies, ["cmp"]);

  assert.equal(guided.control.executionStyle, "guided");
  assert.equal(guided.control.automation.autoReturnToCoreAgent, false);
  assert.equal(guided.control.automation.autoSeedChildren, false);

  assert.equal(manual.control.executionStyle, "manual");
  assert.equal(manual.control.automation.autoDispatch, false);
  assert.equal(manual.control.automation.autoReturnToCoreAgent, false);
  assert.equal(manual.control.automation.autoSeedChildren, false);
});

test("createRaxCmpFacade dispatch enforces auto-return, auto-seed and manual-target overrides", async () => {
  const cmp = createRaxCmpFacade();
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage(_input: DispatchContextPackageInput) {
      return {
        status: "dispatched",
        receipt: {
          dispatchId: "dispatch-control",
          packageId: "package-control",
          sourceAgentId: "main",
          targetAgentId: "child-1",
          status: "delivered",
          deliveredAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies DispatchContextPackageResult;
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
  };

  const session = cmp.session.open({
    config: {
      projectId: "proj-control-dispatch",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-control-dispatch",
        repoRootPath: "/tmp/praxis/proj-control-dispatch",
        defaultBranchName: "main",
      },
    },
    control: {
      executionStyle: "guided",
      scope: {
        dispatch: "manual_targets",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  await assert.rejects(
    () => cmp.flow.dispatch({
      session,
      payload: {
        agentId: "main",
        packageId: "package-control",
        sourceAgentId: "main",
        targetAgentId: "child-1",
        targetKind: "child",
      },
    }),
    /manual override|auto-seed|manual_targets/i,
  );

  const manualDispatch = await cmp.flow.dispatch({
    session,
    control: {
      executionStyle: "manual",
      metadata: {
        manualOverride: true,
      },
    },
    payload: {
      agentId: "main",
      packageId: "package-control",
      sourceAgentId: "main",
      targetAgentId: "child-1",
      targetKind: "child",
      metadata: {
        manualOverride: true,
      },
    },
  });
  assert.equal(manualDispatch.status, "dispatched");

  await assert.rejects(
    () => cmp.flow.dispatch({
      session,
      payload: {
        agentId: "main",
        packageId: "package-return",
        sourceAgentId: "main",
        targetAgentId: "core-main",
        targetKind: "core_agent",
      },
    }),
    /manual override|auto-return|manual_targets/i,
  );
});

test("createRaxCmpFacade requestHistory respects strict_not_found fallback policy", async () => {
  const cmp = createRaxCmpFacade();
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      return {
        status: "materialized",
        found: true,
        contextPackage: {
          packageId: "pkg-history",
          sourceProjectionId: "projection-history",
          targetAgentId: "main",
          packageKind: "historical_reply",
          packageRef: "cmp-package:history",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-25T00:00:00.000Z",
        },
        metadata: {
          degraded: true,
          truthSource: "git_checked",
        },
      } satisfies RequestHistoricalContextResult;
    },
  };

  const session = cmp.session.open({
    config: {
      projectId: "proj-history-strict",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-history-strict",
        repoRootPath: "/tmp/praxis/proj-history-strict",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
    control: {
      truth: {
        fallbackPolicy: "strict_not_found",
      },
    },
  });

  const result = await cmp.flow.requestHistory({
    session,
    payload: {
      requesterAgentId: "main",
      projectId: "proj-history-strict",
      reason: "Need history",
      query: {},
    },
  });

  assert.equal(result.status, "not_found");
  assert.equal(result.found, false);
  assert.equal(result.metadata?.blockedByFallbackPolicy, "strict_not_found");
});

test("createRaxCmpFacade can forward explicit peer approval to runtime", async () => {
  const cmp = createRaxCmpFacade();
  const calls: Array<Record<string, unknown>> = [];
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
    reviewCmpPeerExchangeApproval(input: Record<string, unknown>) {
      calls.push(input);
      return {
        approvalId: String(input.approvalId),
        parentAgentId: "parent-a",
        sourceAgentId: "child-a",
        targetAgentId: "child-b",
        packageId: "pkg-peer-1",
        createdAt: "2026-03-28T00:00:00.000Z",
        mode: "explicit_once" as const,
        status: "approved" as const,
        approvalChain: "parent_dbagent_then_parent_core_agent" as const,
        approvedAt: "2026-03-28T00:00:01.000Z",
        approvedByAgentId: input.actorAgentId as string,
      };
    },
  };

  const session = cmp.session.open({
    config: {
      projectId: "proj-peer-approval",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-peer-approval",
        repoRootPath: "/tmp/praxis/proj-peer-approval",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  const approval = await cmp.roles.approvePeerExchange({
    session,
    approvalId: "approval-1",
    actorAgentId: "parent-a",
    decision: "approved",
    note: "allow sibling exchange once",
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    approvalId: "approval-1",
    actorAgentId: "parent-a",
    decision: "approved",
    note: "allow sibling exchange once",
  });
  assert.equal(approval.status, "approved");
  assert.equal(approval.approvedByAgentId, "parent-a");
});

test("createRaxCmpFacade can resolve five-agent TAP capability access through runtime", async () => {
  const cmp = createRaxCmpFacade();
  const calls: Record<string, unknown>[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
    resolveCmpFiveAgentCapabilityAccess(input: Record<string, unknown>) {
      calls.push(input);
      return {
        role: "iterator" as const,
        profile: {
          profileId: "cmp-five-agent/iterator-tap-profile/v1",
          agentClass: "cmp-five-agent.iterator",
          defaultMode: "restricted" as const,
          canonicalDefaultMode: "standard" as const,
          baselineTier: "B2" as const,
          baselineCapabilities: ["docs.read", "code.read", "cmp.git.read"],
          allowedCapabilityPatterns: ["cmp.git.write", "cmp.git.review_ref.*", "cmp.db.read"],
          deniedCapabilityPatterns: ["cmp.db.write*", "cmp.mq.*"],
        },
        resolution: {
          status: "review_required" as const,
          request: {
            requestId: "cmp-access-request-1",
            sessionId: String(input.sessionId),
            runId: String(input.runId),
            agentId: String(input.agentId),
            requestedCapabilityKey: String(input.capabilityKey),
            requestedTier: "B1" as const,
            reason: String(input.reason),
            mode: "restricted" as const,
            canonicalMode: "standard" as const,
            createdAt: "2026-03-28T00:00:00.000Z",
          },
        },
      } satisfies CmpFiveAgentCapabilityAccessResolution;
    },
  };

  const session = cmp.session.open({
    config: {
      projectId: "proj-role-capability",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-role-capability",
        repoRootPath: "/tmp/praxis/proj-role-capability",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  const result = await cmp.roles.resolveCapabilityAccess({
    session,
    role: "iterator",
    payload: {
      agentId: "iterator-agent",
      capabilityKey: "cmp.git.write",
      reason: "iterator wants to advance candidate commit",
      metadata: {
        runId: "run-role-capability",
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    role: "iterator",
    sessionId: session.sessionId,
    runId: "run-role-capability",
    agentId: "iterator-agent",
    capabilityKey: "cmp.git.write",
    reason: "iterator wants to advance candidate commit",
    requestedTier: undefined,
    mode: undefined,
    taskContext: undefined,
    requestedScope: undefined,
    requestedDurationMs: undefined,
    metadata: {
      runId: "run-role-capability",
    },
  });
  assert.equal(result.profile.profileId, "cmp-five-agent/iterator-tap-profile/v1");
  assert.equal(result.resolution.status, "review_required");
});

test("createRaxCmpFacade can dispatch five-agent TAP capability through runtime bridge", async () => {
  const cmp = createRaxCmpFacade();
  const calls: Record<string, unknown>[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    recoverCmpRuntimeSnapshot() {},
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
    async dispatchCmpFiveAgentCapability(input: Record<string, unknown>) {
      calls.push(input);
      return {
        role: "dispatcher" as const,
        profile: {
          profileId: "cmp-five-agent/dispatcher-tap-profile/v1",
          agentClass: "cmp-five-agent.dispatcher",
          defaultMode: "balanced" as const,
          canonicalDefaultMode: "standard" as const,
          baselineTier: "B1" as const,
          baselineCapabilities: [],
          allowedCapabilityPatterns: [],
          deniedCapabilityPatterns: [],
        },
        intent: {
          intentId: "intent-dispatch-role-capability",
          sessionId: "session-dispatch-role-capability",
          runId: "run-dispatch-role-capability",
          kind: "capability_call" as const,
          createdAt: "2026-03-30T00:00:00.000Z",
          priority: "high" as const,
          request: {
            requestId: "request-dispatch-role-capability",
            intentId: "intent-dispatch-role-capability",
            sessionId: "session-dispatch-role-capability",
            runId: "run-dispatch-role-capability",
            capabilityKey: "cmp.mq.publish.delivery",
            input: {
              packageId: "pkg-1",
            },
            priority: "high" as const,
          },
        },
        bridgeMetadata: {
          cmpRole: "dispatcher",
        },
        dispatch: {
          status: "review_required" as const,
        },
      } satisfies DispatchCmpFiveAgentCapabilityResult;
    },
  };
  const session = cmp.session.open({
    config: {
      projectId: "proj-dispatch-role-capability",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-dispatch-role-capability",
        repoRootPath: "/tmp/praxis/proj-dispatch-role-capability",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
  });

  const result = await cmp.roles.dispatchCapability({
    session,
    role: "dispatcher",
    payload: {
      agentId: "dispatcher-agent",
      capabilityKey: "cmp.mq.publish.delivery",
      reason: "dispatcher wants to publish child seed delivery",
      capabilityInput: {
        packageId: "pkg-1",
      },
      metadata: {
        runId: "run-dispatch-role-capability",
      },
      cmpContext: {
        requestId: "request-1",
        packageId: "pkg-1",
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    role: "dispatcher",
    sessionId: session.sessionId,
    runId: "run-dispatch-role-capability",
    agentId: "dispatcher-agent",
    capabilityKey: "cmp.mq.publish.delivery",
    reason: "dispatcher wants to publish child seed delivery",
    capabilityInput: {
      packageId: "pkg-1",
    },
    priority: undefined,
    timeoutMs: undefined,
    requestedTier: undefined,
    mode: undefined,
    taskContext: undefined,
    requestedScope: undefined,
    requestedDurationMs: undefined,
    cmpContext: {
      requestId: "request-1",
      packageId: "pkg-1",
    },
    metadata: {
      runId: "run-dispatch-role-capability",
    },
  });
  assert.equal(result.profile.profileId, "cmp-five-agent/dispatcher-tap-profile/v1");
  assert.equal(result.dispatch.status, "review_required");
});

test("createRaxCmpFacade recover respects dry_run recovery preference", async () => {
  const cmp = createRaxCmpFacade();
  let recovered = false;
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    getCmpRuntimeRecoverySummary() {
      return {
        totalProjects: 0,
        alignedProjectIds: [],
        degradedProjectIds: [],
        snapshotOnlyProjectIds: [],
        infraOnlyProjectIds: [],
        recommendedHydrateFromSnapshot: [],
        recommendedHydrateFromInfra: [],
        recommendedReconcile: [],
      };
    },
    async recoverCmpRuntimeSnapshot() {
      recovered = true;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
  };

  const session = cmp.session.open({
    config: {
      projectId: "proj-recover-dry-run",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-recover-dry-run",
        repoRootPath: "/tmp/praxis/proj-recover-dry-run",
        defaultBranchName: "main",
      },
    },
    runtime: adaptLegacyCmpRuntimeStub(runtime),
    control: {
      truth: {
        recoveryPreference: "dry_run",
      },
    },
  });

  const result = await cmp.project.recover({
    session,
    snapshot: {
      projectRepos: [],
      lineages: [],
      events: [],
      deltas: [],
      activeLines: [],
      snapshotCandidates: [],
      checkedSnapshots: [],
      requests: [],
      sectionRecords: [],
      snapshotRecords: [],
      promotedProjections: [],
      packageRecords: [],
      contextPackages: [],
      dispatchReceipts: [],
      syncEvents: [],
      infraState: { projects: [] },
    },
  });

  assert.equal(recovered, false);
  assert.equal(result.recovery?.dryRun, true);
  assert.equal(result.recovery?.appliedPreference, "dry_run");
});
