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
  CmpRoleCheckpointRecord,
} from "./types.js";

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

function createBundleEnvelope(input: {
  contextPackage: CmpDispatcherDispatchInput["contextPackage"];
  dispatch: CmpDispatcherDispatchInput["dispatch"];
  packageMode: CmpDispatcherRecord["packageMode"];
  targetKind: CmpDispatcherDispatchInput["dispatch"]["targetKind"] | "core_agent_return";
  targetIngress: "core_agent_return" | "child_icma_only" | "peer_exchange" | "lineage_delivery";
  peerApproval?: CmpPeerExchangeApprovalRecord;
}): CmpDispatcherBundleEnvelope {
  return {
    target: {
      targetAgentId: input.dispatch.targetAgentId,
      targetKind: input.targetKind,
      packageMode: input.packageMode,
      targetIngress: input.targetIngress,
    },
    body: {
      packageId: input.contextPackage.packageId,
      packageKind: input.contextPackage.packageKind,
      primaryRef: input.contextPackage.packageRef,
      timelineRef: typeof input.contextPackage.metadata?.cmpTimelinePackageId === "string"
        ? input.contextPackage.metadata.cmpTimelinePackageId
        : undefined,
      guideRef: typeof input.contextPackage.metadata?.cmpGuideRef === "string"
        ? input.contextPackage.metadata.cmpGuideRef
        : undefined,
      backgroundRef: typeof input.contextPackage.metadata?.cmpBackgroundRef === "string"
        ? input.contextPackage.metadata.cmpBackgroundRef
        : undefined,
      taskSnapshotRefs: Array.isArray(input.contextPackage.metadata?.cmpTaskSnapshotIds)
        ? input.contextPackage.metadata.cmpTaskSnapshotIds.filter((value): value is string => typeof value === "string")
        : [],
    },
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
    },
    sourceAnchorRefs: [
      input.contextPackage.packageRef,
      ...(typeof input.contextPackage.metadata?.snapshotId === "string" ? [input.contextPackage.metadata.snapshotId] : []),
    ],
  };
}

export interface CmpDispatcherRuntimeResult {
  loop: CmpDispatcherRecord;
  peerApproval?: CmpPeerExchangeApprovalRecord;
}

export class CmpDispatcherRuntime {
  readonly #records = new Map<string, CmpDispatcherRecord>();
  readonly #checkpoints = new Map<string, CmpRoleCheckpointRecord>();
  readonly #peerApprovals = new Map<string, CmpPeerExchangeApprovalRecord>();

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

export function createCmpDispatcherRuntime(): CmpDispatcherRuntime {
  return new CmpDispatcherRuntime();
}
