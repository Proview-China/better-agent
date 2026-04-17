# Praxis Platform Status

This document summarizes current platform truth for Praxis.

## Primary Baseline

- macOS local baseline: primary validated host profile

## Current Non-Primary Paths

- Linux: compile-safe placeholder or degraded host truth unless stated otherwise

## What This Means In Practice

On macOS, the repository currently validates:

- `swift test`
- key shipped Swift examples
- `PraxisRuntimeKitSmoke`
- local host adapters for runtime, approval, search, and export-baseline flows

On Linux, the repository currently preserves:

- compile-safe package assembly
- honest placeholder semantics for unsupported execution paths
- degraded host summaries instead of fake parity claims

## Do Not Overclaim

- Linux is not current parity with the macOS local baseline
- `code.sandbox` is currently a declared contract, not a kernel-isolation guarantee
- support claims should follow `docs/PraxisSupportMatrix.md`

## Related Docs

- [Praxis Support Matrix](./PraxisSupportMatrix.md)
- [Praxis High Risk Capability Safety](./PraxisHighRiskCapabilitySafety.md)
- [Praxis Repository Baseline](./PraxisRepositoryBaseline.md)
