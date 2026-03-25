# 05 Shell Restricted Capability Package

## 任务目标

把 `shell.restricted` 做成第一波正式 capability，并把它和后续更厚的 shell/system 类能力切开。

## 必须完成

- 定义 `shell.restricted` 的 capability manifest
- 定义 package 七件套最小实例
- 明确 restricted shell 的预算：
  - 只允许受限命令
  - 不允许毁灭性命令
  - 默认 repo 内执行
- 在 policy / usage 中写清：
  - 什么是允许的
  - 什么需要升级人工或更高能力
- 补最小 fixture / validation 测试

## 允许修改范围

- `src/agent_core/capability-package/**`
- `src/agent_core/ta-pool-model/**`
- `src/agent_core/ta-pool-safety/**`

## 不要做

- 不要顺手扩展成 full shell
- 不要把 `rm -rf` 之类危险操作塞到默认允许集

## 验收标准

- `shell.restricted` 的风险边界和 usage 清楚
- 与 `repo.write` 的职责区分清楚

## 交付说明

- 明确未来 full shell / system.write 应如何与它区分
