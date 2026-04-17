# Changelog

All notable changes to this repository should be recorded in this file.

The format follows a lightweight Keep a Changelog style and uses `Unreleased` until a tagged release exists.

## [Unreleased]

### Planned

- first public preview baseline aligned around the current outward-facing RuntimeKit, embedding, and native demo-host story

### Added

- explicit `requestSchemaVersion`, `responseSchemaVersion`, and `eventSchemaVersion` fields for `PraxisRuntimeInterface` / `PraxisFFI`
- decode-time rejection for unsupported schema versions while preserving legacy versionless payload compatibility
- machine-readable supported schema metadata on the `inspectArchitecture` / `bootstrapSnapshot` path
- `PraxisFFIEmbeddingExample` as the smallest shipped host embedding example
- shipped RuntimeKit example and smoke paths for the current preview baseline, including governed execution, durable runtime recovery/provisioning readback, reviewer context, and capability verification
- `docs/PraxisFFICompatibility.md` to document the current FFI / runtime interface compatibility contract
- `docs/PraxisReleasePolicy.md` and `docs/PraxisMigrationNotes.md` as Phase 6 baseline release materials
- `docs/PraxisSupportMatrix.md` as the current exported-surface support matrix
- `docs/PraxisHighRiskCapabilitySafety.md`, `docs/PraxisReviewerContextGuide.md`, and `docs/PraxisDurableRuntimeGuide.md` as the current governed-execution, reviewer-context, and durable-runtime reference set
- `PraxisExportBaselineExample` plus `docs/PraxisPerformanceBaseline.md` as the repeatable export latency/resource baseline
- `docs/PraxisPositioning.md`, `docs/PraxisEvaluationChecklist.md`, and `docs/PraxisPreviewReleaseNote.md` as the external positioning and evaluation materials for the first preview
- `PraxisDemoHostApp`, `docs/PraxisDemoHost.md`, and the local build/run script path as the first native macOS demo-host baseline

### Changed

- `PraxisRuntimeInterface` and `PraxisFFI` now publish version metadata as part of their encoded contract instead of relying on implicit repository knowledge
- README and preview release materials now point outside evaluators at the current support, safety, migration, performance, positioning, evaluation, and demo-host sources instead of a repository-truth-only checkpoint
