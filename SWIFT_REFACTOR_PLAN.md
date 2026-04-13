# Praxis Swift 重构总计划

## 1. 这份文档的角色

这份文档是当前仓库在根目录下唯一保留的 Swift 重构总计划。

它统一替代此前分散在根目录的：

- `SWIFT_ARCHITECTURE.md`
- `SWIFT_OBJECT_ARCHITECTURE_PLAN.md`
- `SWIFT_TARGET_EXECUTION_PLAN.md`
- `REFACTOR_SWIFT_WORKORDER.md`

一句白话：

- 后续如果要判断 Swift 重构“为什么这么拆、先做什么、每个 target 干什么、什么不能做”，优先只读这一个文件。

配套长期约束仍继续沉淀在 `memory/architecture/` 与 `memory/decisions/`，但根目录不再保留多份并行主计划。

## 2. 当前事实

### 2.1 真实实现基线

- 当前可验证行为基线仍在 TypeScript 主线。
- 真正的核心行为主要集中在：
  - `src/agent_core/`
  - `src/rax/`
  - `src/integrations/`
- 当前最重的总编排器仍是 `src/agent_core/runtime.ts`。
- 当前最接近 UI 的实现不是成熟产品 UI，而是：
  - `src/agent_core/live-agent-chat.ts`
  - `src/agent_core/live-agent-chat/ui.ts`

### 2.2 当前 Swift 侧状态

- SwiftPM phase-1 target 拓扑已经稳定，不再只是“可编译骨架”。
- `Package.swift` 中的 target 依赖方向仍保持冻结，且大部分 phase-1 target 已进入“有真实规则 / use case / facade / contract”的状态。
- 当前 Swift 代码已经稳定表达：
  - 子域边界
  - Host 分层
  - RuntimeInterface / PresentationBridge 入口规则
  - 宿主无关的 typed request / response / summary / facade surface
- 最近这轮 HostRuntime 收口后，CMP/MP 的中立表面已经不再只是规划目标：
  - CMP 侧 `session`、`project`、`flow`、`roles`、`control`、`readback` 已经进入 Swift host-neutral runtime surface，而不是仍停留在单一大 facade
  - MP 侧 `ingest / align / promote / archive / resolve / history / search / readback / smoke` 已经具备可验证的 use case / facade / interface 路径
  - RuntimeInterface / Facades / UseCases 上大量 stringly-typed surface 已被收成 typed contract，包括 opaque references、lineage references、event names、role-stage telemetry、recovery source、capability IDs 等
- `PraxisRuntimeComposition.localDefaults(rootDirectory:)` 当前已经具备一批真实本地 runtime lanes：
  - checkpoint / journal / projection / delivery truth
  - embedding metadata / semantic memory / semantic search
  - message bus
  - workspace reader / searcher / writer
  - shell executor
  - git readiness probe / minimal git executor
  - lineage store
- `localDefaults` 不再适合被统称为“scaffold runtime”：
  - persistence / workspace / git / message-bus / lineage 是真实 local runtime lanes
  - provider inference / browser grounding / audio transcription / speech synthesis / image generation 这些 surface 现在按 provenance 真值区分为 `unavailable`、`scaffoldPlaceholder`、`localBaseline`、`composed`
  - inspection / smoke wording 已同步跟随 provenance truth，不再把“有 adapter”一律说成 host-backed
- `PraxisCLI` 仍只保留最小命令式壳：
  - `inspect-architecture`
  - `inspect-tap`
  - `inspect-cmp`
  - `inspect-mp`
  - `run-goal`
  - `resume-run`
  - `events`
- 当前 Swift 仍然没有承接 TS 的完整 live/runtime 深度：
  - provider / browser / multimodal user-io 的 live host depth 仍未完成，当前更像 scaffold placeholder、local baseline 或已组合 surface 的分层体系，而不是统一 live lane
  - 本地持久化已切到 SQLite-backed single-file baseline，但还没有进入正式 schema versioning / migration policy
  - `PraxisFFI` 仍未作为正式 target 收口，当前只有最小 encoded bridge surface

### 2.3 当前验证状态

截至 `2026-04-13`，本地已确认：

- `swift test` 通过
- Swift package tests 已切换到 `Swift Testing`
- 当前 `swift test` 最新快照为：
  - `355` tests
  - `53` suites
- `npm run typecheck` 当前仍未全绿：
  - `src/agent_core/live-agent-chat.ts:1690` 仍存在 TypeScript 参数个数错误

这说明：

- Swift 非 UI 主线当前已经不是“target 规划 + 架构守卫”阶段，而是已具备大体可用的 HostRuntime / CMP / MP / TAP 中立表面与对应行为回归网
- 但它还不是 TS 运行时的功能等价替代，也还没有正式冻结导出层与 live host 深度
- TS 侧当前仍是行为参考基线；上面的 `typecheck` 问题是可选尾账，不是当前 Swift 非 UI 主线 blocker

## 3. 总目标

Swift 重构的目标不是把当前 TypeScript 代码逐文件翻译成 Swift，而是把现有总装线拆成四层：

1. 可导出的 `PraxisCore`
2. 可替换的 `PraxisHostContracts`
3. 可装配的 `PraxisHostRuntime`
4. 可演进的宿主入口：
   - `PraxisCLI`
   - `PraxisAppleUI`
   - 未来 `PraxisFFI`

最终希望得到的是：

- 核心规则不再被 provider SDK、Git/DB/MQ、CLI、SwiftUI 绑死
- Apple 端可以走原生 SwiftUI / 原生宿主路线
- 未来其它平台可以通过 FFI 或导出层复用 Core
- Swift 版本不再重建一个新的大总装器

## 4. 非目标

当前阶段明确不做：

