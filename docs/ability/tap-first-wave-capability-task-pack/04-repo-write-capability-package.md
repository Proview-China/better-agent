# 04 Repo Write Capability Package

## 任务目标

把 `repo.write` 定义成 bootstrap `TMA` 和少数施工 agent 的正式本地写入 capability。

## 必须完成

- 定义 `repo.write` 的 capability manifest
- 定义 package 七件套最小实例
- 明确 `repo.write` 的写入边界：
  - repo 内写
  - 禁止工作区外写
  - 默认不含删除危险目录
- 明确与 `shell.restricted` 的区别：
  - `repo.write` 是直接内容写入能力
  - `shell.restricted` 是命令执行能力
- 补风险与 policy 说明

## 允许修改范围

- `src/agent_core/capability-package/**`
- `src/agent_core/ta-pool-model/**`
- 必要时少量 `src/agent_core/index.ts`

## 不要做

- 不要默认给 reviewer
- 不要把危险删除直接放进行为白名单

## 验收标准

- `repo.write` 的 scope / deny 边界清楚
- package 校验通过
- 风险等级不是 `normal`

## 交付说明

- 明确哪些操作属于后续高风险升级项
