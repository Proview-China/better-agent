# TAP Native Capability Family And Backend Selection

状态：活文档 / 设计冻结候选稿。

更新时间：2026-04-08

## 这份文档解决什么问题

Praxis 现在已经进入一个新阶段：

- 不再只是讨论 `TAP` 有没有能力池
- 而是要决定 `TAP` 里的能力到底如何建模
- 以及面对 `OpenAI / Claude / Gemini` 三家模型与官方工具链时，到底应该“统一实现”，还是“保留各家原生实现”

这份文档要冻结的，不是某个单一工具的代码细节，而是下面这件核心事情：

**Praxis 的 `core` 应该只消费统一的 capability 语义；`TAP` 则负责把这些统一 capability lowering 到最合适的 vendor-native backend。**

一句白话：

- `core` 只说“我要什么能力”
- `TAP` 决定“这次到底用 Codex 的方式、Claude Code 的方式、Gemini CLI 的方式，还是用独立服务的方式来做”

这比“把三家实现揉成一种通用实现”更稳，也更接近最终想要的架构美感。

## 先说结论

最终结论只有三条：

1. `core -> TAP` 这一层必须统一 capability 语义
2. `TAP -> backend` 这一层不应该强行统一实现
3. `TAP` 必须支持 provider-native backend、portable backend、external backend 共存

换句话说：

- 统一的是“能力名字、能力输入语义、能力输出 envelope”
- 不统一的是“底层到底怎么调用、走哪家官方实现、是否需要外部独立服务”

## 一、为什么不能把三家实现强行揉成一种

如果把 `Codex / Claude Code / Gemini CLI` 三家工具实现强行揉成一种“Praxis 通用工具实现”，看起来统一，实际上会损失三个最重要的东西：

### 1. 原生稳定性

每家模型最擅长消费自家最原生的工具描述、调用格式、事件流和结果结构。

典型例子：

- `Codex / GPT` 对 `Responses` 风格和 `web_search` 参数形状更自然
- `Claude Code` 对自己的 `WebFetchTool / WebSearchTool / BashTool / MCPTool` 路径更自然
- `Gemini CLI` 对自己的 `ToolRegistry / tool declarations / grounding metadata` 更自然

如果强行揉成一种实现，最后会变成：

- 谁都能用
- 但谁都不是最原生
- 谁都不够顺手

### 2. 原生能力边界

很多能力不是三家同时、对称、完全等价存在的。

例如：

- 有的家原生支持更强的 `web_search`
- 有的家原生支持更顺的 `web_fetch`
- 有的家对 `MCP` 的调度和资源读取更成熟
- 有的家根本没有图像生成，但可以调用外部独立图像服务

如果强行统一实现，最后不得不按“最弱公共子集”做设计，系统会变笨。

### 3. 原生演进能力

如果后面上游更新：

- `Claude Code` 新增更好的 `WebFetch`
- `Gemini CLI` 改了 `MCP` 工具面
- `Codex` 升级了 `web_search` 的参数或工具契约

那么保留 vendor-native backend 的架构里，只需要更新对应 family。

如果全揉成一种实现，则每次升级都要整体返工。

## 二、正式原则：统一 capability 语义，不统一 backend 实现

这条规则现在冻结为 `TAP` 的正式设计原则。

### Layer A：Unified Capability Intent

这一层是 `core` 面向 `TAP` 的统一语义层。

`core` 只应该看到：

- `search.web`
- `search.fetch`
- `search.ground`
- `shell.restricted`
- `code.read`
- `code.edit`
- `mcp.call`
- `request_user_input`

`core` 不应该直接看到：

- `claude_web_fetch`
- `gemini_native_mcp_tool`
- `codex_web_search_live`

也就是说，`core` 不和 vendor 命名直接耦合。

### Layer B：Tap Routing And Selection

这一层由 `TAP` 负责。

`TAP` 接到统一 capability 之后，负责决定：

- 当前最合适的 backend 是谁
- 当前有没有 provider-native backend
- 当前是否应该 fallback 到 portable backend
- 当前是否应该走 independent external service backend
- 当前是否应把这个 capability 暴露给 `core`

### Layer C：Vendor-Native Or Service Backend

这一层才是真正执行能力的地方。

这一层可以同时存在：

