# Praxis 12 周接手开发流程

> 状态：当前执行手册
>
> 本文负责把 12 周接手路线拆成可执行的推进流程、阶段出口、工件清单和验证顺序。
> 截至 2026-04-14，旧的 `SWIFT_REFACTOR_PLAN.md` 已视为过时，不再作为执行依据。
> 当前仓库涉及 Swift 重构范围、target 职责、执行顺序和阶段边界时，统一以本文为唯一执行入口。
> 截至 2026-04-14，Phase 1 的 RuntimeKit examples / README 入口、Phase 2 的 support matrix / error matrix / smoke harness skeleton，以及 Phase 3 的第一批 thin capability baseline 已落地到主线代码。

## 1. 文档定位

这份文档只回答一个问题：

在不恢复旧 TS/Node runtime、不破坏当前 Swift target 边界、也不再发散出第二套总路线图的前提下，Praxis 接手后的 12 周应该怎样推进。

执行顺序遵循的是工程风险，而不是模块外观：

1. 先止血。
2. 再统一仓库入口和 SDK 入口。
3. 再补 TAP 与 durable runtime 主链。
4. 最后做 export 与商业化准备。

## 2. 当前前提

- 活跃实现主线是 Swift + SwiftPM。
- 长期对外形态是可嵌入、可导出的 runtime/framework，不是 CLI/TUI/GUI 产品仓库。
- `PraxisRuntimeKit` 是默认推荐的调用入口。
- `PraxisHostRuntime` 与 `PraxisFFI` 属于导出/runtime 层，不应成为新接入方的第一入口。
- 旧 TS/Node runtime 不应回流到当前主线。
- 在 macOS 本地 baseline host adapters 完备前，Linux 相关宿主实现只保留占位与条件编译接缝，不进入并行实装。
- `shell.*`、`code.*`、MCP、Skill、`computer.use` 这类高副作用能力，必须排在 durable state、reviewer 上下文和 recovery 之后。

## 3. 三条硬约束

### 3.1 仓库方向约束

- 不恢复 `src/`、`dist/`、`package.json`、`npm`、旧 TS runtime 工作流。
- 不新建与本文并行竞争的总计划文档。
- 不把 CLI 或 GUI 壳重新当成主产品面。

### 3.2 Runtime 边界约束

- `PraxisRuntimeKit` 保持 thin shell，但要 caller-friendly。
- 不把 composition、transport、bootstrap、FFI、gateway 细节泄漏到推荐公开面。
- 如果需要更激进的便捷 API，应放在 `PraxisRuntimeKit` 之上单独封装，而不是反向做脏 RuntimeKit。

### 3.3 交付纪律约束

- 不同时开太多战略战线。
- 每条 capability 必须带着代码、验证、smoke、文档一起交付。
- 每个阶段结束时都必须留下 baseline 或 milestone 总结，而不是只有代码合并记录。

## 4. 当前代码基线

结合 `Package.swift`，当前包结构可以归成五层：

- Foundation 领域层：`PraxisFoundation`
- Capability 与 TAP 领域层：`PraxisCapabilityDomain`、`PraxisTapDomain`
- CMP/MP 领域层：`PraxisCmpDomain`、`PraxisMpDomain`
- Host/export/runtime 层：`PraxisHostContracts`、`PraxisHostRuntime`、`PraxisRuntimeKit`
- 架构守卫层：`PraxisArchitectureTests`

当前最有价值的调用路径，已经在 [PraxisRuntimeKitTests.swift](/Users/shiyu/Documents/Project/Praxis/Tests/PraxisRuntimeKitTests/PraxisRuntimeKitTests.swift) 里被验证：

- `PraxisRuntimeClient.makeDefault(...)`
- `runs.run(...)` / `runs.resumeRun(...)`
- `cmp.project(...).approvals.*`
- `tap.project(...).overview(...)`
- `mp.project(...).search(...)` / `resolve(...)` / `history(...)`

后续 README、Examples 和 smoke harness 的第一批素材，应优先从这些已验证路径中提炼，而不是另写抽象伪示例。

## 5. 12 周阶段总览

