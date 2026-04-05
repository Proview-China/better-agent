# 07 Skill Doc Generate Capability Package

## 任务目标

把 `skill.doc.generate` 做成第一波正式 capability，让 bootstrap `TMA` 能稳定交 usage/skill 产物。

## 必须完成

- 定义 `skill.doc.generate` 的 capability manifest
- 定义 package 七件套最小实例
- 明确它的产物目标：
  - usage artifact
  - skill doc
  - 小型说明书
- 明确它不是 `skill.use`
- 补最小 fixture / validation 测试

## 允许修改范围

- `src/agent_core/capability-package/**`
- 必要时少量 `src/agent_core/ta-pool-provision/**`

## 不要做

- 不要把 skill runtime 调用能力混进来
- 不要让这个 capability 直接去执行外部 skill

## 验收标准

- `skill.doc.generate` 能作为独立 capability package 存在
- `TMA` usage artifact 的目标更清楚

## 交付说明

- 明确它与 `skill.use/prepare/mount` 的分层关系
