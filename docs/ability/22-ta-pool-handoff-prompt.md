# T/A Pool Handoff Prompt

状态：上下文压缩后交接用 prompt。

更新时间：2026-03-18

## 用法

如果当前会话要做上下文压缩，后续可直接把下面这段 prompt 原样复制给压缩后的新上下文模型。

目标不是重新介绍整个仓库，而是让新上下文下的你，快速、准确地接上当前阶段的工作。

---

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

当前唯一目标：

继续推进 `T/A Pool` 与 `raw_agent_core` 的 runtime assembly 主线，不要串到别的任务。

请先接受下面这些当前事实：

1. 当前阶段判断
- `Capability Interface v1` 已成立
- 第一个 `T/A Pool` 控制面也已成立
- 第一个 pool 已接进 `raw_agent_core` 预留接口
- 但完整治理和默认主路径切换都还没结束

2. 当前相关代码层
- `src/agent_core/ta-pool-types/**`
- `src/agent_core/ta-pool-model/**`
- `src/agent_core/ta-pool-review/**`
- `src/agent_core/ta-pool-provision/**`
- `src/agent_core/ta-pool-safety/**`
- `src/agent_core/ta-pool-context/**`
- `src/agent_core/ta-pool-runtime/**`

3. 当前 `AgentCoreRuntime` 已新增的 T/A 能力面
- `resolveTaCapabilityAccess(...)`
- `dispatchTaCapabilityGrant(...)`
- `dispatchCapabilityIntentViaTaPool(...)`
- `taControlPlaneGateway`

4. 当前已经打通的 runtime assembly 路径
- review -> dispatch
- review -> provisioning
- safety -> interrupt

5. 当前还没有完成的事
- 还没有把所有 capability intent 默认切到 `T/A Pool` 主路径
- reviewer 还没有接真实项目状态、记忆池、包装机
- provisioner 还只是 mock builder
- safety 还没有接完整人工审批链

6. 当前阶段最重要的边界
- `CapabilityPool` 继续做 execution plane
- `T/A Pool` 做 control plane
- reviewer / provisioner / safety 不应直接污染 raw kernel
- context aperture 已留坑，但当前不要提前做完整治理 system

7. 当前验证基线
- `npm run typecheck` 通过
- `npx tsx --test src/agent_core/**/*.test.ts` 通过
- 当前 `agent_core` 测试：`115 pass / 0 fail`

8. 先读这些文档再继续
- `docs/ability/20-ta-pool-control-plane-outline.md`
- `docs/ability/21-ta-pool-implementation-status.md`
- `docs/ability/22-ta-pool-handoff-prompt.md`
- `docs/ability/ta-pool-task-pack/README.md`
- `memory/current-context.md`
- `memory/worklog/2026-03-18-ta-pool-first-implementation.md`
- `memory/worklog/2026-03-18-ta-pool-runtime-assembly.md`

9. 你现在的默认工作方式
- 先回读当前代码事实
- 再确认当前唯一目标
- 然后继续推进 `T/A Pool` 的 runtime assembly 与治理收口
- 除非用户改目标，否则不要跳回纯设计讨论

---

## 一句话压缩版

Praxis 已完成第一个 `T/A Pool` 控制面的第一版代码落地，并把它接进了 `raw_agent_core` 预留接口；当前系统已打通基础 runtime assembly，但还没有完成默认主路径切换和高层治理接入。
