# TAP Wave2 Formal Family Availability Checks

状态：已落地代码与测试。

更新时间：2026-03-25

## 这一步真正做成了什么

这一步把 `Wave 2` 要做的 formal family availability checks 写成了正式代码，不再只是任务标题。

对应到 formal family：

- `foundation`
- `websearch`
- `skill`
- `mcp`

现在每个 family 都已经有自己的 family-level report 生成入口。

## 当前代码入口

位于：

- [family-check-types.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/family-check-types.ts)
- [family-check-assembly.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/family-check-assembly.ts)
- [foundation-family-check.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/foundation-family-check.ts)
- [websearch-family-check.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/websearch-family-check.ts)
- [skill-family-check.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/skill-family-check.ts)
- [mcp-family-check.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/tap-availability/mcp-family-check.ts)

## 每组 family 现在能检查什么

### foundation

- 本地 read/write/test/doc tooling 稳定性
- registration / prepare / execute / activation factory
- runtime health hook 缺口是否只是 warning

### websearch

- `search.ground` 的 register / prepare / execute / health / smoke
- failure taxonomy
- grounding truthfulness
- provider / support-route 差异

### skill

- `skill.use / skill.mount / skill.prepare`
- progressive loading
- carrier coverage
- activation / replay coverage
- managed lifecycle 与 family 本体边界

### mcp

- read 层：`mcp.listTools / mcp.readResource`
- call 层：`mcp.call`
- native execute 层：`mcp.native.execute`
- truthfulness
- support matrix
- provider-native 与 shared-runtime 边界

## 这一步最大的工程价值

- `Wave 2` 现在不再只是“逐个 family 看起来差不多”
- 而是已经有统一的 family report 模型
- 也有一份 live family assembly -> availability report -> family check 的总装入口

一句白话：

- 现在我们已经可以从一份 live TAP baseline，直接生成四组 family 的 production-like 检查结果

## 当前验证结果

这步已验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/tap-availability/*.test.ts`

后续主控还会继续跑：

- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 当前还没做的事

这一步还没有进入：

- half-wired / pending-closure capability backlog 审计
- reviewer / tool_reviewer / TMA durable closure
- activation / replay / human gate recovery closure

所以它当前的真实定位是：

- `Wave 2 formal family checks are code-backed`
- 但整条 production closure 还没结束
