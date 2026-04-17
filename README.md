# Praxis

Praxis 是一个基于 Swift + SwiftPM 的本地 agent runtime framework。仓库当前主线不是 CLI、TUI 或 GUI，而是一组可嵌入、可测试、可导出的 runtime products，用来承载 run lifecycle、capability governance、project context、memory retrieval 和 host export boundary。

对大多数 Swift 调用方，默认公开入口是 `PraxisRuntimeKit`。
当前仓库推进节奏与下一步整改顺序，当前统一以 [AUDIT_REMEDIATION_EXECUTION_GOALS.md](./AUDIT_REMEDIATION_EXECUTION_GOALS.md) 为准。
当前文档默认使用四级成熟度语义：`recommended`、`ready`、`declared-only contract`、`placeholder / degraded`。如果某个 surface 没有被明确标成前两类，不要把它当成与 macOS 本地 baseline 等价的稳定能力；当前状态标签和 qualifier 以 [docs/PraxisSupportMatrix.md](./docs/PraxisSupportMatrix.md) 为准。

## Quick Start

- 5 分钟接入路径见 [docs/PraxisQuickStart.md](./docs/PraxisQuickStart.md)。

先编译并运行 RuntimeKit 示例：

```bash
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCmpTapExample
swift run PraxisRuntimeKitMpExample
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitSearchExample
swift run PraxisRuntimeKitDurableRuntimeExample
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisExportBaselineExample --iterations 5 --format json
swift run PraxisRuntimeKitSmoke --suite code
swift run PraxisRuntimeKitSmoke --suite code-patch
swift run PraxisRuntimeKitSmoke --suite shell
swift run PraxisRuntimeKitSmoke --suite shell-approval
swift run PraxisRuntimeKitSmoke --suite code-sandbox
swift run PraxisRuntimeKitSmoke --suite cmp-tap
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite provisioning
swift run PraxisRuntimeKitSmoke --suite all
```

这组 examples 和 smoke 路径直接提炼自仓库里已经被测试覆盖的真实调用链：

- `PraxisRuntimeKitRunExample`
  展示 `runs.run(...)` 与 `runs.resumeRun(...)`。
- `PraxisRuntimeKitCmpTapExample`
  展示 project-scoped CMP approval、TAP overview、`tap.inspect()` reviewer context，以及 `reviewWorkbench()` 聚合读面；`swift run PraxisRuntimeKitCmpTapExample` 负责展示 provider skill / provider MCP tool discovery 和 recent provider activity，`swift run PraxisRuntimeKitSmoke --suite cmp-tap` 负责核对 CMP approval / TAP overview / reviewWorkbench baseline，`swift run PraxisRuntimeKitSmoke --suite recovery` 与 `swift run PraxisRuntimeKitSmoke --suite provisioning` 负责 durable readback 与 provisioning summaries。
- reviewer context 说明见 [docs/PraxisReviewerContextGuide.md](./docs/PraxisReviewerContextGuide.md)。
- `PraxisRuntimeKitMpExample`
  展示 MP overview、search、resolve、history。
- `PraxisRuntimeKitCapabilitiesExample`
  展示当前 thin capability baseline：catalog、generate、stream、embed、`code.sandbox` contract、bounded `code.run` / `code.patch` / `shell.approve` / `shell.run`、provider `skill.list` / `skill.activate` / MCP tool discovery、tool、file、batch、session。
- `PraxisRuntimeKitSearchExample`
  展示 Phase 3 search chain：`search.web`、`search.fetch`、`search.ground`。
- `PraxisRuntimeKitDurableRuntimeExample`
  展示当前 shipped durable-runtime 读面：checkpoint、provisioning，以及 replay recovery。它会串起一次 run、fresh-client resume、staged provisioning、activation replay，与 recovery 后的 provisioning / workbench readback；这不是 fully general execution console。
