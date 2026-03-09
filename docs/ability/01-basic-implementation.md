# Basic Implementation

## Basic Tool Module

本模块定义两层能力：
- 核心执行层（跨供应商共性最强）：
- Function Calling / Custom Tools
- Web Search
- Code Execution
- Computer Use
- 扩展执行层（工程上高频，但平台实现差异更大）：
- Shell
- Hooks(应被废弃)
- Skills
- MCP

### 1) Scope Boundary

- 本模块先定义“统一执行语义”，再由供应商适配层落地到具体 API。
- 不强制要求模型输出固定 JSON 形态；允许自然语言 + 结构化混合输出。
- 统一层只保证“可调度、可审计、可回放”，不限制上层编排策略。

### 2) Unified Runtime Contract

`Unified Runtime Contract` 不是“让模型背固定输出模板”，而是“由运行时做归一化”。

实现上分两步：
- 第一步：接收模型原始输出（函数调用、工具调用、普通文本、混合内容均可）。
- 第二步：由 `runtime normalizer` 转为内部统一记录。

建议内部统一记录（可增减字段，不强行一刀切）：
- `execution_id`：一次工具执行的唯一 ID
- `tool_kind`：工具类别（function/web/code/computer/shell/hooks/skills/mcp）
- `intent`：任务意图（原始文本或结构化摘要）
- `input_raw`：模型原始调用内容（保留可追溯）
- `input_normalized`：归一化后参数（供执行器消费）
- `policy_snapshot`：执行时权限快照（目录、网络、命令、超时、资源）
- `status`：`queued | running | success | partial | failed | blocked | timeout`
- `evidence`：可验证证据（日志、网页引用、截图、产物路径、事件流）
- `error`：错误码 + 原始错误 + 归一化错误
- `handoff`：给上层编排器的下一步建议（重试、换工具、人工接管）
*注意,这里的io_format,应当是可以继承和多态的.*

关键点：
- 模型“会不会稳定按格式输出”不是前提，运行时必须兜底解析。
- 解析失败要可恢复：回退到二次澄清或安全失败，而不是 silent failure。

### 3) Tool Semantics

`当前实现状态（2026-03-08）`
- GPT-first 迁移已开始：`Function Calling / Custom Tools`、`Web Search`、`Shell` 的请求构造核心已迁入 Rust，并通过项目内测试与 GPT 上游联调验证。
- `Shell` 当前默认优先走 Codex 风格的 `local_shell` 能力；`shell` / `shell_command` / `exec_command` 作为兼容与扩展形态继续保留。
- `Code Execution`、`Computer Use`、`MCP` 的工具定义与标准工具集构造已进入 Rust；当前继续从“定义层”推进到“可稳定调用层”。
- `Hooks`、`Skills` 的运行时能力描述已进入 Rust 标准工具集；当前继续从“能力描述层”推进到“可稳定调用层”。
- 已新增 GPT 基础能力预设构造，可由上层直接获取包含 4+4 能力的基础工具集合与运行时能力说明。
- 已新增 `after_tool_use` hook payload 构造与 skills section 渲染输出，供上层中间件直接消费。
- OpenAI function call output payload 的构造也已下沉到 Rust，GPT 路径进一步脱离旧 C++ 主实现。
- 与 GPT/Codex 路线直接相关的 payload / wrapper 构造已继续下沉到 Rust，C++ 进一步收缩为外观层与桥接层；Claude 后续单独规划，不作为本阶段 Rust 内核目标。
- `core_provider.cpp` 中旧的 provider payload/helper 实现已退场，相关逻辑转由 Rust + bridge 承接。
- `tool registration` 解析也已切到 Rust，`core_registry.cpp` 中最重的 GPT 路径解析逻辑开始退场。
- `function/custom/tool_use` payload 归一化也已切到 Rust-first，C++ 侧继续退化为外观层和数据映射层。
- `local_shell_call`、`custom_tool_call` 的基础 payload normalization / runtime normalization 现已进入 Rust，供上层执行器与调度层后续继续承接。
- 参数 schema 校验与 allow/deny 策略校验也已切到 Rust-first，`core_registry.cpp` 的 GPT 校验路径继续收缩。
- `build_tool_execution_request` 与 `build_execution_record` 也已切到 Rust-first，旧 C++ 请求/记录组装路径已退场。
- mock result 解析与 mock tool 执行结果构造也已切到 Rust-first，旧 C++ 简单执行路径已退场。
- 旧的 `tool kind/schema/policy` 辅助函数已从 `core_models.cpp` 清理，GPT 路线对应能力改由 Rust-first 实现承接。
- `PolicyView` 构造也已切到 Rust-first，`core_models.cpp` 进一步收缩为序列化/反序列化与基础错误模型层。
- executor target 解析与 builtin/native executor 错误结果构造也已切到 Rust-first，旧 C++ 执行链外围逻辑已退场。
- `runtime normalization` 主路径已切到 Rust-first，`agent_core_normalize_runtime_event` 现在优先使用 Rust 产物。
- 旧 `core_runtime.cpp` 已退场，runtime normalization 的 C++ 实现不再作为主路径保留。
- `model_output_json` 解析也已切到 Rust-first，`core_models.cpp` 的 GPT 路线解析职责进一步收缩。
- 旧的 GPT/Codex runtime status/tool-kind 辅助函数已从 `core_models.cpp` 清理，相关语义由 Rust-first runtime normalization 承接。
- `prepare_function_call_request` 已切到 Rust-first，相关旧桥接辅助也已清理。
- OpenAI `function_call_output` / `custom_tool_call_output` 的输出 payload 现在也由 Rust 统一构造，并统一遵循“字符串或 content items 数组”的 wire 语义。
- 本阶段仍保留 C++ 作为统一中间件/外观层，Rust 负责 GPT 系列、尤其 Codex 系列模型的 infra 内核；Claude 路线后续单列。
- 为避免继续越界到“替上层写 agent”，旧 C++ hook lifecycle 与 idempotency replay 主链已从当前 GPT 执行主路径退场。
- 为避免继续越界到“替上层写 agent”，旧的 `agent_core_execute_*`、execution record 读取/中断、provider wrapper 公开执行接口已从当前公开 surface 退场。
- 当前公开保留重点是：八相能力工具定义、请求构造、runtime normalization、hook payload、skills 渲染，以及必要的 C ABI / Node facade。
- `core_execution.cpp` 已从当前主构建链退场，仓库主线不再保留那套项目内执行编排实现。