- 不一次性替换整个 TS 系统
- 不先做 UI
- 不先接全量 provider live 能力
- 不先做跨平台 UI
- 不先把 `runtime.ts` 原样翻译成 Swift
- 不先把 `live-agent-chat` 原样翻译成 Swift

一句白话：

- 先把骨架和边界做对，再谈宿主体验和 live 能力。

## 5. 硬约束

### 5.1 四层结构是硬边界

必须长期遵守：

1. `PraxisCore`
   - 只放纯领域模型、状态机、规则、planner、编排协议
2. `PraxisHostContracts`
   - 只放宿主能力协议
3. `PraxisHostRuntime`
   - 只负责装配、use case、facade、presentation bridge
4. `Entry`
   - 只负责宿主入口与导出适配
   - CLI / lib / 跨语言 host 优先走 runtime interface / FFI
   - 原生 UI host 如需展示映射，再走 presentation bridge

### 5.2 Core 只代表逻辑层，不代表兜底模块

- 不允许新建一个什么都往里塞的大 `Core` target。
- phase-1 已经拆开的 target，不允许再回并成粗粒度单体。

### 5.3 Core 不得依赖宿主副作用

Core 禁止直接依赖：

- provider SDK
- shell / `Process`
- Git CLI
- 数据库客户端
- Redis / MQ 客户端
- SwiftUI / AppKit / UIKit
- 终端 I/O

### 5.4 Git / DB / MQ / Provider 必须二段式拆分

所有这类能力都必须拆成：

- Core model / planner
- Host executor / adapter

### 5.5 CLI / 导出优先 RuntimeInterface，原生 UI 通过 PresentationBridge

- `PraxisCLI` 与未来导出 lib / 跨语言 host，不应越过 `PraxisRuntimeInterface` / `PraxisFFI` 直连 Core 或 HostContracts。
- 原生 UI host 如需展示层状态映射，可通过 `PraxisRuntimePresentationBridge` 进入系统。
- 但这条规则不应被理解为“所有未来 UI 都必须先做 Swift CLI / SwiftUI”。
- 对未来其它语言实现的 UI / shell / desktop host，优先通过：
  - `PraxisRuntimeInterface`
  - `PraxisFFIBridge`
  - 后续正式 `PraxisFFI`
  进入系统，而不是把 CLI 当成唯一主入口。

## 6. 平台策略

当前 Swift 主路径先面向 `macOS`，默认运行策略如下：

- `SQLite` 作为结构化持久化底座
- 进程内 `actor` / `AsyncStream` 作为默认消息总线
- `Accelerate` 作为默认本地向量计算底座
- 系统 `git` 作为 canonical history backbone

这意味着：

- `PostgreSQL` 不作为 macOS 单机 App 前置
- `Redis` 不作为 macOS 单机 App 前置
- 旧 TS 里的 `cmp-db` / `cmp-mq` 语义会被保留，但默认实现会转成本地存储与本地消息传播

## 7. 执行总原则

### 7.1 排序原则

固定顺序是：

1. 先纯模型
2. 再纯规则与 planner
3. 再宿主协议
4. 再运行时装配
5. 最后入口层

### 7.2 迁移原则

- 迁移按“职责纯度”切，不按 TS 目录 1:1 镜像
- 先迁可独立测试的行为
- 先迁 stable model，再迁 orchestration
- `rax` 只吸收其抽象价值，不原样照搬目录结构

### 7.3 验收原则

每一波结束时至少满足：

1. target 真实承接了职责，不再只是 TODO 占位
2. 架构守卫测试继续通过
3. 新实现没有引入越层依赖
4. 有清楚的 TS 对照行为样本

### 7.4 高风险反模式

明确禁止：

1. 直接翻译 `src/agent_core/runtime.ts`
2. 直接翻译 `src/agent_core/live-agent-chat.ts`
3. 把 provider payload builder 放进 Core
4. 把 Git / DB / MQ live 实现提前塞进 Core target
5. 让 `PraxisRuntimeUseCases` 长回第二个总编排器

## 8. 目标 target 地图

下表是当前 phase-1 目标拓扑，也是后续迁移的正式落点。

### 8.1 Foundation

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 1 | `PraxisCoreTypes` | 共享 ID、错误、边界描述、最小公共协议 | `types`、`cmp-types`、`ta-pool-types` 的公共底层 |
| 2 | `PraxisGoal` | goal source / normalize / compile | `src/agent_core/goal` |
| 3 | `PraxisState` | state projection / validation / delta | `src/agent_core/state` |
| 4 | `PraxisTransition` | transition table / guards / next action evaluation | `src/agent_core/transition` |
| 5 | `PraxisRun` | run lifecycle / tick / pause / resume / fail / complete | `src/agent_core/run` |
| 6 | `PraxisSession` | session header / attachment / hot-cold lifecycle | `src/agent_core/session` |
| 7 | `PraxisJournal` | append-only event stream / cursor / read model input | `src/agent_core/journal` |
| 8 | `PraxisCheckpoint` | checkpoint snapshot / recovery envelope / pointer 语义 | `src/agent_core/checkpoint` |

### 8.2 Capability

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 9 | `PraxisCapabilityContracts` | capability identity / manifest / invocation contract | `src/agent_core/capability-types` |
| 10 | `PraxisCapabilityResults` | normalized result envelope / failure taxonomy | `src/agent_core/capability-result` |
| 11 | `PraxisCapabilityPlanning` | selector / plan / lease / dispatch 的纯规划 | `src/agent_core/capability-model`、`capability-invocation` |
| 12 | `PraxisCapabilityCatalog` | capability family registry / baseline / discoverability，包含 MP family baseline 与跨宿主能力目录 | `src/agent_core/capability-package` |

