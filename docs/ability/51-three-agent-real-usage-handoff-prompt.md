# Three-Agent Real Usage Handoff Prompt

下面这段 prompt 是给压缩上下文后的新会话用的。

直接复制给新的 Codex 即可：

---

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

当前唯一目标：
继续推进 `TAP` 三个 agent 的真实使用落地，不要串到 `CMP / MP` 或别的 pool。

先锚定对象：

- 主工作树不是这次开发现场
- 真正开发线在：
  `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge`
- 目标分支：
  `reboot/blank-slate`

当前已经推上远端的最近两次关键提交：

- `5d559b0`
  - `推进 TAP 模型推理主链接入并完成 core 联调`
- `6dd29f4`
  - `推进 TAP 三个 agent 默认模型接入并完成联调`

当前已经真实成立：

1. `core_agent -> TAP -> model.infer -> gmn -> gpt-5.4` 已真实跑通
2. `reviewer / tool_reviewer / TMA` 默认已有 model-backed 装配
3. `src/agent_core/**/*.test.ts` 已通过
4. 三个 worker 的 live 验证已经通过：
   - reviewer 返回真实结构化 decision
   - tool_reviewer 返回真实治理摘要
   - TMA 返回真实 build summary / replay rationale

但当前还没有进入“真实使用”阶段定义完成态。

本轮冻结目标不是继续证明“能调模型”，而是：

- 把三 agent 收成真实可用闭环

当前已冻结的关键共识：

- `reviewer` 先总闸
- `tool_reviewer` 收在治理 + 验收
- `TMA` 先收成施工执行器
- `reviewer` 三块都做：
  - 审批拍板
  - 上下文研究
  - 人机沟通
- `reviewer` 只写审批记录，不直接施工
- 除 `human gate` 外尽量自动继续
- `TAP` 是自治灰盒，不是完全黑盒放飞
- `CMP / MP` 很快接入，所以当前不能把临时上下文方案写死
- 完成门槛是：
  - 真实任务可跑
  - 内部有一版精细化调整

必须先读这三份：

- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/50-three-agent-real-usage-outline.md`
- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/three-agent-real-usage-task-pack/README.md`
- `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/reboot-merge/docs/ability/48-tap-final-closure-and-three-agent-outline.md`

当前推荐推进顺序：

1. `00 Real Usage Protocol Freeze`
2. `01 Reviewer Real Usage Mainline`
3. `02 Tool Reviewer Real Usage Mainline`
4. `03 TMA Real Usage Mainline`
5. `04 Cross-Agent Auto Chain`
6. `05 Durable Ledger And User Records`
7. `06 CMP MP Aperture Ready Points`
8. `07 End To End Real Task Closure`

执行要求：

- 继续只在 `reboot-merge` 上工作
- 不碰 `cmp/mp` 主工作树代码
- 主控负责联调、测试、冲突控制和阶段提交
- 优先做真实可跑链路，不要先堆前台
- 继续可以使用多智能体，但不要递归失控

---
