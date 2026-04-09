# Current Context

更新时间：2026-04-09

## 当前主线一句话

Praxis 当前可继续开发的总装主线已经形成，工作分支是：

- branch: `integrate/dev-master-cmp`
- worktree: `.parallel-worktrees/integrate-dev-master-cmp`

一句白话：

- 这条线已经不是“合并试算线”
- 它现在就是后续继续联调与开发的实际工作线

## 当前最重要的项目事实

### 1. 这条线已经承接住 `core_agent_runtime + TAP + CMP + MP + rax.cmp + rax.mp`

当前 `integrate/dev-master-cmp` 已经真实吸收：

- `dev-master`
- `reboot/blank-slate`
- `cmp/mp`
- 后续为 `runtime.ts`、`runtime.test.ts`、TAP replay / human-gate / provisioning 主链、CMP five-agent live wrapper 做的一批收口补丁

白话：

- 当前最重要的三块不再分散在多条主要实现线上
- 已经进入同一条可继续开发的总装基线

并且到 2026-04-08 当前阶段，这条线还新增了一层新的稳定事实：

- `MP` 已不再只是 branch family 里的预留位
- 现在已经有：
  - `mp-types`
  - `mp-lancedb`
  - `mp-runtime`
  - `rax.mp`
  - `mp` capability family
  - 默认接入 `AgentCoreRuntime` 的 workflow 路径

### 2. `core_agent_runtime` 当前已经是总装后的正式运行底座

当前这条线里的 `src/agent_core/runtime.ts` 已经同时承接：

- reboot/TAP 基座上的 reviewer / tool-reviewer / provisioner / replay / recovery 主链
- `CMP` 的 readback / recover / dispatch / requestHistory / five-agent TAP bridge
- `CMP` five-agent live wrapper：
  - `captureCmpIcmaWithLlm(...)`
  - `advanceCmpIteratorWithLlm(...)`
  - `evaluateCmpCheckerWithLlm(...)`
  - `materializeCmpDbAgentWithLlm(...)`
  - `servePassiveCmpDbAgentWithLlm(...)`
  - `dispatchCmpDispatcherWithLlm(...)`
  - `deliverPassiveCmpDispatcherWithLlm(...)`
  - `runCmpFiveAgentActiveLiveLoop(...)`
  - `runCmpFiveAgentPassiveLiveLoop(...)`

### 3. `rax.cmp` 当前已经是可继续使用的统一入口

当前这条线已经真实接好并验证：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-five-agent-live-smoke.ts`

白话：

- `rax.cmp` 不再只是低风险表面层
- 它已经能对接当前总装后的 `agent_core` runtime

### 3.1 `rax.mp` 当前也已经成为可继续使用的统一入口

当前这条线已经真实接好并验证：

- `src/rax/mp-config.ts`
- `src/rax/mp-connectors.ts`
- `src/rax/mp-runtime.ts`
- `src/rax/mp-facade.ts`

白话：

- `rax.mp` 不是单独的 demo facade
- 它现在已经能对接真实本地 `LanceDB`、`agent_core` 的 `MP` runtime、以及默认 workflow 主链

### 4. 当前已经完成一轮真实 `core + TAP + CMP` 单 agent 联调

当前已在提供的 OpenAI-compatible 上游 `https://gmn.chuangzuoli.com` 上真实跑通：

- `core -> TAP -> model.infer`
- TAP 三 agent：
  - `reviewer`
  - `tool_reviewer`
  - `TMA`
- `CMP role -> TAP bridge`
- `CMP five-agent live`

白话：

- 当前不只是“代码能编译”
- 而是关键主链已经在真实模型上跑过一轮

### 5. 这轮联调里，`dispatcher` 的真实问题已经查清并修复

这轮最关键的新事实不是“换了个模型就好了”，而是：

- `dispatcher` 规则层没有坏
- 真正的问题在：
  - `model.infer -> OpenAI responses`
  - 把内部 metadata 一起发到了 provider
  - 当前 `gmn` 路由会把这类请求拖成 `524 timeout`

已经落地的修复是：

- 对 OpenAI `responses` 不再发送内部 metadata
- `dispatcher` live prompt 改成更紧凑、更确定的 routing prompt
- `dispatcher` live 请求增加更小的输出 token 上限

白话：

