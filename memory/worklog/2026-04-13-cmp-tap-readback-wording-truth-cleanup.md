# 2026-04-13 CMP/TAP Readback Wording Truth Cleanup

## What Changed

- Tightened CMP/TAP readback summaries in `PraxisUseCaseImplementations.swift` so they no longer describe every readable state as a blanket `host-backed truth`.
- Kept `persisted` wording only where the code is actually reconstructing from stored review state or append-only TAP runtime events:
  - CMP peer approval readback now says `persisted review state` only on the found path.
  - TAP history keeps `persisted` wording only when persisted descriptors or runtime events are actually present.
- Downgraded broader CMP/TAP readback wording to `current ... state` where fallback or store-missing paths can still produce a valid host-neutral surface:
  - TAP status now summarizes `current governance state`.
  - CMP roles now summarize `current projections, packages, and delivery state`.
  - CMP control now summarizes `current runtime state`.
- Updated the matching public `///` comments for the affected readback use cases so their responsibilities match the real fallback semantics.
- Added use-case regression coverage for missing-store readbacks:
  - verifies `tapStatus`, `tapHistory`, `cmpRoles`, and `cmpControl` all keep truthful wording when CMP/TAP stores are absent
  - verifies the control readback still resolves the default control surface on fallback

## Why This Package Exists

- The remaining risk on the CMP/TAP side was no longer model shape or wire shape. It was wording drift inside the host-neutral middle layer.
- Several summaries were still collapsing different sources of truth into a vague `host-backed` or always-`persisted` claim, even when the implementation could return fallback/default views with missing stores.
- This package makes those summaries describe what the runtime actually read:
  - persisted review state
  - append-only runtime events
  - current resolved governance / control / projection state
- That keeps the middle layer host-neutral without overstating provenance or implying a stronger storage contract than the code actually guarantees.

## Files Touched

- `Sources/PraxisRuntimeUseCases/PraxisUseCaseImplementations.swift`
- `Tests/PraxisRuntimeUseCasesTests/PraxisRuntimeUseCasesTests.swift`

## Validation

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test`

## Residual Risks

- This package only cleans the CMP/TAP readback wording called out in the current review loop. It is not a repository-wide wording sweep.
- The partial fallback path where TAP runtime events are missing but peer-approval descriptors still exist is covered by current behavior, but not yet by a dedicated standalone assertion.
