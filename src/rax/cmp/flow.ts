import type {
  CommitContextDeltaResult,
  DispatchContextPackageResult,
  IngestRuntimeContextResult,
  MaterializeContextPackageResult,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotResult,
} from "../../agent_core/cmp-types/index.js";
import type {
  RaxCmpCommitInput,
  RaxCmpDispatchInput,
  RaxCmpFlowApi,
  RaxCmpIngestInput,
  RaxCmpMaterializeInput,
  RaxCmpRequestHistoryInput,
  RaxCmpResolveInput,
} from "../cmp-types.js";
import { assertAutomationAllowed, assertDispatchAllowed, resolveControlSurface } from "./control.js";

export function createRaxCmpFlowApi(): RaxCmpFlowApi {
  return {
    async ingest(ingestInput: RaxCmpIngestInput): Promise<IngestRuntimeContextResult> {
      const control = resolveControlSurface({
        projectId: ingestInput.session.projectId,
        base: ingestInput.session.control,
        override: ingestInput.control,
      });
      assertAutomationAllowed({
        control,
        gate: "autoIngest",
        label: "CMP automatic ingest",
        payloadMetadata: ingestInput.payload.metadata,
      });
      return ingestInput.session.runtime.flow.ingest(ingestInput.payload);
    },
    async commit(commitInput: RaxCmpCommitInput): Promise<CommitContextDeltaResult> {
      const control = resolveControlSurface({
        projectId: commitInput.session.projectId,
        base: commitInput.session.control,
        override: commitInput.control,
      });
      assertAutomationAllowed({
        control,
        gate: "autoCommit",
        label: "CMP automatic commit",
        payloadMetadata: commitInput.payload.metadata,
      });
      return commitInput.session.runtime.flow.commit(commitInput.payload);
    },
    async resolve(resolveInput: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult> {
      const control = resolveControlSurface({
        projectId: resolveInput.session.projectId,
        base: resolveInput.session.control,
        override: resolveInput.control,
      });
      assertAutomationAllowed({
        control,
        gate: "autoResolve",
        label: "CMP automatic resolve",
        payloadMetadata: resolveInput.payload.metadata,
      });
      return resolveInput.session.runtime.flow.resolve(resolveInput.payload);
    },
    async materialize(materializeInput: RaxCmpMaterializeInput): Promise<MaterializeContextPackageResult> {
      const control = resolveControlSurface({
        projectId: materializeInput.session.projectId,
        base: materializeInput.session.control,
        override: materializeInput.control,
      });
      assertAutomationAllowed({
        control,
        gate: "autoMaterialize",
        label: "CMP automatic materialization",
        payloadMetadata: materializeInput.payload.metadata,
      });
      return materializeInput.session.runtime.flow.materialize(materializeInput.payload);
    },
    async dispatch(dispatchInput: RaxCmpDispatchInput): Promise<DispatchContextPackageResult> {
      const control = resolveControlSurface({
        projectId: dispatchInput.session.projectId,
        base: dispatchInput.session.control,
        override: dispatchInput.control,
      });
      assertDispatchAllowed({
        control,
        targetKind: dispatchInput.payload.targetKind,
        payloadMetadata: dispatchInput.payload.metadata,
      });
      return dispatchInput.session.runtime.flow.dispatch(dispatchInput.payload);
    },
    async requestHistory(historyInput: RaxCmpRequestHistoryInput): Promise<RequestHistoricalContextResult> {
      const control = resolveControlSurface({
        projectId: historyInput.session.projectId,
        base: historyInput.session.control,
        override: historyInput.control,
      });
      const result = await historyInput.session.runtime.flow.requestHistory({
        ...historyInput.payload,
        metadata: {
          ...(historyInput.payload.metadata ?? {}),
          readbackPriority: control.truth.readbackPriority,
          fallbackPolicy: control.truth.fallbackPolicy,
          recoveryPreference: control.truth.recoveryPreference,
        },
      });
      if (control.truth.fallbackPolicy === "strict_not_found" && result.metadata?.degraded === true) {
        return {
          status: "not_found",
          found: false,
          metadata: {
            blockedByFallbackPolicy: "strict_not_found",
            originalResult: result.metadata,
          },
        };
      }
      return result;
    },
  };
}
