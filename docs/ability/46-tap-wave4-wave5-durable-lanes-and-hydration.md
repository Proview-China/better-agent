# TAP Wave4-Wave5 Durable Lanes And Hydration

状态：已落地第一段 durable lane 与 hydration 基线。

更新时间：2026-03-25

## 这一步真正做成了什么

这一步没有一次性把 `Wave 4-5` 全部终结，而是先把最关键的一段打通了：

- reviewer durable lane
- tool_reviewer 最小真 agent 壳
- TMA/provision 资产台账 durability
- TMA planner / executor 最小可恢复过程态
- runtime snapshot / checkpoint / recovery / hydration 的共享接缝

一句白话：

- 现在 TAP 不只是能恢复通用 human gate / replay / activation
- reviewer、tool_reviewer、provision、TMA 也已经开始有自己的 durable lane，并且能被 TAP snapshot 带走再 hydrate 回来

## 当前代码入口

### reviewer durable

- [reviewer-durable-state.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-review/reviewer-durable-state.ts)
- [reviewer-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-review/reviewer-runtime.ts)

### tool_reviewer 最小真 agent 壳

- [tool-review-session.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-tool-review/tool-review-session.ts)
- [tool-review-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-tool-review/tool-review-runtime.ts)

### TMA / provision durable

- [provision-durable-snapshot.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/provision-durable-snapshot.ts)
- [provision-registry.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/provision-registry.ts)
- [provision-asset-index.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/provision-asset-index.ts)
- [provisioner-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/provisioner-runtime.ts)
- [tma-session-state.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/tma-session-state.ts)
- [tma-planner.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/tma-planner.ts)
- [tma-executor.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-provision/tma-executor.ts)

### runtime hydration / recovery 接缝

- [runtime-snapshot.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-runtime/runtime-snapshot.ts)
- [runtime-checkpoint.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-runtime/runtime-checkpoint.ts)
- [runtime-recovery.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/ta-pool-runtime/runtime-recovery.ts)
- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/src/agent_core/runtime.ts)

## 这一步已经成立的能力

### reviewer

- 已有最小 durable state
- 已能 export / hydrate durable snapshot
- 仍保持 vote-only，不持久化 inline grant

### tool_reviewer

- 已有 session
- 已有 action ledger
- 已有 snapshot / restore
- 仍保持 `governance_only` 边界，不执行原任务

### TMA / provision

- registry 已能 serialize / restore
- asset index 已能 serialize / restore
- bundle history 已能 serialize / restore
- planner / executor 已有最小 resumable session state

### runtime

- `TapPoolRuntimeSnapshot` 已开始承载 reviewer/tool_reviewer/provision/TMA 的 durable 子状态
- `AgentCoreRuntime` 已能把这些状态 hydrate 回来
- 已有 runtime 级集成测试证明这件事不是纸面设计

## 当前验证结果

这步已验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/runtime.test.ts src/agent_core/ta-pool-review/*.test.ts src/agent_core/ta-pool-tool-review/*.test.ts src/agent_core/ta-pool-provision/*.test.ts src/agent_core/ta-pool-runtime/runtime-*.test.ts`
- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 这一步还没有完全做完的部分

这一步还没把 `Wave 4-5` 全部终结，剩下的真实缺口主要是：

- tool_reviewer 还没有深度接进 runtime 主链业务路径
- reviewer / tool_reviewer / TMA 的更完整 resume 驱动还可以继续加强
- `three-agent negative boundary tests` 还没有作为独立波次完整收口
- 更重的 activation / replay / human gate “自动续跑”仍可继续细化

所以它当前更准确的定位是：

- `Wave 4-5 durable lane baseline is code-backed`
- 但不是 `Wave 4-5 final closure`

## 一句话收口

这次已经把 TAP 从“只有通用控制面可恢复”推进到了“reviewer / tool_reviewer / TMA / provision 这些角色与资产层开始拥有自己的 durable lane，并能跟着 TAP snapshot 一起 hydrate 回 runtime”的阶段。
