# CMP Non-Five-Agent Part 3 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 3 负责把 `CMP` 的本地 git 工作流做得更接近真人协作：

- branch
- checked ref
- promoted ref
- local PR / merge
- repair / rollback

## 推荐文件列表

- `00-git-realism-freeze.md`
- `01-real-commit-lowering.md`
- `02-checked-promoted-ref-truth.md`
- `03-local-pr-record-and-merge-model.md`
- `04-promotion-and-parent-acceptance.md`
- `05-repair-repeat-rollback-path.md`
- `06-git-realism-smoke-and-evidence.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`

### Wave 2

- `03`
- `04`

### Wave 3

- `05`
- `06`

## 推荐二层 agent

- `Part3 Lead`
- `Git Ref Worker`
- `Local PR Merge Worker`
- `Repair Rollback Worker`

## 最小验收口径

- 本地 git workflow 已具备 checked/promoted/merge/repair 近似真实链
- 证据可回读，可为未来 GitHub 对齐留口子
