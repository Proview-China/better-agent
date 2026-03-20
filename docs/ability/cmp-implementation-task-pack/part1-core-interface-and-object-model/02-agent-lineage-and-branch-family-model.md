# 02 Agent Lineage And Branch Family Model

## 任务目标

冻结 `AgentLineage` 与 `branchFamily` 如何表达项目、父子层级和 `work/cmp/mp/tap` 四线。

## 必须完成

- 收口 `AgentLineage`
- 收口 `projectId`
- 收口 `parentAgentId`
- 收口 `branchFamily`
- 说明四线如何挂进对象模型

## ownership

- 三层：`L3-B lineage/model specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`

## 串并行位置

- 可与 `01/03` 并行

## 最小验证义务

- 能完整支撑逐级治理、非越级控制、branch family 路由

