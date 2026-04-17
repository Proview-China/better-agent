# Praxis Preview Release Note

This document drafts the first Praxis preview release note for `v0.1.0-preview.1`. The target remains in pre-tag preparation and is not yet published.

This first preview exposes the current Praxis public baseline for Swift, Apple-hosted embedding, and one native macOS demo-host lane without pretending that the broader repository is already a fully mature cross-platform agent framework.

The goal of this preview is to make the current public contract reviewable from the outside: what the default Swift integration surface is, what the encoded export boundary looks like today, how the current embedding paths are expected to behave, and which verification commands and reference documents define the current baseline.

## Release Target

- selected first preview version: `v0.1.0-preview.1`
- release state: pre-tag preparation only
- publication state: no tag yet, not yet published

## Version-Scoped Draft Package

The concrete draft package for this prepared first preview lives at [releases/v0.1.0-preview.1/README.md](./releases/v0.1.0-preview.1/README.md).
It is a version-scoped handoff set derived from the generic preview docs in this directory, not the upstream source for preview rules or baseline truth.

Use the version-scoped package when you need the derived draft artifacts that could later be copied into a tag announcement or GitHub Release body:

- package index: [releases/v0.1.0-preview.1/README.md](./releases/v0.1.0-preview.1/README.md)
- draft release note body: [releases/v0.1.0-preview.1/RELEASE_NOTE.md](./releases/v0.1.0-preview.1/RELEASE_NOTE.md)
- version-scoped operational checklist: [releases/v0.1.0-preview.1/CHECKLIST.md](./releases/v0.1.0-preview.1/CHECKLIST.md)

The package stays intentionally draft-only. It is a prepared pre-tag handoff set, not proof that `v0.1.0-preview.1` is already tagged or published.

## What This First Preview Exposes

This preview is intended to expose seven things clearly:

- the default Swift integration surface through `PraxisRuntimeKit`
- the current encoded export boundary through `PraxisRuntimeInterface` and `PraxisFFI`
- the first public schema-versioned host-embedding story, including explicit request, response, and event schema version fields
- the current governed-execution, reviewer-context, and durable-runtime readback baseline through included examples and smoke coverage
- one native macOS demo-host baseline that proves the same exported bridge can be hosted outside terminal-only examples
- the current executable verification paths and public evaluation docs that outside evaluators can run without needing internal team context
- the current macOS-first support truth together with honest Linux placeholder or degraded semantics where parity is not yet implemented

In other words, this preview is less about breadth and more about making the current public runtime surfaces inspectable, testable, and documentable.

## Public Surfaces In Scope

The preview scope currently covers these outward-facing surfaces:

- `PraxisRuntimeKit` as the primary Swift integration surface for callers embedding Praxis in a Swift host
- `PraxisRuntimeInterface` as the current versioned encoded request and response contract
- `PraxisFFI` as the bridge-level export surface for host-boundary embedding
- `PraxisFFIEmbeddingExample` as the smallest included example of the encoded embedding path
- `PraxisAppleHostEmbeddingExample` as the more host-like Apple embedding flow with architecture negotiation first
- `PraxisRuntimeKitCmpTapExample` as the current reviewer-context and CMP/TAP readback example
- `PraxisRuntimeKitGovernedExecutionExample` as the current governed execution and approval-boundary example
- `PraxisRuntimeKitDurableRuntimeExample` as the current durable recovery, checkpoint, provisioning, and replay readback example
- `PraxisExportBaselineExample` as the repeatable export latency, payload-size, and resident-memory baseline path
- `PraxisRuntimeKitSmoke` as the current smoke harness for checking the runtime and capability baseline
- `PraxisDemoHostApp` together with `./script/build_and_run.sh --verify` as the first native macOS demo-host baseline

These surfaces are the parts of Praxis that this preview expects outside readers and early integrators to evaluate first.

## What This Preview Explicitly Does Not Claim

