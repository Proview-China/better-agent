import {
  createCmpFiveAgentConfiguration,
  getCmpDefaultRoleLiveLlmMode,
  type CmpFiveAgentConfiguration,
} from "./configuration.js";
import { createCmpDbAgentRuntime, type CmpDbAgentRuntime } from "./dbagent-runtime.js";
import { createCmpDispatcherRuntime, type CmpDispatcherRuntime } from "./dispatcher-runtime.js";
import { createCmpIcmaRuntime, type CmpIcmaRuntime } from "./icma-runtime.js";
import { createCmpIteratorCheckerRuntime, type CmpIteratorCheckerRuntime } from "./iterator-checker-runtime.js";
import { createCmpFiveAgentSummary } from "./observability.js";
import type {
  CmpCheckerEvaluateInput,
  CmpDbAgentMaterializeInput,
  CmpDbAgentMaterializeResult,
  CmpDbAgentPassiveInput,
  CmpDispatcherDispatchInput,
  CmpDispatcherPassiveReturnInput,
  CmpFiveAgentRuntimeSnapshot,
  CmpFiveAgentSummary,
  CmpIcmaIngestInput,
  CmpIteratorAdvanceInput,
  CmpRoleLiveLlmMode,
} from "./types.js";
import type { CmpCheckerRuntimeResult } from "./iterator-checker-runtime.js";
import type { CmpDispatcherRuntimeResult } from "./dispatcher-runtime.js";
import type { CmpIcmaRuntimeResult } from "./icma-runtime.js";

export type CmpIcmaLiveOptions = NonNullable<Parameters<CmpIcmaRuntime["captureWithLlm"]>[1]>;
export type CmpIteratorLiveOptions = NonNullable<Parameters<CmpIteratorCheckerRuntime["advanceIteratorWithLlm"]>[1]>;
export type CmpCheckerLiveOptions = NonNullable<Parameters<CmpIteratorCheckerRuntime["evaluateCheckerWithLlm"]>[1]>;
export type CmpDbAgentMaterializeLiveOptions = NonNullable<Parameters<CmpDbAgentRuntime["materializeWithLlm"]>[1]>;
export type CmpDbAgentPassiveLiveOptions = NonNullable<Parameters<CmpDbAgentRuntime["servePassiveWithLlm"]>[1]>;
export type CmpDispatcherLiveOptions = NonNullable<Parameters<CmpDispatcherRuntime["dispatchWithLlm"]>[1]>;
export type CmpDispatcherPassiveLiveOptions = NonNullable<Parameters<CmpDispatcherRuntime["deliverPassiveReturnWithLlm"]>[1]>;

export interface CmpFiveAgentLiveExecutorCatalog {
  icma?: CmpIcmaLiveOptions["executor"];
  iterator?: CmpIteratorLiveOptions["executor"];
  checker?: CmpCheckerLiveOptions["executor"];
  dbagent?: CmpDbAgentMaterializeLiveOptions["executor"];
  dispatcher?: CmpDispatcherLiveOptions["executor"];
}

export interface CmpFiveAgentLiveModeCatalog {
  icma?: CmpRoleLiveLlmMode;
  iterator?: CmpRoleLiveLlmMode;
  checker?: CmpRoleLiveLlmMode;
  dbagent?: CmpRoleLiveLlmMode;
  dispatcher?: CmpRoleLiveLlmMode;
}

export interface CmpFiveAgentLiveDefaults {
  modes?: CmpFiveAgentLiveModeCatalog;
  executors?: CmpFiveAgentLiveExecutorCatalog;
}

export interface CmpFiveAgentActiveLiveRunInput {
  icma: {
    input: CmpIcmaIngestInput;
    options?: CmpIcmaLiveOptions;
  };
  iterator: {
    input: CmpIteratorAdvanceInput;
    options?: CmpIteratorLiveOptions;
  };
  checker: {
    input: CmpCheckerEvaluateInput;
    options?: CmpCheckerLiveOptions;
  };
  dbagent: {
    input: CmpDbAgentMaterializeInput;
    options?: CmpDbAgentMaterializeLiveOptions;
  };
  dispatcher: {
    input: CmpDispatcherDispatchInput;
    options?: CmpDispatcherLiveOptions;
  };
}