- 这次不是“CMP 五角色自己废了”
- 而是 provider request shape 把 `dispatcher` live 拖死了
- 这个点现在已经修通

### 6. 当前仓库里已经有更适合联调的断点 smoke 入口

当前实际可用的联调入口包括：

- `src/agent_core/single-agent-live-smoke.ts`
- `src/rax/cmp-five-agent-live-smoke.ts`

这两个入口当前已经支持：

- 角色级别断点
- `active / passive` 区分
- `--no-retry`
- `--strict-live`

白话：

- 后面继续联调时，优先做断点测试
- 不要再直接黑盒全链乱跑

### 7. `CMP` 接口已经改成分组 API，后续不要再回到平铺 facade

从这轮开始，`rax.cmp` 的主入口已经改成分组接口：

- `rax.cmp.session.open(...)`
- `rax.cmp.project.bootstrap/readback/recover/smoke(...)`
- `rax.cmp.flow.ingest/commit/resolve/materialize/dispatch/requestHistory(...)`
- `rax.cmp.roles.resolveCapabilityAccess/dispatchCapability/approvePeerExchange(...)`

同时，`AgentCoreRuntime` 已新增 `runtime.cmp` 分组 port：

- `runtime.cmp.project`
- `runtime.cmp.workflow`
- `runtime.cmp.fiveAgent`
- `runtime.cmp.tapBridge`

当前约束：

- `rax` 不应再直接依赖 `agent_core/index.js` 的大 barrel 来获取 CMP 相关类型
- `rax` 应优先依赖 `agent_core/cmp-api/*`、`cmp-runtime/*`、`cmp-types/*` 等明确子入口
- `AgentCoreRuntime` 上旧的扁平 CMP 方法目前仍可作为内部兼容层存在，但新代码不要继续贴着这些平铺方法写

白话：

- 这轮已经把 `CMP` 的“接口形状”从一长串方法改成了结构化分组
- 后面继续拆 `runtime.ts` 时，要顺着这个方向拆，不要再把新能力塞回 `rax.cmp.xxx(...)` 或 `runtime.xxxCmp...(...)` 这种平铺表面

## 当前已验证通过的基线

这条线当前已经真实通过：

- `npm run typecheck`
- `npm run build`
- `npm test`

额外已单独回读过的重点验证：

- `npx tsx --test src/agent_core/runtime.test.ts`
- `npx tsx --test src/agent_core/runtime.mp-workflow.test.ts`
- `npx tsx --test src/agent_core/runtime.cmp-live.test.ts src/agent_core/runtime.cmp-five-agent.test.ts`
- `npx tsx --test src/agent_core/runtime.recovery.test.ts src/agent_core/runtime.replay.test.ts src/agent_core/runtime.replay-continue.test.ts`
- `npx tsx --test src/agent_core/runtime.continue-followups.test.ts src/agent_core/runtime.continue-followups.*.test.ts`
- `npx tsx --test src/rax/cmp-facade.test.ts src/rax/cmp-runtime.test.ts`
- `npx tsx --test src/rax/mp-config.test.ts src/rax/mp-connectors.test.ts src/rax/mp-runtime.test.ts src/rax/mp-facade.test.ts`
- `npx tsx --test src/agent_core/cmp-five-agent/dispatcher-runtime.test.ts src/agent_core/integrations/model-inference.test.ts`
- `npx tsx --test src/agent_core/mp-lancedb/*.test.ts src/agent_core/mp-runtime/*.test.ts`
- `npx tsx --test src/agent_core/capability-package/mp-family-capability-package.test.ts src/agent_core/integrations/rax-mp-adapter.test.ts`

额外已在真实模型上回读过的重点 smoke：

- `single-agent-live-smoke`
  - `core`
  - `tap`
  - `cmp-bridge`
  - `cmp-live`
- `cmp-five-agent-live-smoke`
  - `dispatcher active + strict-live + no-retry`

### 关于 `runtime.continue-followups`

当前已经不再使用原来的超大单文件直跑方式。

当前状态是：

- `src/agent_core/runtime.continue-followups.test.ts`
  - 改成轻量 skip 入口
- focused tests:
  - `runtime.continue-followups.pickup-targeted.test.ts`
  - `runtime.continue-followups.auto-after-verify.test.ts`
  - `runtime.continue-followups.blocked.test.ts`
  - `runtime.continue-followups.waiting-human.test.ts`

