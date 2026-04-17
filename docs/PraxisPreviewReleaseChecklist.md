# Praxis Preview Release Checklist

## Release Intent

This checklist prepares `v0.1.0-preview.1` as the first Praxis preview cut. It remains a pre-tag, unpublished target.

Target the first preview only after the outward-facing docs, RuntimeKit examples/smoke paths, export checks, and native demo host all describe the same macOS-first public baseline.

## Release Target

- selected first preview version: `v0.1.0-preview.1`
- release state: pre-tag preparation only
- publication state: no tag yet, not yet published
- canonical evidence source: [PraxisPreviewReleaseEvidence.md](./PraxisPreviewReleaseEvidence.md)
- version-scoped draft handoff package: [releases/v0.1.0-preview.1/README.md](./releases/v0.1.0-preview.1/README.md)

## Public Blocking CI Baseline

The release branch should be green on the public macOS blocking workflow before preview sign-off.
That workflow should cover:

### RuntimeKit examples, export checks, and focused smoke suites

```bash
swift test
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCmpTapExample
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitGovernedExecutionExample
swift run PraxisRuntimeKitSearchExample
swift run PraxisRuntimeKitDurableRuntimeExample
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite search
swift run PraxisRuntimeKitSmoke --suite cmp-tap
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite provisioning
swift run PraxisRuntimeKitSmoke --suite capabilities
swift run PraxisRuntimeKitSmoke --suite code
swift run PraxisRuntimeKitSmoke --suite code-sandbox
swift run PraxisRuntimeKitSmoke --suite code-patch
swift run PraxisRuntimeKitSmoke --suite shell
swift run PraxisRuntimeKitSmoke --suite shell-approval
swift build --product PraxisDemoHostApp
```

This public CI baseline covers the current macOS-first preview baseline, including demo-host build proof, but not native app launch verification.

## Release-Only Additional Verification

Run these heavier local checks before preview sign-off:

```bash
swift run PraxisRuntimeKitSmoke --suite all
./script/build_and_run.sh --verify
```

Use `PraxisRuntimeKitSmoke --suite all` as the aggregate regression sweep and `./script/build_and_run.sh --verify` as native demo-host launch evidence.

Record the command evidence in [PraxisPreviewReleaseEvidence.md](./PraxisPreviewReleaseEvidence.md), keep this checklist as the generic rules layer, then use [releases/v0.1.0-preview.1/README.md](./releases/v0.1.0-preview.1/README.md) as the concrete pre-tag handoff package derived for this version.

## Required Docs

- `README.md`
- `CHANGELOG.md`
- `docs/PraxisPreviewReleaseNote.md`
- `docs/PraxisPreviewReleaseEvidence.md`
- `docs/releases/v0.1.0-preview.1/README.md`
- `docs/releases/v0.1.0-preview.1/RELEASE_NOTE.md`
- `docs/releases/v0.1.0-preview.1/CHECKLIST.md`
- `docs/PraxisPositioning.md`
- `docs/PraxisEvaluationChecklist.md`
- `docs/PraxisDemoHost.md`
- `docs/PraxisRepositoryBaseline.md`
- `docs/PraxisFFICompatibility.md`
- `docs/PraxisReleasePolicy.md`
- `docs/PraxisMigrationNotes.md`
- `docs/PraxisSupportMatrix.md`
- `docs/PraxisHighRiskCapabilitySafety.md`
- `docs/PraxisReviewerContextGuide.md`
- `docs/PraxisDurableRuntimeGuide.md`
- `docs/PraxisPerformanceBaseline.md`

## Required Decisions

- preview version string selected
- `v0.1.0-preview.1` is threaded through the release-facing docs as a pre-tag first preview target
- blocking CI workflow green on the release branch
- canonical evidence is captured through `docs/PraxisPreviewReleaseEvidence.md` before any future tag is cut
- the version-scoped draft package under `docs/releases/v0.1.0-preview.1/` is internally linked and ready as a later tag handoff set derived from the generic preview docs
- Linux placeholder / degraded language reviewed for honesty
- governed execution wording keeps declared contract separate from enforced host behavior where relevant
- durable runtime and reviewer-context wording stays scoped to recovery/readback evidence rather than a general execution-console claim
- native demo host build/run evidence is accepted as the current macOS host baseline, not as a product-shell parity claim
- positioning, evaluation, support, safety, performance, release, and migration materials all tell the same public preview story
