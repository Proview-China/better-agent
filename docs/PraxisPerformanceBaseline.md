# Praxis Export Performance Baseline

This note defines the current Phase 6 performance and resource baseline for the exported runtime surface.

It intentionally measures only the thin host-neutral export path:

1. open one opaque runtime interface session
2. send `inspectArchitecture`
3. drain the encoded event envelope
4. send `runGoal`
5. drain the encoded event envelope again

It does not measure:

- network transport outside the in-process FFI bridge
- provider latency
- UI rendering
- terminal presentation
- future Linux-native host implementations

## Baseline Command

Run the shipped export baseline example:

```bash
swift run PraxisExportBaselineExample --iterations 5 --format json
```

Use `--format text` for a compact human-readable summary.
Use `--root /tmp/praxis-export-baseline` when you want a stable runtime directory across repeated runs.

## Report Fields

The baseline example emits one archive-friendly report with:

- session open latency
- `inspectArchitecture` round-trip latency
- `inspectArchitecture` event drain latency
- `runGoal` round-trip latency
- `runGoal` event drain latency
- encoded request / response / event envelope byte sizes
- buffered event counts
- resident memory before / peak / after when the host can sample it
- negotiated request / response / event schema versions
- declared support for legacy versionless payload compatibility

## Current Interpretation Rules

- Treat this report as an export-surface baseline, not an end-to-end product benchmark.
- Compare runs captured with the same iteration count and similar local machine load.
- Investigate regressions when latency or resident memory shifts materially without a matching contract change.
- Linux currently remains a compile-safe placeholder / degraded host path, so baseline comparisons should be anchored on the macOS local baseline until a real Linux adapter exists.

## Suggested Release Check

Before tagging an exported-surface release, run:

```bash
swift test
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
```

Archive the JSON output together with the release note or internal milestone evidence so contract and baseline drift can be reviewed together.

## Reference Sample

One local reference sample captured on 2026-04-17 (Asia/Shanghai) with:

```bash
swift run PraxisExportBaselineExample --iterations 5 --format json
```

reported:

- `sessionOpenMilliseconds.average = 0.078`
- `architectureRoundTripMilliseconds.average = 0.059`
- `architectureDrainMilliseconds.average = 0.011`
- `runRoundTripMilliseconds.average = 4.425`
- `runDrainMilliseconds.average = 0.016`
- `architectureRequestBytes.average = 57`
- `architectureResponseBytes.average = 346`
- `runRequestBytes.average = 223`
- `runResponseBytes.average = 1626`
- `runEventCounts.average = 2`
- `residentMemory.beforeBytes = 9,338,880`
- `residentMemory.peakBytes = 16,498,688`
- `residentMemory.afterBytes = 16,498,688`

Treat this as a repository baseline sample rather than a hard SLA. The main value is keeping a stable report shape and a rough regression anchor for future export-surface changes.
