# Praxis Glossary

This glossary defines the core repository terms used in Praxis docs.

## Core Terms

### TAP

Capability governance and review layer. Use TAP when you need approval, inspection, review workbench context, and persisted evidence around risky runtime actions.

### CMP

Project-context and approval domain. CMP owns project-scoped context, approval flows, projection/delivery truth, and related host-facing readback surfaces.

### MP

Memory and retrieval domain. MP covers search, resolve, history, alignment, and workflow-oriented memory state.

### FFI

Encoded host boundary for non-default callers that need request/response/event bridging and schema-version negotiation.

### Support Matrix

The document that records current support truth per surface and per platform.

### Recommended

A surface explicitly called out as the preferred entry point or integration baseline for current callers.

### Ready

A surface or behavior that is implemented and supported for the stated platform and scope today.

### Declared-Only Contract

A surface that publishes the contract shape and caller-facing semantics, but does not claim a fully backed runtime implementation yet.

### Placeholder / Degraded

Placeholder preserves contract shape without claiming real implementation parity. Degraded returns honest reduced capability or host truth instead of pretending the full baseline exists.

### Stable

A surface or behavior that is documented as the current supported baseline and should not change incompatibly without release/migration discipline.
