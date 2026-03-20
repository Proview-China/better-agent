# CMP Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-20

## 这一包是干什么的

Part 4 负责把五个 agent 的 runtime、active/passive flow、父子/平级交付与联调闭环真正组装起来。

这包不按“五个 agent 一人一块”硬切，而是按：

- 共享协议
- 主动流主链
- 被动查询链
- 父子/平级分发链
- 联调闭环

来切。

## 推荐文件列表

- `00-runtime-protocol-freeze.md`
- `01-icma-ingress-and-neighborhood-broadcast.md`
- `02-iterator-checker-active-line.md`
- `03-dbagent-projection-and-package-materialization.md`
- `04-dispatcher-parent-child-peer-delivery.md`
- `05-passive-request-and-historical-delivery.md`
- `06-lineage-visibility-and-non-skipping-enforcement.md`
- `07-runtime-assembly-and-core-agent-integration.md`
- `08-end-to-end-runtime-smoke-and-multi-agent-tests.md`

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

### Wave 4

- `08`

## 二层 agent 角色

### `Agent A: ICMA and Broadcast Owner`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - 协同 `06`

### `Agent B: Iterator and Checker Active Line Owner`

- 模型：`gpt-5.4-high`
- ownership：
  - `02`

### `Agent C: DBAgent and Package Owner`

- 模型：`gpt-5.4-high`
- ownership：
  - `03`
  - 协同 `05`

### `Agent D: Dispatcher Runtime and Test Owner`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - 协同 `07`
  - 协同 `08`

## 三层 agent 角色

### `A1 topic and routing specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - 邻接广播 topic / envelope / routing 细化

### `A2 ingress granularity and samples specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - `ICMA` 输入粒度、广播裁剪、父/平级/子代传播样例

### `B1 iterator state push specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - iterator 主链与 git side 状态推进

### `B2 checker usable-state specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - checked snapshot / promotion gate / usable-state 测试义务

### `C1 projection and package specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - projection schema / visibility state / package materialization

### `C2 passive delivery query specialist`

- 模型：`gpt-5.4-medium`
- 用途：
  - DB read model 与 passive delivery query

### `D1 dispatcher state-machine specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - parent/child/peer delivery 状态机

### `D2 assembly and e2e test specialist`

- 模型：`gpt-5.4-high`
- 用途：
  - runtime assembly、smoke、multi-agent 测试矩阵

## 强依赖提醒

- `00` 没完成前，其他文件不要正式开写。
- `07` 不建议外包成多个写域，它最容易牵扯全链路接口漂移。
- `08` 必须最后收口。

## 最小验收口径

- 让 `CMP` 的 active mode、passive mode、parent-child reseed、sibling exchange、non-skipping enforcement 和 runtime assembly 真正接成一条可联调闭环。