export interface CmpFiveAgentActiveLiveRunResult {
  icma: CmpIcmaRuntimeResult;
  iterator: Awaited<ReturnType<CmpFiveAgentRuntime["advanceIteratorWithLlm"]>>;
  checker: CmpCheckerRuntimeResult;
  dbagent: CmpDbAgentMaterializeResult;
  dispatcher: CmpDispatcherRuntimeResult;
  summary: CmpFiveAgentSummary;
}

export interface CmpFiveAgentPassiveLiveRunInput {
  dbagent: {
    input: CmpDbAgentPassiveInput;
    options?: CmpDbAgentPassiveLiveOptions;
  };
  dispatcher: {
    input: CmpDispatcherPassiveReturnInput;
    options?: CmpDispatcherPassiveLiveOptions;
  };
}

export interface CmpFiveAgentPassiveLiveRunResult {
  dbagent: CmpDbAgentMaterializeResult;
  dispatcher: Awaited<ReturnType<CmpFiveAgentRuntime["deliverDispatcherPassiveReturnWithLlm"]>>;
  summary: CmpFiveAgentSummary;
}

export interface CmpFiveAgentRuntimeOptions {
  icma?: CmpIcmaRuntime;
  iteratorChecker?: CmpIteratorCheckerRuntime;
  dbagent?: CmpDbAgentRuntime;
  dispatcher?: CmpDispatcherRuntime;
  configuration?: CmpFiveAgentConfiguration;
  live?: CmpFiveAgentLiveDefaults;
}

export class CmpFiveAgentRuntime {
  readonly icma: CmpIcmaRuntime;
  readonly iteratorChecker: CmpIteratorCheckerRuntime;
  readonly dbagent: CmpDbAgentRuntime;
  readonly dispatcher: CmpDispatcherRuntime;
  readonly configuration: CmpFiveAgentConfiguration;
  readonly liveDefaults: CmpFiveAgentLiveDefaults;

  constructor(options: CmpFiveAgentRuntimeOptions = {}) {
    this.configuration = options.configuration ?? createCmpFiveAgentConfiguration();
    this.icma = options.icma ?? createCmpIcmaRuntime({
      configuration: this.configuration.roles.icma,
    });
    this.iteratorChecker = options.iteratorChecker ?? createCmpIteratorCheckerRuntime({
      iteratorConfiguration: this.configuration.roles.iterator,
      checkerConfiguration: this.configuration.roles.checker,
    });
    this.dbagent = options.dbagent ?? createCmpDbAgentRuntime({
      configuration: this.configuration.roles.dbagent,
    });
    this.dispatcher = options.dispatcher ?? createCmpDispatcherRuntime({
      configuration: this.configuration.roles.dispatcher,
    });
    this.liveDefaults = {
      modes: {
        ...(options.live?.modes ?? {}),
      },
      executors: {
        ...(options.live?.executors ?? {}),
      },
    };
  }

