# 2026-04-13 RuntimeInterface requestCmpHistory boundary cleanup

## What changed

- Replaced `PraxisRuntimeInterfaceRequestCmpHistoryPayload.query: PraxisCmpHistoricalContextQuery` with a dedicated interface-side type: `PraxisRuntimeInterfaceCmpHistoryQuery`.
- Kept the interface query host-neutral and boundary-specific by expressing only interface-facing fields:
  - `snapshotID: PraxisRuntimeInterfaceReferenceID?`
  - `lineageID: PraxisRuntimeInterfaceReferenceID?`
  - `branchRef: String?`
  - `packageKindHint: PraxisCmpContextPackageKind?`
  - `projectionVisibilityHint: PraxisCmpProjectionVisibilityLevel?`
  - `metadata: [String: PraxisValue]`
- Added a thin service-side mapping in `PraxisRuntimeInterfaceServices` so `requestCmpHistory` still calls the existing use-case layer with `PraxisCmpHistoricalContextQuery`.

## Why this belongs to the host-neutral closeout

- The runtime interface no longer exposes a use-case/domain query model directly on its request payload.
- The package does not change `PraxisRequestCmpHistoryCommand` or the CMP historical query truth model.
- The change is limited to boundary DTO ownership and thin mapping; it does not add business rules or broaden scope into UI, runtime state, or other request paths.

## Validation

- `swift test --filter HostRuntimeInterfaceTests`
- `swift test`

Both passed. Full snapshot after this package: `336 tests / 53 suites`.

## Residuals

- `requestCmpHistory` now owns its boundary query shape, but other interface payloads may still carry older boundary/model coupling that should be evaluated separately.
- This package intentionally did not tighten `Run`, `Transition`, `State`, UI/TUI/GUI, or TypeScript surfaces.
