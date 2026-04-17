# Praxis Durable Runtime Guide

This guide summarizes the current durable-runtime surface exposed through `PraxisRuntimeKit`.

## Current Durable Runtime Surface

The current durable-runtime surface includes:

- `runs.run(...)`
- `runs.resume(...)`
- `cmp.project(...).openSession(...)`
- `tap.project(...).provision(...)`
- `tap.project(...).provisioning()`
- `tap.project(...).advanceReplay(...)`
- `tap.project(...).reviewWorkbench(...)`

## What This Surface Is For

Use this path when you need durable readback for run checkpoint recovery, provisioning state, activation progress, replay lifecycle, and reviewer-visible evidence after rebuilding a fresh RuntimeKit client.

This guide does not claim that durable runtime is already a fully general side-effect execution console. The current public value is durable checkpoint and evidence recovery through host-neutral RuntimeKit surfaces.

## Current Durable Signals

On the current local baseline, durable runtime can already surface:

- run checkpoint references after resume
- persisted TAP approval and provisioning evidence
- activation status for staged replays
- replay status after activation
- recovered workbench provisioning summaries on a fresh client

## Example Path

Start with:

```bash
swift run PraxisRuntimeKitDurableRuntimeExample
```

What this example demonstrates:

- one run followed by fresh-client resume
- one provisioning request with a staged replay
- one replay activation
- one fresh-client recovery of provisioning and reviewer workbench state

## Verification Path

Use:

```bash
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite provisioning
```

These smoke paths should confirm the durable checkpoint, provisioning, activation, replay, and recovery readback chain still projects the expected evidence.

## Related Docs

- [Praxis Support Matrix](./PraxisSupportMatrix.md)
- [Praxis Reviewer Context Guide](./PraxisReviewerContextGuide.md)
- [Praxis High Risk Capability Safety](./PraxisHighRiskCapabilitySafety.md)
