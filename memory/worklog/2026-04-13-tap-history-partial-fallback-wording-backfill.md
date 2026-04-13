# TAP History Partial Fallback Persisted Wording Backfill

## What Changed

- Added a focused `PraxisRuntimeUseCasesTests` regression for the partial fallback path where
  `tapRuntimeEventStore` is missing but `cmpPeerApprovalStore` still returns persisted approval
  descriptors.
- The new test asserts that `readbackTapHistory.summary` keeps persisted wording instead of
  collapsing to `current approval activity view`.
- Added a narrow test helper that removes only the TAP runtime event store from an otherwise
  unchanged local host adapter registry so the fallback path stays isolated.

## Why This Package Exists

- `05386d7` tightened CMP/TAP readback wording truth, but review identified a remaining coverage
  gap around TAP history partial fallback.
- That path matters because persisted approval descriptors are still truth-bearing even when the
  append-only TAP runtime event store is unavailable.
- This package backfills the missing regression net without expanding the wording sweep or changing
  interface/facade wire shapes.

## Validation

- Ran `swift test --filter PraxisRuntimeUseCasesTests`
- Ran `swift test`
  - `PraxisRuntimeUseCasesTests` stayed green, including the new partial fallback assertion.
  - Full suite passed with `354 tests / 53 suites`.

## Residual Notes

- This package only locks the missing-event-store partial fallback path.
- It does not add separate coverage for the variant where the TAP runtime event store exists but
  returns an empty result set while persisted approval descriptors remain available.
