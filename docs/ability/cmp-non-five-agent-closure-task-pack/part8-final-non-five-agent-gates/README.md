# CMP Non-Five-Agent Part 8 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 8 负责收 `CMP` 自己的 final non-five-agent acceptance gates。

这里不是做五个 agent，而是明确：

- 什么时候可以说 `CMP` 自己已经收口
- 什么时候才适合进入五个 agent 阶段

## 推荐文件列表

- `00-final-gate-freeze.md`
- `01-end-to-end-smoke-matrix.md`
- `02-degraded-matrix.md`
- `03-git-realism-evidence.md`
- `04-readback-and-rebuild-evidence.md`
- `05-manual-control-evidence.md`
- `06-non-five-agent-acceptance-contract.md`
- `07-handoff-to-five-agent-stage.md`
- `08-stage-wrap-up.md`

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

### Wave 4

- `07`
- `08`

## 推荐二层 agent

- `Part8 Lead`
- `Smoke Matrix Worker`
- `Evidence Worker`
- `Handoff Worker`

## 最小验收口径

- `CMP` 自己的 final gate 已明确
- 有证据说明还没到五个 agent，或已经到五个 agent
- 下一阶段 handoff 不再靠口头记忆
