import assert from "node:assert/strict";
import test from "node:test";

import type { RaxFacade } from "../../rax/facade.js";
import { createMpMemoryRecord } from "../index.js";
import {
  createRaxMpCapabilityPackage,
  RAX_MP_ACTIVATION_FACTORY_REFS,
} from "../capability-package/index.js";
import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import {
  createActivationFactoryResolver,
  materializeActivationRegistration,
} from "../ta-pool-runtime/index.js";
import {
  createRaxMpActivationFactory,
  createRaxMpCapabilityAdapter,
  registerRaxMpCapabilityFamily,
} from "./rax-mp-adapter.js";

const facade: Pick<RaxFacade, "mp"> = {
  mp: {
    create() {
      return {
        sessionId: "mp-session-1",
        projectId: "project.praxis",
        createdAt: "2026-04-08T00:00:00.000Z",
        config: {
          projectId: "project.praxis",
          profileId: "mp.default",
          defaultAgentId: "main",
          mode: "balanced" as const,
          lance: {
            kind: "lancedb" as const,
            rootPath: "/tmp/praxis/mp/project.praxis",
            schemaVersion: 1,
            liveExecutionPreferred: false,
          },
          searchDefaults: {
            limit: 10,
            scopeLevels: ["agent_isolated", "project", "global"],
            preferSameAgent: true,
          },
          workflow: {
            enabled: true,
            roleModes: {
              icma: "llm_assisted" as const,
              iterator: "llm_assisted" as const,
              checker: "llm_assisted" as const,
              dbagent: "llm_assisted" as const,
              dispatcher: "llm_assisted" as const,
            },
            freshnessPolicy: {
              preferFresh: true,
              allowStaleFallback: true,
            },
            alignmentPolicy: {
              autoSupersede: true,
              markOlderAsStale: true,
            },
            retrievalPolicy: {
              primaryBundleLimit: 3,
              supportingBundleLimit: 5,
              omitSupersededFromPrimary: true,
            },
          },
        },
        runtime: {} as never,
      };
    },
    async bootstrap(input) {
      return {
        status: "bootstrapped",
        session: input.session,
        receipt: {
          projectId: "project.praxis",
        } as never,
      };
    },
    async search() {
      return {
        projectId: "project.praxis",
        queryText: "history",
        hits: [{
          memoryId: "memory-1",
          tableName: "mp_project_project_praxis_memories",
          score: 1,
          record: createMpMemoryRecord({
            memoryId: "memory-1",
            projectId: "project.praxis",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
            lineagePath: ["main"],
            payloadRefs: ["payload-1"],
            tags: ["history"],
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-08T00:00:01.000Z",
          }),
        }],
      };
    },
    async readback() {
      return {
        status: "found" as const,
        summary: {
          projectId: "project.praxis",
        },
      } as never;
    },
    async smoke() {
      return {
        status: "ready" as const,
        checks: [],
      };
    },
    async ingest() {
      return {
        status: "ingested" as const,
        records: [],
        supersededMemoryIds: [],
        staleMemoryIds: [],
        summary: {} as never,
      };
    },
    async align() {
      return {
        status: "aligned" as const,
        primary: createMpMemoryRecord({
          memoryId: "memory-1",
          projectId: "project.praxis",
          agentId: "main",
          scopeLevel: "project",
          sessionMode: "shared",
          visibilityState: "project_shared",
          promotionState: "promoted_to_project",
          lineagePath: ["main"],
          payloadRefs: ["payload-1"],
          tags: ["history"],
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:01.000Z",
        }),
        updatedRecords: [],
        supersededMemoryIds: [],
        staleMemoryIds: [],
        summary: {} as never,
      };
    },
    async resolve() {
      return {
        status: "resolved" as const,
        bundle: {
          scope: {
            projectId: "project.praxis",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
          },
          primary: [],
          supporting: [],
          diagnostics: {
            omittedSupersededMemoryIds: [],
            rerankComposition: {
              fresh: 0,
              aging: 0,
              stale: 0,
              superseded: 0,
              aligned: 0,
              unreviewed: 0,
              drifted: 0,
            },
          },
        },
        summary: {} as never,
      };
    },
    async requestHistory() {
      return {
        status: "history_returned" as const,
        bundle: {
          scope: {
            projectId: "project.praxis",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
          },
          primary: [],
          supporting: [],
          diagnostics: {
            omittedSupersededMemoryIds: [],
            rerankComposition: {
              fresh: 0,
              aging: 0,
              stale: 0,
              superseded: 0,
              aligned: 0,
              unreviewed: 0,
              drifted: 0,
            },
          },
        },
        summary: {} as never,
      };
    },
    async materialize() {
      return [createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "project_shared",
        promotionState: "promoted_to_project",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      })];
    },
    async materializeBatch() {
      return [createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "project_shared",
        promotionState: "promoted_to_project",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      })];
    },
    async promote() {
      return createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "project_shared",
        promotionState: "promoted_to_project",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      });
    },
    async archive() {
      return createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "archived",
        promotionState: "archived",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      });
    },
    async split() {
      return {
        status: "split" as const,
        records: [createMpMemoryRecord({
          memoryId: "memory-1",
          projectId: "project.praxis",
          agentId: "main",
          scopeLevel: "project",
          sessionMode: "shared",
          visibilityState: "project_shared",
          promotionState: "promoted_to_project",
          lineagePath: ["main"],
          payloadRefs: ["payload-1"],
          tags: ["history"],
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:01.000Z",
        })],
      };
    },
    async merge() {
      return {
        status: "merged" as const,
        record: createMpMemoryRecord({
          memoryId: "memory-1",
          projectId: "project.praxis",
          agentId: "main",
          scopeLevel: "project",
          sessionMode: "shared",
          visibilityState: "project_shared",
          promotionState: "promoted_to_project",
          lineagePath: ["main"],
          payloadRefs: ["payload-1"],
          tags: ["history"],
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:01.000Z",
        }),
        bundle: {
          bundleId: "bundle-1",
          projectId: "project.praxis",
          agentId: "main",
          scope: {
            projectId: "project.praxis",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
          },
          memberMemoryIds: ["memory-1"],
          semanticGroupId: "bundle-1",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:01.000Z",
        },
      } as never;
    },
    async reindex() {
      return createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "project_shared",
        promotionState: "promoted_to_project",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      }) as never;
    },
    async compact() {
      return [createMpMemoryRecord({
        memoryId: "memory-1",
        projectId: "project.praxis",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
        visibilityState: "archived",
        promotionState: "archived",
        lineagePath: ["main"],
        payloadRefs: ["payload-1"],
        tags: ["history"],
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:01.000Z",
      })] as never;
    },
  },
};