  #resolveIcmaLiveOptions(options: CmpIcmaLiveOptions = {}): CmpIcmaLiveOptions {
    return {
      mode: options.mode ?? this.liveDefaults.modes?.icma ?? getCmpDefaultRoleLiveLlmMode("icma"),
      executor: options.executor ?? this.liveDefaults.executors?.icma,
    };
  }

  #resolveIteratorLiveOptions(options: CmpIteratorLiveOptions = {}): CmpIteratorLiveOptions {
    return {
      mode: options.mode ?? this.liveDefaults.modes?.iterator ?? getCmpDefaultRoleLiveLlmMode("iterator"),
      executor: options.executor ?? this.liveDefaults.executors?.iterator,
    };
  }

  #resolveCheckerLiveOptions(options: CmpCheckerLiveOptions = {}): CmpCheckerLiveOptions {
    return {
      mode: options.mode ?? this.liveDefaults.modes?.checker ?? getCmpDefaultRoleLiveLlmMode("checker"),
      executor: options.executor ?? this.liveDefaults.executors?.checker,
    };
  }

  #resolveDbAgentLiveOptions(
    options: CmpDbAgentMaterializeLiveOptions | CmpDbAgentPassiveLiveOptions = {},
  ): CmpDbAgentMaterializeLiveOptions {
    return {
      mode: options.mode ?? this.liveDefaults.modes?.dbagent ?? getCmpDefaultRoleLiveLlmMode("dbagent"),
      executor: options.executor ?? this.liveDefaults.executors?.dbagent,
    };
  }

  #resolveDispatcherLiveOptions(
    options: CmpDispatcherLiveOptions | CmpDispatcherPassiveLiveOptions = {},
  ): CmpDispatcherLiveOptions {
    return {
      mode: options.mode ?? this.liveDefaults.modes?.dispatcher ?? getCmpDefaultRoleLiveLlmMode("dispatcher"),
      executor: options.executor ?? this.liveDefaults.executors?.dispatcher,
    };
  }

  async captureIcmaWithLlm(input: CmpIcmaIngestInput, options: CmpIcmaLiveOptions = {}): Promise<CmpIcmaRuntimeResult> {
    return this.icma.captureWithLlm(input, this.#resolveIcmaLiveOptions(options));
  }

  async advanceIteratorWithLlm(
    input: CmpIteratorAdvanceInput,
    options: CmpIteratorLiveOptions = {},
  ): Promise<ReturnType<CmpIteratorCheckerRuntime["advanceIterator"]>> {
    return this.iteratorChecker.advanceIteratorWithLlm(input, this.#resolveIteratorLiveOptions(options));
  }

  async evaluateCheckerWithLlm(
    input: CmpCheckerEvaluateInput,
    options: CmpCheckerLiveOptions = {},
  ): Promise<CmpCheckerRuntimeResult> {
    return this.iteratorChecker.evaluateCheckerWithLlm(input, this.#resolveCheckerLiveOptions(options));
  }

  async materializeDbAgentWithLlm(
    input: CmpDbAgentMaterializeInput,
    options: CmpDbAgentMaterializeLiveOptions = {},
  ): Promise<CmpDbAgentMaterializeResult> {
    return this.dbagent.materializeWithLlm(input, this.#resolveDbAgentLiveOptions(options));
  }

  async servePassiveDbAgentWithLlm(
    input: CmpDbAgentPassiveInput,
    options: CmpDbAgentPassiveLiveOptions = {},
  ): Promise<CmpDbAgentMaterializeResult> {
    return this.dbagent.servePassiveWithLlm(input, this.#resolveDbAgentLiveOptions(options));
  }

  async dispatchDispatcherWithLlm(
    input: CmpDispatcherDispatchInput,
    options: CmpDispatcherLiveOptions = {},
  ): Promise<CmpDispatcherRuntimeResult> {
    return this.dispatcher.dispatchWithLlm(input, this.#resolveDispatcherLiveOptions(options));
  }

  async deliverDispatcherPassiveReturnWithLlm(
    input: CmpDispatcherPassiveReturnInput,
    options: CmpDispatcherPassiveLiveOptions = {},
  ): Promise<ReturnType<CmpDispatcherRuntime["deliverPassiveReturn"]>> {
    return this.dispatcher.deliverPassiveReturnWithLlm(input, this.#resolveDispatcherLiveOptions(options));
  }

  async runActiveLoopWithLlm(input: CmpFiveAgentActiveLiveRunInput): Promise<CmpFiveAgentActiveLiveRunResult> {
    const icma = await this.captureIcmaWithLlm(input.icma.input, input.icma.options);
    const iterator = await this.advanceIteratorWithLlm(input.iterator.input, input.iterator.options);
    const checker = await this.evaluateCheckerWithLlm(input.checker.input, input.checker.options);
    const dbagent = await this.materializeDbAgentWithLlm(input.dbagent.input, input.dbagent.options);
    const dispatcher = await this.dispatchDispatcherWithLlm(input.dispatcher.input, input.dispatcher.options);

    return {
      icma,
      iterator,
      checker,
      dbagent,
      dispatcher,
      summary: this.createSummary(input.icma.input.ingest.agentId),
    };
  }

  async runPassiveLoopWithLlm(input: CmpFiveAgentPassiveLiveRunInput): Promise<CmpFiveAgentPassiveLiveRunResult> {
    const dbagent = await this.servePassiveDbAgentWithLlm(input.dbagent.input, input.dbagent.options);
    const dispatcher = await this.deliverDispatcherPassiveReturnWithLlm(input.dispatcher.input, input.dispatcher.options);

    return {
      dbagent,
      dispatcher,
      summary: this.createSummary(input.dbagent.input.request.requesterAgentId),
    };
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
