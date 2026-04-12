# 2026-04-13 Runtime Interface Opaque Reference ID Hardening

## What changed

- Introduced `PraxisRuntimeInterfaceReferenceID` in `Sources/PraxisRuntimeInterface/PraxisRuntimeInterfaceModels.swift` as a host-neutral opaque reference wrapper.
- Kept the JSON wire shape stable by encoding and decoding `PraxisRuntimeInterfaceReferenceID` as a single string value instead of an object envelope.
- Tightened the outward-facing runtime interface surface to use the typed reference wrapper for:
  - `PraxisRuntimeInterfaceSnapshot.pendingIntentID`
  - `PraxisRuntimeInterfaceEvent.intentID`
  - `PraxisRuntimeInterfaceCommitCmpFlowRequestPayload.eventIDs`
- Updated `PraxisRuntimeInterfaceServices` to normalize outward-facing reference IDs at the interface boundary and to map them back to raw strings only when calling existing facade/use-case commands.
- Preserved the existing commit-flow validation contract:
  - empty `eventIDs` still returns `invalid_input`
  - blank `eventIDs` elements still return `invalid_input`
- Added a narrow behavior test that feeds a blank follow-up reference through the run facade path and verifies the runtime interface normalizes it to `nil` on both `pendingIntentID` and event `intentID`.
- Updated runtime interface and CLI tests to build and assert typed opaque reference IDs while keeping the host-neutral JSON contract stable.

## Why this stays scoped to the host-neutral interface layer

- The new type only models interface-level opaque references; it does not rename them into provider, CLI, UI, or transport-specific identifiers.
- No `Sources/PraxisRun/*`, `Sources/PraxisTransition/*`, or `Sources/PraxisState/*` internal ID models were changed.
- The service layer remains responsible for boundary normalization and validation, while downstream facades and use cases still receive the existing string payloads they already own.

## Validation

- `swift test --filter HostRuntimeInterfaceTests`
- `swift test --filter HostRuntimeSurfaceTests`
- `swift test --filter PraxisCLITests`
- `swift test`

Current full-suite snapshot: `324 tests / 53 suites` passing.

## Residual risk

- `PraxisRuntimeInterfaceReferenceID` currently hardens only the outward-facing interface references explicitly in scope for this package; deeper run/transition/state ID domains remain string-based by design.
- Other runtime interface reference-like fields such as checkpoint or package identifiers are still plain strings and may become future candidates if they need the same host-neutral opaque treatment.
