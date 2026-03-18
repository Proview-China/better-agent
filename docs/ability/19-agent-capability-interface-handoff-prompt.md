# Agent Capability Interface Handoff Prompt

状态：上下文压缩后交接用 prompt。

更新时间：2026-03-18

## 用法

如果当前会话要做上下文压缩，后续可直接把下面这段 prompt 原样复制给压缩后的新上下文模型。

目标不是重新介绍整个仓库，而是让新上下文下的你，快速、准确地接上当前阶段的工作。

---

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

当前唯一目标：

继续推进 `agent_core` 的统一能力接口与能力池主线，不要串到别的任务。

请先接受下面这些当前事实：

1. 仓库当前状态
- 分支：`reboot/blank-slate`
- 这轮“能力接口第一版实现”已经提交并推送到同名远端分支
- 当前相关工作不是设计稿，而是已经有代码落地

2. 当前阶段判断
- `Capability Interface v1` 已成立
- 但完整迁移还没结束
- 新旧路径目前并存

3. 已经落地的代码层
- `src/agent_core/capability-types/**`
- `src/agent_core/capability-model/**`
- `src/agent_core/capability-invocation/**`
- `src/agent_core/capability-result/**`
- `src/agent_core/capability-gateway/**`
- `src/agent_core/capability-pool/**`
- `src/agent_core/integrations/model-inference-adapter.ts`
- `src/agent_core/integrations/rax-websearch-adapter.ts`
- `src/agent_core/integrations/rax-mcp-adapter.ts`
- `src/agent_core/integrations/rax-skill-adapter.ts`

4. `AgentCoreRuntime` 当前已新增的新能力面
- `capabilityPool`
- `capabilityGateway`
- `registerCapabilityAdapter(...)`
- `dispatchCapabilityPlan(...)`
- `dispatchCapabilityIntentViaGateway(...)`

5. 当前仍保留的旧路径
- `CapabilityPortBroker`
- `registerCapabilityPort(...)`
- `dispatchCapabilityIntent(...)`
- 旧的 `agent_core -> rax-port` 路径
- `runUntilTerminal()` 仍主要走旧的最小直问直答闭环

6. 当前验证基线
- `npm run typecheck` 通过
- `npx tsx --test src/agent_core/**/*.test.ts` 通过
- 当前 `agent_core` 测试：`65 pass / 0 fail`
- `npm test` 通过
- 当前仓库级测试：`156 pass / 0 fail`

7. 当前最应该继续推进的方向
- 继续做 `runtime assembly`
- 逐步让 `AgentCoreRuntime` 从旧 `CapabilityPortBroker` 主路径迁移到新的 `KernelCapabilityGateway + CapabilityPool`
- 继续把 `model inference` 主闭环往统一 adapter 路径回收
- 保持兼容，不要粗暴删除旧路径

8. 这轮最重要的约束
- 不要把 provider-specific 细节重新漏回 kernel-facing 层
- 不要把治理层审批系统提前塞进 pool 第一版
- 不要串到别的仓库任务
- 继续优先维持：
  - 公共语言在上，provider lowering 在下
  - 冷路径丰富，热路径极薄
  - 热插拔走 generation / drain

9. 先读这些文档再继续
- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `docs/ability/18-agent-capability-interface-implementation-status.md`
- `docs/ability/agent-capability-interface-task-pack/README.md`
- `memory/current-context.md`
- `memory/worklog/2026-03-18-agent-capability-interface-implementation.md`

10. 你现在的默认工作方式
- 先回读当前代码事实
- 再确认当前唯一目标
- 然后继续推进“统一能力接口迁移收口”
- 除非用户改目标，否则不要重新回到纯设计讨论

---

## 一句话压缩版

Praxis 已完成 `Capability Interface v1` 的第一版代码落地与验证；现在系统处于“新接口已成立、runtime 部分接入、旧路径尚未完全退役”的迁移阶段，下一步重点是继续收口 `runtime assembly`。
