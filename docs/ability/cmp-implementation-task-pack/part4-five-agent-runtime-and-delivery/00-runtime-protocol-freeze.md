# 00 Runtime Protocol Freeze

## 任务目标

冻结 Part 4 的共享 runtime 词汇和最小状态机。

## 必须完成

- active mode 主链状态
- passive mode 请求链状态
- parent/peer/child delivery 状态
- non-skipping enforcement 接点

## ownership

- 主线程优先
- 如需协作，由 `Agent A` 与 `Agent D` 只读参与
- 模型：`gpt-5.4-high`

## 依赖前置

- Part 1 `00`
- Part 2 / 3 的 `00` 草案应可参考

## 最小验证义务

- 回读协议中所有 runtime 对象和状态迁移表
- 明确列出与 Part 1/2/3 的输入输出依赖

