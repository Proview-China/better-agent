# CMP Infra Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 2 负责把 `CMP DB` 真正落到 `PostgreSQL`。

它要解决的不是“给现有 helper 套一层 SQL”，而是把下面这些东西做成真实后端：

- project database bootstrap
- shared control tables
- agent-local hot tables
- schema versioning / migration
- projection/package/delivery persistence
- dbagent runtime sync 与 recovery read model

一句白话：

- Part 2 管的是“`CMP DB` 在 PostgreSQL 里到底怎么活”

## 推荐文件列表

- `00-postgresql-protocol-freeze.md`
- `01-project-database-bootstrap-and-naming.md`
- `02-shared-control-tables-schema.md`
- `03-agent-local-hot-tables-schema.md`
- `04-schema-versioning-and-migration-contract.md`
- `05-projection-persistence-and-state-machine-bridge.md`
- `06-context-package-and-delivery-registry-persistence.md`
- `07-postgresql-adapter-read-write-primitives.md`
- `08-dbagent-runtime-sync-and-transaction-boundary.md`
- `09-recovery-read-model-and-snapshot-hydration.md`
- `10-observability-seed-data-and-fixtures.md`
- `11-part2-integration-gates-and-postgres-smoke.md`

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

### Wave 4

- `09`
- `10`

### Wave 5

- `11`

## 二层 agent 角色

### `Part2 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `08`
  - `11`

### `Postgres Schema Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`
  - `03`
  - `04`

### `Projection Persistence Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `05`
  - `06`
  - `07`

### `Recovery And Ops Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `09`
  - `10`

## 三层 agent 角色

### `Schema Naming Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - DB naming
  - bootstrap inputs
  - table/index layout

### `State Machine Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - projection lifecycle
  - persistence bridge

### `Transaction Boundary Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - dbagent sync
  - transaction scope
  - consistency guard

### `Recovery Read Model Specialist`

- 模型：`gpt-5.4-xhigh`
- 用途：
  - snapshot hydration
  - rehydration read path

### `Postgres Smoke Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - seed data
  - fixtures
  - smoke readback

## 强依赖提醒

- `00` 没完成前，其他文件不要正式开写。
- `01/02/03` 没稳前，不要开 `07`，否则 adapter 缺 schema 锚点。
- `04` 没稳前，不要开 `08/09`，否则 transaction boundary 和 recovery 口径会漂。
- `05/06/07` 没稳前，不要收 `11`。
- 整个 Part 2 必须始终遵守：
  - `PostgreSQL` 只做投影层、索引层、交付层
  - 不做 RAG / embedding / vector retrieval
  - 不抢 `git` 的 truth authority
  - `checker` 判 truth，`DBAgent` 只投影 checked truth

## 与其它 Part 的依赖

- Part 1 依赖：
  - project/repo identity
  - agent lineage naming
- Part 3 需要对齐：
  - package / delivery record
  - ack / retry readback 字段
- Part 4 强依赖：
  - `07`
  - `08`
  - `09`

## 最小验收口径

- 能为项目真实初始化 `CMP DB` 与 schema。
- shared tables 与 agent-local hot tables 有稳定命名和 ownership 规则。
- `CheckedSnapshot -> Projection -> ContextPackage -> DeliveryRegistry` 能真实落盘。
- dbagent runtime sync 与 transaction boundary 明确。
- 至少有一次 postgres bootstrap/readback/smoke 与 integration gate。
