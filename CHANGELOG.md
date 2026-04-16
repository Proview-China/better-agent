# Changelog

All notable changes to this repository should be recorded in this file.

The format follows a lightweight Keep a Changelog style and uses `Unreleased` until a tagged release exists.

## [Unreleased]

### Added

- explicit `requestSchemaVersion`, `responseSchemaVersion`, and `eventSchemaVersion` fields for `PraxisRuntimeInterface` / `PraxisFFI`
- decode-time rejection for unsupported schema versions while preserving legacy versionless payload compatibility
- machine-readable supported schema metadata on the `inspectArchitecture` / `bootstrapSnapshot` path
- `PraxisFFIEmbeddingExample` as the smallest shipped host embedding example
- `docs/PraxisFFICompatibility.md` to document the current FFI / runtime interface compatibility contract
- `docs/PraxisReleasePolicy.md` and `docs/PraxisMigrationNotes.md` as Phase 6 baseline release materials
- `docs/PraxisSupportMatrix.md` as the current exported-surface support matrix
- `docs/PraxisHighRiskCapabilitySafety.md` as the current high-risk capability safety note
- `PraxisExportBaselineExample` plus `docs/PraxisPerformanceBaseline.md` as the repeatable export latency/resource baseline

### Changed

- `PraxisRuntimeInterface` and `PraxisFFI` now publish version metadata as part of their encoded contract instead of relying on implicit repository knowledge
- README now links directly to the current FFI compatibility, release, and migration notes
