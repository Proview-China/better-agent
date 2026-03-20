# 05 Peer Exchange And Neighborhood Sync Contract

## 任务目标

处理父、平级、子代三种邻接传播在 git 侧的映射。

## 必须完成

- peer exchange 的定义
- parent-mediated fanout 的边界
- 子不能直达父级平级

## ownership

- 二层：`Runtime Orchestrator Worker`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- 与 Part 3 `06/08` 强耦合

## 最小验证义务

- 只允许父/平级/子代三类邻接传播
- 父级平级扩散必须中转

