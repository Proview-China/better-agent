# 2026-03-15 MCP Official Gap Audit

## 目的

- 审计 `rax` 当前 MCP 实现，区分：
  - 已经具备的共享 MCP client runtime 能力
  - 尚未吃透的三家官方 API SDK / Agent SDK MCP carrier 能力
- 为下一阶段“收紧支持范围”和“继续补官方 carrier”提供依据。

## 当前代码已经做到的

- `rax.mcp.use()` 已可用，返回 route-bound session handle：
  - `tools()`
  - `resources()`
  - `read()`
  - `prompts()`
  - `prompt()`
  - `call()`
  - `disconnect()`
- `McpRuntime` 已实现：
  - `connect`
  - `listConnections`
  - `disconnect`
  - `disconnectAll`
  - `listTools`
  - `listResources`
  - `readResource`
  - `listPrompts`
  - `getPrompt`
  - `call`
- 当前 transport：
  - `stdio`
  - `streamable-http`
  - `in-memory`
- 当前 route governance：
  - `provider`
  - `model`
  - `layer`
  - `compatibilityProfileId`
- 已有真实 smoke：
  - Playwright MCP on `stdio`
  - Playwright MCP on `streamable-http`
  - GPT / Claude / Gemini 类型模型借助 MCP 完成任务

## 当前代码还不是的东西

- 还不是三家官方 MCP carrier 的完整抽象层。
- 还不是官方 API SDK 与 Agent SDK 的全覆盖实现。
- 还不是完整 MCP platform：
  - `mcp.serve` 只有 Anthropic agent-side 最小 builder，距离跨三家完整 platform 还差很多
  - 无 persistence / resumption
  - 无 provider-native auth / approval / oauth 生命周期
  - 无 quirks compatibility matrix

## 官方能力与当前缺口

## 本轮已先落的一步

- provider shell 已开始从“一家一个总壳”拆成“更贴近官方 carrier 的 `api` / `agent` 双壳”
- `McpRuntime.connect()` 已允许显式 `layer` 选到对应 shell，不再被单壳模型直接拒绝
- `registry` 的 MCP 语义已进一步收紧：
  - `mcp.connect` / `mcp.listTools` / `mcp.call` 保留 `documented`，但 notes 已明确“当前 lowering 仍走 shared runtime”
  - `mcp.listResources` / `mcp.readResource` / `mcp.listPrompts` / `mcp.getPrompt` 已下调为 `inferred`
- `WP-03 Anthropic API MCP Connector` 已推进到第一段可验证状态：
  - Anthropic `api` shell 现在是 remote-first / tools-first
  - 显式 `layer=api + stdio` 会被 `mcp_transport_unsupported` 拒绝
  - Anthropic `api` shell 上 `listResources/readResource/listPrompts/getPrompt` 现在由 runtime 抛出 `mcp_surface_unsupported`
  - richer `resources/prompts` 正向 contract 已改由 Anthropic `agent` carrier 承接
- `WP-05 Gemini API MCP Carrier` 已推进到第一段可验证状态：
  - DeepMind `api` shell 现在明确是 tools-first
  - DeepMind `api` shell 上 `listResources/readResource/listPrompts/getPrompt` 现在由 runtime 抛出 `mcp_surface_unsupported`
- `WP-01 OpenAI API MCP Carrier` 已推进到第一段可验证状态：
  - OpenAI `api` shell 现在明确是 API-side / tools-first
  - 显式 `layer=api + stdio` 会被 `mcp_transport_unsupported` 拒绝
  - OpenAI `api` shell 上 `listResources/readResource/listPrompts/getPrompt` 现在由 runtime 抛出 `mcp_surface_unsupported`
- `WP-07 MCP Compatibility Profiles` 已进入可运行状态：
  - `BaseCompatibilityProfile` 现在已可表达 MCP layer-level 规则
  - 默认 `rax` 运行面现在会挂载 `DEFAULT_COMPATIBILITY_PROFILES`
  - profile 当前已能在 facade 阶段直接阻断部分 MCP 调用：
    - Anthropic `api + stdio`
    - OpenAI `api + listResources`
    - DeepMind `api + listPrompts`
  - OpenAI Responses adapter 已显式带上 `variant: "responses"`，避免默认 profile 下的 OpenAI 生成路径回归