- `codex-native backend`
- `claude-code-native backend`
- `gemini-cli-native backend`
- `praxis-portable backend`
- `external-service backend`

## 三、能力类型：TAP 里不是所有能力都必须“三家同构”

从现在开始，Praxis 里的 capability 必须分类型，而不是假设所有能力都应该三家对称。

### Type 1：Native Capability

定义：

- 某个 provider 或官方工具链对该能力有最原生、最顺手、最稳定的实现

例子：

- 某条 `Gemini` 的 grounding/search 路线
- 某条 `Claude Code` 的 `WebFetch`
- 某条 `Codex / GPT` 的 `Responses web_search`

设计要求：

- 当当前 `core` 与该 provider/backend 对齐时，优先走 native backend

### Type 2：Portable Capability

定义：

- 三家模型虽然实现不同，但都可以通过某种本地或跨 provider 的方式稳定完成

例子：

- `code.read`
- `code.grep`
- `code.glob`
- `repo.write`
- `code.edit`
- `shell.restricted`

设计要求：

- 即使 provider-native backend 不存在，也应该保留一个 Praxis portable backend

### Type 3：External Service-Backed Capability

定义：

- 当前 `core` 模型本身不原生拥有该能力，但它可以通过 `TAP` 调用独立服务完成

例子：

- `image.generate`
- `audio.transcribe`
- `speech.synthesize`

设计要求：

- 不能因为当前 `core` 是 `Claude` 或 `Gemini`，就简单说“不能做”
- 要先看 `TAP` 当前是否为该能力挂好了独立 backend

### Type 4：Hybrid Capability

定义：

- 既可以走 provider-native backend
- 也可以在 native backend 不可用时，走 external 或 portable backend

例子：

- `search.ground`
- `mcp.call`
- `browser.fetch`

设计要求：

- 定义明确的 selection policy 和 degrade policy

## 四、能力 availability model

每个 capability 从现在开始，都应该拥有一个正式的 availability model。

最小字段建议如下：

```ts
interface TapCapabilityAvailabilityModel {
  capabilityKey: string;
  backendKind: "native" | "portable" | "external" | "hybrid";
  providerSupport: Array<{
    provider: "openai" | "anthropic" | "deepmind" | "generic";
    native: boolean;
    backendRef?: string;
  }>;
  externalSupport?: {
    enabled: boolean;
    backendRef?: string;
  };
  selectionPolicy: string;
  degradePolicy: string;
  visibilityPolicy: string;
}
```

白话解释：

- `backendKind`：这个能力本质上属于哪类能力
- `providerSupport`：哪家 provider 有原生 backend
- `externalSupport`：是否允许独立服务支撑
- `selectionPolicy`：优先走哪条 backend
- `degradePolicy`：这条 backend 不可用时如何降级
- `visibilityPolicy`：什么时候把这个能力显示给 `core`

## 五、最重要的设计边界：capability 可以存在，但不一定始终可见

这一条很重要。

能力是否“存在于 TAP pool”与能力是否“当前暴露给 core”，是两回事。

### 一、Capability Exists In Pool

表示：

- 该能力在 Praxis 体系内是被正式支持的
- 有 schema
- 有 backend family
- 有治理策略

### 二、Capability Is Exposed In Current Window

表示：

- 该能力当前真的可用
- 对当前 route / provider / session / policy 来说是可调用的

例子：

- `image.generate` 可以是 TAP 支持的正式 capability
- 但如果当前没有图像 backend 被挂载，就不应暴露给 `core`

### 冻结规则

- `core` 只根据当前 capability window 工作
- `core` 不应该臆测某个系统级 capability 一定存在
- `TAP` 应明确告诉 `core`：当前有哪些能力可调用，哪些只是系统层支持但当前未激活

## 六、Praxis 需要的 capability namespace

下面是当前建议冻结的 TAP capability namespace。

### P0：必须内置的能力

- `model.infer`
- `search.web`
- `search.fetch`
- `search.ground`
- `shell.restricted`
- `shell.session`
- `code.read`
- `code.read_many`
- `code.grep`
- `code.glob`
- `code.ls`
- `code.edit`
- `repo.write`
- `code.patch`
- `test.run`
- `mcp.listTools`
- `mcp.listResources`
- `mcp.readResource`
- `mcp.call`
- `request_user_input`
- `request_permissions`

### P1：强烈建议尽快支持

