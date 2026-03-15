# 2026-03-14 MCP Runtime And Compatibility

## 本次完成

- 建立了 `rax` 的第一版能力控制面骨架：
  - capability registry
  - router
  - facade
  - runtime
  - compatibility profile
- 打通第一批薄能力：
  - `generate.create`
  - `generate.stream`
  - `embed.create`
  - `file.upload`
  - `batch.submit`
- 引入三家 provider 的薄能力适配层：
  - OpenAI
  - Anthropic
  - DeepMind / Gemini
- 增加 `raxLocal`，用于 unofficial gateway 的 compatibility-aware 调用。

## unofficial upstream 当前判断

### OpenAI-like (`gmn.chuangzuoli.com/v1`)

- 只能按 `openai-chat-only-gateway` 处理。
- 目前最稳的是：
  - `chat/completions`
  - `chat/completions stream`
- 不要默认启用：
  - `responses`
  - `embeddings`
  - `files`
  - `batches`

### Anthropic-like (`viewpro.top`)

- 可以按 `messages-only + streaming` 处理。
- 当前最稳的能力边界：
  - `messages.create`
  - `messages stream`
  - `models.list`
- 不要默认启用：
  - `files`
  - `messages.batches`

### DeepMind-like unofficial gateway

- 品牌像 Gemini，但协议壳更像 OpenAI-compatible gateway。
- 当前可用能力更像：
  - `generate.create`
  - `generate.stream`
  - `embed.create`
- `file upload` 和 `batch` 不能假设为可用。

## MCP 当前完成度

`MCP` 已从概念推进到第一阶段共享 runtime：

- 已完成：
  - `mcp.connect`
  - `mcp.listConnections`
  - `mcp.disconnect`
  - `mcp.disconnectAll`
  - `mcp.listTools`
  - `mcp.call`
  - `mcp.listResources`
  - `mcp.readResource`
  - `mcp.listPrompts`
  - `mcp.getPrompt`
- transport:
  - `stdio`
  - `streamable-http`
  - `in-memory`
- provider shell 当前挂层：
  - OpenAI MCP -> `agent`
  - Anthropic MCP -> `api-first`
  - DeepMind MCP -> `agent`

## 本轮 review 收口结果

本轮先收 review 提到的两个 medium finding：

1. lifecycle / 管理口 scope
- 已修复。
- `listConnections()` 与 `disconnectAll()` 已改为 route-scoped：
  - `provider`
  - `model`
  - `layer`
  - `compatibilityProfileId`
- facade 和 runtime 现在都会按上述路由上下文筛选连接，而不是直接暴露进程级全表管理口。

2. provider shell metadata drift
- 已修复。
- Anthropic shell 的 `supportsResources` / `supportsPrompts` 已改成与当前 runtime 一致。
- DeepMind shell notes 不再声称“first phase only implements connect/listTools/call”。
- 当前策略选择的是“metadata 说真话”，而不是为了对齐注释去缩回已公开的 runtime 能力面。

3. registry / public surface drift
- 已修复。
- `src/rax/registry.ts` 现在已经补齐当前已实现的 MCP 动作：
  - `listConnections`
  - `disconnect`
  - `disconnectAll`
  - `listResources`
  - `readResource`
  - `listPrompts`
  - `getPrompt`
- `src/rax/index.ts` 现在也补齐了 resources/prompts 相关 MCP 类型导出。
- 新增了一条 registry 回归测试，锁住“已实现动作必须出现在能力注册表里”这个约束。

4. `mcp.use()` 统一会话入口
- 已实现。
- `rax.mcp.use()` 现在会：
  - 先建立 MCP 连接
  - 再返回一个绑定了 `provider + model + layer + compatibilityProfileId + connectionId` 的 session handle
- 上层会话句柄现在统一暴露：
  - `tools()`
  - `resources()`
  - `read()`
  - `prompts()`
  - `prompt()`
  - `call()`
  - `disconnect()`