### 8.3 TAP

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 13 | `PraxisTapTypes` | TAP 共用对象模型 | `src/agent_core/ta-pool-types` |
| 14 | `PraxisTapGovernance` | risk classify / mode policy / governance object / user surface | `src/agent_core/ta-pool-model` |
| 15 | `PraxisTapReview` | review route / review decision / tool review 统一审查面 | `src/agent_core/ta-pool-review`、`ta-pool-tool-review` 的规则层 |
| 16 | `PraxisTapProvision` | provision request / asset index / planner / activation spec 纯计划层 | `src/agent_core/ta-pool-provision` 的纯规划部分 |
| 17 | `PraxisTapRuntime` | control plane / activation lifecycle / replay policy / runtime snapshot | `src/agent_core/ta-pool-runtime` |
| 18 | `PraxisTapAvailability` | family audit / gate / availability / failure taxonomy | `src/agent_core/tap-availability` |

### 8.4 CMP

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 19 | `PraxisCmpTypes` | section / request / package / lineage / snapshot 共用对象模型 | `src/agent_core/cmp-types` |
| 20 | `PraxisCmpSections` | ingest / section creation / lowering / ownership / visibility | `src/agent_core/cmp-runtime` 中 section 相关纯规则 |
| 21 | `PraxisCmpProjection` | projection / materialization / runtime snapshot / recovery / readback summary / visibility 模型 | `src/agent_core/cmp-runtime` 与 `cmp-db` 的纯模型层 |
| 22 | `PraxisCmpDelivery` | package / dispatch instruction / active-passive flow / manual control / historical readback planning | `src/agent_core/cmp-runtime`、`cmp-mq` 的纯计划层 |
| 23 | `PraxisCmpGitModel` | branch family / refs lifecycle / lineage governance / sync intent | `src/agent_core/cmp-git` 的规则层 |
| 24 | `PraxisCmpDbModel` | storage topology / persistence plan / projection-package-delivery 落库 / readback contract 模型 | `src/agent_core/cmp-db` 的模型层 |
| 25 | `PraxisCmpMqModel` | topic topology / routing / neighborhood / delivery truth / timeout / escalation model | `src/agent_core/cmp-mq` 的规则层 |
| 26 | `PraxisCmpFiveAgent` | five-agent role protocol / handoff / context partition / TAP bridge / peer approval contract | `src/agent_core/cmp-five-agent` |

### 8.5 HostContracts

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 27 | `PraxisWorkspaceContracts` | workspace read / search / write 协议 | workspace 读写检索接缝 |
| 28 | `PraxisToolingContracts` | shell / browser / git / process supervision / browser grounding evidence 协议 | tooling adapters、`rax`、部分 `integrations` |
| 29 | `PraxisUserIOContracts` | input / permission / terminal / conversation presentation / multimodal user-io 协议 | `live-agent-chat` 宿主交互面 |
| 30 | `PraxisProviderContracts` | inference / embedding / files / batch / MCP / skill 协议 | `src/integrations/*` 与 `rax` provider 接缝 |
| 31 | `PraxisInfraContracts` | checkpoint / journal / projection / message bus / lineage / semantic search / semantic memory store 协议 | checkpoint、cmp-service、persistence、queue 相关接缝 |

### 8.6 HostRuntime

| 顺序 | Target | 职责范围 | 主要对照 TS |
| --- | --- | --- | --- |
| 32 | `PraxisRuntimeComposition` | composition root / dependency graph / adapter registry | `src/agent_core/runtime.ts`、`src/rax/runtime.ts` 的装配部分 |
| 33 | `PraxisRuntimeUseCases` | runGoal / resumeRun / inspectTap / inspectCmp / inspectMp / buildCapabilityCatalog 等高层用例 | runtime 对外应用用例层 |
| 34 | `PraxisRuntimeFacades` | 稳定 facade surface / DTO 压平层，承接 CMP `session/flow/project/roles` 这类宿主表面 | `src/rax/facade.ts` 一类对外表面 |
| 35 | `PraxisRuntimeInterface` | 宿主无关的统一 request/response/event surface，为未来导出层与跨语言绑定提供稳定接口 | `src/rax/facade.ts`、`live-agent-chat/shared.ts` 的跨宿主表面 |
| 36 | `PraxisRuntimePresentationBridge` | Swift-native presentation bridge / state mapping / event mapping，为原生宿主提供薄适配层 | `live-agent-chat` 的展示边界，但不应被当成跨语言 UI 的唯一接入协议 |

### 8.7 Entry

| 顺序 | Target | 职责范围 | 说明 |
| --- | --- | --- | --- |
| 37 | `PraxisCLI` | 调试 / 验证 / smoke 用的薄宿主适配层，不作为当前产品主路径 | 运行时请求默认经由 `PraxisRuntimeInterface`，不把 CLI 绑定成桥层中枢 |
| 38 | `PraxisAppleUI` | Swift 原生壳的可选适配层，不作为当前阶段必须优先落地的产品界面 | 先保留宿主边界，不急于实现完整 UI |
| 39 | `PraxisFFI` | 未来多语言导出层与 UI 接入主路径 | 当前先以 `PraxisFFIBridge` 的最小 encoded bridge surface 锁住可用性，后续优先服务跨语言 UI / shell 接入 |

### 8.8 当前需要显式纳入规划的模块面

这里说的“模块”默认不是再新开 target，而是在既有 target 边界内把最近已经浮现出来的子模块面写清楚，避免后面又长回大总装器。

