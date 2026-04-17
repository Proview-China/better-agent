# Praxis Preview Release Checklist

## Release Intent

Target the first preview only after repository entry docs, support matrix, release notes, and public CI all describe the same Swift baseline.

## Required Checks

```bash
swift test
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitSearchExample
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite all
```

## Required Docs

- `README.md`
- `CHANGELOG.md`
- `docs/PraxisRepositoryBaseline.md`
- `docs/PraxisFFICompatibility.md`
- `docs/PraxisReleasePolicy.md`
- `docs/PraxisMigrationNotes.md`
- `docs/PraxisSupportMatrix.md`
- `docs/PraxisHighRiskCapabilitySafety.md`
- `docs/PraxisPerformanceBaseline.md`

## Required Decisions

- preview version string selected
- blocking CI workflow green on the release branch
- Linux placeholder language reviewed for honesty
- release note explicitly calls out contract vs enforced behavior where relevant
