# 2026-04-13 CMP command lineageID typed neutral cleanup

## What changed

- Tightened the remaining CMP flow/recovery command `lineageID` fields in `PraxisRuntimeUseCases` from `String?` to `PraxisCmpLineageID?`.
- Updated the use-case implementation path to accept typed lineage identifiers directly instead of re-wrapping command strings inside the neutral layer.
- Kept thin source-compatibility initializers on the command DTOs so `PraxisRuntimeInterface` can continue passing optional string lineage values without changing its wire contract in this package.
- Compatibility is intentionally narrow: public source construction now has three explicit paths.
- Omit `lineageID` to request no-lineage behavior.
- Pass `lineageID: PraxisCmpLineageID(...)` for the typed neutral path.
- Pass `lineageID: String?` only for legacy source compatibility, including existing interface-side optional-string callers.
- Module-internal optional typed chaining uses a separate canonical initializer so this compatibility does not leak overload ambiguity into public call sites.
- Kept `Codable` wire shape stable so command JSON still encodes `lineageID` as a plain string.

## Why now

- These command DTOs were the last obvious `lineageID` weak spots inside `PraxisRuntimeUseCases` after interface opaque references and aggregate/readback IDs were already tightened.
- This is host-neutral contract cleanup only. It does not change runtime business rules, interface shape, or execution state models.

## Verification

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test`

## Residuals

- `PraxisRuntimeInterface` history/query shapes are unchanged in this package; this work only preserves its existing string command construction path.
- No broader `Run` / `Transition` / state-model ID cleanup was attempted.
