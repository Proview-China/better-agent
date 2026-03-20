# 05 Promoted Projection And Context Package Model

## 任务目标

把 DB 投影对象与可分发对象切开。

## 必须完成

- 收 `PromotedProjection`
- 收 `ContextPackage`
- 明确 projection 与 package 的职责差异
- 明确与 Part 3 的对接面

## ownership

- 三层：`L3-C checked/projection/package specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- `04`

## 串并行位置

- 在 `04` 之后

## 最小验证义务

- 明确 projection 不是事实源
- 明确 package 不是 raw history

