# 2026-04-13 Tool Review Governance Signal Kind Typed Contract

## What changed

- Introduced `PraxisToolReviewGovernanceSignalKind` in `PraxisTapToolReviewModels` and changed `PraxisToolReviewGovernanceSignal.kind` from `String` to the typed enum.
- Kept the JSON codec shape stable by using `governance_snapshot` as the enum raw value wire format.
- Updated the HostRuntime TAP inspection construction path in `PraxisUseCaseImplementations` so `toolReviewReport.signals` now uses `.governanceSnapshot` instead of a raw string literal.
- Added TAP review codec coverage for signal-kind raw-value round-trip stability and unknown raw-value decode rejection.
- Updated TAP governance support coverage to construct the governance signal through the typed enum surface.

## Why this stays scoped

- This package only seals the `PraxisToolReviewGovernanceSignal.kind` contract.
- It intentionally does not widen into advisory codes, trace IDs, session IDs, or other string-bearing fields in `PraxisTapReview`.
- No CLI, UI, platform, provider, or storage-specific semantics were added to the new enum.

## Validation

- `swift test --filter PraxisTapReviewTests`
- `swift test --filter PraxisTapArchitectureTests`
- `swift test --filter PraxisRuntimeUseCasesTests`

## Residual risk

- `PraxisToolReviewGovernanceSignalKind` currently contains only the single signal emitted by the existing HostRuntime TAP inspection path; future governance signals will need explicit enum cases and matching codec coverage.
- The package hardens the DTO contract and the known construction path, but it does not broaden `PraxisToolReviewReport` coverage across other runtime surfaces because no other signal constructors currently exist.