| 阶段 | 时间 | 目标 | 完成出口 |
| --- | --- | --- | --- |
| Phase 0 | 第 1-3 天 | 接管与止血 | 默认入口清楚、baseline 记录完成、issue 重组完成 |
| Phase 1 | 第 1-2 周 | 统一对外入口与上手路径 | README 可上手、examples 可运行、推荐入口清晰、首次预发布可准备 |
| Phase 2 | 第 2-4 周 | 把 RuntimeKit 做顺而不是做厚 | API 摩擦下降、support matrix 初稿出现、smoke harness 有骨架 |
| Phase 3 | 第 4-7 周 | 按依赖顺序补 TAP 基线能力 | thin capabilities 可用、search 链接通、reviewer 上下文不再只是 placeholder |
| Phase 4 | 第 7-9 周 | 打通 durable runtime 主链 | checkpoint 自动写入、TMA 主链贯通、独立 smoke/e2e 路径建立 |
| Phase 5 | 第 9-10 周 | 在守卫到位后补高风险执行能力 | shell/code 有 bounded 路径、MCP/Skill 进入稳定化 |
| Phase 6 | 第 10-12 周 | 做 export 与商业化准备 | FFI 版本策略、demo host、release/migration/support 材料齐备 |

## 6. 分阶段执行流程

## Phase 0：第 1-3 天，接管与止血

### 目标

先让仓库说真话，再继续加能力。

### 执行顺序

1. 确认分支事实。
   - 决定 `swift-refactor` 是成为默认分支，还是快进合回 `main`。
   - 停止接受“默认分支首页仍指向过时产品定位”的状态。
2. 修正仓库入口。
   - 归档旧 README 内容。
   - 重写根 README，让仓库首页直接呈现当前 Swift runtime/framework 方向。
3. 确认计划入口。
   - 不另起 roadmap 文档家族。
   - 统一以本文作为执行入口，不再等待旧计划恢复。
   - 后续新增计划约束，直接回写本文或沉淀到 `memory/`。
4. 产出构建/测试 baseline。
   - 运行 `swift test`。
   - 记录失败测试、慢测试、本地目录或数据库前提、SQLite/系统依赖前提、平台差异。
5. 产出接手基线说明。
   - 模块清单
   - 公开 API 推荐入口
   - 测试清单
   - issue 到 milestone 的对应关系
6. 重组 issue 管理。
   - 建立 milestone：
     - `M1 Repo Entry & DX`
     - `M2 TAP Baseline`
     - `M3 Durable Runtime`
     - `M4 Export & Commercial Readiness`
   - 建立 labels：
     - `area/runtimekit`
     - `area/tap`
     - `area/ffi`
     - `area/docs`
     - `risk/high-side-effect`
     - `kind/e2e`

### 必须交付的工件

- 已对齐的仓库首页入口
- 一份 baseline 报告
- 一套 milestone/label 结构
- 一个明确的推荐结论：外部接入默认从 `PraxisRuntimeKit` 开始

### 阶段完成标准

新同事进入仓库后，15 分钟内应该能知道：

- 这个项目现在是什么
- 应该从哪个 product 开始
- 哪些模块偏 internal-oriented
- 哪些 issue 属于哪个里程碑

## Phase 1：第 1-2 周，统一对外入口与开发者上手路径

### 目标

把仓库从“内部人看得懂”推进到“外部人能开始用”。

### 执行顺序

1. 重写根 README，按 SDK 首页组织。
   - 结构建议：
     - 它是什么
     - 5 分钟 Quick Start
     - 推荐入口
     - 可复制示例
     - 高级模块说明
     - 架构边界约束
2. 直接从已验证测试提炼 examples，而不是另外发明伪代码。
   - Example A：`runs.run(...)` / `resumeRun(...)`
   - Example B：CMP session + approval 流
   - Example C：MP search + resolve + history 流
3. 缩窄推荐公开面。
   - 文档里只把 `PraxisRuntimeKit` 作为第一推荐入口。
   - `PraxisFoundation`、各 domain library、`PraxisHostRuntime`、`PraxisArchitectureTests` 都标成 advanced/internal-oriented。
4. 建立 Quick Start 验收标准。
   - 一个全新开发者从 README 复制示例到跑通第一次调用，不超过 10 分钟。
5. 准备第一个预发布版本。
   - 最低目标：`v0.1.0-alpha` 或 `v0.1.0-preview`
   - 同步补最小 changelog 与 migration 说明

### 必须交付的工件

- 新 README
- 可运行的 examples 或等价示例源
- 版本化发布说明初稿
- 明确的 “recommended vs advanced” 包级说明

### 阶段完成标准

- 新接入者不需要先读内部 runtime 层才能开始。
- 第一条跑通的路径必须基于 `PraxisRuntimeKit`，而不是内部 facade 或 FFI。

## Phase 2：第 2-4 周，RuntimeKit 体验打磨

### 目标

让 RuntimeKit 更顺手，但不让它变厚。

### 执行顺序