`Function Calling / Custom Tools`
- 输入：工具清单（名称、描述、参数 schema、调用约束）。
- 执行：模型给出调用意图；运行时做参数校验、权限校验后执行。
- 输出：返回工具结果 + 执行证据；失败时返回可诊断错误而非模糊文本。
- 设计重点：模型只“决策与组参”，执行权必须在 infra。

`Web Search`
- 输入：查询意图、时间范围、来源约束（可配置白名单域名）。
- 执行：检索结果先进入基础治理（去重、时效检查、来源分级、噪声过滤）。
- 输出：返回“可引用证据集”而不是只返回摘要文本。
- 设计重点：搜索是“取证流程”，不是“让模型自由浏览后口述”。

`Code Execution`
- 输入：代码片段/脚本、运行时参数、依赖说明、资源限制。
- 执行：在沙箱或隔离环境运行；严格限制目录、网络、时长、CPU/内存。
- 输出：至少包含 `stdout/stderr/exit_code/artifacts`。
- 设计重点：可复现与可回放优先，禁止默认高权限裸机执行。

`Computer Use`
- 输入：目标界面、任务目标、动作边界（可点击区域/禁用操作）。
- 执行：按“观察 -> 动作 -> 再观察”循环推进，逐步确认状态收敛。
- 输出：动作序列、关键截图、失败点位、最终状态。
- 设计重点：它是 API 缺失时的兜底层，不应替代可无头执行的路径。

`Shell`(bash,zsh,powershell,只做这三种,另外者应当自适应)
- 输入：命令请求与工作目录。
- 执行：命令策略校验（白名单/黑名单/路径限制）后执行。
- 输出：命令、退出码、stdout/stderr、关键副作用变更。
- 设计重点：模型可“提命令”，但执行审批权在 infra。

`Hooks`(应当被skill代替,成为client实质上的一种提示词注入)
- 输入：事件类型（如 before/after tool call）与触发条件。
- 执行：在运行时事件点执行预定义脚本或命令。
- 输出：hook 执行日志、状态和对主流程的影响（继续/中断/降级）。
- 设计重点：hooks 属于运行时治理机制，不是模型核心能力本身。

`Skills`
- 输入：版本化技能包（能力说明、模板、约束、依赖元数据）。
- 执行：运行时按任务意图装载对应 skill，并注入到工具调用上下文。
- 输出：skill 选择记录、命中率、执行收益（时延/成功率变化）。
- 设计重点：skills 是“能力复用与分发单元”，不是单次工具调用。