This preview does not claim any of the following:

- Linux parity with the current macOS local baseline
- unrestricted shell or code execution, PTY support, or streaming-shell parity
- kernel-enforced sandbox isolation merely because `code.sandbox` is publicly inspectable
- identical capability behavior across every host profile
- stable guarantees for undocumented internal module boundaries or experimental payload shapes
- that the repository already presents a finalized general-purpose cross-platform UI or host product

Where Linux still relies on compile-safe placeholder or degraded semantics, that reduced truth is the real public status for this preview.
Where a contract is documented but not fully enforced by the host runtime, the contract should be read as a caller-visible declaration rather than as a stronger implementation guarantee.

## Preview Verification Baseline

For this first preview, the documented verification baseline is:

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

This command set defines the baseline that an outside evaluator should expect to run when checking the current preview story before the first preview tag is cut.
It intentionally goes beyond the narrower exported-surface minimum in the release policy so the preview can cover the export boundary, the current caller-facing RuntimeKit baseline, and the first native macOS demo-host proof point.
If you want the surface-by-surface smoke gates behind governed execution, reviewer context, durable recovery, or provisioning, use [PraxisEvaluationChecklist.md](./PraxisEvaluationChecklist.md) as the deeper evaluation guide.

## Generic Docs That Define The Current Truth

Use these shared generic documents as the source of truth for the current preview:

- external positioning and evaluation framing: [PraxisPositioning.md](./PraxisPositioning.md)
- outside-evaluator command guide and stop conditions: [PraxisEvaluationChecklist.md](./PraxisEvaluationChecklist.md)
- native macOS demo-host scope and build/run interpretation: [PraxisDemoHost.md](./PraxisDemoHost.md)
- support truth: [PraxisSupportMatrix.md](./PraxisSupportMatrix.md)
- safety truth for bounded shell, code, sandbox, and provider-backed high-risk capabilities: [PraxisHighRiskCapabilitySafety.md](./PraxisHighRiskCapabilitySafety.md)
- migration truth for embedding hosts moving onto explicit schema versions: [PraxisMigrationNotes.md](./PraxisMigrationNotes.md)
- compatibility truth for encoded payload shape and decode rules: [PraxisFFICompatibility.md](./PraxisFFICompatibility.md)
- performance and resident-memory baseline truth for the exported path: [PraxisPerformanceBaseline.md](./PraxisPerformanceBaseline.md)
- release discipline and release-bucket rules: [PraxisReleasePolicy.md](./PraxisReleasePolicy.md)
- current repository-facing public baseline summary: [PraxisRepositoryBaseline.md](./PraxisRepositoryBaseline.md)
- current checked-in change summary for the prepared first preview cut: [CHANGELOG.md](../CHANGELOG.md)

Use the version-scoped package at [releases/v0.1.0-preview.1/README.md](./releases/v0.1.0-preview.1/README.md) as the concrete handoff set derived from these generic docs for `v0.1.0-preview.1`.

When these documents disagree with a higher-level summary, prefer the more specific contract document for that surface.
For example, support labels come from the support matrix, sandbox and approval claims come from the safety note, and export-surface baseline interpretation comes from the performance note.

## Current Reader Guidance

If you are evaluating Praxis from the outside, start with `PraxisRuntimeKit` if you want the default Swift caller path.
Start with `PraxisFFI` and the embedding examples if you are validating host-boundary export behavior.
Start with `PraxisDemoHostApp` and [PraxisDemoHost.md](./PraxisDemoHost.md) if you need proof that the same baseline bridge flow can be hosted in a native macOS app.
Use [PraxisEvaluationChecklist.md](./PraxisEvaluationChecklist.md) when you want the deeper smoke suites and the stop conditions that keep unsupported Linux or non-parity assumptions out of scope.
Read the support matrix before assuming any macOS behavior also exists on Linux, and read the safety note before treating any bounded execution surface as a claim of unrestricted execution.
