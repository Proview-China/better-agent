# 04 Checked Snapshot To Projection Materializer

## 任务目标

把 Part 1 的 `CheckedSnapshot` 映射到 DB 投影对象。

## ownership

- 二层：`Part3 DB`
- 三层辅助：`DB ProjectionState`
- 模型：`gpt-5.4-high`

## 依赖前置

- `03`
- Part 1 对象模型已稳

## 最小验证义务

- 保留 lineage、branch、checked-quality、promotion status

