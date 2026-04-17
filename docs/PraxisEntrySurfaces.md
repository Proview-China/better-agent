# Praxis Entry Surfaces

This guide explains which public Praxis surface to choose first.

## Default Recommendation

Start with `PraxisRuntimeKit` unless you already know you need a lower-level embedding or host-runtime boundary.
For SwiftPM package integration, `PraxisRuntimeInterface` and `PraxisFFI` are currently carried by the `PraxisHostRuntime` library product rather than standalone library products.

## Surface Selection

### `PraxisRuntimeKit`

Choose this when:

- you are integrating from Swift
- you want the caller-friendly scoped clients
- you do not want to wire composition, transport, or FFI details yourself

Do not choose this first when:

- you are implementing the export boundary itself
- you need an encoded bridge for another host runtime

### `PraxisRuntimeInterface`

Choose this when:

- you need the encoded request / response surface without dropping to the lower-level FFI bridge
- you are defining or validating schema-versioned export-boundary payloads
- you need a host-neutral boundary model shared across export adapters

Do not choose this first when:

- a pure Swift caller can use `PraxisRuntimeKit`
- you need the opaque-handle bridge layer that `PraxisFFI` exposes

### `PraxisFFI`

Choose this when:

- you need an encoded request/response/event bridge
- you are embedding Praxis from outside the default Swift API surface
- you need schema-version negotiation at the host boundary

Do not choose this first when:

- a pure Swift caller can use `PraxisRuntimeKit`

### `PraxisHostRuntime`

Choose this when:

- you are working inside Praxis runtime assembly
- you need facades, gateways, composition, or export-boundary internals
- you are modifying how host adapters wire into the runtime

Do not choose this first when:

- you only need to consume the runtime from an application

## Short Rule

- app integrator: `PraxisRuntimeKit`
- export-boundary model integrator: `PraxisRuntimeInterface`
- embedding host integrator: `PraxisFFI`
- Praxis runtime maintainer: `PraxisHostRuntime`

## Related Docs

- export compatibility details: [Praxis FFI Compatibility Note](./PraxisFFICompatibility.md)
