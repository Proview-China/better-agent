# 03 DBAgent Projection And Package Materialization

## 任务目标

定义 `DBAgent` 如何把 checked state 变成 projection / package。

## ownership

- 二层：`Agent C`
- 三层辅助：
  - `C1 projection and package specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- Part 3 `03/04/05`

## 最小验证义务

- `CheckedSnapshot -> PromotedProjection -> ContextPackage` 映射闭环成立
- `DBAgent` 不拥有 git 真相裁决权