| 模块面 | 当前线索 | Swift 正式落点 |
| --- | --- | --- |
| CMP control surface | `src/rax/cmp/control.ts` 已把 execution style、automation gate、dispatch scope、truth preference 拆出来 | `PraxisCmpDelivery` 承担 manual control / dispatch policy，`PraxisCmpProjection` 承担 truth preference / readback fallback 语义 |
| CMP flow facade | `src/rax/cmp/flow.ts` 与 `src/agent_core/cmp-service/active-flow-service.ts` 已把 ingest / commit / resolve / materialize / dispatch / history request 从大 runtime 拆开 | Core 规则分别落到 `PraxisCmpSections`、`PraxisCmpProjection`、`PraxisCmpDelivery`，宿主表面收敛到 `PraxisRuntimeUseCases` 与 `PraxisRuntimeFacades` |
| CMP project / readback / smoke | `src/rax/cmp/project.ts`、`src/rax/cmp/readback.ts`、`src/agent_core/cmp-service/project-service.ts` 已把 bootstrap、recovery、delivery truth、acceptance readback 单独成面 | `PraxisCmpGitModel`、`PraxisCmpDbModel`、`PraxisCmpMqModel`、`PraxisCmpProjection` 负责纯模型与 summary，`PraxisRuntimeFacades` 对外提供 inspection / smoke 表面 |
| CMP roles / TAP bridge | `src/rax/cmp/roles.ts` 与 `src/agent_core/cmp-service/tap-bridge-service.ts` 已把 role capability access、dispatch、peer approval 从 runtime 主体剥离 | `PraxisCmpFiveAgent` 负责 role/TAP bridge 协议，`PraxisTapRuntime` 负责 capability access / review / provision 规则，`PraxisRuntimeUseCases` 负责编排 |
| CMP session surface | `src/rax/cmp/session.ts`、`src/rax/cmp/api.ts` 已把 session open、bootstrap payload normalize、runtime binding 明确成表面 | `PraxisRuntimeFacades` 提供稳定 session/project/flow facade，`PraxisRuntimeComposition` 负责 runtime binding 与 composition root |
| MP capability baseline | `Sources/PraxisCapabilityCatalog/PraxisCapabilityCatalogMPModels.swift` 已引入 MP family capability baseline | `PraxisCapabilityCatalog` 继续承接 MP family registry / baseline，不单独新开“大 MP core” target |
| Semantic memory / search contracts | `Sources/PraxisInfraContracts/PraxisSemanticMemoryRequests.swift` 已出现 local-first semantic memory record、search、bundle 契约 | `PraxisInfraContracts` 负责 memory/search/store 接缝，`PraxisRuntimeUseCases` 通过 `inspectMp` 等入口暴露宿主可读视图 |
| Browser grounding / multimodal user-io | `Sources/PraxisToolingContracts/PraxisBrowserGroundingModels.swift` 与 `Sources/PraxisUserIOContracts/PraxisUserIOMultimodalRequests.swift` 已把 grounding evidence、audio/image/speech 请求面显式化 | `PraxisToolingContracts` 负责 browser grounding，`PraxisUserIOContracts` 负责 multimodal chips 与 I/O 请求，运行时只做编排不吸收具体宿主实现 |

## 9. 正式执行波次

### Wave 0：基线冻结

这不是 target 波次，而是后续所有 target 迁移的前提。

进度记录（`2026-04-10`）：

- 已完成
- 已冻结并落地 Foundation 最小黄金样本的 Swift 侧承接起点：
  - goal compile
  - run transition
  - state projection / delta merge
- 对应验证已纳入并通过 `swift test`
- 相关 Swift package 测试已统一迁移到 `Swift Testing`

必须冻结：

- TS 当前验证命令
- live / smoke 入口
- 最小黄金行为样本

最低样本集：

- goal compile
- run transition
- capability invocation plan
- TAP risk / policy / review decision
- CMP section lowering / delivery planning / routing

### Wave 1：Foundation

进度记录（`2026-04-10`）：

- 已完成
- Foundation 八个 target 已全部进入“最小可演算实现”状态，不再只是边界占位
- `PraxisRun`、`PraxisSession`、`PraxisJournal`、`PraxisCheckpoint` 已补齐第一轮纯模型 / 纯规则 / in-memory 支撑实现
- 已补齐对应 Swift Testing 逻辑测试，覆盖 session lifecycle、journal append/read、checkpoint codec/recovery、run lifecycle advance
- 当前 `swift test` 已覆盖到 Foundation 八个 target 的架构守卫与纯逻辑样本，并保持通过

覆盖 target：

- `PraxisCoreTypes`
- `PraxisGoal`
- `PraxisState`
- `PraxisTransition`
- `PraxisRun`
- `PraxisSession`
- `PraxisJournal`
- `PraxisCheckpoint`

目标：

- 建立最小可演算核心
- 把 ID、状态、事件、run/session/checkpoint 关系全部固化

完成标准：

- Swift 中的 Foundation 八个 target 不再只是边界占位
- 不依赖 Node 即可跑纯逻辑测试

### Wave 2：Capability

进度记录（`2026-04-10`）：

- 已完成
- `PraxisCapabilityContracts`、`PraxisCapabilityResults`、`PraxisCapabilityPlanning`、`PraxisCapabilityCatalog` 已进入最小可演算实现状态
- `PraxisCapabilityContracts` 已承接 capability manifest、binding、invocation request、execution policy 等基础契约模型
- `PraxisCapabilityResults` 已承接 normalized output、result envelope、failure taxonomy 与默认 normalizer
- `PraxisCapabilityPlanning` 已承接 selector、invocation plan、lease、dispatch plan 与纯规划 heuristics
- `PraxisCapabilityCatalog` 已承接 family grouping、catalog snapshot、latest selection 视图与 MP baseline 承接点
- 已补齐对应 Swift Testing 逻辑测试，覆盖 contracts / results / planning / catalog 四个 target 的核心样本
- 当前 `swift test` 已继续保持通过

覆盖 target：

- `PraxisCapabilityContracts`
- `PraxisCapabilityResults`
- `PraxisCapabilityPlanning`
- `PraxisCapabilityCatalog`

