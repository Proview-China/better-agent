# CMP Final Closure Task Pack

状态：最终收尾任务包。

更新时间：2026-03-30

## 这包任务处理什么

这包任务处理的是 `CMP` 的最终收尾，
不是继续做概念澄清。

这包任务的目标是：

- 把五个 agent 做成真实 loop
- 把核心对象模型真正落成代码
- 把三类包 schema 落成代码
- 把 `CMP -> TAP` 从 resolve 推进到真实审批/执行路径
- 把真实 infra、观测、recovery 收到可持续运行状态

## 当前唯一目标

把 `CMP` 从：

- 主链已成立
- 五角色配置与协议已成立
- `TAP profile` 编译层已成立

推进到：

- 五角色真实工作系统完成态

## 总执行顺序

### Wave 0 / Program Control

- 锁死工程纪律与收口顺序

### Wave 1 / Core Object Model

- 收 `request / section / snapshot / package`

### Wave 2 / Five-Agent Real Loop

- 收五个角色的真实 loop 和 LLM I/O

### Wave 3 / Bundle Schema And Governance

- 收三类包 schema 与路由治理

### Wave 4 / TAP Deep Bridge

- 收 role-specific 审批/执行桥

### Wave 5 / Live Infra And Observability

- 收 compose / live infra / acceptance gate

## 超多智能体调度原则

当前允许的资源上限非常高：

- 最多 `1024` 个 agents
- 最深 `9` 层

但第一版收尾阶段不建议盲目打满。

推荐的真实调度策略是：

1. 常态并发优先控制在：
- `16-48` 个 agent

2. 常态深度优先控制在：
- `3-4` 层

3. 只有满足下面条件时才继续向下钻：
- write ownership 非常清晰
- 验收责任已经明确
- 联调责任已经明确
- 不会和主线程收口文件冲突

4. 主线程永远只做：
- 总调度
- 依赖图维护
- runtime / rax 收口
- 最终联调
- 最终验收

## 多智能体 ownership 规则

### 一级 ownership

一级 worker 应只拥有下面某一条主线之一：

1. 对象模型
2. `ICMA`
3. `Iterator`
4. `Checker`
5. `DBAgent`
6. `Dispatcher`
7. bundle schema
8. `TAP` deep bridge
9. live infra / compose
10. recovery / acceptance gate

### 二级 ownership

一级 worker 如果继续下钻，只能按“子对象或子流程”继续拆。

例如：

- `DBAgent`
  - request state
  - section finalization
  - package materialization
  - snapshot attach

- `Dispatcher`
  - core return
  - child seed
  - peer exchange

- live infra
  - compose topology
  - postgres
  - redis
  - git service layer
  - observability

### 三级 ownership

三级 worker 只允许处理：

- 某个明确对象的 schema
- 某个明确测试文件
- 某个明确 infra service

不要让三级 worker 跨多个收口面写代码。

## 主线程独占收口面

- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.ts)
- [runtime.test.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.test.ts)
- [cmp-facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-facade.ts)
- [cmp-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-runtime.ts)
- [cmp-types.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-types.ts)

## Part Map

- [part0-program-control/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part0-program-control/README.md)
- [part1-core-object-model-and-section-lifecycle/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part1-core-object-model-and-section-lifecycle/README.md)
- [part2-five-agent-real-loop-and-llm-io/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part2-five-agent-real-loop-and-llm-io/README.md)
- [part3-bundle-schema-and-route-governance/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part3-bundle-schema-and-route-governance/README.md)
- [part4-tap-deep-bridge-and-role-enforcement/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part4-tap-deep-bridge-and-role-enforcement/README.md)
- [part5-live-infra-compose-and-observability/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part5-live-infra-compose-and-observability/README.md)
- [part6-recovery-and-acceptance-gate/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part6-recovery-and-acceptance-gate/README.md)
- [part7-multi-agent-orchestration/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/part7-multi-agent-orchestration/README.md)

## 推荐串并行顺序

### 第一组：必须先串行开路

1. `part0-program-control`
2. `part1-core-object-model-and-section-lifecycle`

原因：

- 没有对象模型，后面所有角色 loop 和 bundle schema 都会反复返工

### 第二组：可以并行展开

在 `part1` 基本稳定后，同时开：

1. `part2-five-agent-real-loop-and-llm-io`
2. `part3-bundle-schema-and-route-governance`
3. `part4-tap-deep-bridge-and-role-enforcement`

### 第三组：带真实依赖的收尾

在 `part2-4` 出第一轮稳定产物后，再开：

1. `part5-live-infra-compose-and-observability`
2. `part6-recovery-and-acceptance-gate`

### 第四组：主线程最终收口

最后由主线程统一：

1. 对齐 runtime / rax
2. 跑全量联调
3. 评估 acceptance gate
4. 准备 commit

## 完成定义

如果下面任一项还没做到，就不算这次 `CMP` 最终收尾完成：

1. `request / section / package / snapshot` 没变成正式对象
2. 五角色还只是配置对象，没有真实 loop 语义
3. 三类包还没 schema 化
4. `CMP -> TAP` 还只停在 resolution
5. compose + live infra 没跑通
6. recovery 没覆盖完整主链对象
7. `rax.cmp` 还不能稳定看清关键状态