- `PraxisFFIEmbeddingExample`
  展示 Phase 6 的最小 embedding path：`open handle -> encode request -> decode response -> drain FFI events`，并打印当前 schema version。
- `PraxisAppleHostEmbeddingExample`
  展示更接近真实宿主的 Apple-side embedding path：先 `inspectArchitecture` 协商 supported schema versions，再通过 FFI 提交业务请求并处理 response / event envelope。
- `PraxisExportBaselineExample`
  展示 Phase 6 的 export/readiness baseline：重复采样 `open session -> inspectArchitecture -> runGoal -> drain events`，输出可归档的 latency / payload / resident-memory 基线摘要。
- `PraxisRuntimeKitSmoke --suite code`
  展示 Phase 5 第一条 bounded code 路径；macOS 当前执行 bounded Swift snippet，Linux 诚实返回 placeholder failed-to-launch 语义。
- `PraxisRuntimeKitSmoke --suite code-sandbox`
  展示 Phase 5 的 `code.sandbox` 合同读面；macOS 当前返回 declared-only workspace sandbox contract，非 macOS 或工具链未就绪时返回 placeholder。
- `PraxisRuntimeKitSmoke --suite code-patch`
  展示 Phase 5 的 bounded `code.patch` 路径；当前 macOS baseline 通过系统 `patch` 应用单文件 patch。
- `PraxisRuntimeKitSmoke --suite shell`
  展示 Phase 5 第一条 bounded shell 路径；macOS 走真实本地 shell，Linux 诚实返回 placeholder failed-to-launch 语义。
- `PraxisRuntimeKitSmoke --suite shell-approval`
  展示 Phase 5 第二条 bounded shell approval 路径；请求、readback 与 fresh-client recovery 都通过 CMP/TAP durable approval state 完成。
- 高风险 capability 安全说明与入口见 [docs/PraxisHighRiskCapabilitySafety.md](./docs/PraxisHighRiskCapabilitySafety.md)。
- `PraxisRuntimeKitSmoke --suite cmp-tap`
  展示 reviewer context 的 CMP/TAP baseline：`tap.inspect()`、project-scoped `reviewWorkbench()`、CMP approval 与 TAP overview；这不是跨平台 fully-backed execution console 声明，也不单独宣称 recent provider activity coverage。
- `PraxisRuntimeKitSmoke --suite recovery`
  验证 fresh-client run / TAP recovery，确认重建 RuntimeKit client 后仍能读回最新 checkpoint 与 approval evidence。
- `PraxisRuntimeKitSmoke --suite provisioning`
  验证 staged replay、activation，以及 recovered provisioning readback，确认 project-scoped provisioning / replay evidence 能在恢复后继续读回。

当前这些 examples 依赖本地 baseline host adapters，默认按 macOS 本地运行验证。
Linux 路径当前只保留 compile-safe placeholder 和条件编译接缝，待 macOS 实现完备后再推进兼容实现。
`PraxisRuntimeKitSmoke` 是独立于测试 target 的 smoke harness 骨架，适合在 examples 之外做快速回归验收。
当前 durable-runtime 已公开的 shipped entry points 是 `swift run PraxisRuntimeKitDurableRuntimeExample`、`swift run PraxisRuntimeKitSmoke --suite recovery`、`swift run PraxisRuntimeKitSmoke --suite provisioning`。它们分别覆盖 checkpoint / provisioning / replay recovery 示例、fresh-client run / TAP recovery 验证，以及 staged replay / activation / recovered provisioning readback 验证。
当前 `tap.project(...).provision(...)` 会返回 host-neutral staged receipt，不会执行真实安装副作用，但会把 bundle / activation / replay 证据写入 TAP checkpoint 与 recovery readback。现在也可以通过 `tap.project(...).provisioning()` 单独读取 durable provisioning state；当 `advanceReplay` 触发 activation 时，对应 replay 会被消费并回写 activation receipt / replay status。
- durable runtime 说明见 [docs/PraxisDurableRuntimeGuide.md](./docs/PraxisDurableRuntimeGuide.md)。