1. 审视 `PraxisRuntimeKit` 的公开 API 摩擦点。
   - 命名是否统一
   - 输入模型是否重复
   - 默认值是否缺失
   - typed ref / ID 是否足够轻
   - 错误信息是否带修复建议
   - 日志/事件订阅是否可用
2. 控制 RuntimeKit 变更范围。
   - 保持 thin shell 属性。
   - 不暴露 composition root、transport、FFI 细节。
3. 如果确实需要更主观的便捷层，单独设计位于 RuntimeKit 之上的 wrapper。
4. 提前补 support matrix 与 error matrix。
   - 哪些 capability 在哪些 provider/layer 可用
   - 不支持时的返回约定
   - 错误映射与 remediation 建议
5. 提前搭 smoke harness 骨架。
   - 一个可执行入口
   - 一个可扩展结构
   - 与单元测试清晰分离

### 必须交付的工件

- RuntimeKit API 清理清单与对应修复
- support matrix 初稿
- error matrix 初稿
- smoke harness 骨架

### 阶段完成标准

- RuntimeKit 更容易调用，但没有退化成低层细节大杂烩。
- 后续新增 capability 挂入 smoke 的边际成本显著降低。

## Phase 3：第 4-7 周，按依赖顺序补 TAP 能力面

### 目标

不按 issue 编号推进，而按依赖链推进。

### 建议交付顺序

1. 先做 thin capability baseline。
   - `generate.create`
   - `generate.stream`
   - `embed.create`
   - `tool.call`
   - `file.upload`
   - `batch.submit`
   - `session.open`
2. 再补 search 链。
   - `search.web`
   - `search.fetch`
   - `search.ground`
3. 再补 reviewer 上下文与第一批真实基础工具。
   - 更像真实项目态的 reviewer context
   - 第一批 production-useful reviewer tools
4. 高副作用能力最后进入。

### 每条 capability 的交付规则

任何一条 capability，必须四件套同时成立才算完成：

1. capability package 或 registry entry
2. support matrix 更新
3. 至少一条 smoke 路径
4. README / Example 增量

### 必须交付的工件

- 可用的 thin-capability baseline
- 能跑通 registry/evidence 流的 search 链
- 不再只是 placeholder 的 reviewer 上下文

### 阶段完成标准

- capability 工作是“可接入 SDK 等级”，不是“内部脚手架等级”。
- search 与 thin capabilities 不依赖高风险执行面也能体现价值。

## Phase 4：第 7-9 周，打通 durable runtime 主链

### 目标

先把恢复链和重放链做扎实，再扩执行风险。

### 执行顺序

1. 把 durable checkpoint 自动写入接到主状态变化上。
   - human gate 相关状态变化
   - replay 关键状态变化
   - activation 状态变化
2. 把 TMA planner 与 executor 接成一条 provisioner runtime 主链。
   - planner
   - executor
   - bundle assembly
3. 把 smoke/e2e 提升到与功能同等级。
   - 覆盖 capability 缺失
   - provisioning
   - activation
   - human gate / recovery
   - dispatch

### 必须交付的工件

- durable checkpoint 自动写入
- TMA planner -> executor -> bundle assembly 主链
- 独立 smoke/e2e 入口

### 阶段完成标准

- recovery 依赖真实持久化状态，而不是赌内存连续性。
- provisioner runtime 是正式流水线，而不是 helper collection。

## Phase 5：第 9-10 周，高风险执行能力补齐

### 目标

在 guardrails 就位之后，再增加执行能力。

### 建议交付顺序

1. `shell.run`
2. `shell.approve`
3. `code.run`
4. `code.patch`
5. `code.sandbox`
6. MCP / Skill
7. `computer.use` / observe / act 最后

### 进入交付前必须满足的守卫条件

- 已有 approval path
- 已有 evidence path
- 已有 replay/recovery path
- 已有 bounded smoke path
- 已有 side-effect 风险标记

### 必须交付的工件

- 至少一条 bounded shell 路径
- 至少一条 bounded code 路径
- 不再依赖脆弱 runtime 假设的 MCP/Skill 基线

### 阶段完成标准

- 高副作用能力不只是“能调”，而是“可控、可审计、可恢复”。

## Phase 6：第 10-12 周，Export 与商业化准备

### 目标

把 runtime 做成别人敢接、敢升级的东西。

### 执行顺序

1. 正式产品化 `PraxisFFI`。
   - 保持其“最小 encoded runtime bridge”定位
   - 不允许 UI 或 terminal 语义倒灌进 FFI
2. 加版本策略。
   - request schema version
   - response schema version
   - event schema version
   - 兼容性规则
   - breaking change checklist
