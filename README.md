# Praxis

Praxis 当前可继续开发的总装基线是 `integrate/dev-master-cmp`。

这条线已经不是单纯的 reboot 起步线，而是把 `dev-master`、`reboot/blank-slate`、`cmp/mp` 以及后续 TAP / CMP 收口补丁真正装到一起后的可验证工作线。

## 当前状态

- 项目主工具链是 TypeScript + Node.js。
- `core_agent_runtime`、`TAP`、`CMP`、`MP`、`rax.cmp`、`rax.mp` 当前都已进入同一条可继续开发的主线。
- `memory/` 目录继续承担仓库内长期记忆层，用来沉淀当前阶段的事实、约束和工作脉络。
- macOS 不默认走 Electron；Windows / Linux 后续仍可再评估 Electron。

## 当前基线

- 当前总装工作线：`integrate/dev-master-cmp`
- 当前仓库级验证已经通过：
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- 当前 `MP` 线也已经接好：
  - 真实本地 `LanceDB` adapter
  - `rax.mp`
  - `mp.*` capability family
  - 默认 `AgentCoreRuntime` workflow 注册
- `runtime.continue-followups` 已拆成 focused 测试文件，以绕开 Node 25 + `tsx` 下的单文件 OOM。
- 当前已在真实 OpenAI-compatible 上游 `https://gmn.chuangzuoli.com` 上完成一轮单 agent 联调：
  - `core -> TAP -> model.infer`
  - TAP `reviewer / tool_reviewer / TMA`
  - `CMP role -> TAP bridge`
  - `CMP five-agent live`
- 当前已确认并修复一处关键 live 阻塞：
  - `dispatcher` 不是规则层坏掉，而是 `model.infer -> OpenAI responses` 把内部 metadata 一起发到了 provider，导致当前 `gmn` 路由把请求拖成 `524 timeout`
  - 现在这层 provider metadata 已从 OpenAI `responses` 请求里移除，同时补了更紧凑的 `dispatcher` live prompt 和输出 token 上限

## 这条线已经承接住什么

- `reboot/blank-slate` 带回来的 `agent_core` / `TAP` / capability 基座
- `cmp/mp` 带回来的 `CMP` runtime、`rax.cmp`、五角色 runtime 与 live wrapper
- 当前新补的 `MP` memory plane：
  - `mp-types`
  - `mp-lancedb`
  - `mp-runtime`
  - `rax.mp`
  - `mp.search/materialize/promote/archive/split/merge/reindex/compact`
- 后续总装阶段对 `runtime.ts`、`runtime.test.ts`、TAP replay / human-gate / provisioning 主链做的收口修正
- 当前联调 smoke 层还新增了模型分级策略：
  - `core` smoke 默认按 `gpt-5.4 + high`
  - TAP 三 agent smoke 默认按 `gpt-5.4 + medium`
  - `CMP five-agent` smoke 默认按角色分级：
    - `icma`: `gpt-5.4 + medium`
    - `iterator`: `gpt-5.4 + low`
    - `checker`: `gpt-5.4 + medium`
    - `dbagent`: `gpt-5.4 + medium`
    - `dispatcher`: `gpt-5.4 + high`

## 接下来怎么用

1. 默认直接在这条线继续开发新功能。
2. 新功能优先复用已经接好的 `core_agent_runtime + TAP + CMP + MP + rax.cmp + rax.mp` 总装面。
3. 如需回溯重启期设计背景，再读 [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md) 和 [memory/current-context.md](/home/proview/Desktop/Praxis_series/Praxis/memory/current-context.md)。
4. 如果后面继续联调，优先从 `single-agent-live-smoke` 和 `cmp-five-agent-live-smoke` 这两个入口做断点测试，不要直接黑盒全链乱跑。
5. 如果后面继续做 `MP`，当前建议直接从：
   - `rax.mp`
   - `mp.*` capability family
   - `src/agent_core/runtime.mp-workflow.test.ts`
   这三个面开始，不要重新发明新的 memory workflow 入口。
