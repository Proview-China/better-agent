# 2026-04-13 CMP aggregate/readback domain IDs

## What changed

- Tightened remaining aggregate/readback CMP IDs in `PraxisRuntimeUseCases` from raw `String` to existing domain IDs where the domain type already existed.
- Tightened matching façade DTO snapshots in `PraxisRuntimeFacades` without changing outward JSON wire shape.
- Kept `PraxisRuntimeInterface` untouched for this package.

## Scope

- `PraxisCmpRolesReadback.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpControlReadback.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpStatusReadback.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpRolesPanelSnapshot.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpControlPanelSnapshot.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpStatusPanelSnapshot.latestPackageID` -> `PraxisCmpPackageID?`
- `PraxisCmpFlowIngestSnapshot.requestID` -> `PraxisCmpRequestID`

## Why this belongs to the host-neutral closeout

- These fields were still leaking aggregate CMP identity as weak strings inside the host-neutral middle layer even though stable CMP domain IDs already existed.
- The package only tightened DTO/readback identity shape; it did not add business rules, did not change runtime/interface routing, and did not introduce a new reference abstraction.
- JSON stays string-shaped because the typed IDs preserve their `Codable` raw-value encoding.

## Validation

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test --filter PraxisRuntimeFacadesTests`
- `swift test --filter HostRuntimeSurfaceTests`
- `swift test`

All passed. Full snapshot after this package: `331 tests / 53 suites`.

## Residuals

- `PraxisRuntimeInterfaceRequestCmpHistoryPayload` still exposes `PraxisCmpHistoricalContextQuery` directly at the interface boundary instead of a thinner reference-only boundary shape.
- Some aggregate/readback surfaces outside this package still carry opaque string fields where there is no immediate existing domain ID or where tightening would expand scope.
- This package intentionally did not touch `Run`, `Transition`, `State`, UI/TUI/GUI, or TypeScript.
