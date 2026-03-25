# 02 Code Read Capability Package

## 任务目标

把 `code.read` 做成第一波正式 capability，而不是只停在 reviewer baseline 名单里。

## 必须完成

- 定义 `code.read` 的 capability manifest
- 定义 `code.read` 的 package 七件套最小实例：
  - manifest
  - adapter
  - policy
  - builder
  - verification
  - usage
  - lifecycle
- 明确 `code.read` 的 scope 语义：
  - repo 内只读
  - 禁止工作区外越界
- 为 `code.read` 增加最小 fixture / validation 测试

## 允许修改范围

- `src/agent_core/capability-package/**`
- 必要时 `src/agent_core/ta-pool-model/**`
- 必要时少量 `src/agent_core/index.ts`

## 不要做

- 不要做真正文件系统 executor
- 不要把 shell 权限混进来
- 不要把 docs.read 一起打包成一个 capability

## 验收标准

- `code.read` 能通过统一 package 校验
- `code.read` 的 policy 明确是只读低风险
- 后续 reviewer / worker 能引用这份 package 定义

## 交付说明

- 明确 `code.read` 与 `docs.read` 的边界
