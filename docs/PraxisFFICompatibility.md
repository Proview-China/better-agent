# Praxis FFI Compatibility Note

This note defines the current compatibility contract for `PraxisRuntimeInterface` and `PraxisFFI`.

## Current Version

The current schema baseline is `v1`.

Encoded payloads now expose these stable version fields:

- Runtime interface requests: `requestSchemaVersion = "1"`
- Runtime interface responses: `responseSchemaVersion = "1"`
- Runtime interface responses and FFI event envelopes: `eventSchemaVersion = "1"`

## Decode Rules

Current decode behavior is intentionally conservative:

- Missing version fields are accepted and treated as `v1`.
- Unknown version values are rejected during decode.
- Legacy flat payload decoding remains limited to the original `runGoal` and `resumeRun` bootstrap shapes.
- New commands must continue to use the nested payload envelope.

`inspectArchitecture` / `bootstrapSnapshot` also publish:

- `supportedRequestSchemaVersion`
- `supportedResponseSchemaVersion`
- `supportedEventSchemaVersion`
- `acceptsLegacyVersionlessPayloads`

## Compatibility Scope

`v1` promises stability for:

- command kind names
- snapshot kind names
- event names
- top-level request / response / event envelope fields
- existing enum raw values already exposed through encoded payloads

`v1` does not promise:

- that every host profile exposes the same capability inventory
- that provider-backed capabilities share identical runtime behavior
- that placeholder Linux host adapters provide parity with the macOS local baseline

## Breaking Change Checklist

Any change that does one of the following must be treated as a breaking schema change:

- renames or removes a top-level encoded field
- renames or removes a command kind
- renames or removes a snapshot kind
- renames or removes an event name
- changes a stable enum raw value already emitted in payloads
- changes legacy decode behavior for existing accepted payload shapes

## Recommended Host Strategy

Embedding hosts should:

1. log the received request / response / event schema versions
2. reject unknown versions before dispatching into host business logic
3. treat missing version fields as legacy `v1`
4. keep transport concerns outside `PraxisRuntimeKit`
5. prefer `PraxisFFI` or `PraxisRuntimeInterface` only at export boundaries

## Minimal Host Flow

The minimal embedding flow is:

1. open one runtime session handle
2. encode one `PraxisRuntimeInterfaceRequest`
3. submit it through `PraxisFFIBridge.handleEncodedRequest`
4. decode one `PraxisRuntimeInterfaceResponse`
5. drain one `PraxisFFIEventEnvelope`

See `swift run PraxisFFIEmbeddingExample` for the smallest working example currently shipped in this repository.
