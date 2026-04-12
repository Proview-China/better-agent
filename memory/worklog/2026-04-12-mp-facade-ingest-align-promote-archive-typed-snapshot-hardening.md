# 2026-04-12 MP Facade Ingest/Align/Promote/Archive Typed Snapshot Hardening

## What changed

- Tightened `PraxisMpIngestSnapshot` and `PraxisMpAlignSnapshot` so `decision`, `freshnessStatus`, and `alignmentStatus` now use existing MP typed enums instead of `String`.
- Tightened `PraxisMpPromoteSnapshot` and `PraxisMpArchiveSnapshot` so `scopeLevel`, `sessionMode`, `visibilityState`, and `promotionState` now use existing MP typed enums instead of `String`.
- Updated `PraxisMpFacade` mappings to pass through typed MP values directly instead of flattening them through `.rawValue`.
- Updated facade workflow assertions to validate typed enum fields instead of string literals.
- Added facade-level codec coverage for:
  - ingest/promote typed round-trip
  - align/archive invalid raw value decode failure

## Why this belongs to the host-neutral track

- These four snapshots are facade-owned DTOs used to keep MP host access out of CLI/UI-specific presentation buckets.
- Leaving enum semantics as free strings here would keep a weak seam in the host-neutral middle layer even though upstream MP models are already typed.
- This package closes that seam without expanding `RuntimeInterface` or introducing host-specific wording.

## Validation

- Ran `swift test --filter PraxisRuntimeFacadesTests`

## Residual risks

- `PraxisMpSearchHitSnapshot` and `PraxisMpReadbackSnapshot` still contain other stringly MP semantics outside this package scope.
- The outer `RuntimeInterface` remains summary-only for MP and does not yet surface these typed facade snapshots directly.
- This package hardens facade DTOs only; any remaining weak typing upstream or downstream must be closed in later packages.

## Next entry point

- Continue with the remaining MP facade DTO surfaces that still flatten typed enum semantics through strings, especially search/readback-oriented snapshot fields that are already backed by typed MP models.
