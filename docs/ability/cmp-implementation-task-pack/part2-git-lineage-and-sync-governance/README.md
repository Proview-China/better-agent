# CMP Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-20

## 这一包是干什么的

Part 2 负责把项目级 `repo`、branch family、PR/merge/promotion/ref、逐级治理与非越级纪律收成真正可实现的 `git lineage governance backbone`。

## 推荐文件列表

- `00-git-lineage-protocol-freeze.md`
- `01-project-repo-and-branch-family-model.md`
- `02-lineage-registry-and-parent-child-topology.md`
- `03-cmp-commit-and-delta-sync-rules.md`
- `04-pr-merge-promotion-governance.md`
- `05-peer-exchange-and-neighborhood-sync-contract.md`
- `06-checked-ref-and-promoted-ref-lifecycle.md`
- `07-git-sync-runtime-orchestrator.md`
- `08-non-skipping-policy-and-escalation-guard.md`
- `09-fixtures-and-lineage-simulation-pack.md`
- `10-cross-part-integration-hooks.md`
- `11-end-to-end-lineage-sync-and-governance-smoke.md`

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

### `Part2 Lead / Integrator`

- 模型：`gpt-5.4-high`
- ownership：
  - `00`
  - `04`
  - `10`
  - `11`

### `Lineage Model Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`

### `Governance Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `03`
  - `04`
  - `06`

### `Runtime Orchestrator Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `05`
  - `07`
  - `08`

## 三层 agent 角色

### `Protocol Checker`

- 模型：`gpt-5.4-medium`
- 用途：
  - 协议冲突、命名不一致、依赖环检查

### `Fixture/Test Worker`

- 模型：`gpt-5.4-medium`
- 用途：
  - fixtures、simulation cases、golden examples

### `Ref Promotion Worker`

- 模型：`gpt-5.4-high`
- 用途：
  - `checked ref / promoted ref / branch head` 三者关系

### `Guard Escalation Worker`

- 模型：`gpt-5.4-medium`
- 用途：
  - non-skipping policy 与 critical escalation 测试矩阵

## 强依赖提醒

- `00` 没完成前，不要动其它文件。
- `04/06` 没收稳前，Part 4 的 active line 不算真正可联调。
- `10/11` 必须最后收。

## 最小验收口径

- 把“逐级同步、父级中转、merge 不等于 promotion、祖先默认不可见”写成可实现协议。

