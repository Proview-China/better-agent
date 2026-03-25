# RAX CMP Workflow Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这包任务是干什么的

这一包不是直接去实现五个 `CMP` agent，而是先把 `CMP` 融入当前工作流。

目标是：

1. 做出 `rax.cmp` facade。
2. 把 `CMP` 接进 shared `git_infra`、`PostgreSQL`、`Redis`。
3. 显式化 `Section / StoredSection / Rules`。
4. 让 `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 成立。

一句白话：

- 这是五个 agent 之前的地基包

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- [20-ta-pool-control-plane-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/20-ta-pool-control-plane-outline.md)
- [24-tap-mode-matrix-and-worker-contracts.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/24-tap-mode-matrix-and-worker-contracts.md)
- [25-tap-capability-package-template.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/25-tap-capability-package-template.md)
- [27-tap-runtime-completion-blueprint.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/27-tap-runtime-completion-blueprint.md)
- [36-rax-cmp-workflow-integration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/36-rax-cmp-workflow-integration-outline.md)
- [35-cmp-infra-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/35-cmp-infra-closure-outline.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)

## 本轮冻结共识

- `git_infra` 是共享协作底座，不是 `CMP` 私有系统。
- 每个 agent 可以和 shared `git_infra` 沟通，但不应各带一套 `git_infra`。
- `rax.cmp` 是 facade / runtime shell / configuration layer。
- 五个 agent 的细调排在这包之后。
- `Section / StoredSection / Rules` 必须先显式化。

## 四个部分

### Part 1

- 目录：
  - [part1-rax-cmp-facade-and-config/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/part1-rax-cmp-facade-and-config/README.md)
- 目标：
  - 做出 `rax.cmp` facade、config、startup shell

### Part 2

- 目录：
  - [part2-shared-git-infra-and-backend-connectors/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/part2-shared-git-infra-and-backend-connectors/README.md)
- 目标：
  - 把 `CMP` 正式接到 shared `git_infra / pg / redis`

### Part 3

- 目录：
  - [part3-section-stored-section-and-rules/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/part3-section-stored-section-and-rules/README.md)
- 目标：
  - 显式化 `Section / StoredSection / Rules`

### Part 4

- 目录：
  - [part4-workflow-integration-and-pre-agent-gates/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/part4-workflow-integration-and-pre-agent-gates/README.md)
- 目标：
  - 让 `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 成立，并形成五个 agent 之前的 gate

## 全局串并行顺序

### Global Wave 0

- 主线程冻结本 README
- 四个二层 agent 只读准备

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
  - `01/02/03`
- Part 2:
  - `01/02`
- Part 3:
  - `01/02`
- Part 4:
  - `01`

### Global Wave 3

- Part 1:
  - `04/05`
- Part 2:
  - `03/04/05`
- Part 3:
  - `03/04`
- Part 4:
  - `02/03`

### Global Wave 4

- Part 2:
  - `06/07`
- Part 3:
  - `05/06`
- Part 4:
  - `04/05`

### Global Wave 5

- Part 4:
  - `06/07/08`

## 强依赖提醒

- `rax.cmp` facade 没稳前，不要开始五个 agent 配置。
- shared `git_infra` connector 没稳前，不要把 `CMP` 继续写成私有 git 系统。
- `Section / StoredSection / Rules` 没稳前，不要锁死五个 agent 分工。
- 最终 gate 必须最后收。

## 推荐 agent 拓扑

### 主线程

- 数量：`1`
- 模型：`gpt-5.4-high`
- 责任：
  - 全局协议收口
  - 跨 Part 依赖仲裁
  - 最终联调与门控

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
  - 普通实现：`gpt-5.4-high`
  - doc/fixture/smoke：`gpt-5.4-medium`
  - 高耦合 rules/runtime 整合：`gpt-5.4-xhigh`

## 一句话收口

`RAX CMP workflow task pack` 处理的是五个 agent 之前最重要的一步：先把 `CMP` 接进当前工作流。
