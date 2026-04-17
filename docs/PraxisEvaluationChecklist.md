# Praxis External Evaluation Checklist

Use this checklist when you need to decide whether Praxis is ready for your host integration today, where to start, and which repository artifacts prove the current boundary truth.

## 1. Decide Whether You Can Integrate Praxis Today

- [ ] Confirm your target host matches the current baseline in [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md).
  Today the primary validated profile is the macOS local baseline. If your plan depends on Linux host parity, treat the current Linux path as compile-safe placeholder or degraded truth unless the matrix says otherwise.
- [ ] Confirm your preferred integration surface is already public.
  Start from `PraxisRuntimeKit` if you are a Swift caller. Escalate to `PraxisRuntimeInterface` or `PraxisFFI` only when you need an encoded export boundary or a non-Swift embedding lane.
- [ ] Confirm your required capabilities are actually claimed today.
  Check whether the surface is labeled `recommended` or `ready` in [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md). Do not treat `declared-only contract` or `placeholder / degraded` as production parity.
- [ ] Confirm your host can live with the current governed execution model in [docs/PraxisHighRiskCapabilitySafety.md](./PraxisHighRiskCapabilitySafety.md).
  `code.run`, `code.patch`, and `shell.run` are bounded risky surfaces. `code.sandbox` is a caller-visible contract description, not proof of kernel-level isolation.
- [ ] Confirm your host actually needs the durable and reviewer surfaces that Praxis already exports.
  Read [docs/PraxisDurableRuntimeGuide.md](./PraxisDurableRuntimeGuide.md) and [docs/PraxisReviewerContextGuide.md](./PraxisReviewerContextGuide.md) before assuming Praxis is a fully general execution console.

## 2. Pick The Right Starting Layer

- [ ] Start with `PraxisRuntimeKit` if your host is a Swift app or framework integration.
  This is the default public entry for real callers, and it is the surface the support matrix marks as `recommended`.
- [ ] Start with `PraxisRuntimeInterface` or `PraxisFFI` only if your host needs a transport-safe exported boundary.
  If that is your path, review schema and release discipline first in [docs/PraxisMigrationNotes.md](./PraxisMigrationNotes.md) and [docs/PraxisReleasePolicy.md](./PraxisReleasePolicy.md).
- [ ] Start with reviewer or durable examples only when your integration needs those exact operator-facing readbacks.
  Use `PraxisRuntimeKitCmpTapExample` for reviewer context and `PraxisRuntimeKitDurableRuntimeExample` for checkpoint / provisioning / replay recovery, instead of inventing your own first-read path.

## 3. Read The Documents That Prove Boundary Truth

- [ ] Read [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md) for surface-by-surface support truth, maturity labels, and platform qualifiers.
- [ ] Read [docs/PraxisHighRiskCapabilitySafety.md](./PraxisHighRiskCapabilitySafety.md) for the governed high-risk execution story, approval/readback expectations, and Linux non-parity truth.
- [ ] Read [docs/PraxisDurableRuntimeGuide.md](./PraxisDurableRuntimeGuide.md) for what durable runtime does cover today and what it explicitly does not claim.
- [ ] Read [docs/PraxisReviewerContextGuide.md](./PraxisReviewerContextGuide.md) for the current reviewer-facing read surfaces and evidence model.
- [ ] Read [docs/PraxisMigrationNotes.md](./PraxisMigrationNotes.md) before depending on exported schema behavior, legacy versionless payloads, or host upgrade sequencing.
- [ ] Read [docs/PraxisReleasePolicy.md](./docs/PraxisReleasePolicy.md) to understand which contract changes are patch / minor / major and which release artifacts must move together.
- [ ] Read [docs/PraxisPerformanceBaseline.md](./docs/PraxisPerformanceBaseline.md) if your host evaluation depends on export-latency, payload-size, or resident-memory baseline evidence.

## 4. Run The Commands That Verify The Current Story

- [ ] Verify recovery and durable readback:

```bash
swift run PraxisRuntimeKitDurableRuntimeExample
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite provisioning
```

- [ ] Verify governed execution and high-risk capability boundaries:

