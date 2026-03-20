# 11 End To End Lineage Sync And Governance Smoke

## 任务目标

做链路联调与测试，验证逐级同步与祖先默认不可见。

## 必须完成

- 3 级提 PR
- 2 级 merge
- 1 级默认只看 2 级 promoted
- peer exchange 不等于 upward promotion
- non-skipping guard 生效

## ownership

- 二层：`Part2 Lead / Integrator`
- 模型：`gpt-5.4-high`

## 依赖前置

- `10`
- 与 Part 1/3/4 的 hook 至少接通一版

## 最小验证义务

- 必须和 Part 1/3/4 的 stub/hook 联起来，不只做孤立单测

