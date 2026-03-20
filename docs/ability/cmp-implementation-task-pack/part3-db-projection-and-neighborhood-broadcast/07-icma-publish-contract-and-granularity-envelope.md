# 07 ICMA Publish Contract And Granularity Envelope

## 任务目标

定义 `ICMA` 发布消息的 envelope 和“粒度由 core_agent 决定”的落地接口。

## ownership

- 二层：`Part3 MQ`
- 三层辅助：`MQ TopicRouter`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `06`
- Part 1 interface 已稳

## 最小验证义务

- publish envelope 体现“粒度由 core_agent 决定，发起点是 ICMA”

