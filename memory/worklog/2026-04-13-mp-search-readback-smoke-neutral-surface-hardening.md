## 2026-04-13 - MP search/readback/smoke neutral surface hardening

### What changed

- Added `HostRuntimeInterfaceTests` coverage for `searchMp`, `readbackMp`, and `smokeMp` request codec roundtrip with stable string wire shape.
- Added real `runtimeInterface.handle(...)` boundary-behavior tests for those three MP paths.
  - `searchMp` now has explicit regression coverage for blank `projectID` rejection and blank `query` rejection.
  - `searchMp` and `readbackMp` now have representative anti-canonicalization coverage for padded `projectID` / `sessionID`, ordered `scopeLevels`, and `includeSuperseded`.
  - `smokeMp` now has representative anti-canonicalization coverage for padded `projectID`.
- Added `PraxisRuntimeUseCasesTests` coverage that executes real `PraxisSearchMpUseCase`, `PraxisReadbackMpUseCase`, and `PraxisSmokeMpUseCase` paths against host adapter stubs.
  - These tests assert the current baseline boundary semantics:
    - `search/readback` emit canonicalized memory-truth identifiers and project IDs.
    - `smoke` keeps the request project ID surface unchanged.
    - Encoded payloads remain free of presentation-only keys.
- Added `PraxisRuntimeFacadesTests` coverage that executes the real runtime facade path for MP search/readback/smoke.
  - These tests assert the same current-baseline output semantics and host-neutral payload-shape guarantees at the facade layer.

### Why this package

- The previous MP boundary package hardened `ingest / align / promote / archive / resolve / requestHistory`.
- `search / readback / smoke` were still missing the same level of request codec and representative boundary-behavior coverage across `RuntimeInterface -> UseCase -> Facade`.
- This package closes that gap without changing MP domain models or widening host contracts.

### Files touched

- `Tests/PraxisHostRuntimeArchitectureTests/HostRuntimeInterfaceTests.swift`
- `Tests/PraxisRuntimeUseCasesTests/PraxisRuntimeUseCasesTests.swift`
- `Tests/PraxisRuntimeFacadesTests/PraxisRuntimeFacadesTests.swift`
- `memory/worklog/2026-04-13-mp-search-readback-smoke-neutral-surface-hardening.md`

### Validation

- Planned:
  - `swift test --filter HostRuntimeInterfaceTests`
  - `swift test --filter PraxisRuntimeUseCasesTests`
  - `swift test --filter PraxisRuntimeFacadesTests`
  - `swift test`

### Residual notes

- Coverage is representative, not exhaustive.
- This package does not introduce full typed migration for MP `projectID / sessionID / memoryID`.
- This package does not refactor `PraxisRuntimeInterfaceServices`.
- This package does not touch HostContracts seams, UI/TUI/GUI/TS, or local-baseline execution semantics.