目标：

- 建立 capability 的声明、规划、结果归一化

完成标准：

- Swift Core 能表示 capability plan、lease、result envelope
- 但仍不直接接真实工具

### Wave 3：TAP

进度记录（`2026-04-10`，`2026-04-11` 校准）：

- 已完成
- TAP 六个 target 已从“类型/服务骨架 + 架构守卫”进入“最小可验证的 Core 规则层”状态
- `PraxisTapTypes`、`PraxisTapGovernance` 已承接 mode / tier / risk / vote / profile、risk classify、mode policy、safety interception 等基础语义与治理规则
- `PraxisTapReview`、`PraxisTapProvision` 已承接 review route / decision、tool-review 统一审查面、asset registry、provision planner、verification/rollback plan 等纯规则面
- `PraxisTapRuntime`、`PraxisTapAvailability` 已承接 replay policy、human gate、runtime snapshot、availability audit、gate decision、failure taxonomy 等运行期语义与可用性规则
- 已明确把 reviewer worker bridge、model hook、tool runtime handoff、install/repo write/network side effect 留在 HostContracts / HostRuntime，不回灌进 TAP Core
- 已补齐对应 Swift Testing 测试，覆盖 topology、governance、review/provision/runtime/availability 的首轮样本；当前全仓最新验证快照见 `2.3 当前验证状态`

覆盖 target：

- `PraxisTapTypes`
- `PraxisTapGovernance`
- `PraxisTapReview`
- `PraxisTapProvision`
- `PraxisTapRuntime`
- `PraxisTapAvailability`

目标：

- 让 reviewer / tool review / provision / human gate / replay policy 都成为独立 Core 子域

完成标准：

- Swift Core 能独立做 TAP 决策
- 审查与供应流程不再依赖 Node 宿主实现

### Wave 4：CMP

进度记录（`2026-04-10`）：

- 已完成
- CMP 八个 target 已从“边界 + 占位模型”进入“最小可验证的纯 Core model / planner”状态
- `PraxisCmpTypes` 已冻结 Wave4 共享名词表：
  - CMP ID 类型
  - lineage / neighborhood / visibility / delivery status 等共享枚举
  - request / section / snapshot / projection / package / receipt 基础语义
  - ingest / commit / resolve / materialize / dispatch / history request 六个入口 contract
- `PraxisCmpSections`、`PraxisCmpProjection`、`PraxisCmpDelivery` 已补齐从 ingest -> section -> lowering -> projection/materialization -> delivery planning 的纯规则链路
- `PraxisCmpGitModel`、`PraxisCmpDbModel`、`PraxisCmpMqModel`、`PraxisCmpFiveAgent` 已补齐对应 planner / lifecycle / topology / role protocol / tap-bridge payload 纯模型
- 已明确排除 Git CLI、数据库执行器、消息队列适配器、provider 推理执行器进入 Wave4 Core；相关 live backend 仍留给后续 HostContracts / HostRuntime
- 已补齐八个独立 Swift Testing 测试 target，`swift test` 当前全绿，合计 `72` 个测试通过

覆盖 target：

- `PraxisCmpTypes`
- `PraxisCmpSections`
- `PraxisCmpProjection`
- `PraxisCmpDelivery`
- `PraxisCmpGitModel`
- `PraxisCmpDbModel`
- `PraxisCmpMqModel`
- `PraxisCmpFiveAgent`

目标：

- 把 CMP 从当前文档驱动体系落成可复用 Core 规则层，并吸收最近已经拆出来的 control / flow / project / readback / roles / tap-bridge 模块面

完成标准：

- Swift Core 能在不接真实 Git / DB / MQ 的情况下推进 CMP 规划与状态演进
- HostRuntime 不再把 CMP project/readback/role bridge 重新揉回一个大 runtime 方法集

### Wave 5：HostContracts

进度记录（`2026-04-10`）：

- 已完成
- `PraxisInfraContracts` 已进入“可被 HostRuntime 消费的稳定宿主 contract”状态
- `PraxisToolingContracts` 已进入结构化 shell / browser / git / process contract 状态，并补齐对应 doubles 与测试
- `PraxisWorkspaceContracts` 已进入结构化 read / search / change contract 状态，并补齐对应 doubles 与测试
- `PraxisProviderContracts` 已进入结构化 inference / embedding / file / batch / skill / MCP contract 状态，并补齐对应 doubles 与测试
- `PraxisUserIOContracts` 已进入结构化 prompt / permission / terminal / conversation / multimodal contract 状态，并补齐对应 doubles 与测试
- 已补齐 checkpoint / journal / projection / message bus / delivery truth / embedding / semantic search / semantic memory / lineage 的 structured request/query/receipt 模型
- 已补齐 shell / browser grounding / git readiness / workspace read-search-write / provider host-facing contract 模型
- 已补齐 prompt / permission / terminal / conversation / audio transcription / speech synthesis / image generation 的 host-facing contract 模型
- 已为 `PraxisInfraContracts`、`PraxisToolingContracts`、`PraxisWorkspaceContracts`、`PraxisProviderContracts`、`PraxisUserIOContracts` 新增 fake / stub / spy test doubles，避免后续 runtime 测试只能依赖空协议或真实 adapter
- 已新增 `PraxisInfraContractsTests`、`PraxisToolingContractsTests`、`PraxisWorkspaceContractsTests`、`PraxisProviderContractsTests`、`PraxisUserIOContractsTests` 并通过，当前 `swift test` 合计 `87` 个测试通过

覆盖 target：

- `PraxisWorkspaceContracts`
- `PraxisToolingContracts`
- `PraxisUserIOContracts`
- `PraxisProviderContracts`
- `PraxisInfraContracts`

目标：

