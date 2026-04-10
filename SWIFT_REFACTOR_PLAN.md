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

- SwiftPM phase-1 target 骨架已经建立完成。
- `Package.swift` 中的 target 依赖方向已经冻结。
- 当前 Swift 代码已经能表达：
  - 子域边界
  - Host 分层
  - PresentationBridge 入口规则
  - 若干 placeholder DTO / facade / use case
- 最近已吸收 `integrate/dev-master-cmp` 的模块化方向：
  - CMP facade / service 不再只靠一个大表面承接，而是已经出现 `session`、`flow`、`project`、`roles`、`control`、`readback` 这些清晰缝
  - HostRuntime 内部也已经出现 `activeFlow`、`project`、`tapBridge` 这样的服务切面
  - HostContracts 侧已经开始出现 MP baseline、semantic memory、browser grounding、multimodal user-io 的明确契约占位
- 当前 Swift 仍然主要是“可编译骨架 + 架构守卫测试”，还没有承接 TS 的完整行为深度。

### 2.3 当前验证状态

截至 `2026-04-10`，本地已确认：

- `swift test` 通过
- `npm run typecheck` 通过

这说明：

- Swift 骨架当前是可编译、可守卫的
- 但它还不是 TS 运行时的功能等价替代

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
   - 只负责 CLI / SwiftUI / FFI 入口

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

### 5.5 Entry 只能通过 PresentationBridge 进入系统

- CLI / SwiftUI / FFI 不允许越过 `PraxisRuntimePresentationBridge` 直连 Core 或 HostContracts。

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
| 35 | `PraxisRuntimePresentationBridge` | CLI / SwiftUI / FFI 展示桥 / state mapping / event mapping | `live-agent-chat` 的展示边界 |

### 8.7 Entry

| 顺序 | Target | 职责范围 | 说明 |
| --- | --- | --- | --- |
| 36 | `PraxisCLI` | 非交互命令、交互会话、终端渲染、日志回放 | 先命令，后会话，再高级终端体验 |
| 37 | `PraxisAppleUI` | SwiftUI app shell、inspection、run/session 宿主界面 | 先壳、后只读、再交互 |
| 38 | `PraxisFFI` | 未来导出层 | 等 `PraxisRuntimePresentationBridge` 稳定后再做 |

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

覆盖 target：

- `PraxisRuntimeComposition`
- `PraxisRuntimeUseCases`
- `PraxisRuntimeFacades`
- `PraxisRuntimePresentationBridge`

目标：

- 正式把系统装起来，并提供 CMP / MP inspection 这类稳定 facade / use case 表面

完成标准：

- 宿主可经由 facade / bridge 调 Core
- 但不会把 Core 规则重新吸回 runtime 层

### Wave 7：Entry

覆盖 target：

- `PraxisCLI`
- `PraxisAppleUI`
- 未来 `PraxisFFI`

目标：

- 建立真正可用的 Swift 宿主

完成标准：

- CLI 能接管最小运行面
- Apple UI 能承接 inspection 与后续交互页面

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
2. PR 2
   - `PraxisRun`
   - `PraxisSession`
   - `PraxisJournal`
   - `PraxisCheckpoint`
3. PR 3
   - `PraxisCapabilityContracts`
   - `PraxisCapabilityResults`
   - `PraxisCapabilityPlanning`
   - `PraxisCapabilityCatalog`
4. PR 4
   - 全部 TAP targets
5. PR 5
   - `PraxisCmpTypes`
   - `PraxisCmpSections`
   - `PraxisCmpProjection`
   - `PraxisCmpDelivery`
6. PR 6
   - `PraxisCmpGitModel`
   - `PraxisCmpDbModel`
   - `PraxisCmpMqModel`
   - `PraxisCmpFiveAgent`
7. PR 7
   - 全部 HostContracts targets
8. PR 8
   - `PraxisRuntimeComposition`
   - `PraxisRuntimeUseCases`
9. PR 9
   - `PraxisRuntimeFacades`
   - `PraxisRuntimePresentationBridge`
10. PR 10
   - `PraxisCLI`
   - `PraxisAppleUI`

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
- Capability 各 target 的 plan / result 测试
- TAP 各 target 的 policy / review / runtime 测试
- CMP 各 target 的 section / projection / delivery / model 测试
- HostContracts 的 fake/mock 合约测试
- HostRuntime 的 composition / use case / facade / bridge 集成测试

### 13.3 双跑对照

真正切换宿主前，应逐步建立：

- TS goal vs Swift goal
- TS run transition vs Swift run transition
- TS TAP governance vs Swift TAP governance
- TS CMP routing vs Swift CMP routing

## 14. 当前开工建议

如果下一轮要开始真实编码，建议严格按下面节奏推进：

1. 先做 Wave 0
   - 冻结最小黄金样本
   - 确认对照测试入口
2. 再做 Wave 1 和 Wave 2
   - 先证明 Swift 能承接纯核心
3. 然后做 Wave 3 和 Wave 4
   - 把 TAP/CMP 的纯规则层补齐
4. 再做 Wave 5 和 Wave 6
   - 建立可装配运行时
5. 最后才做 Wave 7
   - 让 Swift 宿主真正可用

最重要的一句话：

- 先证明“Swift 可以承接纯核心”，再证明“Swift 可以装配整个系统”，最后才证明“Swift 宿主真的好用”。
