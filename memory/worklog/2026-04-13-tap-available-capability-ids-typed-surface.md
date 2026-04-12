# 2026-04-13 TAP available capability IDs typed surface

## What changed

- Hardened the TAP status capability inventory chain so the host-neutral contracts below now expose `availableCapabilityIDs` as `[PraxisCapabilityID]` instead of `[String]`:
  - `PraxisTapStatusReadback`
  - `PraxisTapStatusSnapshot`
- Kept the wire shape stable by relying on `PraxisCapabilityID`'s existing `Codable` form, so TAP status JSON still round-trips as a string array.
- Removed the last DTO-only downgrade in `readbackTapStatus(...)`: the use-case now passes the typed list returned by `hostCapabilityIDs(from:)` straight through the neutral readback contract instead of projecting it down to raw strings first.
- Left `availableCapabilityCount` unchanged and did not expand this package into other capability fields or inventory targets.

## Why this package belongs to the host-neutral lane

- `availableCapabilityIDs` is part of the neutral TAP status surface, not display text. Keeping it typed prevents the facade layer from reintroducing stringly capability identity after the previous `capabilityKey` package.
- The package stays within the intended scope: it only seals the remaining TAP status list field and does not widen into peer approval, TAP history, or capability catalog modeling.
- No CLI, UI, platform, or provider-specific semantics were added.

## Tests run

- `swift test --filter PraxisRuntimeUseCasesTests`
- `swift test --filter PraxisRuntimeFacadesTests`
- `swift test --filter HostRuntimeInterfaceTests`
- `swift test --filter HostRuntimeSurfaceTests`
- `swift test`

## Residual notes

- `PraxisRuntimeInterfaceSnapshot` still does not expose `availableCapabilityIDs`; the runtime interface continues to surface TAP status there as a summary-oriented snapshot, so no dedicated interface list field was added in this package.
- Capability inventory modeling outside TAP status remains intentionally out of scope. If the project later wants stronger validation than opaque `PraxisCapabilityID` strings, that should be a separate package at the capability catalog boundary rather than in TAP status DTOs.