## Technical Overview

Praxis 当前的设计目标是把运行时拆成边界明确的 Swift package products，而不是把所有能力堆进一个粗粒度模块。

核心技术方向：

- 以 SwiftPM products 组织运行时能力
- 以 `PraxisRuntimeKit` 暴露 caller-friendly API
- 以 host contracts 隔离 provider、workspace、tooling、infra、user I/O 等宿主能力
- 以 `PraxisProviderRequestSurface` 收口 AI/provider 请求接缝，给后续独立 SDK 抽离预留稳定边界
- 以 runtime composition / facade / gateway / FFI 承担装配与导出责任
- 以 architecture tests 约束 target 边界，避免能力重新塌回“大模块”

## Product Surface

`Package.swift` 当前公开了这些 library products：

- `PraxisFoundation`
  基础领域模型，包括 core identity、goal、state、transition、run、session、journal、checkpoint。
- `PraxisCapabilityDomain`
  capability contract、planning、result normalization、catalog。
- `PraxisTapDomain`
  capability governance、review、provision、runtime availability。
- `PraxisCmpDomain`
  project context、approval、projection、delivery，以及 Git / DB / MQ 相关模型。
- `PraxisMpDomain`
  memory、search、resolve、history 相关模型与服务。
- `PraxisHostContracts`
  provider、workspace、tooling、infra、user I/O 协议层。
- `PraxisHostRuntime`
  runtime composition、use cases、facades、interface、gateway、FFI。
- `PraxisRuntimeKit`
  面向调用方的高层 Swift API。
- `PraxisArchitectureTests`
  用于验证 target 拆分与依赖方向的测试 product。

如果你只是要接入运行时，不需要先理解全部 products；优先从 `PraxisRuntimeKit` 开始。

## Runtime Layering

当前仓库可以粗分为四层：

1. Foundation / Domain
   - `PraxisCoreTypes`
   - `PraxisGoal`
   - `PraxisState`
   - `PraxisTransition`
   - `PraxisRun`
   - `PraxisSession`
   - `PraxisJournal`
   - `PraxisCheckpoint`

2. Capability / Workflow Domain
   - `PraxisCapabilityContracts`
   - `PraxisCapabilityPlanning`
   - `PraxisCapabilityResults`
   - `PraxisCapabilityCatalog`
   - `PraxisTap*`
   - `PraxisCmp*`
   - `PraxisMp*`

3. Host Boundary
   - `PraxisProviderContracts`
   - `PraxisWorkspaceContracts`
   - `PraxisToolingContracts`
   - `PraxisInfraContracts`
   - `PraxisUserIOContracts`

4. Runtime Assembly / Export
   - `PraxisRuntimeComposition`
   - `PraxisRuntimeUseCases`
   - `PraxisRuntimeFacades`
   - `PraxisRuntimeInterface`
   - `PraxisRuntimeGateway`
   - `PraxisFFI`
   - `PraxisRuntimeKit`

约束上，`PraxisRuntimeKit` 应该保持 thin shell，不直接把 composition、transport、bootstrap 或 FFI 细节暴露给调用方。

当前 `PraxisRuntimeInterface` / `PraxisFFI` 已开始显式携带 schema version：

- request payloads emit `requestSchemaVersion = "1"`
- response payloads emit `responseSchemaVersion = "1"` and `eventSchemaVersion = "1"`
- FFI event envelopes emit `eventSchemaVersion = "1"`

