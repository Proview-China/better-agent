## 2026-04-12 MP Search Hit Typed Snapshot Hardening

### What changed

- Tightened `PraxisMpSearchHitSnapshot` so `scopeLevel`, `memoryKind`, `freshnessStatus`, and `alignmentStatus` now use existing MP typed enums instead of `String`.
- Updated MP facade search mapping to pass those typed values through directly instead of re-encoding from `.rawValue`.
- Expanded facade tests to assert typed search-hit values from runtime search results, plus a dedicated round-trip and invalid raw value decode failure test for `PraxisMpSearchHitSnapshot`.

### Why this belongs to the host-neutral surface

- `PraxisMpSearchHitSnapshot` is a host-neutral DTO exposed by the runtime facade.
- Keeping enum semantics as raw strings here left room for host-facing code to treat stable MP semantics as presentation text.
- This package keeps the contract aligned with the typed MP use case output without expanding `RuntimeInterface` or touching UI-facing layers.

### Validation

- `swift test --filter PraxisRuntimeFacadesTests`

### Residual risks

- This package only hardens `PraxisMpSearchHitSnapshot`; `readback` breakdown maps remain string-keyed and are intentionally deferred.
- The outermost `RuntimeInterface` MP export is still summary-oriented and does not expose this typed search-hit shape directly.
