# Praxis Reviewer Context Guide

This guide summarizes the current reviewer-context surface exposed through `PraxisRuntimeKit`.

## Current Reviewer Context Surface

The current reviewer-context surface is:

- `tap.inspect()`
- `tap.project(...).overview(...)`
- `tap.project(...).reviewWorkbench(...)`

## What This Surface Is For

Use this path when you need reviewer-facing context before enabling higher-side-effect capability lanes.

The current surface reads persisted approval history, capability inventory, checkpoint/journal recovery hints, provider skill discovery, provider MCP tool discovery, and recent provider activity without requiring callers to reconstruct that context by hand.

This guide does not claim that reviewer context is already a cross-platform full-fidelity execution console. Support truth still follows `docs/PraxisSupportMatrix.md`.

## Current Real Signals

On the current local baseline, reviewer context can already surface:

- pending and latest approval decisions
- provider skill discovery
- provider MCP tool discovery
- recent provider activity recorded through `skill.activate` and `tool.call`
- provisioning and replay summaries when durable evidence exists

## Example Path

Start with:

```bash
swift run PraxisRuntimeKitCmpTapExample
```

What this example demonstrates:

- one CMP approval request and decision
- one `tap.inspect()` read
- one project-scoped `reviewWorkbench(...)` read
- provider skill discovery
- provider MCP tool discovery
- recent provider activity appearing in reviewer context

## Verification Path

Use:

```bash
swift run PraxisRuntimeKitSmoke --suite cmp-tap
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite provisioning
```

These smoke paths should confirm reviewer context, durable readback, and workbench provisioning summaries still project the expected evidence chain.

## Related Docs

- [Praxis Support Matrix](./PraxisSupportMatrix.md)
- [Praxis High Risk Capability Safety](./PraxisHighRiskCapabilitySafety.md)
- [Praxis Capability Guide](./PraxisCapabilityGuide.md)