当前 decode 规则会兼容缺失版本字段的 legacy payload，并拒绝未知版本值或显式 `null` 版本值。
`inspectArchitecture` / `bootstrapSnapshot` 现在也会返回 machine-readable 的 supported schema versions 与 legacy compatibility flag，便于 embedding host 在发出业务请求前做协商。
更完整的兼容说明见 [docs/PraxisFFICompatibility.md](./docs/PraxisFFICompatibility.md)。
发布和升级纪律见 [docs/PraxisReleasePolicy.md](./docs/PraxisReleasePolicy.md) 与 [docs/PraxisMigrationNotes.md](./docs/PraxisMigrationNotes.md)。
当前公开面支持矩阵见 [docs/PraxisSupportMatrix.md](./docs/PraxisSupportMatrix.md)。
高风险 capability 安全说明见 [docs/PraxisHighRiskCapabilitySafety.md](./docs/PraxisHighRiskCapabilitySafety.md)。
导出面性能/资源基线见 [docs/PraxisPerformanceBaseline.md](./docs/PraxisPerformanceBaseline.md)。
Phase 6 收尾审计清单见 [docs/PraxisClosureAudit.md](./docs/PraxisClosureAudit.md)。

## Recommended Entry

对 Swift 集成方，最小入口是：

```swift
import PraxisRuntimeKit
```

典型初始化方式：

```swift
let client = try PraxisRuntimeClient.makeDefault()
```

高层 API 当前收敛为五个 scoped clients：

- `client.runs`
- `client.capabilities`
- `client.tap`
- `client.cmp`
- `client.mp`

其中最小 run 调用路径如下：

```swift
import Foundation
import PraxisRuntimeKit

let client = try PraxisRuntimeClient.makeDefault()

let run = try await client.runs.run(
  .init(
    task: "Summarize repository status",
    sessionID: .init("session.demo")
  )
)

print(run.runID.rawValue)
print(run.phaseSummary)
```

当前可直接参考的真实用法，优先看：

- [PraxisRuntimeKitTests.swift](./Tests/PraxisRuntimeKitTests/PraxisRuntimeKitTests.swift)

这个测试 target 已覆盖：

- `PraxisRuntimeClient.makeDefault(...)`
- `runs.run(...)`
- `runs.resumeRun(...)`
- `tap.inspect()`
- `cmp.project(...).approvals.*`
- `tap.project(...).overview(...)`
- `mp.project(...).search(...)`
- `mp.project(...).resolve(...)`
- `mp.project(...).history(...)`
- `capabilities.catalog()` / `generate(...)` / `stream(...)`
- `capabilities.describeCodeSandbox(...)`
- `capabilities.embed(...)` / `callTool(...)` / `uploadFile(...)`
- `capabilities.submitBatch(...)` / `openSession(...)`
- `capabilities.searchWeb(...)` / `fetchSearchResult(...)` / `groundSearchResult(...)`

## Phase 3 Thin Capability Baseline

Phase 3 当前已经落地 thin capability baseline、第一条 search chain，以及 reviewer context inspection；当前 shipped baseline 也已经包含 provider skill surface、`code.sandbox` 合同读面，以及 bounded `code.*` / `shell.*` seams：

- `client.capabilities.catalog()`
- `client.capabilities.generate(...)`
- `client.capabilities.stream(...)`
- `client.capabilities.embed(...)`
- `client.capabilities.listSkills()` / `activateSkill(...)`
- `client.capabilities.callTool(...)`
- `client.capabilities.uploadFile(...)`
- `client.capabilities.submitBatch(...)`
- `client.capabilities.openSession(...)`
- `client.capabilities.describeCodeSandbox(...)`
- `client.capabilities.runCode(...)`
- `client.capabilities.patchCode(...)`
- `client.capabilities.requestShellApproval(...)`
- `client.capabilities.readbackShellApproval(...)`
- `client.capabilities.runShell(...)`
- `client.capabilities.searchWeb(...)`
- `client.capabilities.fetchSearchResult(...)`
- `client.capabilities.groundSearchResult(...)`
- `client.tap.inspect()`
- `tap.project(...).reviewWorkbench(...)`

这组能力的目标不是把 RuntimeKit 做厚，而是把现有本地 substrate 提升成 SDK 可调用面：

