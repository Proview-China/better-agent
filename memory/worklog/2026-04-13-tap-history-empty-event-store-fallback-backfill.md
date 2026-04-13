# TAP History Empty Event Store Fallback Wording Backfill

## What Changed

- Added a focused `PraxisRuntimeUseCasesTests` regression for the path where
  `tapRuntimeEventStore` is present but returns an empty result set while
  `cmpPeerApprovalStore` still exposes persisted approval descriptors.
- The new test asserts that `readbackTapHistory.summary` keeps persisted approval activity wording
  instead of falling back to `current approval activity view`.
- Added a narrow test helper that swaps only the TAP runtime event store with an empty in-memory
  fake so the fallback path stays isolated from the missing-store variant covered in `2e29833`.

## Why This Package Exists

- `2e29833` backfilled the missing-event-store partial fallback path, but left one explicit coverage
  gap: the event store can also be present and readable while still returning no records.
- That variant should preserve the same truth boundary because persisted CMP approval descriptors
  remain available and continue to anchor the readback summary.
- This package closes that robustness gap without widening the wording sweep or changing any use
  case, facade, or interface wire shape.

## Validation

- Ran `swift test --filter PraxisRuntimeUseCasesTests`
  - The new empty-event-store fallback assertion passed.

## Residual Notes

- This package only backfills the `event store present but empty` fallback branch.
- It does not add broader matrix coverage for other mixed TAP/CMP readback provenance combinations.
