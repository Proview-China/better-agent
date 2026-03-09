# GPT Rust 迁移状态（2026-03-08）

## 结论

本轮迁移**未完成**，但已经完成第一阶段：

- 已在 `better-agent/core/rust/` 建立 GPT-first Rust infra 骨架
- 已将 GPT/OpenAI 请求构造核心迁移到 Rust
- 已保留 `C++` 作为对外中间件/外观层
- 已证明项目内构建 + 单测 + `gmn` 上游联调可工作

## 已完成范围

### 1. Rust infra 骨架

- 新增 Rust crate：`better-agent/core/rust/`
- 已接入 `CMake` 构建
- 产物通过静态库方式链接进 `agent_core`

### 2. GPT-first Rust 模块

当前已拆分的 Rust 子模块：

- `gpt_runtime/config.rs`
- `gpt_runtime/function_tools.rs`
- `gpt_runtime/custom_tools.rs`
- `gpt_runtime/shell.rs`
- `gpt_runtime/web_search.rs`
- `gpt_runtime/request.rs`
- `gpt_runtime/openai_execution.rs`
- `gpt_runtime/code_tools.rs`
- `gpt_runtime/computer_tools.rs`
- `gpt_runtime/mcp_tools.rs`

### 3. C++ 外观层保留

保留并继续作为稳定对外接口：

- `better-agent/core/header/agent_core.h`
- `better-agent/core/cpp/agent_core.cpp`

当前策略：

- Rust 负责 GPT infra 内核，尤其面向 Codex 系列模型
- C++ 只负责桥接、封装、统一 JSON/C ABI 暴露
- Claude 路线后续单独规划，不纳入本阶段 Rust 内核边界

### 4. 已验证能力

通过项目内测试与 `gmn` 上游联调验证的 GPT 能力：

- `Function Calling / Custom Tools`
- `Web Search`
- `Shell`

通过项目内构造测试验证，已纳入 Rust runtime 工具定义 / payload / capability description 的能力：

- `Code Execution`（当前以 `js_repl` / `artifacts` 工具形态进入 Rust）
- `Computer Use`（当前以 `view_image` 工具形态进入 Rust）
- `MCP`（当前以 `list/read mcp resource` 工具形态进入 Rust）
- `Hooks`（当前以 `after_tool_use` payload / 运行时能力描述形态进入 Rust）
- `Skills`（当前以 skills section 渲染 / 运行时能力描述形态进入 Rust）

### 5. 上层可调用状态

当前新增的上层可调用接口：

- `agent_core_build_gpt_responses_request`
- `agent_core_build_gpt_toolset`
- `agent_core_build_gpt_basic_abilities`
- `agent_core_build_after_tool_use_hook_payload`
- `agent_core_render_skills_section`
- `agent_core_rust_runtime_version`

Rust 已接管的 GPT/Codex 路线相关内容新增包括：

- OpenAI execution context → request payload 构造
- OpenAI `function_call_output` payload 构造
- 与 GPT/Codex 路线直接相关的 payload / wrapper 构造
- 原 `core_provider.cpp` 中旧 helper/payload 实现已删除
- `tool registration` 解析已切换为 Rust-first，旧 `core_registry.cpp` 解析逻辑已开始退场
- `function/custom/tool_use` payload 归一化已切换为 Rust-first
- 参数 schema 校验与 allow/deny 策略校验已切换为 Rust-first
- `build_tool_execution_request` 与 `build_execution_record` 已切换为 Rust-first
- mock result 解析与 mock tool 执行结果构造已切换为 Rust-first
- `core_models.cpp` 中旧的 GPT 路线 `tool kind/schema/policy` 辅助函数已清理
- `PolicyView` 构造已切换为 Rust-first
- executor target 解析与 builtin/native executor 错误结果构造已切换为 Rust-first
- `agent_core_normalize_runtime_event` 已切换为 Rust-first
- 旧 `core_runtime.cpp` 已删除
- `model_output_json` 解析已切换为 Rust-first
- 旧的 GPT/Codex runtime status/tool-kind 辅助函数已从 `core_models.cpp` 清理
- `prepare_function_call_request` 已切换为 Rust-first
- `local_shell` 已进入 GPT Rust toolset / preset 主路径，基础能力预设不再默认使用 `shell_command`
- `shell` schema 已补齐 `sandbox_permissions` / `additional_permissions` / `prefix_rule` / `justification` 等关键参数形态
- `local_shell_call` / `custom_tool_call` 的 payload normalization 与 runtime normalization 已切到 Rust-first
- OpenAI `custom_tool_call_output` payload 已进入 Rust-first，`function_call_output` 也已修正为符合字符串 / content items 数组语义