- 冻结“系统向宿主要什么能力”，包括 semantic memory、browser grounding、multimodal user-io 这些已出现的宿主契约面

完成标准：

- 五类协议都具备 fake / stub / spy 测试替身
- 协议输入输出尽量使用 Core 语义，而不是 provider 原始 payload

### Wave 6：HostRuntime

当前进度记录（截至 `2026-04-13`）：

- `PraxisRuntimeComposition`、`PraxisRuntimeUseCases`、`PraxisRuntimeFacades`、`PraxisRuntimeInterface`、`PraxisRuntimeGateway`、`PraxisRuntimePresentationBridge` 已形成持续被真实测试覆盖的 HostRuntime 闭环。
- 当前已经具备：
  - replay-aware `run / resume` 最小运行链
  - typed runtime interface request / structured response / error envelope
  - session handle lifecycle / opaque reference surface
  - `PraxisFFIBridge` 的最小 encoded bridge surface
  - CMP / MP inspection、readback、smoke、history、workflow mutation 的真实 facade / use case / interface 路径
- `PraxisRuntimeComposition.localDefaults(rootDirectory:)` 当前已明确区分两类东西：
  - 真实 local runtime lanes：persistence、workspace、git、message bus、semantic memory/search、lineage
  - 仍需按 provenance 真值描述的 host-facing lanes：provider inference、browser grounding、audio/speech/image multimodal surfaces
- Wave 6 这轮已完成的关键收口包括：
  - `session / project / flow / roles / control / readback` 等 CMP host-neutral surface 的持续 typed 化与守卫测试
  - MP `ingest / align / promote / archive / resolve / history / search / readback / smoke` 的边界行为、wire-shape 与 telemetry contract 加固
  - runtime interface opaque references、lineage references、event names、TAP capability IDs、tool-review governance signals、CMP recovery source、role-stage telemetry 等弱类型 contract 的持续 typed migration
  - `localDefaults` provenance truth 收口：`unavailable / scaffoldPlaceholder / localBaseline / composed`
  - CMP/TAP readback wording truth 收口：只有真正来自 persisted state 或 append-only runtime events 的路径保留 `persisted` 语义，其余 fallback 路径改回 `current ... state/view`
- 这意味着当前 Wave 6 已经从“最小 local runtime 闭环”继续推进到“host-neutral surface 与 truth wording 收口”阶段，而不是仍停留在 neutral bridge 可调用的早期状态。
- 当前 Wave 6 的可信残余项主要是：
  - SQLite-backed runtime store 仍缺正式 schema versioning / migration policy
  - provider / browser / multimodal user-io 仍未形成完整 live host depth，当前主要是 scaffold placeholder、local baseline 与 composed surface 的组合
  - provenance / mixed-fallback 行为网仍是高价值回归网，不是对所有 host-surface 传播路径的完备证明
  - `PraxisFFI` 仍未正式升格成独立导出 target
- 当前阶段应刻意保留的弹性包括：
  - 真实导出函数表如何组织
  - 跨线程调用约束
  - 流式 token / partial update 协议
  - 最终的句柄释放与缓冲区所有权模型
- 当前本地验证快照见 `2.3`：
  - `swift test` 为 `355` tests / `53` suites 全通过

覆盖 target：

- `PraxisRuntimeComposition`
- `PraxisRuntimeUseCases`
- `PraxisRuntimeFacades`
- `PraxisRuntimeInterface`
- `PraxisRuntimePresentationBridge`

目标：

- 正式把系统装起来，并提供 CMP / MP inspection 这类稳定 facade / use case 表面

完成标准：

- 宿主可经由 facade / bridge 调 Core
- 但不会把 Core 规则重新吸回 runtime 层
- 对未来导出层已经有可验证的最小 neutral contract 与 encoded bridge surface
- 但不在 Wave 6 冻结完整 `PraxisFFI` 行为细节
- local runtime 默认装配至少具备：
  - workspace read/search/write
  - git readiness + minimal git execution
  - lineage persistence
  - inspection summary 能反映这些真实本地能力，而不是只反映“有无接线”

### Wave 7：Entry / Export Adapters

进度策略（`2026-04-11`）：

- 当前阶段尽量不深入 CLI / GUI 产品实现
- `PraxisCLI` 只保留为最小调试 / smoke / 开发验证适配层
- `PraxisAppleUI` 只保留为宿主边界占位，不要求当前阶段做完整页面体系
- 进入 Wave 7 时，优先把现有 `PraxisFFIBridge` 升格成正式 target 与稳定导出边界
- 如果后续 UI 有其它语言代码进入，默认优先建立：
  - `RuntimeInterface` request/response/event contract
  - `PraxisFFI` 导出层
  而不是要求它先复用 Swift CLI 或直接绑定 SwiftUI
- 不建议现在就补完整 ABI，因为这会过早冻结：
  - 错误传递语义
  - 内存管理方式
  - 事件流协议
  - 多语言绑定映射策略

覆盖 target：

- `PraxisCLI`
- `PraxisAppleUI`
- 未来 `PraxisFFI`

目标：

- 建立可被多宿主复用的导出与适配边界，而不是先把 Swift CLI / GUI 做厚

完成标准：

- `PraxisCLI` 若存在，只承担最小验证入口，不成为运行时主耦合点
- `PraxisAppleUI` 若存在，只通过薄 bridge 接系统，不反向牵引 Runtime 设计
- 新的 UI / shell 若由其它语言实现，能够优先建立在 `PraxisRuntimeInterface` / `PraxisFFI` 之上
- `PraxisFFI` 进入实现时，以当前最小 encoded bridge surface 为基线增量推进，而不是重写运行协议

## 10. 目标范围与不该迁移的内容

### 10.1 应迁移

