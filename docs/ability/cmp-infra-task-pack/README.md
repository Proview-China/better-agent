# CMP Infra Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这包任务是干什么的

这一包不是再讨论 `CMP` 的协议，而是把已经冻结的 `CMP infra` 总纲拆成四组真正可落代码的实施包。

目标是：

1. 把项目级 `git infra bootstrap` 与 branch family runtime 做成真实底座。
2. 把 `PostgreSQL` schema、migration、`cmp-db` adapter 做成可持久化投影层。
3. 把 `Redis` routing、subscription guard、`cmp-mq` adapter 做成真实邻接传播层。
4. 把 runtime wiring、checkpoint/recovery、infra verification gates 与五个 agent 接入前门控做成联调闭环。

一句白话：

- 这不是一包“把测试从内存改成数据库”那么简单的事
- 这是把 `CMP` 从样板闭环推进成真实可运行基础设施的作战手册

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md)
- [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- [34-cmp-infra-real-backend-and-bootstrap-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/34-cmp-infra-real-backend-and-bootstrap-outline.md)
- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- `memory/current-context.md`

## 本轮冻结共识

- `CMP` 的真实 infra 固定为：
  - `git`
  - `PostgreSQL`
  - `Redis`
- `git` 仍然是 canonical history backbone。
- `PostgreSQL` 只做 `CMP DB`，不做 RAG / vector retrieval。
- `Redis` 只做实时邻接传播与轻量队列/订阅，不做长期事实存储。
- 当前最稳妥的路线不是先拆五个独立服务，而是：
  - 先把真实 infra adapter 与 bootstrap 接进现有 runtime
  - 再把五个 agent 做成 runtime 内可配置、可联调的真实角色
- branch family 固定为：
  - `work/<agent-id>`
  - `cmp/<agent-id>`
  - `mp/<agent-id>`
  - `tap/<agent-id>`
- 广播只允许：
  - 向父节点
  - 向平级节点
  - 向子代节点
- “父级的平级扩散”必须由父节点中转。
- `git / DB / MQ` 默认都遵守逐级 promotion，不允许常规越级 raw 同步。

## 四个部分

### Part 1

- 目录：
  - [part1-git-infra-bootstrap-and-branch-runtime/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/part1-git-infra-bootstrap-and-branch-runtime/README.md)
- 目标：
  - 把项目级 repo bootstrap、branch family runtime、checked/promoted refs、agent lineage branch wiring 做成真实 git 底座

### Part 2

- 目录：
  - [part2-postgresql-schema-and-cmp-db-adapter/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/part2-postgresql-schema-and-cmp-db-adapter/README.md)
- 目标：
  - 把 `CMP DB` schema、migration、shared/local tables、projection/package/delivery persistence 做成真实 PostgreSQL backend

### Part 3

- 目录：
  - [part3-redis-routing-and-cmp-mq-adapter/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/part3-redis-routing-and-cmp-mq-adapter/README.md)
- 目标：
  - 把邻接 topic/routing、subscription guards、critical escalation、`cmp-mq` adapter 做成真实 Redis backend

### Part 4

- 目录：
  - [part4-runtime-wiring-recovery-and-verification/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/part4-runtime-wiring-recovery-and-verification/README.md)
- 目标：
  - 把 runtime wiring、checkpoint/recovery、infra bootstrap orchestration、verification gates 和五个 agent 接入前门控组装起来

## 全局串并行顺序

### Global Wave 0

- 主线程冻结本 README
- 四个二层 agent 全部只读准备，不提前改跨 part 共享协议

### Global Wave 1

- Part 1:
  - `00/01/02`
- Part 2:
  - `00`
- Part 3:
  - `00`
- Part 4:
  - `00`

### Global Wave 2

- Part 1:
  - `03/04/05`
- Part 2:
  - `01/02/03`
- Part 3:
  - `01/02/03`
- Part 4:
  - `01`

### Global Wave 3

- Part 1:
  - `06/07/08`
- Part 2:
  - `04/05/06`
- Part 3:
  - `04/05/06`
- Part 4:
  - `02/03`

### Global Wave 4

- Part 1:
  - `09/10`
- Part 2:
  - `07/08/09`
- Part 3:
  - `07/08/09`
- Part 4:
  - `04/05`

### Global Wave 5

- Part 2:
  - `10/11`
- Part 3:
  - `10/11`
- Part 4:
  - `06/07/08`

### Global Wave 6

- Part 1:
  - `11`
- Part 3:
  - `12`
- Part 4:
  - `09`

## 强依赖提醒

- Part 1 的 bootstrap contract 没稳前，Part 2/3 不要冻结 project bootstrap input/output。
- Part 2 的 schema/migration contract 没稳前，Part 4 不要冻结 durable recovery 写入点。
- Part 3 的 routing/ack contract 没稳前，Part 4 不要冻结 active delivery 的 runtime assembly。
- 所有 end-to-end / bootstrap / recovery / live infra verification 任务必须最后收。
- Part 1 的 `11`、Part 3 的 `12`、Part 4 的 `09` 是最终 gate，必须在全局最后一波统一回读和收口。
- 五个 agent 的默认配置和真实接入，必须排在 infra adapters 之后。

## 推荐 agent 拓扑

### 主线程

- 数量：`1`
- 模型：`gpt-5.4-high`
- 责任：
  - 全局协议收口
  - 跨 Part 依赖仲裁
  - 最终联调与测试门控
  - 决定何时允许下一波并行展开

### 二层 agent

- 数量：`4`
- 默认模型：`gpt-5.4-high`
- ownership：
  - `Part1 Lead`
  - `Part2 Lead`
  - `Part3 Lead`
  - `Part4 Lead`

### 三层 agent

- 建议上限：`8-12`
- 默认模型：
  - 普通写代码/协议落地：`gpt-5.4-high`
  - 轻量 bootstrap fixture / SQL / docs / test scaffolding：`gpt-5.4-medium`
  - 高耦合 recovery / consistency / orchestration：`gpt-5.4-xhigh`

## 模型建议

- 默认写 adapter、写 runtime、写 orchestration：`gpt-5.4-high`
- 简单 SQL/fixture/doc/readback：`gpt-5.4-medium`
- 以下情况再上 `gpt-5.4-xhigh`：
  - checkpoint / recovery / consistency 闭环
  - infra bootstrap 编排
  - live integration gate 和复杂失败恢复路径

## 联调和测试义务

主线程、四个二层 agent 和允许派生出来的三层 agent，都必须承担：

- 单 Part 自测义务
- bootstrap/readback 义务
- 至少一次真实 infra 联调义务
- 最终 recovery / interruption / restart 场景回归义务

谁都不能只交“schema 写完了”或“adapter 写完了”就算收工。

## 一句话收口

这四组 infra 任务包不是四块互不相干的后端杂活，而是一条必须按顺序接通的真实后端落地主线。
