import { getCmpRoleConfiguration } from "./configuration.js";
import {
  attachCmpRoleLiveAudit,
  executeCmpRoleLiveLlmStep,
  toCmpRoleLiveAuditFromTrace,
} from "./live-llm.js";
import {
  createCmpFiveAgentLoopRecord,
  createCmpPeerExchangeApprovalRecord,
  createCmpRoleCheckpointRecord,
} from "./shared.js";
import type {
  CmpDispatcherBundleEnvelope,
  CmpDispatcherDispatchInput,
  CmpDispatcherPassiveReturnInput,
  CmpDispatcherRecord,
  CmpDispatcherRuntimeSnapshot,
  CmpPeerExchangeApprovalRecord,
  CmpRoleConfiguration,
  CmpRoleCheckpointRecord,
  CmpRoleLiveLlmExecutor,
  CmpRoleLiveLlmMode,
} from "./types.js";

type CmpDispatcherLiveOutput = {
  routeRationale?: string;
  bodyStrategy?: CmpDispatcherBundleEnvelope["body"]["bodyStrategy"];
  slimExchangeFields?: string[];
  scopePolicy?: string;
};

function createDispatcherActivePromptText(input: {
  packageMode: CmpDispatcherRecord["packageMode"];
  targetKind: CmpDispatcherRecord["targetKind"];
  targetIngress: CmpDispatcherBundleEnvelope["target"]["targetIngress"];
  packageKind: CmpDispatcherBundleEnvelope["body"]["packageKind"];
  packageId: string;
  targetAgentId: string;
  sourceRequestId?: string;
  sourceSnapshotId?: string;
}): string {
  return [
    "Dispatcher active routing decision.",
    "Return strict JSON only.",
    "Return one minified JSON object only. No markdown fences. No explanation outside JSON.",
    "Use exactly this schema:",
    '{"routeRationale":"one short sentence","bodyStrategy":"child_seed_full|peer_exchange_slim|historical_return","scopePolicy":"policy id","slimExchangeFields":["packageId","packageKind","primaryRef"]}',
    "Rules:",
    "- child_icma_only -> bodyStrategy must be child_seed_full and scopePolicy must be child_seed_only_enters_child_icma",
    "- peer_exchange -> bodyStrategy must be peer_exchange_slim and scopePolicy must mention explicit parent approval",
    "- core_agent_return -> bodyStrategy must be historical_return and scopePolicy must be historical_reply_returns_via_core_path",
    "- Only include slimExchangeFields for peer_exchange_slim",
    "- Keep routeRationale to one short sentence",
    "Input:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

function createDispatcherPassivePromptText(input: {
  packageMode: CmpDispatcherRecord["packageMode"];
  targetIngress: CmpDispatcherBundleEnvelope["target"]["targetIngress"];
  packageKind: CmpDispatcherBundleEnvelope["body"]["packageKind"];
  packageId: string;
  targetAgentId: string;
  sourceRequestId?: string;
}): string {
  return [
    "Dispatcher passive return decision.",
    "Return strict JSON only.",
    "Return one minified JSON object only. No markdown fences. No explanation outside JSON.",
    "Use exactly this schema:",
    '{"routeRationale":"one short sentence","bodyStrategy":"historical_return","scopePolicy":"historical_reply_returns_via_core_path"}',
    "Rules:",
    "- passive historical replies return only via core_agent_return",
    "- bodyStrategy must be historical_return",
    "- scopePolicy must be historical_reply_returns_via_core_path",
    "- Keep routeRationale to one short sentence",
    "Input:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function inferPackageMode(input: CmpDispatcherDispatchInput): CmpDispatcherRecord["packageMode"] {
  if (input.dispatch.targetKind === "core_agent") {
    return "core_return";
  }
  if (input.dispatch.targetKind === "child") {
    return "child_seed_via_icma";
  }
  if (input.dispatch.targetKind === "peer") {
    return "peer_exchange_slim";
  }
  return "lineage_delivery";
}

function createRoutePolicyMetadata(input: {
  targetKind: CmpDispatcherDispatchInput["dispatch"]["targetKind"] | "core_agent_return";
  packageMode: CmpDispatcherRecord["packageMode"];
  peerApproval?: CmpPeerExchangeApprovalRecord;
}): Record<string, unknown> {
  if (input.targetKind === "child") {
    return {
      routePolicy: {
        targetKind: input.targetKind,
        packageMode: input.packageMode,
        targetIngress: "child_icma_only",
        childSeedPolicy: {
          enforced: true,
          requiredIngress: "child_icma_only",
        },
      },
    };
  }

  if (input.targetKind === "peer" && input.peerApproval) {
    return {
      routePolicy: {
        targetKind: input.targetKind,
        packageMode: input.packageMode,
        targetIngress: "peer_exchange",
        peerApprovalRequired: true,
        approvalId: input.peerApproval.approvalId,
        approvalStatus: input.peerApproval.status,
        approvalChain: input.peerApproval.approvalChain,
      },
    };
  }

  if (input.targetKind === "core_agent" || input.targetKind === "core_agent_return") {
    return {
      routePolicy: {
        targetKind: "core_agent",
        packageMode: input.packageMode,
        targetIngress: "core_agent_return",
      },
    };
  }

  return {
    routePolicy: {
      targetKind: input.targetKind,
      packageMode: input.packageMode,
      targetIngress: "lineage_delivery",
    },
  };
}

function createPackageDisciplineMetadata(input: {
  packageMode: CmpDispatcherRecord["packageMode"];
  contextPackage: CmpDispatcherDispatchInput["contextPackage"] | CmpDispatcherPassiveReturnInput["contextPackage"];
}): Record<string, unknown> {
  const metadata = input.contextPackage.metadata ?? {};

  switch (input.packageMode) {
    case "child_seed_via_icma":
      return {
        packageDiscipline: {
          packageMode: input.packageMode,
          payloadClass: "child_seed_bundle",
          includeGuideRef: isString(metadata.cmpGuideRef),
          includeBackgroundRef: isString(metadata.cmpBackgroundRef),
          includeTimelineRef: false,
          includeTaskSnapshots: false,
          mustEnter: "child_icma_only",
        },
      };
    case "peer_exchange_slim":
      return {
        packageDiscipline: {
          packageMode: input.packageMode,
          payloadClass: "peer_slim_exchange_bundle",
          includeGuideRef: false,
          includeBackgroundRef: false,
          includeTimelineRef: false,
          includeTaskSnapshots: false,
          allowedFields: ["packageId", "packageKind", "primaryRef"],
        },
      };
    case "historical_reply_return":
      return {
        packageDiscipline: {
          packageMode: input.packageMode,
          payloadClass: "historical_return_bundle",
          includeGuideRef: false,
          includeBackgroundRef: false,
          includeTimelineRef: isString(metadata.cmpTimelinePackageId),
          includeTaskSnapshots: Array.isArray(metadata.cmpTaskSnapshotIds) && metadata.cmpTaskSnapshotIds.length > 0,
          mustReturnVia: "core_agent_return",
        },
      };
    default:
      return {
        packageDiscipline: {
          packageMode: input.packageMode,
          payloadClass: "lineage_delivery_bundle",
        },
      };
  }
}

function createBundleEnvelope(input: {
  contextPackage: CmpDispatcherDispatchInput["contextPackage"];
  dispatch: CmpDispatcherDispatchInput["dispatch"];
  packageMode: CmpDispatcherRecord["packageMode"];
  targetKind: CmpDispatcherDispatchInput["dispatch"]["targetKind"] | "core_agent_return";
  targetIngress: "core_agent_return" | "child_icma_only" | "peer_exchange" | "lineage_delivery";
  peerApproval?: CmpPeerExchangeApprovalRecord;
}): CmpDispatcherBundleEnvelope {
  const metadata = input.contextPackage.metadata ?? {};
  const body: CmpDispatcherBundleEnvelope["body"] = (() => {
    switch (input.packageMode) {
      case "child_seed_via_icma":
        return {
          packageId: input.contextPackage.packageId,
          packageKind: input.contextPackage.packageKind,
          primaryRef: input.contextPackage.packageRef,
          guideRef: isString(metadata.cmpGuideRef) ? metadata.cmpGuideRef : undefined,
          backgroundRef: isString(metadata.cmpBackgroundRef) ? metadata.cmpBackgroundRef : undefined,
          taskSnapshotRefs: [],
          bodyStrategy: "child_seed_full" as const,
        };
      case "peer_exchange_slim":
        return {
          packageId: input.contextPackage.packageId,
          packageKind: input.contextPackage.packageKind,
          primaryRef: input.contextPackage.packageRef,
          taskSnapshotRefs: [],
          slimExchangeFields: ["packageId", "packageKind", "primaryRef"],
          bodyStrategy: "peer_exchange_slim" as const,
        };
      case "historical_reply_return":
        return {
          packageId: input.contextPackage.packageId,
          packageKind: input.contextPackage.packageKind,
          primaryRef: input.contextPackage.packageRef,
          timelineRef: isString(metadata.cmpTimelinePackageId) ? metadata.cmpTimelinePackageId : undefined,
          taskSnapshotRefs: Array.isArray(metadata.cmpTaskSnapshotIds)
            ? metadata.cmpTaskSnapshotIds.filter((value): value is string => typeof value === "string")
            : [],
          bodyStrategy: "historical_return" as const,
        };
      default:
        return {
          packageId: input.contextPackage.packageId,
          packageKind: input.contextPackage.packageKind,
          primaryRef: input.contextPackage.packageRef,
          timelineRef: isString(metadata.cmpTimelinePackageId) ? metadata.cmpTimelinePackageId : undefined,
          guideRef: isString(metadata.cmpGuideRef) ? metadata.cmpGuideRef : undefined,
          backgroundRef: isString(metadata.cmpBackgroundRef) ? metadata.cmpBackgroundRef : undefined,
          taskSnapshotRefs: Array.isArray(metadata.cmpTaskSnapshotIds)
            ? metadata.cmpTaskSnapshotIds.filter((value): value is string => typeof value === "string")
            : [],
          bodyStrategy: "child_seed_full" as const,
        };
    }
  })();

  const sourceAnchorRefs = (() => {
    switch (input.packageMode) {
      case "child_seed_via_icma":
        return [
          input.contextPackage.packageRef,
          ...(isString(metadata.cmpGuideRef) ? [metadata.cmpGuideRef] : []),
          ...(isString(metadata.cmpBackgroundRef) ? [metadata.cmpBackgroundRef] : []),
        ];
      case "peer_exchange_slim":
        return [
          input.contextPackage.packageRef,
          ...(typeof input.dispatch.metadata?.sourceSnapshotId === "string" ? [input.dispatch.metadata.sourceSnapshotId] : []),
        ];
      case "historical_reply_return":
        return [
          input.contextPackage.packageRef,
          ...(isString(metadata.cmpTimelinePackageId) ? [metadata.cmpTimelinePackageId] : []),
          ...(Array.isArray(metadata.cmpTaskSnapshotIds)
            ? metadata.cmpTaskSnapshotIds.filter((value): value is string => typeof value === "string")
            : []),
        ];
      default:
        return [
          input.contextPackage.packageRef,
          ...(typeof input.contextPackage.metadata?.snapshotId === "string" ? [input.contextPackage.metadata.snapshotId] : []),
        ];
    }
  })();

  return {
    target: {
      targetAgentId: input.dispatch.targetAgentId,
      targetKind: input.targetKind,
      packageMode: input.packageMode,
      targetIngress: input.targetIngress,
    },
    body,
    governance: {
      sourceAgentId: input.dispatch.sourceAgentId,
      sourceRequestId: typeof input.dispatch.metadata?.sourceRequestId === "string"
        ? input.dispatch.metadata.sourceRequestId
        : undefined,
      sourceSnapshotId: typeof input.dispatch.metadata?.sourceSnapshotId === "string"
        ? input.dispatch.metadata.sourceSnapshotId
        : typeof input.contextPackage.metadata?.snapshotId === "string"
          ? input.contextPackage.metadata.snapshotId
          : undefined,
      approvalRequired: input.targetKind === "peer",
      approvalId: input.peerApproval?.approvalId,
      approvalStatus: input.peerApproval?.status,
      confidenceLabel: input.targetKind === "peer" ? "medium" : "high",
      signalLabel: input.contextPackage.fidelityLabel,
      scopePolicy: input.packageMode === "child_seed_via_icma"
        ? "child_seed_only_enters_child_icma"
        : input.packageMode === "peer_exchange_slim"
          ? "peer_exchange_requires_explicit_parent_approval"
          : input.packageMode === "historical_reply_return"
            ? "historical_reply_returns_via_core_path"
            : "lineage_delivery_policy",
    },
    sourceAnchorRefs,
  };
}

export interface CmpDispatcherRuntimeResult {
  loop: CmpDispatcherRecord;
  peerApproval?: CmpPeerExchangeApprovalRecord;
}

export class CmpDispatcherRuntime {
  readonly #configuration: CmpRoleConfiguration;
  readonly #records = new Map<string, CmpDispatcherRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();
  readonly #peerApprovals = new Map<string, CmpPeerExchangeApprovalRecord>();

  constructor(options: { configuration?: CmpRoleConfiguration } = {}) {
    this.#configuration = options.configuration ?? getCmpRoleConfiguration("dispatcher");
  }

  get peerApprovals(): CmpPeerExchangeApprovalRecord[] {
    return [...this.#peerApprovals.values()];
  }

  dispatch(input: CmpDispatcherDispatchInput): CmpDispatcherRuntimeResult {
    const packageMode = inferPackageMode(input);
    const peerApproval = input.dispatch.targetKind === "peer"
      ? createCmpPeerExchangeApprovalRecord({
        approvalId: `${input.loopId}:approval`,
        parentAgentId: String(input.dispatch.metadata?.parentAgentId ?? "unknown-parent"),
        sourceAgentId: input.dispatch.sourceAgentId,
        targetAgentId: input.dispatch.targetAgentId,
        packageId: input.contextPackage.packageId,
        createdAt: input.createdAt,
        mode: "explicit_once",
        status: "pending_parent_core_approval",
        approvalChain: "parent_dbagent_then_parent_core_agent",
        targetIngress: "peer_exchange",
        packageMode: "peer_exchange_slim",
        currentStateSummary: String(input.dispatch.metadata?.currentStateSummary ?? "pending peer exchange approval"),
        metadata: {
          approval: {
            explicit: true,
            status: "pending_parent_core_approval",
            approvalChain: "parent_dbagent_then_parent_core_agent",
            mode: "explicit_once",
          },
          target: {
            ingress: "peer_exchange",
            packageMode: "peer_exchange_slim",
            targetAgentId: input.dispatch.targetAgentId,
          },
          currentState: {
            summary: String(input.dispatch.metadata?.currentStateSummary ?? "pending peer exchange approval"),
          },
        },
      })
      : undefined;
    const loop: CmpDispatcherRecord = {
      ...createCmpFiveAgentLoopRecord({
        loopId: input.loopId,
        role: "dispatcher",
        agentId: input.dispatch.sourceAgentId,
        stage: "collect_receipt",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        metadata: {
          approvalStatus: peerApproval ? "pending" : undefined,
          childSeedsEnterIcmaOnly: input.dispatch.targetKind === "child",
          targetIngress: input.dispatch.targetKind === "child" ? "child_icma_only" : input.dispatch.targetKind === "peer" ? "peer_exchange" : undefined,
          peerApprovalRequired: input.dispatch.targetKind === "peer",
          ...createPackageDisciplineMetadata({
            packageMode,
            contextPackage: input.contextPackage,
          }),
          ...createRoutePolicyMetadata({
            targetKind: input.dispatch.targetKind,
            packageMode,
            peerApproval,
          }),
        },
      }),
      dispatchId: input.receipt.dispatchId,
      packageId: input.contextPackage.packageId,
      targetAgentId: input.dispatch.targetAgentId,
      targetKind: input.dispatch.targetKind,
      packageMode,
      bundle: createBundleEnvelope({
        contextPackage: input.contextPackage,
        dispatch: input.dispatch,
        packageMode,
        targetKind: input.dispatch.targetKind,
        targetIngress: input.dispatch.targetKind === "child"
          ? "child_icma_only"
          : input.dispatch.targetKind === "peer"
            ? "peer_exchange"
            : input.dispatch.targetKind === "core_agent"
              ? "core_agent_return"
              : "lineage_delivery",
        peerApproval,
      }),
    };
    this.#records.set(loop.loopId, loop);
    for (const [index, stage] of ["route", "deliver", "collect_receipt"].entries()) {
      const checkpoint = createCmpRoleCheckpointRecord({
        checkpointId: `${input.loopId}:cp:${index}`,
        role: "dispatcher",
        agentId: loop.agentId,
        stage,
        createdAt: input.createdAt,
        eventRef: input.receipt.dispatchId,
        metadata: {
          source: "cmp-five-agent-dispatcher",
        },
        loopId: input.loopId,
      });
      this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    }
    if (peerApproval) {
      this.#peerApprovals.set(peerApproval.approvalId, peerApproval);
    }
    return {
      loop,
      peerApproval,
    };
  }

  async dispatchWithLlm(
    input: CmpDispatcherDispatchInput,
    options: {
      mode?: CmpRoleLiveLlmMode;
      executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, CmpDispatcherLiveOutput>;
    } = {},
  ): Promise<CmpDispatcherRuntimeResult> {
    const rulesResult = this.dispatch(input);
    const configuration = this.#configuration;
    const live = await executeCmpRoleLiveLlmStep<Record<string, unknown>, CmpDispatcherLiveOutput>({
      role: "dispatcher",
      agentId: rulesResult.loop.agentId,
      mode: options.mode,
      stage: "route",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "organize differentiated dispatcher route rationale body strategy and scope policy",
      schemaTitle: "CmpDispatcherLiveRouteOutput",
      schemaFields: ["routeRationale", "bodyStrategy", "slimExchangeFields", "scopePolicy"],
      requestInput: {
        packageId: rulesResult.loop.packageId,
        packageKind: rulesResult.loop.bundle.body.packageKind,
        packageMode: rulesResult.loop.packageMode,
        targetAgentId: rulesResult.loop.targetAgentId,
        targetKind: rulesResult.loop.targetKind,
        targetIngress: rulesResult.loop.bundle.target.targetIngress,
        sourceRequestId: rulesResult.loop.bundle.governance.sourceRequestId,
        sourceSnapshotId: rulesResult.loop.bundle.governance.sourceSnapshotId,
      },
      fallbackOutput: {},
      executor: options.executor,
      metadata: {
        loopId: rulesResult.loop.loopId,
        maxOutputTokens: 160,
        promptText: createDispatcherActivePromptText({
          packageId: rulesResult.loop.packageId,
          packageKind: rulesResult.loop.bundle.body.packageKind,
          packageMode: rulesResult.loop.packageMode,
          targetAgentId: rulesResult.loop.targetAgentId,
          targetKind: rulesResult.loop.targetKind,
          targetIngress: rulesResult.loop.bundle.target.targetIngress,
          sourceRequestId: rulesResult.loop.bundle.governance.sourceRequestId,
          sourceSnapshotId: rulesResult.loop.bundle.governance.sourceSnapshotId,
        }),
      },
    });

    const updatedLoop: CmpDispatcherRecord = {
      ...rulesResult.loop,
      bundle: {
        ...rulesResult.loop.bundle,
        governance: {
          ...rulesResult.loop.bundle.governance,
          routeRationale: typeof live.output.routeRationale === "string"
            ? live.output.routeRationale
            : rulesResult.loop.bundle.governance.routeRationale,
          scopePolicy: typeof live.output.scopePolicy === "string" && live.output.scopePolicy.trim()
            ? live.output.scopePolicy
            : rulesResult.loop.bundle.governance.scopePolicy,
        },
        body: {
          ...rulesResult.loop.bundle.body,
          bodyStrategy: live.output.bodyStrategy ?? rulesResult.loop.bundle.body.bodyStrategy,
          slimExchangeFields: Array.isArray(live.output.slimExchangeFields)
            ? live.output.slimExchangeFields.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : rulesResult.loop.bundle.body.slimExchangeFields,
        },
      },
      liveTrace: live.trace,
      metadata: attachCmpRoleLiveAudit({
        metadata: rulesResult.loop.metadata,
        audit: toCmpRoleLiveAuditFromTrace(live.trace),
        extras: live.output.routeRationale
          ? {
            routeRationale: live.output.routeRationale,
            bodyStrategy: live.output.bodyStrategy,
            slimExchangeFields: live.output.slimExchangeFields,
            scopePolicy: live.output.scopePolicy,
          }
          : undefined,
      }),
    };
    this.#records.set(updatedLoop.loopId, updatedLoop);

    return {
      ...rulesResult,
      loop: updatedLoop,
    };
  }

  deliverPassiveReturn(input: CmpDispatcherPassiveReturnInput): CmpDispatcherRecord {
    const bundle = createBundleEnvelope({
      contextPackage: input.contextPackage,
      dispatch: {
        agentId: input.request.requesterAgentId,
        packageId: input.contextPackage.packageId,
        sourceAgentId: input.request.requesterAgentId,
        targetAgentId: input.request.requesterAgentId,
        targetKind: "core_agent",
        metadata: {
          sourceRequestId: typeof input.contextPackage.metadata?.sourceRequestId === "string"
            ? input.contextPackage.metadata.sourceRequestId
            : undefined,
        },
      },
      packageMode: "historical_reply_return",
      targetKind: "core_agent_return",
      targetIngress: "core_agent_return",
    });
    const loop: CmpDispatcherRecord = {
      ...createCmpFiveAgentLoopRecord({
        loopId: input.loopId,
        role: "dispatcher",
        agentId: input.request.requesterAgentId,
        stage: "collect_receipt",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        metadata: {
          passiveReturned: true,
          targetIngress: "core_agent_return",
          ...createPackageDisciplineMetadata({
            packageMode: "historical_reply_return",
            contextPackage: input.contextPackage,
          }),
          ...createRoutePolicyMetadata({
            targetKind: "core_agent_return",
            packageMode: "historical_reply_return",
          }),
        },
      }),
      dispatchId: `${input.loopId}:passive`,
      packageId: input.contextPackage.packageId,
      targetAgentId: input.request.requesterAgentId,
      targetKind: "core_agent",
      packageMode: "historical_reply_return",
      bundle,
    };
    this.#records.set(loop.loopId, loop);
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.loopId}:cp:passive`,
      role: "dispatcher",
      agentId: loop.agentId,
      stage: "collect_receipt",
      createdAt: input.createdAt,
      eventRef: loop.dispatchId,
      metadata: {
        source: "cmp-five-agent-dispatcher-passive",
      },
      loopId: input.loopId,
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return loop;
  }

  async deliverPassiveReturnWithLlm(
    input: CmpDispatcherPassiveReturnInput,
    options: {
      mode?: CmpRoleLiveLlmMode;
      executor?: CmpRoleLiveLlmExecutor<Record<string, unknown>, CmpDispatcherLiveOutput>;
    } = {},
  ): Promise<CmpDispatcherRecord> {
    const loop = this.deliverPassiveReturn(input);
    const configuration = this.#configuration;
    const live = await executeCmpRoleLiveLlmStep<Record<string, unknown>, CmpDispatcherLiveOutput>({
      role: "dispatcher",
      agentId: loop.agentId,
      mode: options.mode,
      stage: "deliver",
      createdAt: input.createdAt,
      configuration,
      taskLabel: "organize dispatcher passive return rationale body strategy and scope policy",
      schemaTitle: "CmpDispatcherLiveRouteOutput",
      schemaFields: ["routeRationale", "bodyStrategy", "scopePolicy"],
      requestInput: {
        packageId: loop.packageId,
        packageKind: loop.bundle.body.packageKind,
        packageMode: loop.packageMode,
        targetAgentId: loop.targetAgentId,
        targetIngress: loop.bundle.target.targetIngress,
        sourceRequestId: loop.bundle.governance.sourceRequestId,
      },
      fallbackOutput: {},
      executor: options.executor,
      metadata: {
        loopId: loop.loopId,
        maxOutputTokens: 128,
        promptText: createDispatcherPassivePromptText({
          packageId: loop.packageId,
          packageKind: loop.bundle.body.packageKind,
          packageMode: loop.packageMode,
          targetAgentId: loop.targetAgentId,
          targetIngress: loop.bundle.target.targetIngress,
          sourceRequestId: loop.bundle.governance.sourceRequestId,
        }),
      },
    });

    const updatedLoop: CmpDispatcherRecord = {
      ...loop,
      bundle: {
        ...loop.bundle,
        governance: {
          ...loop.bundle.governance,
          routeRationale: typeof live.output.routeRationale === "string"
            ? live.output.routeRationale
            : loop.bundle.governance.routeRationale,
          scopePolicy: typeof live.output.scopePolicy === "string" && live.output.scopePolicy.trim()
            ? live.output.scopePolicy
            : loop.bundle.governance.scopePolicy,
        },
        body: {
          ...loop.bundle.body,
          bodyStrategy: live.output.bodyStrategy ?? loop.bundle.body.bodyStrategy,
        },
      },
      liveTrace: live.trace,
      metadata: attachCmpRoleLiveAudit({
        metadata: loop.metadata,
        audit: toCmpRoleLiveAuditFromTrace(live.trace),
        extras: live.output.routeRationale
          ? {
            routeRationale: live.output.routeRationale,
            bodyStrategy: live.output.bodyStrategy,
            scopePolicy: live.output.scopePolicy,
          }
          : undefined,
      }),
    };
    this.#records.set(updatedLoop.loopId, updatedLoop);
    return updatedLoop;
  }

  approvePeerExchange(input: {
    approvalId: string;
    actorAgentId: string;
    decision: "approved" | "rejected";
    decidedAt: string;
    note?: string;
  }): CmpPeerExchangeApprovalRecord {
    const current = this.#peerApprovals.get(input.approvalId);
    if (!current) {
      throw new Error(`CMP peer approval ${input.approvalId} was not found.`);
    }
    const next = createCmpPeerExchangeApprovalRecord({
      ...current,
      status: input.decision,
      approvedAt: input.decidedAt,
      approvedByAgentId: input.actorAgentId,
      decisionNote: input.note,
      metadata: {
        ...(current.metadata ?? {}),
        approval: {
          explicit: true,
          status: input.decision,
          approvalChain: current.approvalChain,
          mode: current.mode,
          decidedAt: input.decidedAt,
          decidedByAgentId: input.actorAgentId,
          decisionNote: input.note,
        },
      },
    });
    this.#peerApprovals.set(next.approvalId, next);
    for (const [loopId, record] of this.#records.entries()) {
      if (record.packageId !== current.packageId || record.packageMode !== "peer_exchange_slim") {
        continue;
      }
      this.#records.set(loopId, {
        ...record,
        updatedAt: input.decidedAt,
        bundle: {
          ...record.bundle,
          governance: {
            ...record.bundle.governance,
            approvalStatus: input.decision,
          },
        },
        metadata: {
          ...(record.metadata ?? {}),
          approvalStatus: input.decision,
          ...createRoutePolicyMetadata({
            targetKind: "peer",
            packageMode: record.packageMode,
            peerApproval: next,
          }),
        },
      });
    }
    const checkpoint = createCmpRoleCheckpointRecord({
      checkpointId: `${input.approvalId}:cp:${input.decision}`,
      role: "dispatcher",
      agentId: current.sourceAgentId,
      stage: "collect_receipt",
      createdAt: input.decidedAt,
      eventRef: current.packageId,
      loopId: undefined,
      metadata: {
        source: "cmp-five-agent-dispatcher-peer-approval",
        decision: input.decision,
        actorAgentId: input.actorAgentId,
      },
    });
    this.#checkpoints.set(checkpoint.checkpointId, checkpoint);
    return next;
  }

  createSnapshot(agentId?: string): CmpDispatcherRuntimeSnapshot {
    return {
      records: [...this.#records.values()].filter((record) => !agentId || record.agentId === agentId),
      checkpoints: [...this.#checkpoints.values()].filter((record) => !agentId || record.agentId === agentId),
      peerApprovals: [...this.#peerApprovals.values()].filter((record) => !agentId || record.sourceAgentId === agentId || record.targetAgentId === agentId),
    };
  }

  recover(snapshot?: CmpDispatcherRuntimeSnapshot): void {
    this.#records.clear();
    this.#checkpoints.clear();
    this.#peerApprovals.clear();
    if (!snapshot) return;
    for (const record of snapshot.records) this.#records.set(record.loopId, record);
    for (const record of snapshot.checkpoints) this.#checkpoints.set(record.checkpointId, record);
    for (const record of snapshot.peerApprovals) this.#peerApprovals.set(record.approvalId, record);
  }
}

export function createCmpDispatcherRuntime(options: { configuration?: CmpRoleConfiguration } = {}): CmpDispatcherRuntime {
  return new CmpDispatcherRuntime(options);
}
