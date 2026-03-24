# CMP Infra Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 1 负责把项目级 `git infra` 做成 `CMP` 可真实依赖的底座。

这里不是继续写 in-memory orchestrator，而是把下面这些东西钉成真实 git runtime：

- project repo bootstrap
- branch family bootstrap
- agent lineage -> branch wiring
- checked ref / promoted ref 持久化约定
- commit / PR / merge driver 边界
- git adapter 与 runtime readback

一句白话：

- Part 1 管的是“项目 repo 到底怎么起、怎么管、怎么回读”

## 推荐文件列表

- `00-git-infra-protocol-freeze.md`
- `01-project-repo-bootstrap-contract.md`
- `02-branch-family-bootstrap-and-naming.md`
- `03-agent-lineage-to-branch-wiring.md`
- `04-cmp-branch-head-and-worktree-state.md`
- `05-checked-ref-and-promoted-ref-storage.md`
- `06-commit-pr-merge-driver-boundary.md`
- `07-git-adapter-interface-and-error-model.md`
- `08-bootstrap-and-recovery-readback.md`
- `09-runtime-integration-hooks-and-fixtures.md`
- `10-live-git-bootstrap-smoke-and-governance-tests.md`
- `11-doc-readback-and-cross-part-gates.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`
- `03`

### Wave 2

- `04`
- `05`
- `06`

### Wave 3

- `07`
- `08`
- `09`

### Wave 4

- `10`
- `11`

## 二层 agent 角色

### `Part1 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `07`
  - `11`

### `Git Bootstrap Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`
  - `03`

### `Git State And Ref Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - `05`
  - `06`

### `Git Runtime Bridge Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `08`
  - `09`
  - `10`

## 三层 agent 角色

### `Naming And Layout Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - repo/branch naming
  - bootstrap fixtures

### `Ref Lifecycle Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - checked ref / promoted ref / branch head 三者关系

### `Git Adapter Contract Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - adapter boundary
  - error model
  - readback contract

### `Live Smoke And Gate Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - live bootstrap smoke
  - governance test matrix

## 强依赖提醒

- `00` 不稳，其他都不能开。
- `01/02` 不稳，不能冻结 project bootstrap 输入输出。
- `03` 不稳，不能冻结 agent 派生时的 branch runtime 规则。
- `05` 不稳，Part 4 不能把 git readback 当 durable recovery 依据。
- `07` 必须等 `01-06` 收稳再写，否则 git adapter 很容易抽坏。
- `10/11` 必须最后收，它们是 live bootstrap 和跨 Part gate。

## 与其它 Part 的依赖

- Part 2 依赖：
  - project bootstrap naming
  - project identity / agent identity 对齐
- Part 3 依赖：
  - project bootstrap readback
  - runtime fixture identity
- Part 4 强依赖：
  - `05`
  - `07`
  - `08`
  - `09`

## 最小验收口径

- 能为新项目真实初始化 repo 与 branch family。
- 能把 agent lineage 正确映射到 `work/cmp/mp/tap` 分支族。
- checked ref / promoted ref / branch head 有可回读存储口径。
- git adapter 的输入输出、错误模型和恢复读回路径稳定。
- 至少有一次 live git bootstrap smoke 与治理回归。
