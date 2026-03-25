# TAP Wave3 Backlog Taxonomy Gating

状态：已落地代码与测试。

更新时间：2026-03-25

## 这一步真正做成了什么

这一步把 `Wave 3` 需要的三块控制面补齐了：

- backlog capability audit
- production-like failure taxonomy
- capability availability gating

一句白话：

- 现在 TAP 不只是知道“哪些 formal family 可用”
- 还知道“哪些能力仍然只是待收口、失败怎么分类、最后该放行还是卡住”

## 当前代码入口

位于：

- [backlog-capability-audit.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/backlog-capability-audit.ts)
- [failure-taxonomy.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/failure-taxonomy.ts)
- [availability-gating.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/availability-gating.ts)

## 这一步现在能回答什么

### backlog audit

- 哪些能力仍然只是 `pending_closure`
- 哪些属于 `runtime_thick family`
- 为什么它们还不能算 formal / production-like
- 该先做谁

### failure taxonomy

- 失败属于哪一类：
  - registration gap
  - execution gap
  - health gap
  - evidence gap
  - truthfulness gap
  - boundary gap
  - recovery gap
  - backlog gap
  - transient runtime
  - governance risk
- 每类失败默认应该：
  - `degrade`
  - `retry`
  - `block`
  - `human_gate`

### availability gating

- formal family capability 当前该判成：
  - `baseline`
  - `review_only`
  - `blocked`
- backlog / half-wired capability 当前该判成：
  - `pending_backlog`

## 这一步的工程价值

- formal family、pending backlog、failure taxonomy、gating 现在终于是同一套口径
- 后面 reviewer / tool_reviewer / TMA 的 durable closure 可以直接引用这层，不需要重新发明一套失败分类

## 当前验证结果

这步已经验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/tap-availability/*.test.ts`
- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 当前还没做的事

这一步还没有进入：

- reviewer durable closure
- tool_reviewer 真 agent 化与 durable chain
- TMA asset ledger / session re-entry / builder resume
- activation / replay / human gate recovery closure

所以它当前的真实定位是：

- `Wave 3 control-plane closure is code-backed`
- 但 production closure 后半段 durable 主链还在下一波
