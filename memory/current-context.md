# Current Context

更新时间：2026-03-25

## 当前分支与提交状态

- 当前工作分支：`cmp/mp`
- 当前已推送到远端的最近提交：
  - `05b2ecc`
  - `完成 CMP 非五-agent 主链收口并接入 section-first 与历史回退`
- 当前工作区仍有未提交内容，但这次主要不是 `CMP` 主线代码，而是：
  - `docs/master.md`
  - `.parallel-worktrees/`
  - `docs/ability/41-*`
  - `docs/ability/42-*`
  - `docs/ability/43-*`
  - `docs/ability/tap-*`
- `.parallel-worktrees/` 仍然是多智能体临时目录，提交前必须继续排除。

## 当前阶段一句话

`CMP` 非五-agent部分已经从“主干能跑但真相层没收死”，推进到：

- `section-first` 已进入主链
- `DB-first + git rebuild fallback` 已进入 `requestHistory`
- `MQ delivery truth` 已进入 dispatch/ack 主线
- recovery reconciliation 已进入恢复链
- `rax.cmp` 已开始像真正的控制台，而不只是 facade 壳

白话：

- 现在 `CMP` 的公共底座基本已经收住了
- 后面主要工作可以开始转向五个 agent 本身

## 当前已经确定的架构事实

### 1. `CMP` 与 `MP`

- `CMP` 使用：
  - `PostgreSQL`
  - `Redis`
  - shared `git_infra`
- `CMP` 不使用 embedding / vector / RAG 作为真相源
- `MP` 后续才使用：
  - `LanceDB`

### 2. `git_infra`

- `git_infra` 是与多智能体系统并行的一层共享协作底座
- `CMP` 只是 `git_infra` 的消费者，不是拥有者
- 每个 agent 都可以和 shared `git_infra` 沟通
- 不是每个 agent 自己带一套 `git_infra`

### 3. 当前优先级

- `CMP` 非五-agent公共底座已基本收口
- 接下来可以把重点逐步转到：
  - 五个 agent 的职责细化
  - 五个 agent 的默认配置
  - 五个 agent 的联调

## 当前代码已经真正落到哪里

### 一、`core_agent -> rax.cmp -> cmp-runtime -> shared infra`

这条主链已经不是样板，而是可运行主链。

当前已成立：

- `rax.cmp` 已总装到：
  - `src/rax/runtime.ts`
  - `src/rax/index.ts`
- `AgentCoreRuntime` 已正式提供：
  - `ingestRuntimeContext(...)`
  - `commitContextDelta(...)`
  - `resolveCheckedSnapshot(...)`
  - `materializeContextPackage(...)`
  - `dispatchContextPackage(...)`
  - `requestHistoricalContext(...)`
- `cmp_action` 已经进入 kernel / transition / runtime loop

### 二、`section-first`

当前已经有并且已经接入主链：

- `src/agent_core/cmp-types/cmp-section.ts`
- `src/agent_core/cmp-runtime/section-ingress.ts`
- `src/agent_core/cmp-runtime/section-rules.ts`
- `src/agent_core/cmp-runtime/materialization.ts`

当前状态：

- ingest 会先生成 exact `Section`
- 再 lower 到 `StoredSection`
- `stored section` 已开始参与 `projection/package` 物化

### 三、历史真相与回退

当前已经有并且已经接入主链：

- `src/agent_core/cmp-runtime/git-rebuild.ts`
- `src/agent_core/cmp-runtime/recovery-reconciliation.ts`
- `src/agent_core/cmp-runtime/runtime-recovery.ts`

当前状态：

- `requestHistory` 已按：
  - `DB-first`
  - projection 缺失时 `git rebuild fallback`
  工作
- fallback 结果会显式标记：
  - `degraded`
  - `truthSource`
  - `fallbackReason`

### 四、MQ delivery truth`

当前已经有并且已经进入主链：

- `src/agent_core/cmp-runtime/mq-lowering.ts`
- `src/agent_core/cmp-runtime/mq-delivery-state.ts`
- `src/agent_core/cmp-runtime/db-lowering.ts`

当前状态：

- dispatch 已开始产出：
  - publish receipt
  - delivery truth
  - runtime delivery state
  - DB projection patch
- ack 已开始回写：
  - Redis truth
  - runtime state
  - DB delivery registry
- runtime 现在已经有：
  - `advanceCmpMqDeliveryTimeouts(...)`
  用于把 delivery timeout 推进到：
  - `retry_scheduled`
  - `expired`

### 五、`rax.cmp` 控制面

当前已经有：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`

当前 `rax.cmp` 已提供：

- `create`
- `bootstrap`
- `readback`
- `recover`
- `ingest`
- `commit`
- `resolve`
- `materialize`
- `dispatch`
- `requestHistory`
- `smoke`

并且已经开始吃：

- `readbackPriority`
- `fallbackPolicy`
- `recoveryPreference`
- `executionStyle`
- `dispatch scope`

当前收口新增：

- `requestHistory` 已尊重 `strict_not_found`
- `recover` 已支持 `dry_run`
- `readback / smoke` 已开始带 recovery summary 与 delivery summary

## 当前验证基线

以下验证已经在当前工作区真实跑过并通过：

- `npm run typecheck`
- `npm run build`
- `npx tsx --test src/agent_core/runtime.test.ts`
- `npx tsx --test src/rax/cmp-facade.test.ts`
- `npx tsx --test src/agent_core/cmp-runtime/*.test.ts`

当前综合结果：

- `src/agent_core/runtime.test.ts`
  - `33 pass / 0 fail`
- `src/rax/cmp-facade.test.ts`
  - `7 pass / 0 fail`
- `src/agent_core/cmp-runtime/*.test.ts`
  - `60+ pass / 0 fail`

## 当前还剩什么没收死

如果严格按“除了五个 agent，其他是不是全完了”来问，答案是：

- `基本收完`
- 但仍有两类尾巴可以继续打磨

### 1. final acceptance gate 还可以再更产品化

现在已经有：

- truth summary
- recovery summary
- delivery summary
- smoke checks

但还可以继续增强成更明确的：

- five-agent-ready gate
- live infra evidence gate
- degraded matrix gate

### 2. `manual control` 还可以继续更深地驱动 runtime 细分行为

现在已经不只是类型字段了，
但如果继续深挖，仍可以进一步细化：

- `readbackPriority` 对 summary 裁决顺序的影响
- `recoveryPreference` 对恢复策略的更深分流
- `fallbackPolicy` 对 passive/history 的更细粒度治理

白话：

- 这些已经不是“缺模块”
- 而是“继续做精做厚”

## 现在最推荐的下一步

除非用户要先继续打磨 final gate，否则当前最推荐下一步已经是：

- 进入五个 agent 的实现与联调

建议顺序：

1. 先定义五个 agent 的默认职责边界
2. 再把它们接进现有 `CMP` 主链
3. 再做和 `TAP` 的更真实串联