- 业务规则
- 状态机
- capability 语义
- TAP / CMP 对象模型
- planner / governance / routing 规则
- 行为验证样本

### 10.2 不应原样迁移

- `src/agent_core/runtime.ts` 的超大总装结构
- `src/agent_core/live-agent-chat/ui.ts` 的 ANSI 终端细节
- `src/rax/` 的目录结构本身
- provider 当前 JSON payload 细节
- `docs/ability/*` 的任务包层级
- `dist/`
- `node_modules/`

## 11. 高风险 target 与 review gate

下列 target 需要额外 review gate：

### `PraxisCapabilityPlanning`

风险：

- 容易偷偷长成 executor

### `PraxisTapProvision`

风险：

- 容易把 provisioning 的宿主副作用塞进 Core

### `PraxisCmpDelivery`

风险：

- 容易提前绑定 MQ / DB / provider

### `PraxisRuntimeUseCases`

风险：

- 最容易长回新的 `runtime.ts`

### `PraxisRuntimePresentationBridge`

风险：

- 最容易反向吸收 CLI / SwiftUI 专有模型

## 12. 推荐的 PR 切法

建议不要按“每个 target 一个 PR”切。

推荐顺序：

1. PR 1
   - `PraxisCoreTypes`
   - `PraxisGoal`
   - `PraxisState`
   - `PraxisTransition`
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 四个 Foundation target 已从纯边界占位进入最小可演算实现
     - 已补齐对应 Swift Testing 测试，覆盖 goal compile、state projection / delta、transition evaluation 等核心样本
     - 公开模型与主要函数已补基础注释和文档注释，便于后续继续承接 Wave 1
2. PR 2
   - `PraxisRun`
   - `PraxisSession`
   - `PraxisJournal`
   - `PraxisCheckpoint`
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 四个 Foundation target 已从空服务骨架进入最小可运行实现
     - `PraxisSession` 已承接 session header、run attach、checkpoint pointer、hot-cold transition
     - `PraxisJournal` 已承接 append-only in-memory journal、cursor slice、按 session/run 读取、flush signal
     - `PraxisCheckpoint` 已承接 checkpoint tier、JSON codec、in-memory store、checkpoint + journal replay recovery
     - `PraxisRun` 已承接 run aggregate、run event factory、advance/tick 纯推进逻辑与最小 coordinator
     - 对应 Swift Testing 测试已补齐并通过，便于继续向 Wave 2 推进
3. PR 3
   - `PraxisCapabilityContracts`
   - `PraxisCapabilityResults`
   - `PraxisCapabilityPlanning`
   - `PraxisCapabilityCatalog`
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 四个 Capability target 已从边界与模型骨架进入最小可运行实现
     - `PraxisCapabilityContracts` 已冻结 capability 基础契约模型
     - `PraxisCapabilityResults` 已补齐 result envelope 与默认归一化规则
     - `PraxisCapabilityPlanning` 已补齐 capability selection / invocation / lease / dispatch 纯规划链路
     - `PraxisCapabilityCatalog` 已补齐 family registry / snapshot / discoverability 最小视图
     - 对应 Swift Testing 测试已补齐并通过，覆盖 contracts / results / planning / catalog 的最小验收样本
     - 已新增对应 Swift Testing 逻辑测试并通过，便于后续继续推进 TAP / CMP 依赖 Capability 的上层接线
4. PR 4
   - 全部 TAP targets
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 六个 TAP target 已从 skeleton 进入最小可运行的 Core 规则层
     - `PraxisTapTypes` / `PraxisTapGovernance` 已固定 mode、risk、policy、safety 语义
     - `PraxisTapReview` / `PraxisTapProvision` 已补齐 review route/decision、asset registry、provision planning
     - `PraxisTapRuntime` / `PraxisTapAvailability` 已补齐 replay/human gate/runtime snapshot 与 availability audit/gate 规则
     - 已补齐 `TapGovernanceRuleTests`、`TapOperationalRuleTests`、`TapGovernanceSupportTests`、`TapTopologyTests`
5. PR 5
   - `PraxisCmpTypes`
   - `PraxisCmpSections`
   - `PraxisCmpProjection`
   - `PraxisCmpDelivery`
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 四个 CMP target 已从骨架进入最小可运行的纯规则实现
     - `PraxisCmpTypes` 已冻结共享 ID、状态枚举与六个入口 action contract
     - `PraxisCmpSections` 已承接 ingress / section creation / lowering / ownership rule evaluation
     - `PraxisCmpProjection` 已承接 projection、materialization、visibility、runtime snapshot、recovery 纯模型
     - `PraxisCmpDelivery` 已承接 active / passive delivery planning、dispatch instruction 与 historical fallback planning
     - 已补齐对应 Swift Testing 测试并通过
6. PR 6
   - `PraxisCmpGitModel`
   - `PraxisCmpDbModel`
   - `PraxisCmpMqModel`
   - `PraxisCmpFiveAgent`
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 四个 CMP target 已落下 planner / topology / lifecycle / role protocol 最小实现
     - `PraxisCmpGitModel` 已承接 branch family、checked/promoted ref lifecycle、promotion / sync / lineage guard 纯治理模型
     - `PraxisCmpDbModel` 已承接 storage topology、bootstrap contract、projection/package/delivery persistence plan
     - `PraxisCmpMqModel` 已承接 neighborhood graph、topic topology、routing、subscription guard、critical escalation
     - `PraxisCmpFiveAgent` 已承接 five-agent role protocol、handoff、live trace、tap-bridge payload、runtime summary 纯模型
     - 已明确不把 Git / DB / MQ / provider live executor 带回 Core
     - 已补齐对应 Swift Testing 测试并通过
