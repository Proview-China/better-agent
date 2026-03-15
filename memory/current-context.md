# Current Context

更新时间：2026-03-15

## 当前阶段

- 仓库处于 `reboot/blank-slate` 重启阶段。
- 目标是从空白起点重新建立可持续演进的架构，而不是继续修补旧实现。
- `rax` 的第一版 control-plane 骨架已经落下；`MCP` 第一阶段和 review 收口已完成。
- 当前最新进展：
  - `MCP` 的 registry surface 已与 runtime 实现面对齐
  - `src/rax/index.ts` 的 MCP 公共类型导出已补齐 resources/prompts 相关项
  - `rax.mcp.use()` 已落地，返回 route-bound MCP session handle
  - 真实 Playwright MCP 已通过 `stdio` 与 `streamable-http` 在 OpenAI / Anthropic / DeepMind 三个 route 上跑通
  - 模型经由 MCP 完成任务的 live smoke 也已拿到：
    - GPT type：`gmn` 上游通过 stateless Responses tool loop 成功返回 `Example Domain`
    - Claude type：`https://viewpro.top` 通过 Anthropic `toolRunner()` + MCP 成功返回 `Example Domain`
    - Gemini type：`https://viewpro.top` 通过 `mcpToTool()` + `gemini-2.5-flash` 成功返回 `Example Domain`
- `search.ground` 已确定采用 `native-first + governed-task` 路线：
  - 对上层暴露 `rax.websearch.create()`
  - `rax.websearch.create()` 现在直接执行官方 native search，并返回统一结果壳
  - `rax.websearch.prepare()` 仅保留给内部/测试使用
  - 内部保留 `search.web` / `search.fetch` / `search.ground` 作为 canonical 语义骨架
  - OpenAI / Anthropic / DeepMind 均走官方 native search tooling
  - unofficial gateway 默认不承诺原生搜索能力，按 compatibility profile 阻断
- `websearch` 的统一结果 contract 已补齐：
  - `WebSearchOutput`
  - `normalizeWebSearchOutput()`
  - `toWebSearchCapabilityResult()`
  - `toWebSearchFailureResult()`
- 已补真实 `rax.websearch.create()` smoke，当前 `.env.local` 下结论更细化了：
  - OpenAI route on `gmn.chuangzuoli.com/v1` 可正常承接原生 web search，但当前可用模型是 `gpt-5.4`
  - 同一路由下 `gpt-5` 仍返回 `502`
  - Anthropic route 不是完全不可用：
    - `.env.local` 里的 `claude-opus-4.6-thinking` 在当前主上游会 `503`
    - 同一路由下 `claude-opus-4-6-thinking` 可跑普通 `messages.create`
    - 但 web search 行为不稳定，常返回 `tool_use` 未闭环或异常防御性回答
  - DeepMind route 当前对 `interactions` 返回 `404`
- 当前重点已从前一阶段的 `search.ground` / `MCP` 收口，切换到 `skill` 薄承载层启动：
  - `skill` 现在明确回收到 infra/adapter 层，目标是贴着 OpenAI / Anthropic / Google ADK 的官方 skill carrier 做统一接入
  - 更复杂的能力组织、上下文治理与长期演化，继续放回包装机架构、Context Manager、policy、ledger 等上层部件
  - 第一批代码骨架已落地：
    - `src/rax/skill-runtime.ts`
    - `src/rax/skill-types.ts`
    - `rax.skill.loadLocal()`
    - `rax.skill.define()`
    - `rax.skill.containerCreate()`
    - `rax.skill.discover()`
    - `rax.skill.bind()`
    - `rax.skill.activate()`
- `MCP` 的本轮 review 收口结果仍然保留：
  - lifecycle 管理口已收成 route-scoped
  - provider shell metadata / notes 已与当前 runtime 表面对齐
  - registry / public barrel 已与当前实现面对齐

## 当前明确约束

- TypeScript + Node.js 是新的默认实现语言和工具链。
- `memory/` 是仓库内长期记忆层，重要的架构和执行结论要持续写回这里。
- `docs/` 目录可能由另一个 Codex 实例并行更新；看到文档变化时不要惊讶，也不要回滚无关改动。
- macOS 不默认使用 Electron。
- Windows / Linux 未来可以考虑 Electron，但现在先不搭 UI 壳。
- 需要保持仓库尽量干净，不要提前搬回旧 `dev` 分支的大型目录树。
- unofficial upstream 必须按 compatibility profile 处理，不能假设它们是完整官方 API 平台。
- `rax` 当前同时维护两条运行面：
  - `rax`：默认官方形态运行时
  - `raxLocal`：兼容 unofficial gateway 的本地运行时

## 当前近期待办

1. 继续把 `skill` 收窄为官方 carrier adapter，而不是把包装机所有复杂度塞进 `skill`：
   - OpenAI：`shell` + `environment.skills`
   - Anthropic：`container.skills` 或 filesystem `Skill`
   - Google ADK：`SkillToolset`
2. 继续细化 `rax.skill` v0：
   - `define`
   - `discover`
   - `bind`
   - `activate`
   - `loadLocal`
3. 继续细化 `Skill Container` 和 `Context Manager`，但把它们视为上层架构部件，而不是 `skill` 本身：
   - bindings
   - policy
   - ledger
   - metadata -> entry markdown -> resources/helpers 三层加载
4. 如果后续要让 `skill` 使用 MCP，优先复用 `mcp.use()` 作为统一会话入口，而不是重做三套 provider-specific MCP 逻辑。
5. 保持 `memory/` 作为并行协作下的项目长期记忆层。
