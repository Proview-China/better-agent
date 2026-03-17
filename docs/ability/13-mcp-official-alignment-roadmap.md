# MCP Official Alignment Roadmap

## 目标

本文件用于把 Praxis 当前的 MCP 路线，从“可运行的共享 MCP client runtime”推进到“尽可能吃透三家官方 API SDK / Agent SDK 的 MCP carrier 与能力边界”。

白话说：

- 现在我们已经能统一连 MCP、列工具、调用工具，并且真实跑通了 Playwright MCP。
- 但现在还不等于“已经完整实现 OpenAI / Anthropic / Gemini + ADK 的官方 MCP 体系”。
- 后续工作重点不是继续堆抽象词，而是把三家官方真实 carrier、限制条件、lowering 路径和生命周期能力一点点做实。

## 当前基线

当前已经成立的事实：

- `rax.mcp.use()` 已可用。
- `McpRuntime` 已支持：
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
- Playwright MCP 已在三家 route 上真实 smoke 通过。
- GPT / Claude / Gemini 类型模型已实测可借助 MCP 完成任务。
- provider shell 已开始从“一家一个壳”拆成更贴近官方 carrier 的 `api` / `agent` 双壳。

当前还未成立的事实：

- 还没有跨三家的完整 `mcp.serve`
- 还没有 persistence / resumption
- 还没有 provider-native MCP carrier builder
- 还没有把三家 MCP 的 model / transport / tool-combination 限制完整写进 compatibility profile
- 还没有把“共享 runtime 可用面”和“官方 SDK first-class 面”完全区分干净

## 当前执行状态

- `WP-01 OpenAI API MCP Carrier`
  - 已拿到第一段 contract：API-side tools-first，`api + stdio` 被拒绝，`api + resources/prompts` 被阻断
- `WP-03 Anthropic API MCP Connector`
  - 已拿到第一段 contract：API-side remote-first + tools-first，`api + stdio` 被拒绝，`api + resources/prompts` 被阻断
- `WP-05 Gemini API MCP Carrier`
  - 已拿到第一段 contract：API-side tools-first，`api + resources/prompts` 被阻断
- `WP-07 MCP Compatibility Profiles`
  - 已进入可运行状态：默认 `rax` 已挂载 `DEFAULT_COMPATIBILITY_PROFILES`，部分 MCP layer/surface 阻断已在 facade 阶段生效
- `WP-08 Shared Runtime vs Native Lowering Split`
  - 已拿到下一段更真实的 executor 结果：`officialCarrier / carrierKind / loweringMode` 已进入连接结果，`rax.mcp.shared.*` 与 `rax.mcp.native.prepare(...)` 已分栏，API-side / agent-side native prepare payload skeleton 均已落成，并带 builder-ready metadata；`rax.mcp.native.build()`、`rax.mcp.native.compose()`、`rax.mcp.native.execute()`、`rax.mcp.native.composeAndExecute()` 的控制面都已落成，而且 OpenAI / Anthropic / DeepMind 三条 agent-native `stdio` 都已拿到真实 live pass
- `WP-09 mcp.serve`
  - 已拿到第一段最小收口：`rax.mcp.serve()` / `rax.mcp.native.serve()` 已存在，Anthropic agent-side 会真实走 `createSdkMcpServer()`，OpenAI 明确 unsupported，DeepMind 当前保持 documented-but-unimplemented 的 truthful result
- 当前 MCP + runtime 定向测试：
  - `112 pass / 0 fail`
- 当前 native live smoke 现实：
  - OpenAI API-style Responses MCP：`blocked`，因为 `gmn` 上游对这条仍回 `502`
  - OpenAI agent-native `stdio`：`pass`，当前稳定模型是 `gpt-5.4`
  - Anthropic API connector：`blocked`，因为 localhost HTTP 不是公开 HTTPS MCP server
  - Anthropic agent-native `stdio`：`pass`，当前稳定模型是 `claude-opus-4-6-thinking`
  - DeepMind agent-native `stdio`：`pass`，当前稳定模型是 `gemini-2.5-flash`

## 使用方式

本文件的粒度按“一个子智能体可独立接手的一包工作”来写。

每个 Work Package 都包含：

- 目标
- 主要文件
- 交付内容
- 验收
- 暂不处理

执行规则：

- 一次只拿一个 Work Package。
- 若两个 Work Package 会改同一批核心文件，不要并行。
- 如果当前工作树里有无关改动，不要回滚。
- 若被现有 `skill/docs` 主线挡住，优先做定向 MCP 测试，不要顺手修 unrelated 类型错误。

## Phase 0: 文义收紧

这一阶段的目标，不是加更多功能，而是先把“现在到底做到了哪里”说真话。

### WP-00 Shared Runtime Truthfulness

目标：

- 继续收紧 MCP 的对外语义。
- 明确区分：
  - 官方有 MCP carrier
  - 当前 `rax` 仍通过 shared MCP runtime lowering

主要文件：

- `src/rax/registry.ts`
- `src/integrations/*/api/mcp.ts`
- `src/integrations/*/agent/mcp.ts`
- `memory/worklog/2026-03-15-mcp-official-gap-audit.md`

