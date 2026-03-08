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

- Rust 负责 GPT infra 内核
- C++ 只负责桥接、封装、统一 JSON/C ABI 暴露

### 4. 已验证能力

通过项目内测试与 `gmn` 上游联调验证的 GPT 能力：

- `Function Calling / Custom Tools`
- `Web Search`
- `Shell`

通过项目内构造测试验证，已纳入 Rust runtime 工具定义的能力：

- `Code Execution`（当前以 `js_repl` / `artifacts` 工具形态进入 Rust）
- `Computer Use`（当前以 `view_image` 工具形态进入 Rust）
- `MCP`（当前以 `list/read mcp resource` 工具形态进入 Rust）
- `Hooks`（当前以运行时能力描述形态进入 Rust）
- `Skills`（当前以运行时能力描述形态进入 Rust）

### 5. 上层可调用状态

当前新增的上层可调用接口：

- `agent_core_build_gpt_responses_request`
- `agent_core_build_gpt_toolset`
- `agent_core_build_gpt_basic_abilities`
- `agent_core_build_after_tool_use_hook_payload`
- `agent_core_render_skills_section`
- `agent_core_rust_runtime_version`

Rust 已接管的 GPT/OpenAI provider 相关内容新增包括：

- OpenAI execution context → request payload 构造
- OpenAI `function_call_output` payload 构造
- provider wrapper 所需的 OpenAI/Claude payload 构造

Node binding 已同步暴露：

- `buildGptResponsesRequest`
- `buildGptToolset`
- `buildGptBasicAbilities`
- `buildAfterToolUseHookPayload`
- `renderSkillsSection`
- `rustRuntimeVersion`

### 6. `gmn` 上游八项能力全量测试（2026-03-08）

使用目标：

- 上游：`https://gmn.chuangzuoli.com`
- 模型：`gpt-5.4`

结论：

- `Function Calling / Custom Tools`：通过
- `Web Search`：通过
- `Code Execution`：通过（当前以 `js_repl` 自定义工具调用形态验证）
- `Computer Use`：通过（当前以 `view_image` 函数工具调用形态验证）
- `Shell`：通过（当前以 `shell_command` 函数工具调用形态验证）
- `MCP`：通过（当前以 `list_mcp_resources` 函数工具调用形态验证）
- `Hooks`：本地运行时闭环通过（`after_tool_use` payload 构造已验证）
- `Skills`：本地运行时闭环通过（skills section 渲染已验证）

说明：

- 对于 `Code Execution / Computer Use / MCP / Hooks / Skills`，本轮验证遵循 Codex `0.111` 的运行时分层思路：
  - 能走上游调用的部分，验证模型是否能正确发起对应工具调用
  - 不应由上游承担的部分，验证本地运行时结构化输出是否稳定可用

对应联调目标模型：

- `gpt-5.4`

## 仍未完成范围

以下内容尚未完成迁移或清理：

- 旧 C++ 重叠实现尚未完全删除
- `Code Execution` 尚未迁入 Rust 内核
- `Computer Use` 尚未迁入 Rust 内核
- `Hooks / Skills / MCP` 尚未正式迁移到 Rust 实现层
- `Unified Runtime Contract` 仍未完成按 Rust 内核重组

## 当前工程原则

后续迁移遵循以下原则：

1. GPT 系列 infra 内核以 Rust 为唯一真相来源
2. C++ 保留为官方中间件/外观层，不直接承担 GPT 内核主实现
3. 旧 C++ 重叠实现逐步丢入 git 历史，不长期双轨维护
4. 迁移过程中必须持续做项目内测试与上游联调

## 下一步建议

优先继续处理：

1. 清理旧 C++ 中 GPT `function/web/shell` 重叠路径
2. 将 `Code Execution` 迁入 Rust 运行时
3. 将 `Computer Use` 按 Codex 风格运行时能力迁入 Rust
4. 继续同步更新 `docs/ability/01-basic-implementation.md`
