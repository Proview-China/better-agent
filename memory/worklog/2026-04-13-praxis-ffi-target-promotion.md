# 2026-04-13 PraxisFFI Target Promotion

## What Changed

- Added a formal `PraxisFFI` SwiftPM target under `Sources/PraxisFFI/`.
- Moved the encoded FFI bridge truth out of `PraxisRuntimePresentationBridge`:
  - `PraxisFFIBridge`
  - `PraxisFFIEventEnvelope`
  - `PraxisFFIFactory`
- Kept `PraxisFFI` intentionally thin:
  - it wraps `PraxisRuntimeInterfaceRegistry`
  - it uses the existing runtime interface codec
  - it exports the host-neutral gateway bootstrap snapshot
  - it does not absorb CLI, SwiftUI, terminal, SQLite, or provider semantics
  - its target dependency surface is narrowed to `PraxisRuntimeGateway + PraxisRuntimeInterface + PraxisCoreTypes`
- Shrunk `PraxisRuntimePresentationBridge` back to presentation-only ownership:
  - removed `PraxisFFIBridge`
  - removed `PraxisFFIEventEnvelope`
  - removed `makeFFIBridge` from `PraxisRuntimeBridgeFactory`
  - moved runtime-interface bootstrap helpers out of `PraxisRuntimeBridgeFactory` and into `PraxisFFIFactory`

## Boundary Decisions

- `PraxisFFI` routes through `PraxisRuntimeGateway -> PraxisRuntimeInterface`; it does not touch use case internals or host adapter internals directly.
- `PraxisFFI` no longer owns `PraxisHostAdapterRegistry.localDefaults()` or host-adapter injection helpers; default bootstrap now comes from `PraxisRuntimeGatewayFactory` and injected host-adapter test paths stay at the gateway layer.
- `PraxisFFIBridge.exportArchitectureSnapshot()` now returns `PraxisRuntimeGatewayModule.bootstrap`, because the FFI export path is a gateway entrypoint rather than a presentation bridge truth source.
- `PraxisRuntimePresentationBridge` remains responsible for:
  - CLI presentation mapping
  - Apple presentation mapping
  - presentation event buffering
- `PraxisRuntimePresentationBridge` is no longer the ownership home for FFI encoded request/event contracts.

## Tests

- Added target/ownership guards in `HostRuntimeTopologyTests`:
  - the package manifest now declares `PraxisFFI`
  - the `PraxisFFI` target block no longer depends on `PraxisRuntimeComposition` or `PraxisRuntimeFacades`
  - `PraxisRuntimePresentationBridge` no longer owns `makeFFIBridge`
  - `PraxisRuntimePresentationBridge` no longer defines `PraxisFFIEventEnvelope`
- Repointed FFI smoke tests to `PraxisFFIFactory`.
- Verified the FFI bridge still covers:
  - encoded request smoke path
  - invalid payload failure path
  - closed-session failure path
  - legacy flat request compatibility

## Validation

- `swift test --filter HostRuntimeTopologyTests`
- `swift test --filter HostRuntimeSurfaceTests`
- `swift test --filter HostRuntimePresentationBridgeTests`
- `swift test`

Latest local snapshot after this package:

- `362` tests
- `53` suites

## Residual Notes

- `PraxisFFI` is now a formal target, but it is still only a thin encoded export layer.
- This package does not freeze:
  - final ABI shape
  - foreign-language memory ownership
  - streaming token protocol
  - final exported symbol table design
