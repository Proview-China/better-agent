# 2026-04-13 MP/CMP Boundary Semantics Matrix Hardening

## What Changed

- Strengthened `HostRuntimeInterfaceTests` around recent MP boundary weak spots with real `runtimeInterface.handle(...)` coverage instead of DTO-only assertions.
  - Added stable rejection coverage for blank `memoryID` on `alignMp` / `promoteMp` / `archiveMp`.
  - Added stable rejection coverage for blank `requesterAgentID` on `resolveMp` / `requestMpHistory`.
  - Added an explicit empty-string rejection path for `checkedSnapshotRef` on `ingestMp`, alongside the earlier whitespace-only guard.
  - Added anti-canonicalization coverage showing padded `requesterAgentID`, padded `sessionID`, and ordered `scopeLevels` are preserved as-is on `resolveMp` / `requestMpHistory`.
- Expanded the existing real-path `PraxisRuntimeUseCasesTests` MP workflow test so it now covers:
  - `align`
  - `archive`
  - `requestHistory`
  - encoded command/result payloads for those paths
  - stable ID list shape assertions for mutation/history payloads
  - forbidden presentation-field assertions on both command and result JSON
- Expanded the existing real-path `PraxisRuntimeFacadesTests` MP workflow snapshot test so it now covers:
  - `align`
  - `archive`
  - `resolve`
  - `requestHistory`
  - stable ID list shape assertions on facade snapshots
  - forbidden host/presentation-field assertions across all touched snapshots

## Why This Package Exists

- The previous two MP packages established representative boundary coverage, but some exact-match and requester-identity paths were still under-specified.
- This package converts those remaining high-risk gaps into testable invariants without widening scope into a new model migration or service refactor.
- The focus stays on host-neutral boundary behavior:
  - no silent trim/canonicalization of request identifiers
  - no accidental relaxation from “explicit bad value” to “missing value”
  - no host/presentation wording injected into use-case or facade result payloads

## Files Touched

- `Tests/PraxisHostRuntimeArchitectureTests/HostRuntimeInterfaceTests.swift`
- `Tests/PraxisRuntimeUseCasesTests/PraxisRuntimeUseCasesTests.swift`
- `Tests/PraxisRuntimeFacadesTests/PraxisRuntimeFacadesTests.swift`
- `memory/worklog/2026-04-13-mp-cmp-boundary-semantics-matrix-hardening.md`

## Validation

- Intended validation for this package:
  - `swift test --filter HostRuntimeInterfaceTests`
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test`

## Residuals

- Coverage is stronger, but still intentionally selective rather than exhaustive.
- This package does **not** perform:
  - full typed migration of `projectID` / `sessionID` / `memoryID`
  - `RuntimeInterfaceServices` refactors
  - HostContracts/provider/browser/user-io seam changes
  - CLI/TUI/GUI/TS work
- The package is still MP-heavy despite the broader `MP/CMP boundary semantics` label. Recent risk concentration was on MP boundary invariants, so CMP did not receive a parallel new matrix here.
- Existing dedicated promote-path tests remain elsewhere; this package deliberately avoided widening into additional promotion-state transition setup once that started pulling on domain state-machine rules instead of boundary semantics.
