# 2026-04-12 MP Readback Typed Breakdown Map Hardening

## What Changed

- Added a minimal shared MP typed count-map in `PraxisMpTypes` so host-neutral contracts can carry enum-keyed breakdown maps without falling back to free-form strings.
- Tightened `PraxisMpReadback` and `PraxisMpReadbackSnapshot` to use:
  - `PraxisMpFreshnessBreakdownMap`
  - `PraxisMpAlignmentBreakdownMap`
  - `PraxisMpScopeBreakdownMap`
- Updated MP host result mapping to convert internal projection string maps into typed breakdown maps at the use-case boundary.
- Closed the public string-construction backdoor on the typed count-map API; invalid raw keys now fail as controlled `PraxisError.invariantViolation(...)` at the mapping boundary instead of crashing via `preconditionFailure`.
- Kept the semantic-memory projection layer unchanged; the host-neutral surface now becomes typed at the runtime use-case/facade seam.
- Updated fallback readback construction to use typed empty maps instead of raw empty dictionaries.

## Why This Package Exists

- `readback` was still exposing three string-keyed breakdown maps even after the rest of the MP surface had mostly moved to typed enums.
- Those maps were part of the host-neutral contract, so leaving them as `[String: Int]` kept a weakly-typed seam open in `RuntimeUseCases` and `RuntimeFacades`.

## Verification

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test --filter PraxisRuntimeFacadesTests`
- `swift test --filter HostRuntimeInterfaceTests`
- `swift test`

## Residual Risks

- The internal MP projection layer still computes breakdowns as raw string dictionaries, then converts them into typed maps at the host-runtime boundary. That is acceptable for this package's scope, but it is not yet end-to-end typed from the memory projection source.
- `RuntimeInterface` still stays out of scope for this package, so these typed breakdown maps are hardened only through the use-case/facade surface.

## Next Package Entry

- Continue shrinking remaining weak CMP/MP host-neutral seams, with `CMP recovery source` and adjacent recovery/readback typed fields as the next likely package.
