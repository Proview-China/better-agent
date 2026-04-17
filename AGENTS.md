# Praxis Reboot Agent Guide

## Scope

- 当前仓库仍处于 Swift 接管与收束阶段，但已经不是 blank-slate；默认不要把旧 `dev` 分支的实现整包搬回来。
- 与用户或代码现状冲突时，以当前事实为准；长期有效的结论再同步进 `memory/`。

## Communication

- 默认使用简体中文。
- 专业术语尽量配白话解释。
- 如果问题开始变得含混或风险不清楚，要先停下来对齐，不要硬编答案。

## Working Defaults

- 旧 TypeScript / Node.js 实现已经从仓库移除；当前活代码主语言和主工具链是 Swift + SwiftPM。
- 当前仓库里没有 `TAKEOVER_EXECUTION_WORKFLOW.md`；在它补回前，`AUDIT_REMEDIATION_EXECUTION_GOALS.md` 视为接下来工作的计划文档，`README.md` 作为仓库级入口说明，`Package.swift` 作为 target / product 事实源，`docs/PraxisSupportMatrix.md` 和 `docs/PraxisClosureAudit.md` 作为当前公开面与阶段边界参考。
- 如果任务涉及 Swift 重构范围、target 职责、执行顺序或阶段边界，优先先回读 `AUDIT_REMEDIATION_EXECUTION_GOALS.md`、`README.md`、`Package.swift`、`docs/PraxisSupportMatrix.md`；需要补充导出面审计或对外交付语义时，再按需补读 `docs/PraxisClosureAudit.md`。
- `docs/` 可能会被另一个 Codex 实例持续更新；不要回滚或覆盖与你当前任务无关的文档改动。
- `memory/` 是项目级记忆层；如果目录当前不存在，不要假设它已经建立，也不要只依赖这个 `AGENTS.md`。做完重要架构决策、约束调整或阶段性结论后，先和用户对齐，再决定是否补建或写回对应记忆文件。
- 保持仓库干净、最小化，除非用户明确要求，否则不要提前铺大型目录树或旧时代兼容层。
- 如果看到 `src/**`、`package.json`、`npm` 之类旧 TS 线索，默认把它们视为历史引用或归档语义，不要重新恢复这些实现。
- 当前实现入口优先读 `Tests/PraxisRuntimeKitTests/`、`Examples/PraxisRuntimeKitSmoke/` 与相关 example；不要先从旧 roadmap 假想仓库状态。

## Platform Direction

- macOS 不默认走 Electron，Apple 端优先保留原生应用方向。
- Windows 和 Linux 后续可以考虑 Electron，但在明确需求前不要提前搭 UI 壳子。
- 在 macOS 本地 baseline host adapters 完备前，Linux 相关宿主实现统一保持 compile-safe placeholder，不作为当前阶段并行交付目标。

## Swift Conventions

- 写 Swift 代码前，先确认当前改动属于哪个 target、是否越过现有公开面和 support matrix；当仓库里缺失某份“总计划”文档时，不要假设还有一份未见的执行准绳。
- `Core` 只是逻辑层概念，不是兜底模块名；不要新建“大 Core” 文件或 target 来收容暂时不知道放哪的代码。
- 已拆开的 target 不要回并成粗模块；如果一个文件同时出现纯规则和宿主副作用实现，默认继续拆，而不是接受混合状态。

### Swift 类型选择

- 纯领域真相、DTO、展示模型优先使用 `struct`。
- 有限状态集合、模式、错误种类优先使用 `enum`。
- 共享流程编排、需要持有依赖的服务优先使用 `final class`。
- 有并发可变状态的协调器、注册表、runtime state holder 优先使用 `actor`。
- 外部能力、仓储、执行器、宿主接缝优先使用 `protocol`。
- 不要为了“面向对象”而引入抽象基类树；业务层默认坚持 `protocol + composition`。

### Swift 分层约束