7. PR 7
   - 全部 HostContracts targets
   - 状态：已完成（`2026-04-10`）
   - 完成内容：
     - 五类 HostContracts 已形成稳定结构化 contract
     - 已补齐 fake / stub / spy doubles 与对应测试
     - 协议输入输出已优先使用 Core 语义模型，而不是 provider / host 原始 payload
8. PR 8
   - `PraxisRuntimeComposition`
   - `PraxisRuntimeUseCases`
   - 状态：已完成（`2026-04-11`）
   - 完成内容：
     - 默认 local profile 已切到真实 `localDefaults(rootDirectory:)`
     - 已补入 SQLite-backed checkpoint / journal / projection / delivery truth / semantic memory / lineage
     - `runGoal` / `resumeRun` 已开始真实消费本地 persistence、recovery、message bus 与 lineage truth
9. PR 9
   - `PraxisRuntimeFacades`
   - `PraxisRuntimeInterface`
   - `PraxisRuntimeGateway`
   - `PraxisRuntimePresentationBridge`
   - 状态：已完成（`2026-04-11`）
   - 完成内容：
     - 已形成 facade / runtime interface / encoded bridge 的最小闭环
     - 已具备 typed request/response/error envelope、session handle lifecycle、FFI bridge smoke surface
     - HostRuntime 当前已能通过 neutral surface 承接 inspection / run / resume / buffered events
10. PR 10
   - `PraxisCLI`（若仍需要最小验证入口）
   - `PraxisAppleUI`（若需要原生壳）
   - 或优先替换为 `PraxisFFI` / 导出层相关 PR

## 13. 验证与测试拓扑

### 13.1 架构守卫测试

当前必须持续通过：

- `PraxisFoundationArchitectureTests`
- `PraxisCapabilityArchitectureTests`
- `PraxisTapArchitectureTests`
- `PraxisCmpArchitectureTests`
- `PraxisHostContractsArchitectureTests`
- `PraxisHostRuntimeArchitectureTests`

它们的职责是防止：

- 粗模块回归
- target 边界漂移
- 依赖方向回退
- Entry 越层调用

### 13.2 下一阶段要补的逻辑测试

建议按 target 继续下钻：

- Foundation 各 target 的纯逻辑测试
- 已完成首轮：
  - `PraxisGoalTests`
  - `PraxisStateTests`
  - `PraxisTransitionTests`
  - `PraxisRunTests`
  - `PraxisSessionTests`
  - `PraxisJournalTests`
  - `PraxisCheckpointTests`
- Capability 各 target 的 plan / result 测试
- 已完成首轮：
  - `PraxisCapabilityContractsTests`
  - `PraxisCapabilityResultsTests`
  - `PraxisCapabilityPlanningTests`
  - `PraxisCapabilityCatalogTests`
- TAP 各 target 的 policy / review / runtime 测试
- 已完成首轮：
  - `PraxisTapArchitectureTests/TapTopologyTests`
  - `PraxisTapArchitectureTests/TapGovernanceRuleTests`
  - `PraxisTapArchitectureTests/TapOperationalRuleTests`
  - `PraxisTapArchitectureTests/TapGovernanceSupportTests`
- CMP 各 target 的 section / projection / delivery / model 测试
  - 已完成首轮：
    - `PraxisCmpTypesTests`
    - `PraxisCmpSectionsTests`
    - `PraxisCmpProjectionTests`
    - `PraxisCmpDeliveryTests`
    - `PraxisCmpGitModelTests`
    - `PraxisCmpDbModelTests`
    - `PraxisCmpMqModelTests`
    - `PraxisCmpFiveAgentTests`
- HostContracts 的 fake/mock 合约测试
- 已完成首轮：
  - `PraxisInfraContractsTests`
  - `PraxisToolingContractsTests`
  - `PraxisWorkspaceContractsTests`
  - `PraxisProviderContractsTests`
  - `PraxisUserIOContractsTests`
- HostRuntime 的 composition / use case / facade / bridge 集成测试
- 已完成首轮：
  - `PraxisHostRuntimeArchitectureTests/HostRuntimeTopologyTests`
  - `PraxisHostRuntimeArchitectureTests/HostRuntimeSurfaceTests`
  - `PraxisHostRuntimeArchitectureTests/HostRuntimeInterfaceTests`

### 13.3 双跑对照

真正切换宿主前，应逐步建立：

- TS goal vs Swift goal
- TS run transition vs Swift run transition
- TS TAP governance vs Swift TAP governance
- TS CMP routing vs Swift CMP routing

## 14. 当前剩余项与下一步建议

按当前进度，Swift 非 UI 主线已经从“大块架构迁移”进入“剩余真值与导出边界收口”阶段。可信的剩余项目前压缩为：

1. 继续补强 Wave 6 的 truth / provenance residual
   - 为 mixed provenance、mixed fallback、override path 继续补行为回归网
   - 重点不是再发明新的大 facade，而是防止现有 host-neutral surface 在 wording、summary、inspection、smoke 上重新漂强
2. 继续做实 local runtime baseline
   - 为 SQLite-backed runtime store 引入明确的 schema versioning / migration policy
   - 保持 `localDefaults` 中真实 local lane 与 scaffold/local-baseline/composed host-facing lane 的边界清晰
3. 再推进 Wave 7 的导出层
   - 优先把现有 `PraxisFFIBridge` 升格成正式 `PraxisFFI`
   - `PraxisCLI` 继续只承担最小验证入口
   - `TUI / GUI` 仍不属于当前这份 Swift 非 UI 收口范围
4. 作为可选尾账处理 TS UI 问题
   - `src/agent_core/live-agent-chat.ts:1690` 仍可顺手修，但它不是当前 Swift 主线 blocker

最重要的一句话：

- 先证明“Swift 可以承接纯核心”，再证明“Swift 可以装配整个系统”，最后才证明“Swift 宿主真的好用”。
