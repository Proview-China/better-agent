# CMP Infra Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 4 负责把前 3 个 infra part 真正接回 runtime 主链，并且把 bootstrap、checkpoint/recovery、verification gate 收口。

这包不直接实现五个 agent 本身，而是负责五个 agent 真正接入前必须具备的运行底座：

- runtime backend interface
- `AgentCoreRuntime` 里的 `CMP` backend wiring
- bootstrap sequence 与 readback gates
- checkpoint snapshot 与 durable recovery bridge
- state rehydration 与 consistency guard
- active/passive flow on real infra
- five-agent preflight contract
- infra smoke readiness 与 multi-agent gates

一句白话：

- Part 4 管的是“真实 infra 接上后，这条链怎么稳定活过来”

## 推荐文件列表

- `00-runtime-infra-protocol-freeze.md`
- `01-runtime-backend-interface-and-adapter-boundary.md`
- `02-agent-core-runtime-cmp-backend-wiring.md`
- `03-bootstrap-sequence-and-project-readback-gates.md`
- `04-checkpoint-snapshot-and-durable-recovery-bridge.md`
- `05-runtime-state-rehydration-and-consistency-guard.md`
- `06-active-flow-on-real-infra.md`
- `07-passive-flow-and-historical-read-path-on-real-infra.md`
- `08-five-agent-preflight-contract-and-default-role-boundary.md`
- `09-infra-smoke-readiness-and-multi-agent-gates.md`

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

### Wave 3

- `06`
- `07`
- `08`

### Wave 4

- `09`

## 二层 agent 角色

### `Part4 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `02`
  - `09`

### `Bootstrap And Wiring Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `03`

### `Recovery And Consistency Worker`

- 模型：`gpt-5.4-xhigh`
- ownership：
  - `04`
  - `05`

### `Flow And Preflight Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `06`
  - `07`
  - `08`

## 三层 agent 角色

### `Runtime Adapter Boundary Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - backend interface
  - adapter injection boundary

### `Recovery Specialist`

- 模型：`gpt-5.4-xhigh`
- 用途：
  - durable recovery
  - consistency guard
  - state rehydration

### `Active Passive Flow Specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - active flow on real infra
  - passive read path on real infra

### `Verification Gate Specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - bootstrap readback
  - smoke readiness
  - multi-agent gate

## 强依赖提醒

- `00` 没冻结前，不要正式写其他文件。
- `02` 必须等 Part 1/2/3 的 adapter contract 稳住后再落，否则 runtime 接线会反复返工。
- `04/05` 是 recovery 主轴，没稳之前不要提前做最终 smoke gate。
- `06/07` 必须建立在：
  - Part 1 的 interface 不再漂移
  - Part 2 的 git bootstrap / ref lifecycle 可回读
  - Part 3 的 PostgreSQL / Redis adapter 已能基本落盘和收发
- `08` 只定义五个 agent 接入前的 preflight 门，不去实现五个 agent 本身。
- `09` 必须最后收，而且要覆盖 bootstrap readback、active flow、passive flow、recovery、multi-agent neighborhood gate。

## 与其它 Part 的依赖

- 强依赖 Part 1：
  - bootstrap contract
  - git adapter / readback
- 强依赖 Part 2：
  - postgres adapter
  - recovery read model
- 强依赖 Part 3：
  - redis adapter
  - routing / ack / retry signal

## 最小验收口径

- `AgentCoreRuntime` 能注入真实 git/postgres/redis backend。
- bootstrap sequence 有真实 readback gate。
- checkpoint snapshot 与真实 backend recovery 能完成最小一致性恢复。
- active flow 与 passive flow 都能在真实 infra 上跑通最小链路。
- 五个 agent 接入前的 preflight 条件和最终 smoke gate 明确。
