# CMP Non-Five-Agent Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 2 负责把：

- 所有 ingest materials 先进入 `Section`
- 再由 `Rules` 推到 `StoredSection` 和后续主链

## 推荐文件列表

- `00-section-first-protocol-freeze.md`
- `01-exact-section-ingress.md`
- `02-stored-section-lowering.md`
- `03-rule-pack-evaluation-mainline.md`
- `04-section-driven-commit-materialize-history.md`
- `05-cross-part-section-gates.md`

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

## 推荐二层 agent

- `Part2 Lead`
- `Section Ingress Worker`
- `Rules Mainline Worker`

## 最小验收口径

- 所有 ingest 先进入 `Section`
- `StoredSection` 和 `Rules` 已进入主运行链
- 后续 commit/materialize/history 已开始吃这层对象
