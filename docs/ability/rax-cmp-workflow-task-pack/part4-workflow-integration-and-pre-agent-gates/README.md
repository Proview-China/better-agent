# RAX CMP Workflow Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 4 负责把：

- `core_agent`
- `rax.cmp`
- `cmp-runtime`
- shared infra

真正接成一条工作流，并形成五个 agent 之前的 gate。

## 推荐文件列表

- `00-integration-protocol-freeze.md`
- `01-core-agent-to-rax-cmp-entry.md`
- `02-rax-cmp-to-cmp-runtime-lowering.md`
- `03-active-passive-workflow-entry.md`
- `04-bootstrap-recover-readback-flow.md`
- `05-smoke-and-pre-agent-checklist.md`
- `06-cross-part-integration-gates.md`
- `07-handoff-for-five-agent-stage.md`
- `08-stage-wrap-up.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`

### Wave 2

- `02`
- `03`

### Wave 3

- `04`
- `05`

### Wave 4

- `06`
- `07`
- `08`

## 最小验收口径

- `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 成立。
- 五个 agent 之前的 gate 已明确。