- `PraxisCore` 只放纯领域模型、状态机、规则、planner、编排协议。
- `PraxisHostContracts` 只定义宿主协议，不承载业务规则。
- `PraxisHostRuntime` 只负责装配、use case、facade 与导出边界，不重新吞回 Core 规则。
- 新增能力默认优先落到 framework / exported host surface，不要再把 CLI、GUI、TUI 当长期主入口。
- Core 禁止直接依赖 provider SDK、`Process`、Git CLI、数据库客户端、Redis/MQ 客户端、SwiftUI/AppKit/UIKit、终端 I/O。
- Git / DB / MQ / provider 相关能力必须拆成 “Core model/planner + Host executor/adapter” 两层。

### Swift 编码规则

- 默认使用 initializer injection；不要在 use case、facade、bridge、view model 里直接 new 具体 adapter。
- 只有 `PraxisRuntimeComposition` 可以知道具体 adapter 实现类；不要把 composition root 散落到别处。
- 命名优先表达领域语义，不按 SDK、数据库、第三方产品名命名核心接口。
- 新增模型时，先明确它属于哪个 target 的职责边界，再落代码；不要先写实现再找归属。
- 公共输入输出优先使用 Core 语义模型，不要把 provider 原始 payload、SQL 行结构、CLI 文本碎片直接泄漏到高层。
- 注释保持少而准，只解释边界、规则或不直观约束，不写显然注释。
- Placeholder 可以存在，但必须明确是 placeholder，并且不要伪装成已经承接真实行为。

### Swift 文档注释规则

- 对外可调用的 `public` 函数、重要协议方法、关键 service/type 默认补 `///` 文档注释。
- 函数文档注释统一使用下面格式：
  ```swift
  /// Explains what the function does.
  ///
  /// - Parameters:
  ///   - parameterName1: Explains what this parameter represents.
  ///   - parameterName2: Explains what this parameter represents.
  /// - Returns: Explains what the return value represents.
  /// - Throws: Explains which errors may be thrown. Omit when the function does not throw.
  /// ```
- 如果函数没有参数，可以省略 `Parameters`；如果没有返回值，可以写 `Returns: None.` 或省略 `Returns`，但同一文件内风格要一致。
- 类型文档注释至少说明“这个类型负责什么 / 不负责什么”；不要只写泛泛描述。
- 代码里的注释和文档注释统一使用英文；即使协作沟通默认是中文，也不要写中文注释，避免中英混杂。
- 文档注释描述的是稳定职责，不要把“临时接通了”“占位用”这类开发态口语直接写进长期 API 注释里。

### Swift 宿主与平台约束

- 当前 Swift 主路径先面向 macOS 本地运行。
- 默认结构化持久化底座是 `SQLite`，默认消息传播底座是进程内 `actor` / `AsyncStream`，默认本地向量计算底座是 `Accelerate`。
- `PostgreSQL`、`Redis`、`LanceDB` 不作为 macOS 单机 App 的运行前置。
- 系统 `git` 可以作为按需依赖，但不能让 App 启动强依赖 git 已经就绪。
- 不要把旧 TS 的 `cmp-db`、`cmp-mq`、`rax` 实现形态原样投射到 Swift 目录结构里。

### Swift 测试与验收

- 新增或修改 Swift target 时，至少补对应 target 的单元测试或架构守卫测试，不要只改实现不补验证。
- 架构守卫测试必须和 target 拆分同步更新，防止边界漂移。
- 如果改动涉及纯规则迁移，优先建立与 TS 的对照样本，例如 goal compile、run transition、TAP governance、CMP routing。
- 涉及 Swift 脚手架或实现变更后，至少回读一次 `git status`，并优先执行相关 `swift test`；如果改动触达 exported surface、host runtime 或 capability smoke 链，补跑对应的 `swift run PraxisRuntimeKitSmoke --suite <relevant-suite>`。
- 如果当前改动只影响文档或入口说明，可以不强跑全量验证，但要在结果里说明没有跑哪些检查。

## Verification

- 新增脚手架后，至少回读一次 `git status` 和相关构建/类型检查结果。
- 提交保持单一意图，便于回滚和 review。