- catalog exposes the current thin capability registry rather than an internal-only boundary summary
- generate / stream reuse the current provider inference lane
- embed / tool / file / batch reuse the current local baseline adapters
- session.open exposes the caller-scoped runtime session header rather than a durable checkpoint / provisioning / replay readback lane
- search.web / fetch / ground reuse the current deterministic local search baseline
- tap.inspect uses current TAP status/history, capability inventory, recent provider activity, and durable checkpoint / provisioning / replay evidence hints for reviewer context
- reviewWorkbench combines TAP inspection, TAP overview, CMP overview, reviewer queue, and recovered provisioning summaries into one project-scoped reviewer surface

Reference entry points:

- example: `swift run PraxisRuntimeKitCapabilitiesExample`
- example: `swift run PraxisRuntimeKitSearchExample`
- smoke: `swift run PraxisRuntimeKitSmoke --suite capabilities`
- smoke: `swift run PraxisRuntimeKitSmoke --suite search`

Follow-on docs:

- capability baseline 说明见 [docs/PraxisCapabilityGuide.md](./docs/PraxisCapabilityGuide.md)。
- search chain 说明见 [docs/PraxisSearchChainGuide.md](./docs/PraxisSearchChainGuide.md)。

最小示例：

```swift
import PraxisRuntimeKit

let client = try PraxisRuntimeClient.makeDefault()

let catalog = client.capabilities.catalog()
let session = try await client.capabilities.openSession(.init(sessionID: "runtime.demo"))
let generated = try await client.capabilities.generate(
  .init(
    prompt: "Summarize the thin capability baseline",
    preferredModel: "local-demo-model",
    requiredCapabilities: ["generate.create", "tool.call"]
  )
)

print(catalog.capabilityIDs.map(\.rawValue))
print(session.sessionID.rawValue)
print(generated.outputText)
```

## Phase 2 RuntimeKit Cleanup

这轮 RuntimeKit 体验打磨，优先收敛了几类最常见的调用摩擦：

- 为 `runs` 增加了轻量便捷入口：
  - `client.runs.run(task:sessionID:)`
  - `client.runs.resume(_:)`
- 为 scoped clients 增加了 typed convenience，而不是回退到 stringly flat API：
  - `cmp.project(...).openSession(_:)`
  - `cmp.project(...).overview(for:)`
  - `cmp.project(...).smoke()`
  - `tap.project(...).overview(for:limit:)`
  - `mp.project(...).overview(...)`
  - `mp.project(...).search(query:...)`
  - `mp.project(...).resolve(query:...)`
  - `mp.project(...).history(query:...)`
  - `mp.project(...).smoke()`
- 为 aggregated overview 增加了高层 helper：
  - `projectID`
  - `summary`
  - `smokeChecks`
- 为 caller-facing 错误处理增加了 `PraxisRuntimeErrorDiagnostics.diagnose(_:)`，让 embedding app 和 smoke harness 可以直接打印 remediation。

仍然明确不做的事情：

- 不把 composition root、transport envelope、FFI 细节重新暴露给 RuntimeKit 调用方
- 不把 scoped typed API 回退成以 `String` 为主的扁平入口
- 不把 smoke harness 塞回单元测试 target 里伪装成交付物

## Support Matrix

当前 RuntimeKit 支持矩阵先按“公开面 + 平台基线”说真话：