- `WP-08 Shared Runtime vs Native Lowering Split` 已拿到第一段结构结果：
  - `McpProviderShell` / `McpConnectionSummary` 现在已带：
    - `officialCarrier`
    - `carrierKind`
    - `loweringMode`
  - facade 现已明确分栏：
    - `rax.mcp.shared.*`
    - `rax.mcp.native.prepare(...)`
    - 旧 `rax.mcp.use/connect/...` 仍保留为 shared-runtime 兼容别名
  - `mcp.native.prepare(...)` 现在会按 provider shell 的 native transport 能力，输出 official native carrier plan，并返回 `supported true/false`
  - shell 现在也已声明 `nativeSupportedTransports`
  - 三家 agent-side native prepare payload skeleton 已落成：
    - OpenAI -> `@openai/agents` + `MCPServerStdio` / `hostedMcpTool`
    - Anthropic -> `@anthropic-ai/claude-agent-sdk` + `mcpServers`
    - DeepMind -> `@google/adk` + `McpToolset`
  - 三家 API-side native prepare payload skeleton 也已落成：
    - OpenAI -> `openai` + `client.responses.create` + `tools.type=mcp`
    - Anthropic -> `@anthropic-ai/sdk` + `client.messages.create` + `mcp_servers / mcp_toolset`
    - DeepMind -> `@google/genai` + `mcpToTool`
  - `native.prepare` 结果现在也已带 builder-ready 元数据：
    - `builderId`
    - `constraintSnapshot`
    - `unsupportedReasons`
  - `rax.mcp.native.build()` 已落成：
    - 对支持的 native plan 返回标准 `PreparedInvocation`
    - 对不支持的 native plan 抛 `mcp_native_build_unsupported`
  - `rax.mcp.native.compose()` 已落成：
    - OpenAI Responses 与 Anthropic Messages 现在可把 native MCP build 结果合并回模型调用 prepared invocation
    - DeepMind/Gemini 继续明确报 `mcp_native_compose_unsupported`
  - `rax.mcp.native.execute()` 与 `composeAndExecute()` 已落成：
    - 控制面已经到位，并开始接入真实 provider-native executor
    - OpenAI agent-native `stdio` 现在会真实走 `@openai/agents` 的 `Agent + Runner.run(...)`
    - Anthropic agent-native 现在会消费 `query()` 到最终 assistant message，而不是只返回 `Query` 对象
    - Anthropic agent-native 认证与权限桥接现在也已补齐：
      - 显式通过 `options.env` 注入 `ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL`
      - 对自动化 executor 使用 Claude runtime 的 tool-approval bypass
    - DeepMind agent-native 现在也已接上真实 ADK runtime：
      - `compose` 会把 `generateContent` 输入收成 `@google/adk` 的 `InMemoryRunner.runEphemeral` invocation
      - `execute` 会真实走 `MCPToolset + LlmAgent + InMemoryRunner`
      - 当 `baseURL` 看起来不是 Google 官方域名时，会走官方 `ApigeeLlm` 代理模型桥接；官方域名则走 `Gemini`
  - `smoke:mcp:native:live` 当前状态已明确：
    - OpenAI API-style Responses MCP 仍被 `gmn` 上游 `502` 阻断
    - OpenAI agent-native `stdio` 已在 `gpt-5.4` 上真实返回 `Example Domain`
    - Anthropic API connector 仍被“官方 connector 需要 public HTTPS MCP server”这一前置条件阻断
    - Anthropic agent-native `stdio` 已在 `claude-opus-4-6-thinking` 上真实返回 `Example Domain`
    - DeepMind agent-native `stdio` 已在 `gemini-2.5-flash` 上真实返回 `Example Domain`
  - DeepMind 默认官方 profile 现在也已带最小 `supportedModelHints`
- 三家 API carrier 的第一批 tools-first contract 当前都有定向测试覆盖
- `WP-09 mcp.serve` 已拿到第一段最小结果：
  - `rax.mcp.serve()` / `rax.mcp.native.serve()` 现已存在
  - Anthropic agent-side 现在会真实走 `@anthropic-ai/claude-agent-sdk` `createSdkMcpServer()`
  - OpenAI 当前仍明确 unsupported
  - DeepMind 当前保持 documented-but-unimplemented 的 truthful result，因为当前 JS baseline 里还没有像 Anthropic `createSdkMcpServer()` 那样的一步式 server builder
- MCP + runtime 定向测试当前为 `112 pass / 0 fail`

