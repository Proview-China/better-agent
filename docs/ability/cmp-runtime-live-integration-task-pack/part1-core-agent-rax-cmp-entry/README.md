# CMP Runtime Live Integration Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 1 负责把 `core_agent -> rax.cmp` 的正式接入口接起来。

这里要解决的不是：

- `rax.cmp` facade 存不存在

而是：

- `core_agent` 什么时候、以什么对象、按什么入口正式经过 `rax.cmp`

## 推荐文件列表

- `00-entry-protocol-freeze.md`
- `01-core-agent-cmp-entry-shape.md`
- `02-active-ingress-hook.md`
- `03-passive-history-request-hook.md`
- `04-core-agent-return-and-child-reseed-hook.md`
- `05-runtime-recover-readback-smoke-entry.md`
- `06-cross-part-entry-gates.md`

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

## 二层 agent 角色

### `Part1 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `06`

### `Core Entry Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`

### `Passive And Return Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `03`
  - `04`
  - `05`

## 强依赖提醒

- 不要把 Part 1 做成五个 agent 实现前置包。
- 这里只接 `core_agent` 正式入口，不调五个 agent prompt/config。
- `06` 必须最后收。

## 最小验收口径

- `core_agent -> rax.cmp` 有正式入口。
- active/passive 入口都可从主线程触达。
- core-agent return / child reseed 有稳定接缝。
