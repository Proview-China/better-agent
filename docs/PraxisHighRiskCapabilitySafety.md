# Praxis High-Risk Capability Safety Notes

This document explains the current guardrails around high-side-effect capability surfaces.

## Scope

These notes currently cover:

- `shell.run`
- `shell.approve`
- `code.run`
- `code.patch`
- `code.sandbox`
- provider-backed `skill.activate`
- provider-backed `tool.call`

## Public Entry And Verification Paths

Use these shipped entry points when you need to inspect or verify the current governed high-risk execution story:

- public example: `swift run PraxisRuntimeKitGovernedExecutionExample`
- bounded code verification: `swift run PraxisRuntimeKitSmoke --suite code`
- bounded code patch verification: `swift run PraxisRuntimeKitSmoke --suite code-patch`
- bounded shell verification: `swift run PraxisRuntimeKitSmoke --suite shell`
- durable shell approval verification: `swift run PraxisRuntimeKitSmoke --suite shell-approval`
- provider capability verification: `swift run PraxisRuntimeKitSmoke --suite capabilities`

These paths are intentionally split. The focused example shows the public caller story in one place, while the smoke suites verify the bounded execution lanes, durable approval readback, and provider audit truth independently.

## General Guardrails

High-risk capability work in Praxis is expected to satisfy these conditions before it is considered usable:

- approval path exists where required
- durable evidence path exists
- replay / recovery path exists
- bounded smoke path exists
- side-effect risk labeling exists

The current repository baseline already enforces these principles unevenly but intentionally:

- shell approval uses CMP/TAP durable state
- shell and code execution are bounded, not arbitrary open-ended transports
- TAP inspection and reviewer workbench expose persisted evidence rather than only in-memory status
- provider activity is audited only after successful outcomes

## Safety Truth Model

### Declared sandbox contract: `code.sandbox`

- Current status: declared-only contract
- The contract is structured and caller-visible
- The contract currently does not claim kernel-enforced isolation
- Public read path: `swift run PraxisRuntimeKitGovernedExecutionExample`
- Verification path: `swift run PraxisRuntimeKitSmoke --suite code`

Hosts should treat `code.sandbox` as an execution contract description, not as proof of OS-level isolation.

### Bounded code and shell execution surfaces

- Covered surfaces: `code.run`, `code.patch`, `shell.run`
- Current risk labels remain `risky`
- Execution is bounded to caller-visible runtimes, writable roots, and workspace writer lanes rather than an arbitrary open transport
- Public read path: `swift run PraxisRuntimeKitGovernedExecutionExample`
- Verification paths:
  - `swift run PraxisRuntimeKitSmoke --suite code`
  - `swift run PraxisRuntimeKitSmoke --suite code-patch`
  - `swift run PraxisRuntimeKitSmoke --suite shell`

These surfaces are real on the macOS baseline, but they stay deliberately bounded. They should not be described as unrestricted execution or as a claim of PTY / streaming parity.

### Durable shell approval readback

- Covered surfaces: `shell.approve` and approval readback
- Approval is routed through CMP/TAP durable state
- Readback survives fresh-client recovery
- Public read path: `swift run PraxisRuntimeKitGovernedExecutionExample`
- Verification path: `swift run PraxisRuntimeKitSmoke --suite shell-approval`

The important safety property is not only that approval can be requested, but that it can be read back durably instead of inferred from volatile in-memory state.

### Provider skill and tool audit truth

- Covered surfaces: provider-backed `skill.activate` and `tool.call`
- Only registered provider skill keys and MCP tool names are accepted
- TAP audit evidence is appended only after successful provider outcomes
- Public read path: `swift run PraxisRuntimeKitGovernedExecutionExample`
- Verification path: `swift run PraxisRuntimeKitSmoke --suite capabilities`

Queued, declined, failed, or no-op provider activity must not be projected as already completed or already approved high-risk work.

### Placeholder and degraded Linux truth

- Linux host execution remains compile-safe placeholder or degraded host truth
- macOS is the only baseline that currently claims real local code and shell execution
- Unsupported paths should surface placeholder or unsupported semantics instead of pretending success
- Public comparison path: `swift run PraxisRuntimeKitGovernedExecutionExample`
- Verification paths: `swift run PraxisRuntimeKitSmoke --suite code`, `swift run PraxisRuntimeKitSmoke --suite shell`, `swift run PraxisRuntimeKitSmoke --suite capabilities`

Praxis prefers honest degraded behavior over fake parity. Callers should treat placeholder-backed Linux semantics as authoritative current truth, not as a hidden macOS-equivalent lane.

## Capability Notes

### `shell.run`

- Current risk label: `risky`
- Output mode: buffered only
- PTY support: not supported
- Linux status: placeholder-backed seam

This surface is intentionally constrained. It does not yet claim streaming or PTY parity.

### `shell.approve`

- Routed through CMP/TAP durable approval state
- Readback survives fresh-client recovery
- Public surface does not leak legacy internal shell capability keys

### `code.run`

- Current risk label: `risky`
- Runtime must be allowed by the active code sandbox contract
- Working directory must stay inside writable sandbox roots
- Output mode: buffered only
- Linux status: placeholder-backed seam

### `code.patch`

- Current risk label: `risky`
- Revision tokens are treated as opaque concurrency tokens and must round-trip unchanged
- Patch application is bounded to the workspace writer lane
- The local macOS baseline rolls back partial patch mutations when `/usr/bin/patch` fails partway through

### `code.sandbox`

- Declared contract truth is documented above in "Safety Truth Model"

### `skill.activate`

- Only registered provider skill keys are accepted
- TAP audit events are appended only when the provider reports `activated == true`
- Declined or no-op activations do not claim baseline-approved reviewer state

### `tool.call`

- Only registered provider MCP tool names are accepted
- TAP audit events are appended only when the provider reports `status == succeeded`
- Queued or failed tool submissions do not get projected as approved completed calls

## Provider Audit Truth

Current provider audit surfaces now rely on successful outcomes rather than optimistic intent:

- TAP history
- provider activity inspection section
- reviewer workbench

This is important because host tooling and reviewer UI should not interpret queued, declined, or failed provider activity as already completed risk.

## Platform Truthfulness

Praxis currently prefers honest degraded behavior over fake parity:

- Linux host execution remains compile-safe placeholder or degraded host truth
- macOS is the only baseline that currently claims real local shell / code execution
- unsupported paths should surface placeholder or unsupported semantics instead of pretending success

## Recommended Host Behavior

Embedding hosts should:

1. inspect capability availability before invoking high-risk surfaces
2. respect sandbox contract and approval readbacks instead of inferring them
3. treat placeholder or degraded host truth as authoritative, not as temporary noise
4. record request / response / event schema versions alongside execution logs
5. surface TAP / CMP readback information to operators before retrying risky work