交付内容：

- 把 `documented / inferred / unsupported` 继续说准。
- 把各 provider shell 的 notes 改成 carrier truth，而不是泛泛而谈。
- 补充每家的“这不是 first-class SDK action，而是 shared runtime surface”的说明。

验收：

- `registry` 中 MCP 语义与当前代码实现一致。
- 文档与 notes 不再把 shared runtime surface 冒充成 provider-native surface。
- MCP 定向测试通过。

暂不处理：

- `mcp.serve`
- persistence
- provider-native builder

## Phase 1: Carrier 分层做实

这一阶段的目标，是把三家官方 MCP 的 carrier 拆准。

### WP-01 OpenAI API MCP Carrier

目标：

- 补 OpenAI API MCP carrier builder 的真实 lowering 入口。
- 不再只停留在 `openai/api/mcp` shell metadata。

主要文件：

- `src/integrations/openai/api/mcp.ts`
- `src/rax/facade.ts`
- `src/rax/mcp-types.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 定义 OpenAI API MCP carrier 形状。
- 明确 remote MCP 的输入约束和 route 入口。
- 补最小 contract test。

验收：

- 显式 `provider=openai + layer=api` 时，路由语义稳定。
- 对不支持的 surface 不再默许。
- 新测试通过。

暂不处理：

- OpenAI Agents hosted MCP
- `mcp.serve`

### WP-02 OpenAI Agents MCP Carrier

目标：

- 把 OpenAI Agents MCP 的 carrier 与 API carrier 分开。
- 明确 `stdio` / hosted MCP 的 agent-side 语义。

主要文件：

- `src/integrations/openai/agent/mcp.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- agent-side notes / constraints 收紧。
- 明确 agent-side 默认 route 为什么仍优先。
- 为 hosted vs stdio 预留 clean lowering shape。

验收：

- OpenAI `agent` / `api` 两层语义不再混淆。
- 定向 MCP 测试通过。

暂不处理：

- 真正的 hosted builder 落地

### WP-03 Anthropic API MCP Connector

目标：

- 把 Anthropic API `mcp_connector` 的官方边界收进代码。
- 明确它是：
  - remote-first
  - tools-first
  - 不等于完整 resources/prompts carrier

主要文件：

- `src/integrations/anthropic/api/mcp.ts`
- `src/rax/compatibility.ts`
- `src/rax/registry.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 为 Anthropic API MCP 建立更严格的 compatibility profile 规则。
- 明确 API 路对 `stdio` / `resources` / `prompts` 的真实边界。

验收：

- `provider=anthropic + layer=api` 的不支持面会被显式拦截或显式标注为 shared-runtime extension。
- 文档、profile、runtime 三处说法一致。

暂不处理：

- Claude Code SDK 的完整 runtime

### WP-04 Anthropic Agent MCP Carrier

目标：

- 把 Anthropic agent-side MCP 路线做实。
- 明确它和 API connector 不同。

主要文件：

- `src/integrations/anthropic/agent/mcp.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- agent-side shell 的本地 stdio / richer MCP surface 语义稳定下来。
- 为后续 Claude Agent SDK / Claude Code SDK lowering 预留 carrier 结构。

验收：

- Anthropic `layer=agent` 能稳定走本地 MCP carrier 语义。
- 不再和 API connector 混层。

暂不处理：

- 完整 Claude runtime 生命周期接线

### WP-05 Gemini API MCP Carrier

目标：

- 把 Gemini API 的 MCP 能力和限制条件写进 carrier + profile。

主要文件：

- `src/integrations/deepmind/api/mcp.ts`
- `src/rax/compatibility.ts`
- `src/rax/registry.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 明确 Gemini API 的 remote MCP / local MCP 语义。
- 把 model family / tool combination 限制开始写入 profile。

验收：

- `provider=deepmind + layer=api` 的行为和 notes 对齐。
- 不再泛称成“Gemini 全部 MCP 都可用”。

暂不处理：

- ADK `MCPToolset`
- `mcp.serve`

### WP-06 Google ADK MCP Carrier

目标：

- 把 ADK runtime 这一层的 MCP carrier 单独做实。

主要文件：

- `src/integrations/deepmind/agent/mcp.ts`
- `src/rax/registry.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 明确 ADK 路是 agent/runtime-side carrier。
- 为 `MCPToolset` 和 agent-as-server 预留清晰结构。

验收：

- `provider=deepmind + layer=agent` 不再只是“泛 agent 壳”。
- notes / matrix / route 语义一致。

暂不处理：

- 真正的 ADK server exposure

## Phase 2: Profile 与 runtime 规则收紧

这一阶段的目标，是让“不能做的事”真正被系统拦住。

### WP-07 MCP Compatibility Profiles

目标：

- 把 MCP 相关限制下沉到 `compatibility profile`。

主要文件：

