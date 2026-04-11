# 2026-04-11 Swift Runtime Interface Plan Refresh

## 当前结论

- Swift 重构当前已经不再只是 target 骨架，`Package.swift` 中 phase-1 / phase-2 目标拓扑已经成形，并且 HostRuntime 已固定拆成：
  - `PraxisRuntimeComposition`
  - `PraxisRuntimeUseCases`
  - `PraxisRuntimeFacades`
  - `PraxisRuntimeInterface`
  - `PraxisRuntimeGateway`
  - `PraxisRuntimePresentationBridge`
- 当前真正已经落到“宿主无关对外面”的不是 CLI，也不是 Apple UI，而是：
  - `PraxisRuntimeInterface`
  - `PraxisRuntimeGateway`
- `PraxisCLI` 与 `PraxisAppleUI` 当前都还是薄壳，不应被当成主架构中心：
  - CLI 已经通过 `PraxisRuntimeGatewayFactory.makeRuntimeInterface()` 进入系统，但入口文件仍保留旧 TODO 文案
  - Apple UI 仍主要是 blueprint list 展示壳
- `PraxisRuntimePresentationBridge` 已明确只负责展示映射，不承担中立 runtime contract。

一句白话：

- 现在真正值得继续做厚的是 `RuntimeInterface + Gateway + UseCases + local adapters` 这一段，不是 CLI/GUI 壳。

> 2026-04-11 later update:
>
> - macOS 上的 `SQLite3` system library 已改为优先走系统 `sqlite3`，不再让 SwiftPM 在 Apple 平台默认碰 Homebrew `sqlite` 前缀。
> - 修复原因是当前机器存在 `/usr/local/opt/sqlite/lib/libsqlite3.dylib` 的 `x86_64` 版本，会污染 `arm64` SwiftPM 链接。
> - 修复后本地 `swift test` 已恢复全绿，当前快照为：
>   - `150` tests
>   - `39` suites
> - `PraxisHostAdapterRegistry.localDefaults()` 也已从 stub 升级为真实 `PraxisLocalProcessSupervisor`，能够轮询 pid-based 本地进程句柄。
> - `PraxisHostAdapterRegistry.localDefaults()` 现已不再使用 scaffold provider inference / MCP：
>   - `providerInferenceExecutor` -> `PraxisLocalProviderInferenceExecutor`
>   - `providerMCPExecutor` -> `PraxisLocalProviderMCPExecutor`
> - 两者当前都明确采用 `local-runtime` heuristic baseline：
>   - 不依赖外部 provider
>   - 不伪装成真实云端执行
>   - 但返回真实、可测试的 host-neutral receipt / normalized output
> - `PraxisHostAdapterRegistry.localDefaults()` 当前已进一步补齐为一套基本完整的本地 runtime baseline，新增本地实现包括：
>   - `PraxisLocalCapabilityExecutor`
>   - `PraxisLocalProviderEmbeddingExecutor`
>   - `PraxisLocalProviderFileStore`
>   - `PraxisLocalProviderBatchExecutor`
>   - `PraxisLocalProviderSkillRegistry`
>   - `PraxisLocalProviderSkillActivator`
>   - `PraxisLocalBrowserExecutor`
>   - `PraxisLocalBrowserGroundingCollector`
>   - `PraxisLocalUserInputDriver`
>   - `PraxisLocalPermissionDriver`
>   - `PraxisLocalTerminalPresenter`
>   - `PraxisLocalConversationPresenter`
>   - `PraxisLocalAudioTranscriptionDriver`
>   - `PraxisLocalSpeechSynthesisDriver`
>   - `PraxisLocalImageGenerationDriver`
> - 到这一刻为止，`localDefaults()` 已基本不再依赖 fake/stub scaffold 作为默认 macOS local profile。

## 当前 Swift / TS 映射

### Swift 中立 runtime 面

- `Sources/PraxisRuntimeInterface/*`
  - 对照：
    - `src/rax/facade.ts`
    - `src/agent_core/live-agent-chat/shared.ts`
  - 职责：
    - 定义 host-neutral request / response / event envelope
    - 维护 opaque session handle 与事件缓冲

- `Sources/PraxisRuntimeGateway/*`
  - 对照：
    - `src/rax/runtime.ts`
    - `src/rax/facade.ts`
    - `src/agent_core/runtime.ts`
  - 职责：
    - 统一 bootstrap
    - 装配 composition root / runtime facade / runtime interface registry
    - 给 CLI / FFI / 跨语言宿主提供中立入口

### Swift runtime 内部分层

- `Sources/PraxisRuntimeComposition/*`
  - 对照：
    - `src/agent_core/runtime.ts` 的 runtime assembly 部分
    - `src/rax/runtime.ts` 的宿主接线职责
- `Sources/PraxisRuntimeUseCases/*`
  - 对照：
    - `src/agent_core/run/*`
    - `src/agent_core/checkpoint/*`
    - `src/agent_core/cmp-service/*`
    - `src/agent_core/mp-runtime/*`
- `Sources/PraxisRuntimeFacades/*`
  - 对照：
    - `src/rax/cmp/session.ts`
    - `src/rax/cmp/project.ts`
    - `src/rax/cmp/flow.ts`
    - `src/rax/cmp/control.ts`
    - `src/rax/cmp/readback.ts`
    - `src/rax/cmp/roles.ts`
    - `src/rax/mp-facade.ts`

