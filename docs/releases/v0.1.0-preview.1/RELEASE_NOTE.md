# Praxis v0.1.0-preview.1

## Release Status

`v0.1.0-preview.1` is a prepared first preview draft.
This document is copy-ready release-note material for a later tag review, but the repository has not created the tag and has not published a GitHub Release.

## What This Preview Covers

This first preview exposes the current Praxis public baseline for Swift, Apple-hosted embedding, and one native macOS demo-host lane without pretending that the repository is already a fully mature cross-platform agent framework.

The current draft scope covers:

- `PraxisRuntimeKit` as the default Swift integration surface
- `PraxisRuntimeInterface` and `PraxisFFI` as the current encoded export boundary
- the current host-embedding examples, including schema-versioned request, response, and event fields
- the current governed-execution, reviewer-context, durable-runtime, and search examples plus smoke coverage
- one native macOS demo-host baseline that proves the exported bridge can be hosted outside terminal-only examples

## Verification Baseline

The baseline verification inputs for this draft are defined centrally in [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md).

The expected first-preview command set is:

```bash
swift test
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitCmpTapExample
swift run PraxisRuntimeKitGovernedExecutionExample
swift run PraxisRuntimeKitSearchExample
swift run PraxisRuntimeKitDurableRuntimeExample
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite all
swift build --product PraxisDemoHostApp
./script/build_and_run.sh --verify
```

Use the shared evidence document as the proof source, and use the generic preview docs as the upstream rules and baseline source.
This version-scoped release note is intentionally a derived draft package artifact and does not retain separate command results.

## Platform Scope

This preview is macOS-first.
It includes one native macOS demo-host baseline and the current Swift embedding/export surfaces that outside evaluators can inspect today.

Linux remains placeholder or degraded where [../../PraxisSupportMatrix.md](../../PraxisSupportMatrix.md) documents reduced behavior or non-parity.
The preview should therefore be read as a bounded public baseline, not as a claim of cross-platform feature parity.

## Known Non-Claims

This preview does not claim:

- Linux parity with the current macOS local baseline
- unrestricted shell or code execution, PTY support, or streaming-shell parity
- kernel-enforced sandbox isolation merely because a sandbox contract is publicly inspectable
- identical capability behavior across every host profile
- a finalized general-purpose cross-platform UI or host product surface

Where the host runtime documents a contract more strongly than it enforces today, read that contract as a declared caller-facing boundary rather than as a stronger implementation guarantee.

## Linked Reference Docs

- generic preview release source-of-truth note: [../../PraxisPreviewReleaseNote.md](../../PraxisPreviewReleaseNote.md)
- shared release evidence: [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md)
- version-scoped draft checklist: [CHECKLIST.md](./CHECKLIST.md)
- release policy: [../../PraxisReleasePolicy.md](../../PraxisReleasePolicy.md)
- support matrix: [../../PraxisSupportMatrix.md](../../PraxisSupportMatrix.md)
- high-risk capability safety note: [../../PraxisHighRiskCapabilitySafety.md](../../PraxisHighRiskCapabilitySafety.md)
- native macOS demo-host guide: [../../PraxisDemoHost.md](../../PraxisDemoHost.md)
