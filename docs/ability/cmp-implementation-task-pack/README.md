# CMP Implementation Task Pack

状态：并行编码任务包。

更新时间：2026-03-20

## 这包任务是干什么的

这一包不是继续讨论 `CMP` 是什么，而是把已经冻结下来的 `CMP` 设计拆成四组真正可落代码的实施包。

目标是：

1. 把 `CMP` 的核心 interface 与 canonical object model 先钉死。
2. 把项目级 `git lineage governance` 做成可实现协议。
3. 把 `CMP DB + MQ neighborhood propagation` 做成严格逐级、不可越权的投影与同步面。
4. 把五个 agent 的 runtime、active/passive flow、父子/平级交付链真正组装起来。

一句白话：

- 这不是一包“文档整理”
- 这是给后续大规模编码开的作战手册

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md)
- [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- `memory/current-context.md`

## 本轮冻结共识

- `CMP` 是主动上下文治理池，不是被动 RAG 检索层。
- 一个项目对应：
  - 一个 `repo`
  - 一个 `CMP DB`
  - 一套 `MQ`
- branch family 固定为：
  - `work/<agent-id>`
  - `cmp/<agent-id>`
  - `mp/<agent-id>`
  - `tap/<agent-id>`
- 广播发起点是各个 agent 的 `ICMA`。
- 广播内容粒度由对应 `core_agent` 决定。
- 广播仅允许：
  - 向父节点
  - 向平级节点
  - 向子代节点
- “父级的平级扩散”必须由父节点中转。
- git / DB / MQ 默认都遵守逐级 promotion，不允许常规越级 raw 同步。

## 四个部分

### Part 1

- 目录：
  - [part1-core-interface-and-object-model/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-implementation-task-pack/part1-core-interface-and-object-model/README.md)
- 目标：
  - 钉死 core interface、canonical object model、runtime entrypoints、测试闸门

### Part 2

- 目录：
  - [part2-git-lineage-and-sync-governance/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-implementation-task-pack/part2-git-lineage-and-sync-governance/README.md)
- 目标：
  - 钉死项目级 repo、branch family、PR/merge/promotion/ref、逐级治理

### Part 3

- 目录：
  - [part3-db-projection-and-neighborhood-broadcast/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-implementation-task-pack/part3-db-projection-and-neighborhood-broadcast/README.md)
- 目标：
  - 钉死 `CMP DB` 投影链、delivery visibility、MQ 邻接传播

### Part 4

- 目录：
  - [part4-five-agent-runtime-and-delivery/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-implementation-task-pack/part4-five-agent-runtime-and-delivery/README.md)
- 目标：
  - 组装五 agent runtime、active/passive flow、父子/平级交付、联调闭环

## 全局串并行顺序

### Global Wave 0

- 主线程冻结 Part 1 的 `00`
- 4 个二层 agent 全部只读准备，不提前写共享协议

### Global Wave 1

- Part 1:
  - `01/02/03`
- 其他 Part:
  - 只允许起各自的 `00` 草案

### Global Wave 2

- Part 1:
  - `04/05`
- Part 2:
  - `01/02/03`
- Part 3:
  - `01/02/03`
- Part 4:
  - `00`

### Global Wave 3

- Part 1:
  - `06/07`
- Part 2:
  - `04/05/06`
- Part 3:
  - `04/05/06`
- Part 4:
  - `01/02/03`

### Global Wave 4

- Part 1:
  - `08`
- Part 2:
  - `07/08/09`
- Part 3:
  - `07/08/10`
- Part 4:
  - `04/05/06`

### Global Wave 5

- Part 2:
  - `10/11`
- Part 3:
  - `09/11/12`
- Part 4:
  - `07/08`

## 强依赖提醒

- Part 1 的 `00` 没冻结前，四个 Part 都不要正式写实现协议。
- Part 1 的 `01-06` 没稳前，Part 4 不要真正开写 runtime assembly。
- Part 2 的 `04/06` 没稳前，Part 4 的 active line 不算真正可联调。
- Part 3 的 `03/05/08` 没稳前，Part 4 的 dispatcher/delivery 不算真正可联调。
- 所有 end-to-end / smoke / recovery 任务必须最后收。

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
  - 轻量文档/fixtures/test scaffolding：`gpt-5.4-medium`
  - 高耦合协议争议/恢复闭环/复杂状态机：`gpt-5.4-xhigh`

### 总 agent 数建议

- 推荐控制在 `13-17` 以内：
  - `1` 个主线程
  - `4` 个二层
  - `8-12` 个三层

虽然上限允许到 `64`，但当前不建议为了并发而并发。

## 模型建议

- 默认写代码、写协议、写 runtime：`gpt-5.4-high`
- 简单拆分、fixtures、readback、测试清单：`gpt-5.4-medium`
- 以下情况再上 `gpt-5.4-xhigh`：
  - 跨 Part 共享协议争议
  - non-skipping / visibility / promotion 复杂状态机
  - runtime assembly / recovery / end-to-end 闭环

## 联调和测试义务

主线程、四个二层 agent 和允许派生出来的三层 agent，都必须承担：

- 单 Part 自测义务
- 跨 Part 契约回读义务
- 至少一次联调义务
- 最终 smoke / recovery / multi-agent 场景回归义务

谁都不能只交“单文件完成”就算收工。

## 一句话收口

这四组任务包不是“平行的四摞代码”，而是一个有明显前后依赖、共享协议约束和联调收口责任的多线程实施计划。

