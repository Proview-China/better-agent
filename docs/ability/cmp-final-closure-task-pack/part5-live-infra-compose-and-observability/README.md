# Part 5 Live Infra Compose And Observability

## 目标

把 `CMP` 第一版真实 infra 跑起来，并给出最小可用观测面。

## compose 方向

第一版至少包含：

- `PostgreSQL`
- `Redis`
- `Git 接入/服务层`
- 结构化日志
- 状态面板

## 子任务

1. compose 拓扑
- 服务
- 端口
- volume
- 健康检查

2. git 接入层
- 一个项目一个 repo
- 一个 agent 一组分支
- 分支命名按：
  - `层级-池子-编号`

3. PostgreSQL
- 角色 + section/package 双主轴 schema

4. Redis
- 交付状态
- route 记录
- ack / timeout / retry

5. 观测面
- 结构化日志
- 状态面板
- 重点看：
  - 角色阶段
  - 包流向
  - request 状态
  - reintervention
  - peer approval
