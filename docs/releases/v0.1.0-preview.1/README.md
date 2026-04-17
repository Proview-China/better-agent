# Praxis v0.1.0-preview.1 Release Package

## Status

This directory is the version-scoped draft package for `v0.1.0-preview.1`.
It exists to prepare the first preview cut before any tag is created.

- package state: draft package, not tagged
- publication state: not yet published
- support truth carried into this package: macOS-first baseline, Linux placeholder or degraded where documented

## Included Draft Artifacts

- package summary and entry point: [README.md](./README.md)
- copy-ready draft release note: [RELEASE_NOTE.md](./RELEASE_NOTE.md)
- version-scoped pre-tag checklist: [CHECKLIST.md](./CHECKLIST.md)
- shared release evidence baseline: [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md)

Use this package as the version-scoped handoff set derived from the generic preview docs for the eventual tag review.
Do not read it as a replacement for the shared source-of-truth docs, or as proof that `v0.1.0-preview.1` is already tagged or published.

## Verification Inputs

Use these shared generic documents as the verification, rules, and scope inputs for this package:

- generic preview release story: [../../PraxisPreviewReleaseNote.md](../../PraxisPreviewReleaseNote.md)
- canonical evidence baseline: [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md)
- generic preview release checklist: [../../PraxisPreviewReleaseChecklist.md](../../PraxisPreviewReleaseChecklist.md)
- release policy and pre-tag rules: [../../PraxisReleasePolicy.md](../../PraxisReleasePolicy.md)
- support matrix and platform truth: [../../PraxisSupportMatrix.md](../../PraxisSupportMatrix.md)
- native macOS demo-host scope: [../../PraxisDemoHost.md](../../PraxisDemoHost.md)
- public evaluation guide: [../../PraxisEvaluationChecklist.md](../../PraxisEvaluationChecklist.md)

This package should stay aligned with those generic docs and evidence inputs.
It exists to collect the version-specific handoff artifacts, not to supersede the shared preview story.

## Pre-Tag Exit Criteria

The package is only ready for later tag review when all of the following are true:

- the release note, checklist, and evidence doc all name `v0.1.0-preview.1`
- the evidence captured in [../../PraxisPreviewReleaseEvidence.md](../../PraxisPreviewReleaseEvidence.md) reflects the current verified baseline
- the package keeps the same macOS-first and Linux degraded truth as [../../PraxisSupportMatrix.md](../../PraxisSupportMatrix.md)
- the wording stays draft-only and does not imply that a tag or GitHub Release already exists
- the package remains aligned with the generic preview note and checklist instead of replacing them as the rule source
- the package still points back to the shared evidence doc instead of duplicating command results locally