| Surface | macOS local baseline | Linux current state | Notes |
| --- | --- | --- | --- |
| `PraxisRuntimeClient.makeDefault(...)` | ready | compile-safe placeholder baseline | 两端都能装配 RuntimeKit；Linux 继续保持占位宿主面 |
| `runs.run(...)` / `runs.resume(...)` | ready | ready | run / resume 当前公开 durable checkpoint reference 与 fresh-client recovery；provisioning / replay evidence 继续通过 TAP project surfaces 读回 |
| `capabilities.catalog()` | ready | ready | 当前返回的是 thin capability baseline registry，已包含 search 链、`code.sandbox` 合同读面、provider `skill.list` / `skill.activate`，以及 bounded `code.run` / `code.patch` / `shell.approve` / `shell.run` |
| `capabilities.generate(...)` / `stream(...)` | ready | ready | 当前复用本地 provider inference lane；`stream` 是 bounded projected stream，不宣称 token transport |
| `capabilities.embed(...)` | ready | ready | 当前复用本地 embedding baseline |
| `capabilities.describeCodeSandbox(...)` | declared-only contract | placeholder contract | 当前先暴露结构化 sandbox contract；macOS baseline 说明 workspace write roots 与 enforcement mode，但还不宣称 kernel-enforced isolation |
| `capabilities.patchCode(...)` | ready | unavailable | macOS 当前通过 bounded workspace patch lane 执行单文件 patch；Linux 暂不暴露该 capability，等待后续宿主实现补齐 |
| `capabilities.runCode(...)` | ready | placeholder-backed bounded seam | macOS 当前执行 bounded Swift snippet；Linux 当前返回 compile-safe placeholder `failedToLaunch` 语义，同时保留 runtime / risk label / bounded result projection |
| `capabilities.requestShellApproval(...)` / `readbackShellApproval(...)` | ready | ready | 当前通过 CMP/TAP durable approval path 请求和恢复 bounded shell approval，对外不暴露底层 `tool.shell.exec` |
| `capabilities.runShell(...)` | ready | placeholder-backed bounded seam | macOS 走真实本地 shell；Linux 当前返回 compile-safe placeholder `failedToLaunch` 语义，同时保留 risk label / bounded result projection |
| `capabilities.listSkills(...)` / `activateSkill(...)` | ready | ready | 当前通过 provider skill registry / activator 暴露稳定 skill 基线；`activateSkill` 只接受已注册 skill key，不再对任意字符串宣称成功 |
| `capabilities.listProviderMCPTools(...)` | ready | ready | 当前通过 provider MCP tool registry 暴露可调用工具名读面，供 RuntimeKit 调用 `tool.call` 前做 discovery/readback |
| `capabilities.callTool(...)` / `uploadFile(...)` / `submitBatch(...)` | ready | ready | 当前复用本地 MCP / file store / batch baseline；`tool.call` 只接受 provider MCP tool registry 已注册的工具名 |
| `capabilities.openSession(...)` | ready | ready | 当前只公开 caller-scoped runtime session header，不把 durable checkpoint / provisioning / replay evidence 提升到这个层级 |
| `capabilities.searchWeb(...)` / `fetchSearchResult(...)` / `groundSearchResult(...)` | ready | placeholder-backed SDK seam | 当前 search 链先接 deterministic local baseline；Linux 仍未接真实 browser / search substrate |
| `tap.inspect()` | ready | ready with degraded host summaries | 当前 inspection 会暴露 reviewer backlog、latest decision、section summaries、provider skill / provider MCP tool discovery、reviewer-visible recent provider activity，以及 durable checkpoint / provisioning / replay evidence readback hints；TAP approval request / decision 也会自动刷新 inspection checkpoint；Linux 仍会诚实反映 degraded host summaries |
| `tap.project(...).overview(...)` | ready | ready | TAP 读取面可用，但其 capability 可见性仍受宿主 wiring 影响 |
| `tap.project(...).reviewWorkbench(...)` | ready | ready with degraded host summaries | 当前 workbench 聚合 inspection / TAP history / CMP overview / reviewer queue，并在适用时读回 recovered provisioning summary 与 replay evidence；Linux 下仍会诚实暴露 degraded host summaries |
| `cmp.project(...).overview(...)` / `approvalOverview(...)` | ready | ready with degraded host summaries | Linux 下 git / shell / process 仍会退化为占位语义 |
| `cmp.project(...).smoke()` | ready | degraded | smoke 会诚实反映 git executor / host runtime 退化状态 |
| `mp.project(...).overview(...)` / `search(...)` / `resolve(...)` / `history(...)` | ready | ready | 当前默认走本地 semantic memory / local heuristic baseline |
| `mp.project(...).smoke()` | ready | ready | smoke 是 host-neutral 的，适合作为跨阶段验收入口 |
| system shell / system git / process supervision | macOS-only baseline | placeholder only | Linux 实装明确后置，不在当前阶段并行推进 |
| `PraxisRuntimeKitSmoke` | ready | compile-safe, expected degraded host checks | 这是 smoke harness 骨架，不等于跨平台 fully-backed runtime |

