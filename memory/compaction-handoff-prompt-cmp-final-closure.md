# CMP Final Closure Handoff Prompt

下面是一份给压缩上下文后的新会话直接使用的 handoff prompt。

你可以在压缩后把下面整段直接发给新的模型：

---

当前唯一目标是继续在 `/home/proview/Desktop/Praxis_series/Praxis` 的 `cmp/mp` 分支上推进 `CMP` 最终收尾，不要跳回 `MP`，也不要跳回非五-agent底座。

请先读取并对齐下面这些文件：

- [memory/current-context.md](/home/proview/Desktop/Praxis_series/Praxis/memory/current-context.md)
- [docs/ability/44-cmp-five-agent-implementation-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/44-cmp-five-agent-implementation-outline.md)
- [docs/ability/45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md)
- [docs/ability/46-cmp-final-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/46-cmp-final-closure-outline.md)
- [docs/ability/cmp-final-closure-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/README.md)
- [docs/ability/cmp-final-closure-task-pack/part0-program-control/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part0-program-control/README.md)
- [docs/ability/cmp-final-closure-task-pack/part1-core-object-model-and-section-lifecycle/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part1-core-object-model-and-section-lifecycle/README.md)
- [docs/ability/cmp-final-closure-task-pack/part2-five-agent-real-loop-and-llm-io/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part2-five-agent-real-loop-and-llm-io/README.md)
- [docs/ability/cmp-final-closure-task-pack/part3-bundle-schema-and-route-governance/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part3-bundle-schema-and-route-governance/README.md)
- [docs/ability/cmp-final-closure-task-pack/part4-tap-deep-bridge-and-role-enforcement/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part4-tap-deep-bridge-and-role-enforcement/README.md)
- [docs/ability/cmp-final-closure-task-pack/part5-live-infra-compose-and-observability/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part5-live-infra-compose-and-observability/README.md)
- [docs/ability/cmp-final-closure-task-pack/part6-recovery-and-acceptance-gate/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part6-recovery-and-acceptance-gate/README.md)

当前已经确认的关键事实：

1. `CMP` 非五-agent底座已经基本收口。
2. `core_agent -> rax.cmp -> cmp-runtime -> five-agent runtime` 已经打通。
3. 五个角色固定为：
   - `ICMA`
   - `Iterator`
   - `Checker`
   - `DBAgent`
   - `Dispatcher`
4. 五角色配置面、受控协作协议、角色级 `TAP profile` 编译层、`rax.cmp` 可见性已经进主链。
5. 当前不再只是做配置，而是要把 `CMP` 收成真实运行系统。

当前已经冻结的关键设计口径：

- 五角色第一版采用“规则 + 模型混合”
- `ICMA` 接全量会话面，先生成 `pre-section`
- `Checker` 做 section 级拆分/合并/去噪/精裁
- `DBAgent` 是 `section / package / snapshot / request state` 总控，收候选，出定版
- `Dispatcher` 负责三类包的最终路由
- `Request` 是独立主对象
- `Section` 生命周期：
  - `raw`
  - `pre`
  - `checked`
  - `persisted`
- `Package` 由 persisted section 派生
- recovery 至少覆盖：
  - `request`
  - `section`
  - `package`
  - `snapshot`
- 真 infra 方向偏：
  - `PostgreSQL`
  - `Redis`
  - `Git 接入/服务层`
  - 日志
  - 状态面板

压缩后回来，直接按下面顺序推进：

1. 先做对象模型收口：
   - `request / section / package / snapshot`
2. 再做五角色真实 loop 与 LLM I/O
3. 再做三类包 schema 与路由治理
4. 再做 `CMP -> TAP` 深执行链
5. 最后做 compose + live infra + observability + acceptance gate

要求：

- 使用中文
- 不要跳回 `MP`
- 不要跳回非五-agent底座
- 直接按 `46-*` 总纲和 `cmp-final-closure-task-pack` 施工
- 遇到真正有隐含后果的分叉再问用户

---
