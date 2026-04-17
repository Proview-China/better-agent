# Praxis Quick Start

This guide is the shortest path for a first-time Swift integrator to run Praxis locally and confirm that the exported runtime surface works.

## What You Need

- macOS with Xcode / Swift toolchain available
- a local checkout of this repository
- enough permissions to run `swift test` and `swift run ...` commands locally

## Recommended First Path

If you are new to Praxis, start with `PraxisRuntimeKit`.

```swift
import PraxisRuntimeKit
```

## Five-Minute Verification

Run these commands in order:

```bash
swift test
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitSearchExample
```

What success looks like:

- `swift test` passes
- `PraxisRuntimeKitRunExample` prints a started run and a resumed run
- `PraxisRuntimeKitCapabilitiesExample` prints the thin capability baseline
- `PraxisRuntimeKitSearchExample` prints deterministic search-chain results

## If You Need A Lower-Level Surface

- Use `PraxisRuntimeKit` when you want the default caller-friendly Swift API.
- Use `PraxisRuntimeInterface` when you need the schema-versioned encoded request / response surface without dropping to the opaque-handle bridge.
- Use `PraxisFFI` when you are integrating from a host boundary and need the bridge layer over the encoded runtime interface.
- Use `PraxisHostRuntime` when you are working on runtime assembly, facades, gateways, or export boundaries inside the Praxis host layer.

For SwiftPM package integration, `PraxisRuntimeInterface` and `PraxisFFI` are currently carried by the `PraxisHostRuntime` library product rather than standalone library products.

## Next Docs

- entry surfaces: [Praxis Entry Surfaces](./PraxisEntrySurfaces.md)
- platform status: [Praxis Platform Status](./PraxisPlatformStatus.md)
- glossary: [Praxis Glossary](./PraxisGlossary.md)
- support matrix: [Praxis Support Matrix](./PraxisSupportMatrix.md)
