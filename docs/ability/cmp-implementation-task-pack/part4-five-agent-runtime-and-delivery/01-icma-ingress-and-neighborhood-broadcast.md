# 01 ICMA Ingress And Neighborhood Broadcast

## 任务目标

定义 `ICMA` 截获、事件粒度、父/平级/子代邻接广播规则。

## ownership

- 二层：`Agent A`
- 三层辅助：
  - `A1 topic and routing specialist`
  - `A2 ingress granularity and samples specialist`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `00`
- Part 3 `06/07` 的协议方向应同步

## 最小验证义务

- 至少验证 3 种广播路径：
  - 向父
  - 向平级
  - 向子代
- 至少验证 2 种禁止路径：
  - 子越级到祖先
  - 子直接向父级平级广播

