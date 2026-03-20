# 03 Context Event And Context Delta Model

## 任务目标

把事实层和增量层对象先钉死。

## 必须完成

- 收 `ContextEvent`
- 收 `ContextDelta`
- 说明它们如何承接 `ICMA` ingress
- 明确它们不等于 checked/projection/package

## ownership

- 三层：`L3-B lineage/model specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`

## 串并行位置

- 可与 `01/02` 并行

## 最小验证义务

- 能表达主动模式 ingress
- 不偷混 checked/projection/package 语义

