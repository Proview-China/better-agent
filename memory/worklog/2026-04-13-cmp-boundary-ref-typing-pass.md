# 2026-04-13 CMP boundary ref typing pass

## What changed

- Introduced `PraxisCmpRefName` in `PraxisCmpTypes` as the minimal host-neutral typed wrapper for CMP branch/base/history ref hints.
- Typed the CMP boundary ref chain across:
  - `PraxisRuntimeInterfaceRecoverCmpProjectRequestPayload.branchRef`
  - `PraxisRuntimeInterfaceCommitCmpFlowRequestPayload.baseRef`
  - `PraxisRuntimeInterfaceResolveCmpFlowRequestPayload.branchRef`
  - `PraxisRuntimeInterfaceCmpHistoryQuery.branchRef`
  - `PraxisRecoverCmpProjectCommand.branchRef`
  - `PraxisCommitCmpFlowCommand.baseRef`
  - `PraxisResolveCmpFlowCommand.branchRef`
  - `PraxisCmpHistoricalContextQuery.branchRef`
  - `PraxisCommitContextDeltaInput.baseRef`
  - `PraxisResolveCheckedSnapshotInput.branchRef`
- Kept the JSON wire shape stable by encoding these values as plain strings through the wrapper's single-value `Codable` implementation.
- Added runtime-interface validation so decoded blank optional CMP refs fail with stable `invalid_input` errors when handled through the runtime-interface request path, while both legacy-string and direct-typed command/query initializers normalize blank refs to `nil`.
- Updated `PraxisCmpDelivery` to compare the typed history branch hint against persisted snapshot branch strings without widening the boundary back to raw text.

## Why this belongs to the host-neutral runtime line

- The change removes a remaining stringly-typed seam from the CMP input/query/command path without introducing CLI, UI, provider, or SQLite semantics.
- `PraxisCmpRefName` is intentionally small: it carries only normalized boundary text and does not grow into a broader Git topology model.
- `RuntimeInterface` still exports strings on the wire, but `UseCases` and the CMP domain query path no longer treat free-form `String` as the only source of truth.

## Validation

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test --filter HostRuntimeInterfaceTests`
- `swift test`

## Residual risk

- `PraxisCmpRefName` currently normalizes whitespace, and the surrounding boundary initializers collapse blank refs to `nil`, but it does not try to enforce full Git ref grammar. That remains outside this residual typing pass.
- Output-side CMP DTOs and persisted descriptor metadata still use plain strings where they are already stable external/readback shapes; this package only tightened the input/query/command chain.

## Next entry point

- Continue from the remaining non-UI residual list, with priority on deeper host-contract hardening rather than further widening CMP ref scope into a full Git domain rewrite.
