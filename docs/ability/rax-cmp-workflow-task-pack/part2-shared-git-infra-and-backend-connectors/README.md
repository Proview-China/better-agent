# RAX CMP Workflow Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 2 负责把 `CMP` 正式接入 shared `git_infra / PostgreSQL / Redis`。

## 推荐文件列表

- `00-connector-protocol-freeze.md`
- `01-shared-git-infra-connector.md`
- `02-postgresql-connector-and-project-db-profile.md`
- `03-redis-connector-and-namespace-profile.md`
- `04-bootstrap-readback-lowering.md`
- `05-error-boundary-and-repair-path.md`
- `06-smoke-and-live-connector-matrix.md`
- `07-cross-part-gates.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`

### Wave 2

- `03`
- `04`
- `05`

### Wave 3

- `06`
- `07`

## 最小验收口径

- `CMP` 已明确通过 connector 使用 shared `git_infra`。
- `pg/redis` connector 已成型。
