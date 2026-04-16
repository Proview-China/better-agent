import type { AgentCoreRuntime } from "../runtime.js";
import type { AgentCoreCmpWorksiteTurnArtifactInput } from "../cmp-api/index.js";

export interface AgentCoreCmpWorksiteDerivedState {
  packageFamilyId?: string;
  primaryPackageId?: string;
  primaryPackageRef?: string;
  sourceAnchorRefs: string[];
  reviewStateSummary?: string;
  routeStateSummary?: string;
  unresolvedStateSummary?: string;
  pendingPeerApprovalCount: number;
  approvedPeerApprovalCount: number;
  parentPromoteReviewCount: number;
  reinterventionPendingCount: number;
  reinterventionServedCount: number;
  childSeedToIcmaCount: number;
  passiveReturnCount: number;
  latestStages: string[];
  recoveryStatus: "healthy" | "degraded";
}

export interface AgentCoreCmpWorksiteStateRecord {
  sessionId: string;
  agentId: string;
  activeTurnIndex: number;
  currentObjective: string;
  updatedAt: string;
  deliveryStatus: "available" | "partial" | "absent" | "pending" | "skipped";
  latestCmp: AgentCoreCmpWorksiteTurnArtifactInput["cmp"];
  derived: AgentCoreCmpWorksiteDerivedState;
}

export interface AgentCoreCmpStateStore {
  readonly runtime: AgentCoreRuntime;
  readonly worksiteRecords: Map<string, AgentCoreCmpWorksiteStateRecord>;
  createWorksiteSnapshot(): AgentCoreCmpWorksiteStateRecord[];
  recoverWorksiteSnapshot(snapshot?: readonly AgentCoreCmpWorksiteStateRecord[]): void;
}

export function createAgentCoreCmpStateStore(runtime: AgentCoreRuntime): AgentCoreCmpStateStore {
  return {
    runtime,
    worksiteRecords: new Map<string, AgentCoreCmpWorksiteStateRecord>(),
    createWorksiteSnapshot() {
      return [...this.worksiteRecords.values()].map((record) => structuredClone(record));
    },
    recoverWorksiteSnapshot(snapshot) {
      this.worksiteRecords.clear();
      for (const record of snapshot ?? []) {
        this.worksiteRecords.set(
          `${record.sessionId}::${record.agentId}`,
          structuredClone(record),
        );
      }
    },
  };
}