3. 提供至少一个原生 embedding demo。
   - Apple-native host 优先
   - 不再绕回去做一个新的壳产品
4. 准备最小商业化闭环。
   - release 流程
   - changelog
   - migration notes
   - support matrix
   - performance/resource baseline
   - 高风险能力安全说明
   - embedding demo

### 必须交付的工件

- 有版本策略的 FFI contract
- 一个 demo host
- 一套 release / migration 纪律
- 高风险 capability 的安全说明

### 阶段完成标准

- Praxis 不再只是内部工程资产。
- 外部接入方能评估兼容性、升级风险和能力边界。

## 7. 每周推进节奏

每周建议固定跑同一个控制回路：

1. 周一：确认 milestone 优先级和依赖关系。
2. 周二到周三：实现一个窄 vertical slice。
3. 周四：为同一条 slice 补 smoke、文档、support matrix。
4. 周五：执行验证、写里程碑记录、移动 issue 状态。

如果一周内同时存在两条以上战略主线在并行推进，应主动减 scope。

## 8. 单个 Issue 的标准开发流

每个 issue 都按同一条流水线推进：

1. 分类
   - 属于哪个 milestone
   - 打哪些 area label
   - 是否带 `risk/high-side-effect`
2. 查依赖
   - 是否被入口对齐、durable runtime、reviewer 上下文、support matrix 缺口阻塞
3. 在正确层落设计
   - domain model
   - host contract
   - runtime use case / facade
   - RuntimeKit surface
   - docs / examples / smoke
4. 实现最薄但完整的一刀
   - 非必要不做大范围顺手重构
5. 验证
   - 相关 `swift test`
   - 如适用则跑 smoke
   - 边界变化时同步更新 architecture guard tests
6. 发布证据
   - README / Example / support matrix / baseline note 同步更新
7. 满足用户面和维护者面双重材料后再关闭

## 9. 标准工件清单

任何非 trivial 的 runtime 里程碑，都应该尽量同时留下：

- 代码修改
- 对应单元测试
- 如有边界变化则更新架构守卫测试
- smoke 覆盖或 smoke harness 注册
- README / Example 变更
- support matrix 或 error matrix 更新
- 如结论可复用，则写回 `memory/`

## 10. 验证顺序

除纯文档任务外，验证顺序建议固定为：

1. 定向 `swift test`
2. 共享 runtime 路径变更后补全量 `swift test`
3. smoke harness 验证跨模块行为
4. durable/runtime 关键里程碑补 e2e
5. 最后回读 `git status`

建议持续显式记录的 baseline 观察项：

- 哪些测试需要临时目录
- SQLite linkage 是否稳定
- 平台声明是否和实际构建/测试现实一致
- 哪些测试已经慢到应该从单测体系拆到 smoke/e2e

## 11. Issue 与 Milestone 重组模板

建议始终按下面四组组织 open issues：

- `M1 Repo Entry & DX`
  - README 真相化
  - 默认分支对齐
  - examples
  - onboarding 验收
- `M2 TAP Baseline`
  - thin capabilities
  - search 链
  - reviewer context
  - support matrix
- `M3 Durable Runtime`
  - checkpoint 自动写入
  - TMA planner/executor 主链
  - smoke/e2e runtime 闭环
- `M4 Export & Commercial Readiness`
  - FFI versioning
  - wrapper 方向
  - embedding demo
  - release/changelog/migration policy

## 12. 明天就可以开始做的 10 个动作

1. 对齐默认分支与当前 Swift 主线。
2. 替换仓库首页的过时入口。
3. 统一仓库根目录入口，明确本文是唯一执行手册。
4. 跑并记录一次完整 `swift test` baseline。
5. 以四个主执行轨重组 milestones 与 labels。
6. 从 `PraxisRuntimeKitTests` 提炼三条 examples。
7. 准备第一个预发布版本。
8. 先做 TAP 的 thin-capability baseline，不要一上来就做 `computer.use`。
9. 在高风险执行能力前，先把 durable checkpoint、TMA 主链、smoke/e2e 排进前序依赖。
10. 调用者体验优化优先落在 `PraxisRuntimeKit`，不要通过暴露 composition/FFI 细节来“省事”。

## 13. 维护说明

- 如果后续出现新的计划文档，必须由本文演进而来，而不是并行生长出第二套路线图。
- 如果仓库长期约束或阶段结论稳定下来，应把可复用部分总结回写到 `memory/`。
- 如果仓库现实发生变化，应先更新 baseline 事实，再调整执行流程，不要为了叙事完整保留过时描述。
