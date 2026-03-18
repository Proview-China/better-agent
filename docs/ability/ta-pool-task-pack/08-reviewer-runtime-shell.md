# WP08: Reviewer Runtime Shell

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

做一个最小 reviewer runtime 壳，让审核控制面真实跑起来，但不提前做复杂治理系统。

## 你的任务

1. 设计 reviewer runtime shell：
   - 接收 access request
   - 读取 mode policy
   - 读取 baseline profile
   - 产出 review decision
2. reviewer 第一版应允许：
   - 纯规则批准
   - 纯规则拒绝
   - 转 provisioning
   - 转人工
   - 留 LLM reviewer hook

## 建议修改文件

- `src/agent_core/ta-pool-review/**`
- `src/agent_core/ta-pool-runtime/**`

## 边界约束

- 不做真正的项目态 memory 注入。
- 不做真实大模型联网审核逻辑。
- 先把 runtime 壳搭好。

## 必须包含的测试

- baseline 请求跳过 reviewer 测试
- requestable 请求进入 reviewer 测试
- missing capability 转 provisioning 测试
