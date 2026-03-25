# 03 Docs Read Capability Package

## 任务目标

把 `docs.read` 做成第一波正式 capability，并与 `code.read` 保持边界清晰。

## 必须完成

- 定义 `docs.read` 的 capability manifest
- 定义 `docs.read` 的 package 七件套最小实例
- 明确 `docs.read` 的作用域：
  - 项目文档
  - `docs/**`
  - README / 手册类内容
- 明确与 `code.read` 的区别：
  - `docs.read` 主要服务 reviewer / worker 理解设计
  - `code.read` 主要服务实现和验证
- 补最小 package/validation 测试

## 允许修改范围

- `src/agent_core/capability-package/**`
- 必要时 `src/agent_core/ta-pool-model/**`
- 必要时少量 `src/agent_core/index.ts`

## 不要做

- 不要把任意文件读都塞进 `docs.read`
- 不要把外部网页读取混进来

## 验收标准

- `docs.read` 能通过统一 package 校验
- `docs.read` 的 usage 能指导 reviewer / worker 正确使用

## 交付说明

- 明确 `docs.read` 默认风险等级