原因：

- 在 Node 25 + `tsx` 下，旧的单文件入口会 OOM
- 拆分后已可以稳定验证同一批主链场景

## 当前对“下面能不能继续开发”的判断

当前最诚实的判断是：

- 如果目标是继续做 `CMP + MP + TAP + core_agent_runtime` 的联调、收口与新功能开发
- `integrate/dev-master-cmp` 已经足够承托

也就是说：

- 后面默认直接在这条线继续写
- 不需要再回到 `reboot/blank-slate`
- 也不需要再回到 `cmp/mp`
- 如果目标是继续做 `core + TAP + CMP` 的真实模型联调，这条线现在也已经够用
- 如果目标是继续做 `MP` 的 `LanceDB` 分层记忆、scope/session 连通、以及 package-backed workflow，这条线现在也已经够用

## 当前关于 `MP` 最应该记住的事实

### 1. `MP` 的 storage plane 当前已经固定为 `LanceDB`

当前已经接好：

- 真实本地 `LanceDB` adapter
- in-memory fallback adapter
- `project/global/agent_isolated` 三层表命名与 bootstrap
- `stored section -> MP memory` lowering

白话：

- `MP` 不是继续沿用 `CMP DB`
- 它现在已经有自己的语义记忆落盘层

### 2. `MP` 当前默认三层 scope + session bridge 纪律已经落地

当前已经固定的主要语义是：

- scope:
  - `agent_isolated`
  - `project`
  - `global`
- session mode:
  - `isolated`
  - `bridged`
  - `shared`

并且已经有：

- scope enforcement
- session bridge access
- search planner
- `split / merge / reindex / compact`

### 3. `MP` 当前已经默认进入 capability workflow

当前默认注册进 `AgentCoreRuntime` 的 `mp.*` family 包括：

- `mp.search`
- `mp.materialize`
- `mp.promote`
- `mp.archive`
- `mp.split`
- `mp.merge`
- `mp.reindex`
- `mp.compact`

白话：

- `MP` 现在不是只能通过 `rax.mp` 单独调用
- 它已经进入默认的 `TAP / capability pool / activation factory` workflow

### 4. `MP` 当前已经补了真实主链场景验证

当前已覆盖的默认 workflow 场景包括：

- `mp.materialize -> rax.mp.search`
- `mp.promote -> parent visibility change`
- `mp.archive -> search disappear`

这些场景当前都已经通过：

- `src/agent_core/runtime.mp-workflow.test.ts`

## 当前还需要记住的边界

### 1. 这条线是“当前主线”，不是“删掉所有历史分支也绝对没风险的唯一归档”

白话：

- 当前继续开发，直接用这条线没问题
- 但仓库里其他历史分支是否全部可删，不是当前这份文档要做的承诺

### 2. 后续新功能默认直接贴当前总装线写

后续新需求默认优先复用：

- `agent_core/runtime.ts`
- `TAP` control plane / replay / recovery 主链
- `CMP` workflow / five-agent live wrapper / `rax.cmp`
- 当前已接好的 smoke / live routing 策略

不要再做错的事：

- 不要把 `reboot/blank-slate` 重新当成主要继续线
- 不要把 `cmp/mp` 重新当成主要继续线
- 不要再为“总装”另起新的长期工作分支

### 3. 当前联调 smoke 的模型分级已经写进代码入口

这轮接进去的是联调 smoke 层的模型策略，不是全系统全部任务的最终统一调度。

- `core` smoke:
  - `gpt-5.4`
  - `high`
- TAP 三 agent smoke:
  - `gpt-5.4`
  - `medium`
- `CMP five-agent` smoke:
  - `icma`: `gpt-5.4 + medium`
  - `iterator`: `gpt-5.4 + low`
  - `checker`: `gpt-5.4 + medium`
  - `dbagent`: `gpt-5.4 + medium`
  - `dispatcher`: `gpt-5.4 + high`

## 给后续 Codex 的一句提示

如果后续 Codex 读到这份文件，默认把当前对象理解为：

- “总装主线已经形成，当前在 `integrate/dev-master-cmp` 上继续开发，并且已经完成一轮 `core + TAP + CMP` 真实联调”

而不是：

- 仍在大规模分支整合阶段
- 或仍在等待 `CMP` / `TAP` 的主线接回