## Error Matrix

RuntimeKit 当前公开的 caller-facing 错误分层如下，推荐统一通过 `PraxisRuntimeErrorDiagnostics.diagnose(_:)` 做落地展示：

| Error category | Typical source | RuntimeKit remediation |
| --- | --- | --- |
| `invalidInput` | blank ID、非法 enum、缺少必填字段 | 修正 request payload、typed refs 和参数组合后再试 |
| `dependencyMissing` | 某条 facade / host adapter 没有接线 | 先补 wiring，再调用对应 RuntimeKit surface |
| `unsupportedOperation` | 当前 facade profile 或平台 baseline 不支持该能力 | 先做平台/能力判断，或切到已支持的 runtime profile |
| `invariantViolation` | 本地 SQLite 状态漂移、运行时不变量破坏、实现缺陷 | 视为 runtime bug 或本地状态损坏，优先检查 runtime root 和持久化基线 |
| `unknown` | 非 `PraxisError` 或未归类错误 | 直接记录原始错误和宿主日志，再决定是否重试 |

最小示例：

```swift
do {
  let generated = try await client.capabilities.generate(
    .init(prompt: "Summarize runtime readiness")
  )
  print(generated.outputText)
} catch {
  let diagnostic = PraxisRuntimeErrorDiagnostics.diagnose(error)
  print(diagnostic.category.rawValue)
  print(diagnostic.summary)
  print(diagnostic.remediation)
}
```

## Build Requirements

平台下限由 `Package.swift` 声明为：

- macOS 14+
- iOS 17+
- tvOS 17+
- watchOS 10+
- visionOS 1+

建议本地环境：

- Xcode 16 或更新版本
- Swift 6.x
- macOS 本地开发环境

说明：

- 当前 `PraxisRuntimeKit` examples 和 local baseline host adapters 主要按 macOS 验证。
- 针对非 macOS 平台，仓库已经把系统进程 / system git 相关执行面切成条件编译占位，便于后续补 Linux 实现。

查看本机 Swift 版本：

```bash
swift --version
```

## Build

Praxis 当前是纯 Swift Package，没有默认 app target。常用编译命令：

```bash
swift build
```

release 编译：

```bash
swift build -c release
```

检查 package graph：

```bash
swift package resolve
swift package describe
```

## Test

仓库主验证入口：

```bash
swift test
```

当前验证分工按下面这条规则理解：

- `swift test` 是当前 durable runtime / export path 的主验证入口；integration-style tests 也承担了当前仓库的 e2e 责任。
- `PraxisRuntimeKitSmoke` 是当前 shipped 的可执行 smoke harness，用来做跨模块快速回归和 operator-friendly 验收。
- 当前仓库还没有单独发布 `PraxisRuntimeKitE2E` 之类的独立 e2e executable product；如果后续补上，README 和执行手册会一起更新。

当前公开 CI 以 `.github/workflows/swift-ci.yml` 为准，默认在 macOS runner 上执行 `swift test`、关键 examples，以及 `recovery` / `capabilities` / `search` smoke。`PraxisRuntimeKitSmoke --suite all` 继续保留为更重的本地或 release 前验证。

