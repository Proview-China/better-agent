# Praxis Repository Baseline

This document records the current repository truth for Praxis without assuming internal team context.

## Current Positioning

Praxis currently presents itself as a local agent runtime foundation for Swift and Apple-hosted embedding flows.
The primary public Swift entry surface is `PraxisRuntimeKit`.

## Current Export Surfaces

- `PraxisRuntimeKit` is the default public Swift integration surface.
- `PraxisRuntimeInterface` is the current schema-versioned encoded request / response export surface exposed through the current runtime/export paths, not a standalone SwiftPM library product.
- `PraxisFFI` is the current bridge-level export surface for host-boundary embedding exposed through the current runtime/export paths, not a standalone SwiftPM library product.

## Current Product Surface

- `PraxisFoundation`
- `PraxisCapabilityDomain`
- `PraxisTapDomain`
- `PraxisCmpDomain`
- `PraxisMpDomain`
- `PraxisHostContracts`
- `PraxisHostRuntime`
- `PraxisRuntimeKit`
- `PraxisArchitectureTests`

## Current Executable Surface

- `PraxisRuntimeKitSmoke`
- `PraxisRuntimeKitRunExample`
- `PraxisRuntimeKitCmpTapExample`
- `PraxisRuntimeKitMpExample`
- `PraxisRuntimeKitCapabilitiesExample`
- `PraxisRuntimeKitSearchExample`
- `PraxisFFIEmbeddingExample`
- `PraxisAppleHostEmbeddingExample`
- `PraxisExportBaselineExample`

## Platform Truth

- macOS local baseline is the primary validated host profile
- Linux currently remains compile-safe placeholder or degraded host truth unless documentation says otherwise

## Current Placeholder Or Degraded Areas

- Linux shell execution
- Linux bounded code execution
- Linux browser/search substrate
- code sandbox enforcement is currently a declared contract, not a kernel-isolation claim

## Verification Baseline

```bash
swift test
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite all
```
