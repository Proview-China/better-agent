# Praxis Migration Notes

This note records the current migration guidance for hosts integrating with `PraxisRuntimeInterface` or `PraxisFFI`.

## Current Baseline

Current exported schema baseline: `v1`

Version fields now shipped by default:

- request payloads: `requestSchemaVersion = "1"`
- response payloads: `responseSchemaVersion = "1"`
- event envelopes: `eventSchemaVersion = "1"`

## Legacy Compatibility

The current implementation still accepts payloads that omit schema version fields and treats them as `v1`.

This compatibility exists only to avoid breaking already shipped host bootstraps while the export path is being formalized. It should not be treated as the long-term preferred wire shape.

## Recommended Host Migration

Embedding hosts should migrate in this order:

1. Start logging request / response / event schema versions.
2. Switch request encoding to include `requestSchemaVersion`.
3. Validate `responseSchemaVersion` and `eventSchemaVersion` before business dispatch.
4. Keep accepting missing version fields as legacy `v1` only if the host still needs to talk to older Praxis builds.
5. Move to strict version checks once all deployed Praxis peers emit explicit version fields.

## Host Update Checklist

When updating an embedding host:

- verify that `inspectArchitecture` returns the expected supported schema versions
- verify that `PraxisFFIEmbeddingExample` still models the host flow you depend on
- review `CHANGELOG.md` for payload-shape changes
- review `docs/PraxisFFICompatibility.md` for decode and breaking-change rules

## Non-Goals

These notes do not promise:

- provider capability parity across all host profiles
- Linux parity with the current macOS local baseline
- compatibility for undocumented experimental payload shapes
