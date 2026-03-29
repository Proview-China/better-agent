import { createCmpFiveAgentConfiguration, type CmpFiveAgentConfiguration } from "./configuration.js";
import { createCmpDbAgentRuntime, type CmpDbAgentRuntime } from "./dbagent-runtime.js";
import { createCmpDispatcherRuntime, type CmpDispatcherRuntime } from "./dispatcher-runtime.js";
import { createCmpIcmaRuntime, type CmpIcmaRuntime } from "./icma-runtime.js";
import { createCmpIteratorCheckerRuntime, type CmpIteratorCheckerRuntime } from "./iterator-checker-runtime.js";
import { createCmpFiveAgentSummary } from "./observability.js";
import type {
  CmpFiveAgentRuntimeSnapshot,
  CmpFiveAgentSummary,
} from "./types.js";

export interface CmpFiveAgentRuntimeOptions {
  icma?: CmpIcmaRuntime;
  iteratorChecker?: CmpIteratorCheckerRuntime;
  dbagent?: CmpDbAgentRuntime;
  dispatcher?: CmpDispatcherRuntime;
  configuration?: CmpFiveAgentConfiguration;
}

export class CmpFiveAgentRuntime {
  readonly icma: CmpIcmaRuntime;
  readonly iteratorChecker: CmpIteratorCheckerRuntime;
  readonly dbagent: CmpDbAgentRuntime;
  readonly dispatcher: CmpDispatcherRuntime;
  readonly configuration: CmpFiveAgentConfiguration;

  constructor(options: CmpFiveAgentRuntimeOptions = {}) {
    this.icma = options.icma ?? createCmpIcmaRuntime();
    this.iteratorChecker = options.iteratorChecker ?? createCmpIteratorCheckerRuntime();
    this.dbagent = options.dbagent ?? createCmpDbAgentRuntime();
    this.dispatcher = options.dispatcher ?? createCmpDispatcherRuntime();
    this.configuration = options.configuration ?? createCmpFiveAgentConfiguration();
  }

  createSnapshot(agentId?: string): CmpFiveAgentRuntimeSnapshot {
    const icma = this.icma.createSnapshot(agentId);
    const iteratorChecker = this.iteratorChecker.createSnapshot(agentId);
    const dbagent = this.dbagent.createSnapshot(agentId);
    const dispatcher = this.dispatcher.createSnapshot(agentId);
    return {
      icmaRecords: icma.records,
      iteratorRecords: iteratorChecker.iteratorRecords,
      checkerRecords: iteratorChecker.checkerRecords,
      dbAgentRecords: dbagent.records,
      dispatcherRecords: dispatcher.records,
      checkpoints: [
        ...icma.checkpoints,
        ...iteratorChecker.checkpoints,
        ...dbagent.checkpoints,
        ...dispatcher.checkpoints,
      ],
      overrides: [],
      intentChunks: icma.intentChunks,
      fragments: icma.fragments,
      packageFamilies: dbagent.packageFamilies,
      taskSnapshots: dbagent.taskSnapshots,
      promoteRequests: iteratorChecker.promoteRequests,
      parentPromoteReviews: dbagent.parentPromoteReviews,
      peerApprovals: dispatcher.peerApprovals,
      reinterventionRequests: dbagent.reinterventionRequests,
    };
  }

  recover(snapshot?: CmpFiveAgentRuntimeSnapshot): void {
    this.icma.recover(snapshot ? {
      records: snapshot.icmaRecords,
      intentChunks: snapshot.intentChunks,
      fragments: snapshot.fragments,
      checkpoints: snapshot.checkpoints.filter((item) => item.role === "icma"),
    } : undefined);
    this.iteratorChecker.recover(snapshot ? {
      iteratorRecords: snapshot.iteratorRecords,
      checkerRecords: snapshot.checkerRecords,
      checkpoints: snapshot.checkpoints.filter((item) => item.role === "iterator" || item.role === "checker"),
      promoteRequests: snapshot.promoteRequests,
    } : undefined);
    this.dbagent.recover(snapshot ? {
      records: snapshot.dbAgentRecords,
      checkpoints: snapshot.checkpoints.filter((item) => item.role === "dbagent"),
      packageFamilies: snapshot.packageFamilies,
      taskSnapshots: snapshot.taskSnapshots,
      parentPromoteReviews: snapshot.parentPromoteReviews,
      reinterventionRequests: snapshot.reinterventionRequests,
    } : undefined);
    this.dispatcher.recover(snapshot ? {
      records: snapshot.dispatcherRecords,
      checkpoints: snapshot.checkpoints.filter((item) => item.role === "dispatcher"),
      peerApprovals: snapshot.peerApprovals,
    } : undefined);
  }

  createSummary(agentId?: string): CmpFiveAgentSummary {
    return createCmpFiveAgentSummary({
      agentId,
      snapshot: this.createSnapshot(agentId),
      configuration: this.configuration,
    });
  }
}

export function createCmpFiveAgentRuntime(options: CmpFiveAgentRuntimeOptions = {}): CmpFiveAgentRuntime {
  return new CmpFiveAgentRuntime(options);
}