Node binding 已同步暴露：

- `buildGptResponsesRequest`
- `buildGptToolset`
- `buildGptBasicAbilities`
- `buildAfterToolUseHookPayload`
- `renderSkillsSection`
- `rustRuntimeVersion`

本轮额外清理结论：

- 旧 C++ hook lifecycle 执行链已删除
- 旧 C++ idempotency replay/conflict 主链已删除
- Rust 侧对应的 idempotency module / FFI 已删除
- 旧的 `agent_core_execute_*`、execution record 读取/中断、provider wrapper 公开执行接口已从当前公开 surface 退场
- Node addon 也已同步移除对应公开方法
- 当前保留的公开接口聚焦于八相能力定义/构造与最小 facade，不再继续把项目往“替上层写 agent 主链”方向推
- `core_execution.cpp` 已从当前主构建链退场，历史执行编排实现已整体丢入 git 历史

### 6. `gmn` 上游八项能力分层验证（2026-03-08）

使用目标：

- 上游：`https://gmn.chuangzuoli.com`
- 模型：`gpt-5.4`

结论（注意这里是“分层验证”，不是“八项都已完成 Rust 执行 primitive”）：

- `Function Calling / Custom Tools`：通过
- `Web Search`：通过
- `Code Execution`：定义层 / 调用层验证通过（当前以 `js_repl` 自定义工具调用形态验证）
- `Computer Use`：定义层 / 调用层验证通过（当前以 `view_image` 函数工具调用形态验证）
- `Shell`：通过（当前以 `shell_command` 函数工具调用形态验证）
- `MCP`：定义层 / 调用层验证通过（当前以 `list_mcp_resources` 函数工具调用形态验证）
- `Hooks`：本地 payload / capability 层验证通过（`after_tool_use` payload 构造已验证）
- `Skills`：本地渲染 / capability 层验证通过（skills section 渲染已验证）

说明：

- 对于 `Code Execution / Computer Use / MCP / Hooks / Skills`，本轮验证遵循 Codex `0.111` 的运行时分层思路：
  - 能走上游调用的部分，验证模型是否能正确发起对应工具调用
  - 不应由上游承担的部分，验证本地运行时结构化输出是否稳定可用
  - 这些结果只能证明“相关 Rust infra 已经进入定义层 / 构造层 / payload 层 / capability 层”，不能据此断言“完整执行 primitive 已全部迁完”

对应联调目标模型：

- `gpt-5.4`

## 仍未完成范围

以下内容尚未完成迁移或清理：

- 旧 C++ 重叠实现尚未完全删除
- `Code Execution` 尚未迁入完整 Rust 执行 primitive 层（当前主要是 `js_repl` / `artifacts` 工具定义）
- `Computer Use` 尚未迁入完整 Rust 执行 primitive 层（当前主要是 `view_image` 工具定义）
- `Hooks / Skills / MCP` 尚未从 payload / description / tool-definition 层推进到完整 Rust 执行 primitive 层
- `Shell(local_shell)` 虽已完成工具定义、参数结构、payload normalization、runtime normalization 与统一结果结构，但仍未迁入真正的 Rust 执行 runtime
- 旧 C++ 内部残留（如 `ExecutionRecord` / `g_executions` / 部分 `core_rust_bridge` 执行时代 helper）尚未完全清走
- `Unified Runtime Contract` 仍未完成按 Rust 内核重组

## 当前工程原则

后续迁移遵循以下原则：

1. GPT 系列、尤其 Codex 系列模型的 infra 内核以 Rust 为唯一真相来源
2. C++ 保留为官方中间件/外观层，不直接承担 GPT 内核主实现
3. 旧 C++ 重叠实现逐步丢入 git 历史，不长期双轨维护
4. 迁移过程中必须持续做项目内测试与上游联调

## 下一步建议

优先继续处理：

1. 将 `Code Execution` 迁入 Rust 运行时
2. 将 `Computer Use` 按 Codex 风格运行时能力迁入 Rust
3. 将 `Hooks / Skills / MCP` 从定义层继续推进到 Rust 执行 primitive 层
4. 继续同步更新 `docs/ability/01-basic-implementation.md`
