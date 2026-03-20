# 07 Runtime Entrypoints And State Boundary

## 任务目标

把 Part 1 对 `agent_core` 的最小 runtime 接缝写清。

## 必须完成

- 明确哪些状态由 runtime 持有
- 明确哪些状态只定义 contract 不实现
- 写清与 Part 4 runtime flow 的接口接点
- 写清与现有 TAP runtime 的平行关系

## ownership

- 二层：`Part1 Lead`
- 模型：`gpt-5.4-high`

## 依赖前置

- `01`
- `02`
- `03`
- `04`
- `05`
- `06`

## 串并行位置

- 后串行

## 最小验证义务

- 能用一句话说清 `CMP` 与 `agent_core` 的最小接缝
- 能用一句话说清哪些状态在 runtime，哪些只在 git/DB/MQ