### 明确只做宿主壳的 Swift 入口

- `Sources/PraxisCLI/*`
  - 当前职责：
    - 参数解析
    - runtime request 路由
    - 事件文件持久化
    - 终端渲染
  - 不应承接：
    - 业务规则
    - composition internals
    - facade/use case 拼装

- `Sources/PraxisAppleUI/*`
  - 当前职责：
    - 原生展示壳占位
  - 不应承接：
    - 运行时装配
    - Core / HostContracts 直连

## 当前最大缺口

### 1. local runtime 仍是“半真实、半 scaffold”

`PraxisHostAdapterRegistry.localDefaults()` 当前已接入真实本地能力：

- workspace reader / searcher / writer
- shell executor
- git availability probe
- git executor
- checkpoint / journal / projection / delivery truth
- cmp package / control / peer approval / tap runtime event store
- embedding store / semantic memory / semantic search
- lineage store
- in-process message bus

但以下能力仍回落到 scaffold/stub：

- capability executor
- provider inference / embedding / file / batch / skill / MCP
- browser executor / browser grounding
- process supervisor
- user input / permission / terminal / conversation presenter
- audio / speech / image generation

结论：

- 现在已经不是“完全假的宿主”
- 但还远没到“一个完整、稳定、中立的本地 runtime profile”

### 2. 测试已覆盖边界，但还没完全锁住真实 local profile

- `Tests/PraxisHostRuntimeArchitectureTests/*` 已经在测：
  - HostRuntime 六层拆分
  - RuntimeGateway -> RuntimeInterface 入口规则
  - interface session / codec / response envelope
  - facade / presentation bridge / CLI 命令壳
- 但不少用例仍通过 `PraxisHostAdapterRegistry.scaffoldDefaults()` 驱动，而不是 `localDefaults()`。

结论：

- 当前测试已经能防止“层次重新糊回去”
- 但对“真实 local runtime baseline 是否持续可用”的守卫还不够强

### 3. 当前本地验证卡在 SQLite 链接环境，不是业务断言

本地 `swift test` 在 2026-04-11 的当前机器上失败于链接阶段：

- Homebrew `sqlite3` 动态库是 `x86_64`
- 当前构建目标是 `arm64`
- 因此 `PraxisRuntimeComposition` 的 SQLite-backed local adapters 无法完成链接

这说明：

- 当前阻塞先是环境 / linking baseline
- 不是 Swift 重构逻辑本身先出现断言回归

## 下一步建议顺序

### 第一优先级：把“中立对外面”真正冻结成主入口

目标模块：

- `PraxisRuntimeInterface`
- `PraxisRuntimeGateway`
- `PraxisRuntimeUseCases`

具体动作：

- 继续把 CLI / AppleUI 之外的宿主都假定经由 `RuntimeGateway -> RuntimeInterface`
- 新增或补强测试，明确：
  - CLI 不直接碰 composition/use case/facade internals
  - Apple UI 不直接碰 composition/use case/facade internals
  - 中立 request/response/event 模型不泄漏 CLI 文本或 SwiftUI 视图态

### 第二优先级：继续补齐 localDefaults 的宿主无关适配面

建议先补最影响闭环但最不牵扯 UI 的能力：

1. `ProcessSupervisor`
2. `ProviderInferenceExecutor` baseline
3. `ProviderMCPExecutor` / browser grounding baseline
4. `PermissionDriver` 与 `UserInputDriver` 的 non-UI neutral contract baseline

注意：

- 这里要补的是 HostContracts adapter，不是 CLI prompt 或 SwiftUI 交互页
- 返回值应继续使用 Core / RuntimeInterface 语义模型，而不是终端文本

### 第三优先级：把 TS 里的“分面 facade”继续对齐到 Swift runtime facade/use case

优先对照 TS：

- `src/rax/cmp/session.ts`
- `src/rax/cmp/project.ts`
- `src/rax/cmp/flow.ts`
- `src/rax/cmp/control.ts`
- `src/rax/cmp/readback.ts`
- `src/rax/cmp/roles.ts`
- `src/agent_core/cmp-service/active-flow-service.ts`
- `src/agent_core/cmp-service/tap-bridge-service.ts`
- `src/agent_core/mp-runtime/search-planner.ts`

落点原则：

- session / project / flow / roles / control / readback 继续保持分面
- 不要回退成一个“大 runtime facade”
- MP 继续保持“planner / search policy / scope enforcement”在规则层，“adapter/executor”在 host 层

### 第四优先级：补一组真实 local runtime 守卫测试

建议新增或改造测试，覆盖：

- `localDefaults()` 至少能装出完整 dependency graph
- runtime interface 能在 local profile 下完成：
  - `inspect-cmp`
  - `inspect-mp`
  - `run-goal`
  - `resume-run`
- local SQLite schema 初始化与基础读写 smoke
- git readiness / workspace search / message bus 的最小可用性

## 明确不该做的事

- 不要把下一轮重点放到 `PraxisCLI` 的交互体验做厚
- 不要把 `PraxisAppleUI` 的 blueprint 壳扩成产品 UI
- 不要把 `src/agent_core/live-agent-chat.ts` 或 `ui.ts` 原样翻成 Swift
- 不要让新的宿主能力绕过 `RuntimeInterface / Gateway`
- 不要把 provider payload、终端渲染文本、SwiftUI 展示模型泄漏进 Core 或中立 runtime contract