`MCP`
- 输入：远程 MCP server 描述、工具发现配置、鉴权信息。
- 执行：通过 MCP 协议发现并调用外部工具能力。
- 输出：远程工具响应、调用链路证据、失败归因（网络/鉴权/协议）。
- 设计重点：MCP 是工具接入协议层，负责把外部能力接入统一运行时。

### 4) Safety Baseline

- 默认最小权限：无额外系统权限、无隐式网络放行。
- 高风险命令与高风险 UI 动作必须可拦截。
- 所有工具调用必须可审计、可复盘、可中断。

### 5) Acceptance (M0)

- 核心四类（function/web/code/computer）均可被统一协议调度。
- 扩展四类（shell/hooks/skills/mcp）至少完成一条可复现接入路径验证。
- 每类至少有一个可重复通过的最小用例。
- 任一执行失败都能给出可定位的证据与错误码。
- 当前阶段验收聚焦 infra 原语与 facade，不再把“项目内执行编排主链”当作 M0 必选产物。

### 6) Connectors and App Gateways (Boundary Brief)

`Connectors`
- 本节里的 connectors 指“对外部应用 API/抽象层的直接封装”。
- 目标是把第三方应用能力整理为可调用工具组/上下文组，供后续包装机使用。
- 这里不展开具体 connector 设计细节，因为该部分本质属于下一层（包装机架构）的内容。

边界声明：
- 本节不把 `MCP` 当作 connector 架构本体。
- `MCP` 在这里仅视作一种接入协议能力；若将其组织为 connector 体系，应放到下一层展开。

`App Gateways`
- app gateway 的定位是“统一入口 + 批量管理 + 标准 I/O 编排”。
- 它用于把多应用调用统一到同步/异步任务通道，而不是在本节讨论具体调度算法。
- 详细 I/O 语义在 `### 五, I/O抽象化` 章节展开；本节仅做边界定义。

### 7) Memory Module (Primary Focus)

记忆模块是本阶段优先级最高的基础能力。核心不是“堆更多历史”，而是“提升可复用上下文密度”。

`目标`
- 把可复用事实、可复用策略、可复用失败经验沉淀下来。
- 降低重复搜索、重复试错和上下文膨胀。

`最小实现`
- `Memory Ingestor`：接收工具执行与关键对话结论。
- `Memory Normalizer`：把原始信息整理为统一记忆条目（主题、证据、时效、适用范围）。
- `Memory Store`：分层存储（短期工作记忆 / 中期任务记忆 / 长期策略记忆）。
- `Memory Retriever`：按任务意图检索最相关记忆，并控制注入量。
- `Memory Guard`：处理冲突、过期、敏感信息、低置信条目降权。

`写入规则`
- 只写“可复用内容”，不写大段低价值过程噪声。
- 记忆条目必须带证据锚点（日志、命令输出、文件路径、来源链接）。
- 同类条目优先更新，不做无限追加。

`读取规则`
- 先按任务意图过滤，再按时效与置信度排序。
- 注入模型时遵循“小而精”，避免再次挤爆上下文。
- 记忆与实时证据冲突时，以实时证据为准并回写修正。

`M0 验收`
- 记忆写入可追踪：知道何时、由谁、写入了什么。
- 记忆检索可解释：知道为什么命中这条记忆。
- 冲突可处理：旧记忆不会无条件覆盖新证据。
- 注入可控：单次注入量有上限并可配置。

### 8) Main/Sub-Agent Role Boundary (Brief)

本层先给出职责边界，不展开完整多智能体拓扑实现。

`Main Agent`
- 主要职责是精细化任务切分，给子 agent 分配“最舒服”的执行条件：
  - 合适的上下文窗口
  - 合适的工具组
  - 合适的记忆注入
  - 合适的能力边界
- 主 agent 的目标不是“为了省上下文而粗暴分发任务再等待结果”，那会直接限制多智能体上限。
- 主 agent 偏重调研、综合、路径选择与策略收敛。

`Sub-Agent`
- 子 agent 偏重代码与执行（代码能力可驱动广泛任务落地）。
- 子 agent 的核心价值是高强度执行与反馈，而不是全局架构裁决。
- 主子职责有本质差异，不应混写为同一种 agent 角色。

边界说明：
- 本节只定义职责边界与设计意图。
- 具体多智能体结构与分发策略在 `### 四, 拓扑结构组装器` 详细展开。
- 主子 agent 能力与模型映射细节在 `## 模型选择` 详细展开。
- 新的注入/蒸馏方法及其基座意义在 `## 基座作用与意义` 展开。