这一步的意义不是“已经完整实现官方 carrier”，而是先把底座从“单壳模型”推进到“可继续收紧的双壳模型”。

### OpenAI

- 官方 API SDK：
  - Responses 支持 MCP tool。
  - 这是 API 层，不应只挂到 `agent`。
- 官方 Agents SDK：
  - 支持 `HostedMCPTool`
  - 支持 `MCPServerStdio`
  - 这是 agent runtime 层

当前缺口：

- 已经补出 `openai/api/mcp` 与 `openai/agent/mcp` 双 shell。
- 还没有 OpenAI API MCP carrier builder。
- 还没有 OpenAI Agents MCP carrier builder。
- 还没有把 API remote MCP 与 agent stdio/hosted MCP 分层表达出来。

收紧建议：

- 不要再把 OpenAI MCP 只说成 `agent`。
- 下一阶段至少拆成：
  - `openai/api/mcp`
  - `openai/agent/mcp`

### Anthropic

- 官方 API SDK：
  - API `mcp_connector` 目前是 remote MCP connector。
  - 当前文档明确只支持 tools，不支持 prompts / resources。
  - 当前文档明确只支持 remote MCP server，不支持 stdio。
- Claude Agent SDK / Claude Code SDK：
  - 支持 local stdio MCP server
  - 支持 remote MCP server
  - 更接近完整 MCP runtime

当前缺口：

- 已经补出 `anthropic/api/mcp` 与 `anthropic/agent/mcp` 双 shell。
- 但 API / agent shell 只是 carrier metadata 拆开了，还没有把这些差异真正下沉成 runtime/profile 约束。
- 还没有把 Anthropic API MCP 与 Claude Agent SDK MCP 的差异下沉成 provider-native lowering 与 profile 规则。

收紧建议：

- Anthropic 至少拆成：
  - `anthropic/api/mcp-connector`
  - `anthropic/agent/mcp`
- `api` shell 不应继续默认承诺：
  - `stdio`
  - `prompts`
  - `resources`

### Google / Gemini / ADK

- Gemini API SDK：
  - 支持 local MCP through client libraries
  - 支持 remote MCP tool
  - 但官方明确还有限制：
    - 部分 model family 还不支持 remote MCP
    - tool combinations 仍有限制
- Google ADK：
  - 支持 `MCPToolset`
  - 支持把 ADK agent 暴露为 MCP server

当前缺口：

- 已经补出 `deepmind/api/mcp` 与 `deepmind/agent/mcp` 双 shell。
- 还没有 Gemini API MCP carrier builder。
- 还没有 ADK MCPToolset carrier builder。
- 还没有把 Gemini API 的 model / tool-combination 限制下沉进 compatibility profile。
- `mcp.serve` 在 registry 里有声明，但 runtime/facade 还未实现。

收紧建议：

- Google 路线至少拆成：
  - `deepmind/api/mcp`
  - `deepmind/agent/mcp`
- 在 compatibility profile 中显式编码：
  - remote MCP model support
  - tool combination restrictions

## 横向问题

1. `mcp.serve` 不再是“registry 已声明、代码完全未实现”，但现在仍只有 Anthropic agent-side 最小 builder。
2. duplicate `connectionId` 替换仍不是事务式。
3. `disconnect` 对 missing connection 静默成功，契约偏松。
4. remote tool error message 仍未从 payload 提取真实文本。
5. 真实 smoke 主要证明了 shared client runtime 可用，不等于 provider-native carrier 已完备。

## 下一阶段建议顺序

1. 先把 provider shell 拆成“官方真实 carrier”而不是“一家一个总 shell”
2. 继续把 `mcp.serve` 从“Anthropic 最小 builder + 其他 truthful result”推进到：
  - 更完整的 provider-native serve/runtime story
  - 或对 DeepMind/OpenAI 继续保持严格 truthfulness
3. 为 OpenAI / Anthropic / Gemini / ADK 分别补 carrier builder
4. 把 model / transport / surface 限制下沉为 compatibility profile 规则
5. 再做 persistence / resumption / transactional replacement

## 一句话结论

- 当前 `rax` 已经有可运行的共享 MCP client runtime，并且三家 agent-native MCP execute 都已真实 smoke 通过。
- 但距离“完全吃透三家官方 API SDK / Agent SDK 的 MCP 能力”，还差更完整的 `mcp.serve`、persistence / resumption，以及限制条件的 profile 化。