- `code.lsp`
- `code.symbol_search`
- `code.diff`
- `git.status`
- `git.diff`
- `git.commit`
- `git.push`
- `view_image`
- `read_pdf`
- `read_notebook`
- `write_todos`

### P2：后续可扩展

- `browser.playwright`
- `spreadsheet.read`
- `spreadsheet.write`
- `doc.read`
- `doc.write`
- `image.generate`
- `audio.transcribe`
- `speech.synthesize`
- `tracker.create`
- `remote.exec`

## 七、来源冻结：三家源码分别适合贡献什么

### 1. Claude Code 适合贡献“现成工具执行逻辑”

最值得吸收的工具面：

- `WebSearchTool`
- `WebFetchTool`
- `BashTool`
- `FileReadTool`
- `FileEditTool`
- `FileWriteTool`
- `GlobTool`
- `GrepTool`
- `LSPTool`
- `MCPTool`
- `ListMcpResourcesTool`
- `ReadMcpResourceTool`
- `AskUserQuestionTool`

结论：

- Claude Code 最适合拿来拆工具执行逻辑和输入输出模型

### 2. Gemini CLI 适合贡献“TS-native 工具基底”

最值得吸收的工具面：

- `web-search.ts`
- `web-fetch.ts`
- `shell.ts`
- `read-file.ts`
- `read-many-files.ts`
- `grep.ts`
- `glob.ts`
- `ls.ts`
- `edit.ts`
- `write-file.ts`
- `mcp-tool.ts`
- `mcp-client.ts`
- `mcp-client-manager.ts`
- `ask-user.ts`

结论：

- Gemini CLI 最适合成为 Praxis TAP family 的 TS 重写蓝本

### 3. Codex 适合贡献“工具 contract 和 schema”

最值得吸收的工具契约：

- `web_search`
- `shell`
- `exec_command`
- `write_stdin`
- `request_user_input`
- `request_permissions`
- `spawn_agent`
- `send_message`
- `assign_task`
- `wait_agent`
- `list_mcp_resources`
- `read_mcp_resource`
- `tool_search`
- `view_image`
- `apply_patch`

结论：

- Codex 更适合拿来定义 TAP pool 的工具契约、参数 schema、交互式 exec 模型
- 不是直接搬 Rust 实现，而是拿它做 contract 样板

## 八、哪些不应该直接搬进 TAP pool

下面这些不应作为第一优先级的 capability 本体：

- `skill.use`
- `skill.mount`
- `skill.prepare`

原因：

- 它们更像 usage artifact 或注入层
- 不应混成权限本体或执行本体

下面这些也不应该依赖三家现成实现，而应保留 Praxis 自己原生治理实现：

- `spawn_agent`
- `send_message`
- `assign_task`
- `wait_agent`
- TAP reviewer / tool reviewer / provisioner 的治理逻辑
- CMP 相关任何能力

这里的意思不是这些能力不重要，而是：

- 它们应属于 Praxis 自己的治理骨架
- 可以参考 Codex/Claude/Gemini 的 contract
- 但不应把上游的 orchestrator 逻辑直接搬进来

## 九、正式建议的 family 打包方式

从现在开始，Praxis 不应该再把这些能力散落在 `live-agent-chat.ts` 之类的入口文件里做私有桥接。

应该正式分三层。

### Layer 1：Vendor Primitives

目录建议：

- `src/agent_core/vendor-families/network/`
- `src/agent_core/vendor-families/local-tooling/`
- `src/agent_core/vendor-families/mcp/`
- `src/agent_core/vendor-families/user-io/`

职责：

- 放纯执行逻辑
- 放 normalize / parse / summarize
- 放 provider-native 或 service-backed backend

例子：

- `anthropic-web-search.ts`
- `gemini-web-fetch.ts`
- `codex-shell-contract.ts`
- `mcp-call-executor.ts`

### Layer 2：Praxis Capability Adapters

目录建议：

- `src/agent_core/integrations/tap-vendor-network-adapter.ts`
- `src/agent_core/integrations/tap-vendor-local-tooling-adapter.ts`
- `src/agent_core/integrations/tap-vendor-mcp-adapter.ts`
- `src/agent_core/integrations/tap-vendor-user-io-adapter.ts`

职责：