- 这样上层使用 MCP 时不需要再手写“先 connect，再每次传 connectionId 和 route”的样板代码。

5. 真实 Playwright MCP smoke
- 已完成。
- 新增 `npm run smoke:mcp:playwright`
- 实际接入的是：
  - `npx -y @playwright/mcp@latest --headless --isolated --output-mode stdout --browser chrome`
- smoke 不是只做 `connect/listTools`，而是真的跑了：
  - `browser_navigate`
  - `browser_snapshot`
- 实测在同一套 `rax.mcp.use()` 上，对三家 route 都能跑通：
  - OpenAI -> `agent`
  - Anthropic -> `api`
  - DeepMind -> `agent`
- 两种 transport 都已经有真实通过记录：
  - `stdio`
  - `streamable-http`
- 每条 route / transport 组合都成功：
  - 连接 Playwright MCP
  - 发现 `22` 个工具
  - 导航到 `https://example.com`
  - 拿到包含 `Example Domain` 的 snapshot

6. Anthropic MCP transport policy
- 为了让本地/市面上的 stdio MCP 能在统一上层 API 下跨三家 route 使用，Anthropic MCP shell 现在也接受 `stdio` transport。
- 这代表共享 runtime 的实际互操作边界，不等于把 Anthropic 官方最接近的 MCP 入口重新定义掉；默认挂层仍保持 `api-first`。

7. 模型经由 MCP 的 live smoke
- 已完成。
- 新增 `npm run smoke:mcp:models`
- 当前已确认三种模型类型都能“真的借助 MCP 完成任务”，统一任务是：
  - 打开 `https://example.com`
  - 返回页面标题 `Example Domain`
- GPT type：
  - 上游：`gmn.chuangzuoli.com`
  - 路线：OpenAI Responses function calling + Playwright MCP
  - 关键事实：`previous_response_id` 这条多轮回灌在该上游不稳，稳定做法是 stateless tool loop
- Claude type：
  - 上游：`https://viewpro.top`
  - 路线：Anthropic `beta.messages.toolRunner()` + MCP tools
  - 关键事实：可用模型名是 `claude-opus-4-6-thinking`，不是 `claude-opus-4.6-thinking`
- Gemini type：
  - 上游：`https://viewpro.top`
  - 路线：`@google/genai` `mcpToTool()`
  - 关键事实：当前 `gemini-3-flash` 无可用通道，实测成功的是 `gemini-2.5-flash`

## 仍然保留的风险

当前没有已知 major finding，但还有几个明确残留风险：

1. duplicate `connectionId` 替换仍不是事务式
- 当前是“先关旧连接，再连新连接”。
- 如果新连接失败，旧连接会丢失。

2. tool error message 仍偏保守
- `isError` 现在会正确作为结果返回，不再被压成 runtime failure。
- 但 `errorMessage` 仍是本地合成文案，真实细节主要还在 `content/raw`。

3. `MCP` 仍是第一阶段共享 runtime，不要夸大为完整包装机
- 还没有：
  - `serve`
  - durable persistence
  - reconnection / resumption
  - packaging / merge / split / evolution
  - 普适兼容市面上各种 quirks MCP server

## 本地验证

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run smoke:mcp:playwright` 通过
- `npm run smoke:mcp:models` 通过
- 当前测试为：
  - `43 pass / 0 fail`

## 下一步

后续优先不回头重复修第一阶段 review，而是进入第二阶段能力缺口：

1. `serve` 是否进入下一阶段
2. persistence / resumption
3. duplicate `connectionId` 事务式替换
4. 远端 tool error message 提取
5. `MCP` 与 `session/agent/trace` 的连接方式
6. 基于 `mcp.use()` 的 skill 封装层设计
7. 将当前上游兼容性事实下沉成 runtime/profile 规则，而不是只留在 smoke 结论里
