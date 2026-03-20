# 08 Parent Peer Child Subscription Guards

## 任务目标

实现订阅侧的权限与方向守卫：只允许父、平级、子代。

## ownership

- 二层：`Part3 MQ`
- 三层辅助：`MQ SubscriptionGuard`
- 模型：`gpt-5.4-high`

## 依赖前置

- `06`
- `07`

## 最小验证义务

- 默认阻断祖先越级和父级同级直达