- 把 vendor primitive 包装成 TAP 可注册 adapter
- 负责 selection policy 和 degrade policy

### Layer 3：Capability Packages

目录建议：

- `src/agent_core/capability-package/vendor-network-capability-package.ts`
- `src/agent_core/capability-package/vendor-local-tooling-capability-package.ts`
- `src/agent_core/capability-package/vendor-mcp-capability-package.ts`
- `src/agent_core/capability-package/vendor-user-io-capability-package.ts`

职责：

- 给 TAP 产出正式 capability package
- 注册 activation spec、policy、verification、usage、lifecycle

## 十、Tap backend selection 正式规则

每次 `core` 请求 capability 时，`TAP` 至少应该按下面顺序选择 backend：

### Step 1：判断 unified capability key

例如：

- `search.fetch`
- `mcp.call`
- `code.read`

### Step 2：解析当前 route identity

不能只看 endpoint。

最少需要：

- `provider`
- `carrier`
- `surface`
- `model`
- `tool protocol family`

例如：

- `provider = openai`
- `surface = responses`
- `model = gpt-5.4`
- `toolProtocolFamily = codex/openai-native`

### Step 3：查 capability availability model

看：

- 当前 provider 有没有 native backend
- 当前有没有 portable backend
- 当前有没有 external backend

### Step 4：应用 selection policy

推荐默认：

1. native backend
2. portable backend
3. external backend
4. unavailable

### Step 5：结果回包统一 envelope

无论底下走的是哪家 backend，最后都要回到 Praxis 自己统一的 result envelope。

## 十一、三个关键例子

### 例子一：`mcp.call`

目标：

- `core` 只发 `mcp.call`

`TAP` 可以选择：

- `mcp.call.gemini-native`
- `mcp.call.claude-native`
- `mcp.call.codex-native`
- `mcp.call.praxis-generic`

冻结结论：

- 上层永远叫 `mcp.call`
- 底层保留多 backend 共存

### 例子二：`search.ground`

目标：

- 优先走当前 provider-native grounding/search

如果 native backend 不稳：

- 可以降级到 portable web search + fetch + summarize
- 必要时再走 external backend

冻结结论：

- `search.ground` 是标准 hybrid capability

### 例子三：`image.generate`

即使当前 `core` 是 `Claude`，也不代表 `image.generate` 一定不可用。

只要：

- `TAP` 为当前 session 挂了 external image backend

那么：

- `core` 一样可以请求 `image.generate`

冻结结论：

- 能力是否可见，取决于当前 backend 是否可用
- 不取决于当前 `core` 模型是否原生具备该能力

## 十二、当前执行顺序建议

为了避免再次陷入“空讨论”，这份文档冻结下面的实际推进顺序。

### Batch 1：先做 network family

第一批能力：

- `search.web`
- `search.fetch`
- `search.ground`

原因：

- 当前网络面就是最痛点
- 已经有现成源码可参考
- 也是 direct CLI/directTUI 最先能感受到价值的一层

### Batch 2：再做 local-tooling family

第二批能力：

- `shell.restricted`
- `shell.session`
- `code.read`
- `code.read_many`
- `code.grep`
- `code.glob`
- `code.ls`
- `code.edit`
- `repo.write`
- `code.patch`
- `test.run`

### Batch 3：再做 mcp family

第三批能力：

- `mcp.listTools`
- `mcp.listResources`
- `mcp.readResource`
- `mcp.call`

### Batch 4：补 user-io 和 extended capabilities

第四批能力：

- `request_user_input`
- `request_permissions`
- `code.lsp`
- `view_image`
- 以及其他 P1 / P2 能力

## 十三、最终冻结结论

这轮讨论冻结下面这些共识：

- `core` 只消费统一 capability 语义
- `TAP` 不应强行把三家 backend 揉成一种实现
- `TAP` 应保留 provider-native backend 共存
- `TAP` 还应支持 portable backend 和 external backend
- capability 是否存在于系统中，与 capability 是否当前暴露给 `core`，是两回事
- 每个 capability 都应拥有 availability model
- 第一批最值得落地的是 network family，其次是 local-tooling family，再其次是 mcp family

一句压缩总结：

- 统一的是能力语义，不统一的是 vendor-native backend；
- `core` 只说“我要这个能力”，`TAP` 负责用最原生、最稳、当前可用的那条 backend 去完成它。