如果只想先验证公开 API 或边界守卫，可以按需执行：

```bash
swift test --filter PraxisRuntimeKitTests
swift test --filter PraxisHostRuntimeArchitectureTests
swift test --filter PraxisTapArchitectureTests
swift run PraxisRuntimeKitCapabilitiesExample
swift run PraxisRuntimeKitSearchExample
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisRuntimeKitSmoke --suite recovery
swift run PraxisRuntimeKitSmoke --suite all
```

## Integration

在其他 SwiftPM 项目中接入时，先加入 package：

```swift
dependencies: [
  .package(url: "https://github.com/Proview-China/Praxis.git", branch: "main")
]
```

然后优先依赖 `PraxisRuntimeKit`：

```swift
dependencies: [
  .product(name: "PraxisRuntimeKit", package: "Praxis")
]
```

如果你是在做 runtime 装配、宿主桥接或导出边界，再考虑 `PraxisHostContracts`、`PraxisHostRuntime` 或 `PraxisFFI`。
当前对外导出边界的兼容说明、release policy 和 migration baseline 分别在：

- [docs/PraxisFFICompatibility.md](./docs/PraxisFFICompatibility.md)
- [docs/PraxisReleasePolicy.md](./docs/PraxisReleasePolicy.md)
- [docs/PraxisMigrationNotes.md](./docs/PraxisMigrationNotes.md)
- [docs/PraxisSupportMatrix.md](./docs/PraxisSupportMatrix.md)
- capability baseline 说明见 [docs/PraxisCapabilityGuide.md](./docs/PraxisCapabilityGuide.md)。
- search chain 说明见 [docs/PraxisSearchChainGuide.md](./docs/PraxisSearchChainGuide.md)。
- 术语表见 [docs/PraxisGlossary.md](./docs/PraxisGlossary.md)。
- 平台状态说明见 [docs/PraxisPlatformStatus.md](./docs/PraxisPlatformStatus.md)。
- 入口选择说明见 [docs/PraxisEntrySurfaces.md](./docs/PraxisEntrySurfaces.md)。
- preview release working checklist 见 [docs/PraxisPreviewReleaseChecklist.md](./docs/PraxisPreviewReleaseChecklist.md)。
- 当前仓库事实基线见 [docs/PraxisRepositoryBaseline.md](./docs/PraxisRepositoryBaseline.md)。
- [docs/PraxisHighRiskCapabilitySafety.md](./docs/PraxisHighRiskCapabilitySafety.md)
- [CHANGELOG.md](./CHANGELOG.md)

## Repository Layout

主要目录：

- `Sources/`
  全部 Swift targets 的实现
- `Tests/`
  单元测试与架构守卫测试
- `Package.swift`
  package products、targets、平台与依赖关系定义
- `AGENTS.md`
  仓库协作约束
- `AUDIT_REMEDIATION_EXECUTION_GOALS.md`
  当前整改与实现排期入口文档

如果你第一次读代码，建议顺序：

1. `Package.swift`
2. `Sources/PraxisRuntimeKit/`
3. `Tests/PraxisRuntimeKitTests/`
4. `Sources/PraxisRuntimeUseCases/`
5. `Sources/PraxisRuntimeFacades/`

## Current Constraints

当前主线的几个技术边界是明确的：

- 新能力默认继续落在 Swift targets
- 不恢复旧 TypeScript / Node.js runtime
- 不把 CLI、TUI、GUI 当成长期主入口
- `PraxisRuntimeKit` 优先保持 caller-friendly，而不是暴露底层装配细节
- 架构边界变化时，应同步更新 architecture tests

## Open In Xcode

Praxis 当前没有 `.xcodeproj`，直接把仓库根目录作为 Swift Package 打开即可：

1. 打开 Xcode
2. 选择 `File` → `Open...`
3. 选择仓库根目录
4. 等待 Swift Package indexing 完成
