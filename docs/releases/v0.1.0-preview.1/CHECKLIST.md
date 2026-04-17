# Praxis v0.1.0-preview.1 Checklist

## Pre-Tag Inputs

Use these upstream inputs before treating the package as ready for later tag review:

- package index: [README.md](./README.md)
- draft release note body: [RELEASE_NOTE.md](./RELEASE_NOTE.md)
- canonical evidence source: [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md)
- generic preview checklist source-of-truth: [../../PraxisPreviewReleaseChecklist.md](../../PraxisPreviewReleaseChecklist.md)
- support truth: [../../PraxisSupportMatrix.md](../../PraxisSupportMatrix.md)
- release policy: [../../PraxisReleasePolicy.md](../../PraxisReleasePolicy.md)

This checklist is for a prepared package only.
It derives from the generic preview checklist and does not replace it as the rule source.
It does not authorize creating a tag or publishing a release in this Task 3 handoff.

## Required Verification

- confirm that [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md) names `v0.1.0-preview.1`
- confirm that the evidence document retains the current verified baseline commands and release-only verification split
- confirm that the package derives the same preview story from [../../PraxisPreviewReleaseNote.md](../../PraxisPreviewReleaseNote.md)
- confirm that command results stay referenced from the shared evidence document instead of being duplicated here

## Required Manual Review

- verify the wording still describes a draft package, not tagged and not published
- verify the package keeps macOS-first truth and Linux degraded or placeholder truth intact
- verify governed execution language does not over-claim host-enforced behavior
- verify durable runtime language stays scoped to recovery and readback evidence
- verify demo-host language still describes a native macOS baseline proof point rather than broader product parity

## Packaging Readiness

- `README.md`, `RELEASE_NOTE.md`, and `CHECKLIST.md` all name `v0.1.0-preview.1`
- all package files point back to [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md)
- the package can be used as a later handoff set derived from the generic preview docs without inventing new claims
- the package links remain relative and self-contained within `docs/releases/v0.1.0-preview.1/`

## Final Hold Points

- do not create a git tag from this checklist
- do not create a GitHub Release from this checklist
- do not treat this package as approved for tagging or publication until a later review explicitly approves the cut
