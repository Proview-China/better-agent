# CMP Part 3 Task Pack

状态：并行编码任务包。

更新时间：2026-03-20

## 这一包是干什么的

Part 3 负责把 `git -> checked state -> DB projection -> neighborhood propagation -> delivery visibility` 这条链做成可验证、可联调的控制面。

## 推荐文件列表

- `00-part3-protocol-freeze.md`
- `01-project-db-topology-and-shared-tables.md`
- `02-agent-local-hot-tables-and-lineage-ownership.md`
- `03-projection-state-machine-and-promotion-contract.md`
- `04-checked-snapshot-to-projection-materializer.md`
- `05-context-package-and-delivery-registry.md`
- `06-mq-topic-topology-and-neighborhood-routing.md`
- `07-icma-publish-contract-and-granularity-envelope.md`
- `08-parent-peer-child-subscription-guards.md`
- `09-critical-escalation-exception-lane.md`
- `10-dbagent-runtime-and-projection-sync.md`
- `11-dispatcher-delivery-integration.md`
- `12-part3-end-to-end-and-cross-part-tests.md`

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
- `10`

### Wave 4

- `09`
- `11`

### Wave 5

- `12`

## 二层 agent 角色

### `Part3 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `12`

### `Part3 DB`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`
  - `03`
  - `04`
  - `10`

### `Part3 MQ`

- 模型：`gpt-5.4-high`
- ownership：
  - `06`
  - `07`
  - `08`
  - `09`

### `Part3 Delivery`

- 模型：`gpt-5.4-high`
- ownership：
  - `05`
  - `11`

## 三层 agent 角色

### `DB SharedSchema`

- 模型：`gpt-5.4-medium`
- 用途：
  - 共享表与热表设计

### `DB ProjectionState`

- 模型：`gpt-5.4-high`
- 用途：
  - promotion state machine
  - checked snapshot -> projection materializer

### `MQ TopicRouter`

- 模型：`gpt-5.4-medium`
- 用途：
  - topic 命名、routing key、publish envelope

### `MQ SubscriptionGuard`

- 模型：`gpt-5.4-high`
- 用途：
  - 父/平级/子代订阅规则与越级阻断

### `Delivery PackageModel`

- 模型：`gpt-5.4-medium`
- 用途：
  - package / delivery registry 结构

### `Delivery DispatcherBridge`

- 模型：`gpt-5.4-high`
- 用途：
  - dispatcher 消费 projection/package

### `Part3 IntegrationAuditor`

- 模型：`gpt-5.4-xhigh`
- 用途：
  - 跨文档一致性与跨 Part 依赖审查

### `Part3 TestPlanner`

- 模型：`gpt-5.4-high`
- 用途：
  - 联调矩阵与测试义务设计

## 强依赖提醒

- `00` 没完成前，其他文件不要动。
- `03` 是整个 Part 3 的核心协议。
- `11` 必须等 `05/08/10` 都稳定。
- `12` 必须包含 Part 1/2/4 的联调口。

## 最小验收口径

- 把 `checked state -> projection -> neighborhood propagation -> high-signal delivery` 做成严格逐级、不可越权、可联调的控制面样板。

