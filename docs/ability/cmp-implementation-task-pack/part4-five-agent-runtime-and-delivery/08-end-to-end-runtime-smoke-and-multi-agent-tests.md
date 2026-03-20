# 08 End To End Runtime Smoke And Multi Agent Tests

## 任务目标

对 active mode、passive mode、parent-child reseed、sibling exchange、non-skipping enforcement 和恢复场景做统一联调与测试。

## ownership

- 主线程牵头
- 二层执行主力：
  - `Agent D`
- 三层辅助：
  - `D2 assembly and e2e test specialist`
- 模型：
  - 默认：`gpt-5.4-high`
  - 如遇跨链路恢复或复杂并发状态机：`gpt-5.4-xhigh`

## 依赖前置

- `07`
- Part 1/2/3 的 hook 至少接通一版

## 最小验证义务

- 至少覆盖：
  - active mode end-to-end
  - passive mode end-to-end
  - parent-child reseed
  - sibling exchange
  - non-skipping enforcement
  - interrupted/recovered lineage snapshot

