# Praxis Release Policy

This document defines the current release discipline for exported Praxis runtime surfaces.

## Scope

This policy currently applies to:

- `PraxisRuntimeKit`
- `PraxisRuntimeInterface`
- `PraxisFFI`

Internal module refactors may still happen behind these surfaces, but exported payload shapes and integration guidance should follow the rules below.

## Release Buckets

Use three release buckets:

- patch
  Fixes incorrect behavior without changing stable payload shape or public naming.
- minor
  Adds new backward-compatible fields, commands, snapshots, events, or examples.
- major
  Removes, renames, or changes existing stable payload shape or decode behavior.

## Compatibility Rules

Before publishing a release, confirm:

1. every exported schema version still decodes the payloads claimed in `docs/PraxisFFICompatibility.md`
2. new fields are additive and optional for existing consumers unless a major release is intended
3. old versionless payload compatibility remains limited to the currently documented legacy path
4. `README.md`, `CHANGELOG.md`, and migration notes match the shipped contract

## Required Release Artifacts

Each release should update:

- `CHANGELOG.md`
- `README.md`
- `docs/PraxisFFICompatibility.md`
- `docs/PraxisMigrationNotes.md`

If the release touches exported schemas or host integration guidance, also update:

- embedding examples
- architecture / codec tests that assert wire shape

## Breaking Change Checklist

Treat the release as breaking if any of the following is true:

- a top-level encoded field is removed or renamed
- a command kind, snapshot kind, or event name is removed or renamed
- a documented legacy decode path is narrowed or removed
- an existing enum raw value changes
- a required field is added to an already released encoded payload shape

## Verification Baseline

Before finalizing a release, run at least:

```bash
swift test
swift run PraxisFFIEmbeddingExample
swift run PraxisRuntimeKitSmoke --suite all
```

If one of these is intentionally skipped, the release note should state which check was skipped and why.