```bash
swift run PraxisRuntimeKitGovernedExecutionExample
swift run PraxisRuntimeKitSmoke --suite code
swift run PraxisRuntimeKitSmoke --suite code-sandbox
swift run PraxisRuntimeKitSmoke --suite code-patch
swift run PraxisRuntimeKitSmoke --suite shell
swift run PraxisRuntimeKitSmoke --suite shell-approval
swift run PraxisRuntimeKitSmoke --suite capabilities
```

- [ ] Verify reviewer context and operator-facing evidence:

```bash
swift run PraxisRuntimeKitCmpTapExample
swift run PraxisRuntimeKitSmoke --suite cmp-tap
```

- [ ] Verify export baseline and embedding readiness:

```bash
swift test
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite all
```

Use the corresponding evidence notes in [docs/PraxisDurableRuntimeGuide.md](./PraxisDurableRuntimeGuide.md), [docs/PraxisHighRiskCapabilitySafety.md](./PraxisHighRiskCapabilitySafety.md), [docs/PraxisReviewerContextGuide.md](./PraxisReviewerContextGuide.md), [docs/PraxisReleasePolicy.md](./docs/PraxisReleasePolicy.md), and [docs/PraxisPerformanceBaseline.md](./docs/PraxisPerformanceBaseline.md) to interpret what each command actually proves.

## 5. Ask The Questions That Decide Host Fit

- [ ] Is your host a Swift caller on the macOS local baseline?
  If yes, start with `PraxisRuntimeKit`. If no, verify whether you really need `PraxisRuntimeInterface` or `PraxisFFI`, and whether your non-macOS target is currently only placeholder-backed.
- [ ] Do you need bounded, governed execution, or do you need unrestricted shell / PTY / streaming behavior?
  Praxis currently documents bounded risky surfaces, buffered output, and no PTY parity claim. If you need unrestricted execution semantics, this repo does not currently claim them.
- [ ] Do you need durable approval, checkpoint, provisioning, and replay evidence after rebuilding a fresh client?
  If yes, validate the durable path first. If no, do not over-scope your first integration around TAP/CMP recovery features you do not need.
- [ ] Do you need reviewer-visible context and audit truth before enabling higher-side-effect operations?
  If yes, verify `tap.inspect()` and `reviewWorkbench(...)` through the reviewer example and smoke suites.
- [ ] Do you need stable exported wire contracts, version negotiation, and release discipline?
  If yes, evaluate Praxis through the migration and release docs first, not only through the RuntimeKit examples.
- [ ] Do you need Linux parity today?
  If yes, the current answer is usually no-fit unless the exact surface you need is explicitly marked as supported in [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md).

## 6. Stop When You See Non-Parity Or Unsupported Signals

- [ ] Stop assuming parity when the support matrix says `declared-only contract`, `placeholder / degraded`, `placeholder-backed bounded seam`, `placeholder-backed SDK seam`, `macOS-only baseline`, or `unavailable`.
- [ ] Stop assuming OS-level isolation when the docs describe `code.sandbox` as a declared execution contract.
- [ ] Stop assuming Linux host execution is equivalent to macOS local execution when [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md) or [docs/PraxisHighRiskCapabilitySafety.md](./PraxisHighRiskCapabilitySafety.md) says the Linux path is placeholder or degraded.
- [ ] Stop assuming reviewer context or durable runtime means a full general-purpose execution console.
  Both [docs/PraxisDurableRuntimeGuide.md](./PraxisDurableRuntimeGuide.md) and [docs/PraxisReviewerContextGuide.md](./PraxisReviewerContextGuide.md) explicitly narrow that claim.
- [ ] Stop assuming release compatibility for undocumented payload shapes or permanent support for versionless payloads.
  [docs/PraxisMigrationNotes.md](./PraxisMigrationNotes.md) treats versionless decode as a legacy bridge, not a permanent preferred wire shape.
- [ ] Stop assuming performance notes are end-to-end product benchmarks.
  [docs/PraxisPerformanceBaseline.md](./docs/PraxisPerformanceBaseline.md) measures only the thin export path.

## 7. Exit Criteria For An Outside Evaluator

- [ ] You know which public surface you are starting from.
- [ ] You have matched your host requirements against [docs/PraxisSupportMatrix.md](./PraxisSupportMatrix.md).
- [ ] You have run the relevant smoke/example commands for recovery, governed execution, reviewer context, and export baseline.
- [ ] You have identified any required unsupported behavior before promising integration scope.
- [ ] You can point to the exact evidence doc that supports each integration claim you plan to make.
