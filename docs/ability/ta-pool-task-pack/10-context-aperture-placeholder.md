# WP10: Context Aperture Placeholder

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

为 reviewer / provisioner 未来接入项目状态、记忆池、包装机留下标准坑位。

## 你的任务

1. 设计 `review context aperture` 契约。
2. 设计 `provision context aperture` 契约。
3. 明确当前第一版只提供 placeholder，不依赖真实上层系统。
4. 允许注入：
   - project summary
   - run summary
   - agent profile snapshot
   - capability inventory snapshot
   - mode snapshot

## 建议修改文件

- `src/agent_core/ta-pool-context/**`

## 边界约束

- 不接真正的 memory system。
- 不接真正的 packaging engine。
- 只做接口坑位和 mock provider。

## 必须包含的测试

- aperture snapshot 结构测试
- reviewer/provisioner 可消费 placeholder 测试
