# 06 Test Run Capability Package

## 任务目标

把 `test.run` 做成第一波正式 capability，让 bootstrap `TMA` 和少数施工 agent 能受控跑验证。

## 必须完成

- 定义 `test.run` 的 capability manifest
- 定义 package 七件套最小实例
- 明确 `test.run` 的范围：
  - targeted tests
  - smoke tests
  - 不默认放开全局高成本长测
- 明确与 `shell.restricted` 的关系：
  - `test.run` 是语义化测试能力
  - `shell.restricted` 是更底层命令能力
- 补最小 fixture / validation 测试

## 允许修改范围

- `src/agent_core/capability-package/**`
- `src/agent_core/ta-pool-model/**`

## 不要做

- 不要把整个 CI/CD 能力都混进来
- 不要默认允许无限制长时间测试

## 验收标准

- `test.run` 能以独立 capability 进入 package 层
- usage 能告诉 agent 什么时候该用它而不是直接乱跑 shell

## 交付说明

- 明确 `test.run` 适合哪些 agent 角色默认拥有