test("rax mp adapter supports mp.search and executes via the facade", async () => {
  const adapter = createRaxMpCapabilityAdapter(facade);
  const plan = createCapabilityInvocationPlan({
    intentId: "intent_001",
    sessionId: "session_001",
    runId: "run_001",
    capabilityKey: "mp.search",
    input: {
      projectId: "project.praxis",
      rootPath: "/tmp/praxis/mp/project.praxis",
      agentIds: ["main"],
      queryText: "history",
      requesterLineage: {
        projectId: "project.praxis",
        agentId: "main",
        depth: 0,
      },
      sourceLineages: [
        {
          projectId: "project.praxis",
          agentId: "main",
          depth: 0,
        },
      ],
    },
    priority: "normal",
  });
  const lease = createCapabilityLease({
    capabilityId: "capability:mp.search:1",
    bindingId: "binding:mp.search",
    generation: 1,
    plan,
  }, {
    idFactory: () => "lease_001",
    clock: { now: () => new Date("2026-04-08T00:00:00.000Z") },
  });

  assert.equal(adapter.supports(plan), true);
  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { hits: unknown[] }).hits.length, 1);
});

test("rax mp activation factory materializes a package-backed adapter", async () => {
  const capabilityPackage = createRaxMpCapabilityPackage({
    capabilityKey: "mp.archive",
  });
  const resolver = createActivationFactoryResolver();
  resolver.register(
    RAX_MP_ACTIVATION_FACTORY_REFS["mp.archive"],
    createRaxMpActivationFactory({ facade }),
  );

  const materialized = await materializeActivationRegistration({
    capabilityPackage,
    factoryResolver: resolver,
    capabilityIdPrefix: "capability",
  });

  assert.equal(materialized.manifest.capabilityKey, "mp.archive");
  assert.equal(materialized.adapter.runtimeKind, "rax-mp");
});

test("registerRaxMpCapabilityFamily registers package-backed adapters and activation factories", () => {
  const activationFactories = new Map<string, unknown>();
  const capabilityKeys: string[] = [];
  const registration = registerRaxMpCapabilityFamily({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        capabilityKeys.push(manifest.capabilityKey);
        return {
          bindingId: `binding:${manifest.capabilityKey}`,
          adapterId: adapter.id,
        };
      },
      registerTaActivationFactory(ref, factory) {
        activationFactories.set(ref, factory);
      },
    },
    facade,
  });

  assert.deepEqual(registration.capabilityKeys, [
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
  assert.equal(registration.bindings.length, 12);
  assert.equal(registration.activationFactoryRefs.length, 12);
  assert.deepEqual(capabilityKeys, registration.capabilityKeys);
});
