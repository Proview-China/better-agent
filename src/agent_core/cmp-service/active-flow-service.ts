import { randomUUID } from "node:crypto";
import type {
  CmpIcmaEmitInput,
  CmpIcmaRecord,
  CmpIcmaRuntimeResult,
  CmpIcmaIngestInput,
} from "../cmp-five-agent/index.js";
import type { AgentCoreCmpWorkflowApi } from "../cmp-api/index.js";
import {
  createCmpIngressRecord,
  createCmpSectionIngressRecordFromIngress,
  lowerCmpSectionIngressRecordWithRulePack,
  type CmpIngressRecord,
} from "../cmp-runtime/index.js";
import {
  createAgentLineage,
  createCmpRequestRecordFromIngest,
  createCmpSectionRecord,
  createCmpSectionRecordFromSection,
  createCmpSectionRecordFromStoredSection,
  createContextEvent,
  createIngestRuntimeContextInput,
  createIngestRuntimeContextResult,
  createResolveCheckedSnapshotInput,
  type AgentLineage,
  type CheckedSnapshot,
  type CmpRequestRecord,
  type CmpRulePack,
  type CmpSectionRecord,
  type CommitContextDeltaInput,
  type CommitContextDeltaResult,
  type ContextEvent,
  type IngestRuntimeContextInput,
  type IngestRuntimeContextResult,
  type ResolveCheckedSnapshotInput,
  type ResolveCheckedSnapshotResult,
} from "../cmp-types/index.js";

export interface AgentCoreCmpActiveFlowServiceDeps {
  commitContextDelta(
    input: CommitContextDeltaInput,
  ): Promise<CommitContextDeltaResult> | CommitContextDeltaResult;
  ensureProjectRepo(lineage: AgentLineage): void;
  setLineage(lineage: AgentLineage): void;
  createSectionRulePack(): CmpRulePack;
  captureIcma(input: CmpIcmaIngestInput): CmpIcmaRuntimeResult;
  emitIcma(input: CmpIcmaEmitInput): CmpIcmaRecord;
  storeIngressRecord(record: CmpIngressRecord): void;
  storeRequestRecord(record: CmpRequestRecord): void;
  storeSectionRecord(record: CmpSectionRecord): void;
  storeEvent(event: ContextEvent): void;
  listCheckedSnapshots(): readonly CheckedSnapshot[];
  toEventKind(
    kind: IngestRuntimeContextInput["materials"][number]["kind"],
  ): ContextEvent["kind"];
  recordNeighborhoodSyncs(input: {
    ingress: CmpIngressRecord;
    lineage: AgentLineage;
    payloadRef: string;
    granularityLabel: string;
  }): void;
}

