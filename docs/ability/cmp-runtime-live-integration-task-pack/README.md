# CMP Runtime Live Integration Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这包任务是干什么的

这包任务专门处理：

- `core_agent -> rax.cmp -> cmp-runtime -> shared infra`

这条链的正式接入、真实 lowering、联调和五个 agent 前置关口。

它不是：

- 五个 agent 的 prompt/config 微调包
- 新一轮 CMP 原理讨论包
- 单独的 TAP 扩写包

一句白话：

- 这是“五个 agent 开工前，先把底座和主链焊死”的任务包

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md)
- [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- [35-cmp-infra-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/35-cmp-infra-closure-outline.md)
- [36-rax-cmp-workflow-integration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/36-rax-cmp-workflow-integration-outline.md)
- [37-tap-first-wave-capability-intake-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/37-tap-first-wave-capability-intake-outline.md)
- [39-cmp-runtime-live-integration-and-tap-bridge-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/39-cmp-runtime-live-integration-and-tap-bridge-outline.md)
- `memory/current-context.md`

## 本轮冻结共识

- `CMP` 继续使用：
  - shared `git_infra`
  - `PostgreSQL`
  - `Redis`
- `CMP` 不回退到 embedding / vector / RAG 真相源。
- `MP` 仍然不混进这轮实现。
- 五个 agent 的细调和真实 prompt/config 仍然延后。
- `TAP` 在这轮里只承担：
  - 最小 capability 供给
  - 外围配置供给
  - 不承担 `CMP` 历史主干

## 四个部分

### Part 1

- 目录：
  - [part1-core-agent-rax-cmp-entry/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-runtime-live-integration-task-pack/part1-core-agent-rax-cmp-entry/README.md)
- 目标：
  - 把 `core_agent -> rax.cmp` 的正式入口接起来

### Part 2

- 目录：
  - [part2-runtime-lowering-and-shared-infra-readback/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-runtime-live-integration-task-pack/part2-runtime-lowering-and-shared-infra-readback/README.md)
- 目标：
  - 把 `cmp-runtime` 的关键动作 lower 到 shared infra 并补齐 readback

### Part 3

- 目录：
  - [part3-cmp-tap-minimum-supply-bridge/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-runtime-live-integration-task-pack/part3-cmp-tap-minimum-supply-bridge/README.md)
- 目标：
  - 把 `CMP <-> TAP` 的最小能力与外围供给接缝接起来

### Part 4

- 目录：
  - [part4-final-integration-gates-before-five-agents/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-runtime-live-integration-task-pack/part4-final-integration-gates-before-five-agents/README.md)
- 目标：
  - 收五个 agent 开工前的 final integration gates

## 全局串并行顺序

### Global Wave 0

- 主线程冻结本 README
- 4 个二层 agent 全部只读准备

### Global Wave 1

- Part 1:
  - `00`
- Part 2:
  - `00`
- Part 3:
  - `00`
- Part 4:
  - `00`

### Global Wave 2

- Part 1:
  - `01/02`
- Part 2:
  - `01/02`
- Part 3:
  - `01`
- Part 4:
  - `01`

### Global Wave 3

- Part 1:
  - `03/04`
- Part 2:
  - `03/04`
- Part 3:
  - `02/03`
- Part 4:
  - `02`

### Global Wave 4

- Part 2:
  - `05/06`
- Part 3:
  - `04/05`
- Part 4:
  - `03/04`

### Global Wave 5

- Part 1:
  - `05/06`
- Part 2:
  - `07`
- Part 3:
  - `06/07`
- Part 4:
  - `05`

### Global Wave 6

- Part 4:
  - `06/07/08`

## 强依赖提醒

- `core_agent -> rax.cmp` 没稳前，不要声称 CMP 已正式接入主线程。
- Part 2 的真实 lowering 没稳前，不要声称 shared infra 已正式可用。
- `Section / StoredSection / Rules` 没进主链前，不要开始五个 agent 的实现。
- Part 3 的最小能力供给没稳前，不要把后续五个 agent 写成自己搓工具。
- Part 4 必须最后收。

## 推荐 agent 拓扑

### 主线程

- 数量：`1`
- 模型：`gpt-5.4-high`
- 责任：
  - 冻结本包协议
  - 处理跨 Part 依赖
  - 控制每一波放行
  - 最终联调、测试与验收门控

### 二层 agent

- 数量：`4`
- 默认模型：`gpt-5.4-high`
- ownership：
  - `Part1 Lead`
  - `Part2 Lead`
  - `Part3 Lead`
  - `Part4 Lead`

### 三层 agent

- 建议上限：`8-12`
- 默认模型：
  - 正常编码、runtime 接线、测试补齐：`gpt-5.4-high`
  - 文档、fixture、smoke、readback：`gpt-5.4-medium`
  - recovery、rules lowering、cross-runtime consistency：`gpt-5.4-xhigh`

## 一句话收口

这包任务处理的是五个 agent 之前最关键的一轮：让 `CMP` 真接进系统，并开始拿到 `TAP` 的最小能力供给。
