# 05 Passive Request And Historical Delivery

## 任务目标

定义被动模式：按需请求历史、选 projection、生成 package、回填。

## ownership

- 二层：`Agent C`
- 三层辅助：
  - `C2 passive delivery query specialist`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `03`

## 最小验证义务

- 被动模式能从 checked state 产出高信噪比 package
- 不允许直接回 raw history