export function createAgentCoreCmpActiveFlowService(
  deps: AgentCoreCmpActiveFlowServiceDeps,
): Pick<AgentCoreCmpWorkflowApi, "ingest" | "commit" | "resolve"> {
  return {
    ingest(input): IngestRuntimeContextResult {
      const normalized = createIngestRuntimeContextInput(input);
      const lineage = createAgentLineage(normalized.lineage);
      deps.setLineage(lineage);
      deps.ensureProjectRepo(lineage);

      const createdAt = new Date().toISOString();
      const ingestRequestId = `${lineage.agentId}:ingest:${createdAt}`;
      const enrichedIngest: IngestRuntimeContextInput = {
        ...normalized,
        metadata: {
          ...(normalized.metadata ?? {}),
          cmpRequestId: ingestRequestId,
        },
      };
      const icmaCapture = deps.captureIcma({
        ingest: enrichedIngest,
        createdAt,
        loopId: randomUUID(),
      });
      const sectionIngress = createCmpSectionIngressRecordFromIngress({
        ingest: enrichedIngest,
        ingressId: randomUUID(),
        createdAt,
        metadata: {
          source: "cmp-runtime-section-first-ingress",
        },
      });
      const sectionLowering = lowerCmpSectionIngressRecordWithRulePack({
        record: sectionIngress,
        pack: deps.createSectionRulePack(),
        plane: "git",
        persistedAt: createdAt,
        metadata: {
          source: "cmp-runtime-section-first-lowering",
        },
      });
      const ingress = createCmpIngressRecord(sectionIngress.ingress);
      deps.storeIngressRecord(ingress);
      deps.storeRequestRecord(createCmpRequestRecordFromIngest({
        requestId: ingestRequestId,
        ingest: enrichedIngest,
        createdAt,
        metadata: {
          ingressId: ingress.ingressId,
          source: "cmp-runtime-object-model-ingest",
        },
      }));
      const rawSectionRecordIdsBySectionId = new Map<string, string>();
      const preSectionRecordIdsBySectionId = new Map<string, string>();
      for (const section of sectionIngress.sections) {
        const rawRecordId = `${section.id}:raw`;
        const preRecordId = `${section.id}:pre`;
        rawSectionRecordIdsBySectionId.set(section.id, rawRecordId);
        preSectionRecordIdsBySectionId.set(section.id, preRecordId);
        deps.storeSectionRecord(createCmpSectionRecordFromSection({
          section,
          lifecycle: "raw",
          version: 1,
          sourceAnchors: section.payloadRefs,
          metadata: {
            source: "cmp-runtime-object-model-ingest",
            ingressId: ingress.ingressId,
          },
        }));
        deps.storeSectionRecord(createCmpSectionRecord({
          ...createCmpSectionRecordFromSection({
            section,
            lifecycle: "pre",
            version: 2,
            parentSectionId: rawRecordId,
            ancestorSectionIds: [rawRecordId],
            sourceAnchors: section.payloadRefs,
          }),
          sectionId: preRecordId,
          metadata: {
            source: "cmp-runtime-object-model-ingest",
            ingressId: ingress.ingressId,
            cmpIcmaRecordId: icmaCapture.loop.loopId,
            cmpIntentChunkIds: icmaCapture.loop.chunkIds,
            cmpFragmentIds: icmaCapture.loop.fragmentIds,
          },
        }));
      }

      for (const loweredRecord of sectionLowering.lowered) {
        if (!loweredRecord.storedSection) {
          continue;
        }
        const preRecordId = preSectionRecordIdsBySectionId.get(loweredRecord.section.id);
        deps.storeSectionRecord(createCmpSectionRecordFromStoredSection({
          storedSection: loweredRecord.storedSection,
          sourceSection: loweredRecord.section,
          lifecycle: "persisted",
          version: 3,
          parentSectionId: preRecordId,
          ancestorSectionIds: preRecordId ? [preRecordId] : [],
          metadata: {
            source: "cmp-runtime-object-model-ingest",
            ingressId: ingress.ingressId,
            ruleEvaluation: loweredRecord.evaluation,
          },
        }));
      }

      const acceptedEvents: ContextEvent[] = normalized.materials.map((material) => {
        const loweredSection = sectionLowering.lowered.find((record) =>
          record.section.payloadRefs.includes(material.ref)
        );
        const event = createContextEvent({
          eventId: randomUUID(),
          agentId: lineage.agentId,
          sessionId: normalized.sessionId,
          runId: normalized.runId,
          kind: deps.toEventKind(material.kind),
          payloadRef: material.ref,
          createdAt,
          source: "core_agent",
          metadata: {
            ingressId: ingress.ingressId,
            materialKind: material.kind,
            cmpIcmaRecordId: icmaCapture.loop.loopId,
            cmpIcmaChunkIds: icmaCapture.loop.chunkIds,
            cmpIcmaFragmentIds: icmaCapture.loop.fragmentIds,
            cmpSectionId: loweredSection?.section.id,
            cmpRawSectionRecordId: loweredSection?.section.id
              ? rawSectionRecordIdsBySectionId.get(loweredSection.section.id)
              : undefined,
            cmpPreSectionRecordId: loweredSection?.section.id
              ? preSectionRecordIdsBySectionId.get(loweredSection.section.id)
              : undefined,
            cmpStoredSectionId: loweredSection?.storedSection?.id,
            cmpStoredSections: loweredSection?.storedSection ? [loweredSection.storedSection] : [],
            cmpSectionRuleEvaluation: loweredSection?.evaluation,
            ...(material.metadata ?? {}),
          },
        });
        deps.storeEvent(event);
        return event;
      });
      const emittedIcma = deps.emitIcma({
        recordId: icmaCapture.loop.loopId,
        eventIds: acceptedEvents.map((event) => event.eventId),
        emittedAt: createdAt,
      });

      deps.recordNeighborhoodSyncs({
        ingress,
        lineage,
        payloadRef: normalized.materials[0]?.ref ?? `cmp-ingress:${ingress.ingressId}`,
        granularityLabel: normalized.taskSummary,
      });

      return createIngestRuntimeContextResult({
        status: "accepted",
        acceptedEventIds: acceptedEvents.map((event) => event.eventId),
        nextAction: normalized.requiresActiveSync === false ? "noop" : "commit_context_delta",
        metadata: {
          ingressId: ingress.ingressId,
          cmpFiveAgent: {
            icmaRecordId: emittedIcma.loopId,
            chunkIds: emittedIcma.chunkIds,
            fragmentIds: emittedIcma.fragmentIds,
          },
          sectionIds: sectionIngress.sections.map((section) => section.id),
          storedSectionIds: sectionLowering.storedSections.map((section) => section.id),
          droppedSectionIds: sectionLowering.droppedSectionIds,
        },
      });
    },
    commit(input) {
      return deps.commitContextDelta(input);
    },
    resolve(input): ResolveCheckedSnapshotResult {
      const normalized = createResolveCheckedSnapshotInput(input);
      const snapshot = deps.listCheckedSnapshots()
        .filter((candidate) => {
          const projectId = candidate.metadata?.projectId;
          if (projectId !== normalized.projectId) {
            return false;
          }
          if (candidate.agentId !== normalized.agentId) {
            return false;
          }
          if (normalized.lineageRef && candidate.lineageRef !== normalized.lineageRef) {
            return false;
          }
          if (normalized.branchRef && candidate.branchRef !== normalized.branchRef) {
            return false;
          }
          return true;
        })
        .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];

      if (!snapshot) {
        return {
          status: "not_found",
          found: false,
        };
      }

      return {
        status: "resolved",
        found: true,
        snapshot,
      };
    },
  };
}