- `src/rax/compatibility.ts`
- `src/rax/facade.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 新增 MCP 相关 profile 字段，例如：
  - supported MCP transports
  - supportsRemoteMcp
  - supportsLocalMcp
  - supportsMcpResources
  - supportsMcpPrompts
  - supported remote MCP model hints
  - disallowed tool combinations
- connect / use / resources / prompts 调用时真正消费这些规则。

验收：

- 官方 route 与 unofficial gateway route 的 MCP 边界能被代码表达。
- 不支持的组合会明确失败，而不是靠文档提醒。

暂不处理：

- persistence

### WP-08 Shared Runtime vs Native Lowering Split

目标：

- 在 facade/runtime 层区分：
  - shared runtime path
  - provider-native lowering path

主要文件：

- `src/rax/facade.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-types.ts`

交付内容：

- 定义更清晰的 lowering mode。
- 让后续 provider-native builder 可以接入，而不是一直挤在同一 runtime 路径里。

验收：

- MCP 调用路径的结构已经能容纳 shared/native 两种 lowering。
- 不需要立刻补齐全部 native builder，也不会再次改大骨架。

暂不处理：

- `mcp.serve`

## Phase 3: 生命周期与平台能力

这一阶段的目标，是让 MCP 从“任务期可用”走向“平台期可用”。

### WP-09 `mcp.serve`

目标：

- 解决 `mcp.serve` 现在“registry 已声明、runtime 未实现”的漂移。

主要文件：

- `src/rax/registry.ts`
- `src/rax/facade.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`
- `docs/ability/01-basic-implementation.md`

交付内容：

二选一：

- 真正落地 `mcp.serve`
- 或显式降级为未实现，并把 matrix / docs 全部收齐

验收：

- 不再存在“声明一套、代码一套”的情况。

暂不处理：

- 完整 server deployment story

### WP-10 Persistence And Resumption

目标：

- 让 MCP 连接不只活在内存里。

主要文件：

- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-types.ts`
- 新增 runtime store / ledger 文件
- 对应测试

交付内容：

- connection metadata persistence
- session resumption hooks
- 可选 reconnect plan

验收：

- runtime 重启或 session 恢复路径有最小 contract。

暂不处理：

- 分布式多节点同步

### WP-11 Transactional Replacement And Error Extraction

目标：

- 收尾当前 runtime 的两个明显工程缺口：
  - duplicate `connectionId` 事务式替换
  - remote tool error message 真实提取

主要文件：

- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`

交付内容：

- 先连新连接，成功后再替换旧连接，或提供 rollback
- 从 tool payload 提取更真实的 error message

验收：

- 失败替换场景有单测。
- 远端 tool error 不再只剩固定文案。

暂不处理：

- provider-specific rich retry policy

### WP-12 Live Smoke Expansion

目标：

- 把真实 smoke 从“证明能跑”推进到“证明边界正确”。

主要文件：

- `src/rax/mcp-playwright-smoke.ts`
- `src/rax/mcp-model-live-smoke.ts`
- 新增 smoke fixtures

交付内容：

- 增加 API / agent 分层 smoke
- 增加 allowed / blocked matrix smoke
- 增加 provider-native path smoke

验收：

- smoke 报告不仅有 pass/fail，还有“为什么 blocked”。
- 以后 profile 调整不会再靠人工回忆。

暂不处理：

- 大规模外部 MCP 市场兼容巡检

## 并行建议

可以并行的包：

- `WP-01` 和 `WP-03` 和 `WP-05`
- `WP-02` 和 `WP-04` 和 `WP-06`
- `WP-11` 和 `WP-12`

不要并行的包：

- `WP-07` 与任何会改 `compatibility.ts` 的包
- `WP-08` 与任何会改 `facade.ts` / `mcp-runtime.ts` 大结构的包
- `WP-09` 与任何会改 MCP registry 主语义的包

## 建议执行顺序

建议先后顺序：

1. `WP-00`
2. `WP-03`
3. `WP-05`
4. `WP-01`
5. `WP-02`
6. `WP-04`
7. `WP-06`
8. `WP-07`
9. `WP-08`
10. `WP-09`
11. `WP-11`
12. `WP-10`
13. `WP-12`

原因：

- 先把说法和边界说准。
- 再把三家 API / agent carrier 做实。
- 再把 profile 与 runtime 结构收紧。
- 最后补生命周期和平台级能力。

## Definition Of Done

只有同时满足下面几条，才能说 MCP 路线“基本吃透”：

- 三家都已区分 `api` / `agent` carrier
- shared runtime 与 provider-native lowering 已清晰分路
- compatibility profile 能表达 MCP 的关键限制
- `mcp.serve` 不再处于“声明悬空”状态
- persistence / resumption 有最小 contract
- live smoke 覆盖三家主要 MCP path
- 文档、registry、runtime、smoke 说的是同一套真话

## 当前结论

当前还不能说 Praxis 已经完整容纳三家 MCP 的全部内容。

但现在已经具备：

- 可运行的共享 MCP client runtime
- 统一上层调用入口
- 三家 route 的真实 smoke
- 向官方 carrier 分层继续推进的骨架

所以从现在开始，后续工作已经不是“从 0 开始”，而是“沿着这个 roadmap，把三家官方 MCP 的真实边界一点点接实”。
