# WP11: Safety Intercept And Human Escalation

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把高风险行为阻断、人工升级和 yolo 模式下的安全气囊路径做出来。

## 你的任务

1. 设计安全拦截对象与状态：
   - interrupt
   - block
   - downgrade
   - escalate_to_human
2. 设计 reviewer 如何在 yolo 模式下仍然触发紧急阻断。
3. 设计最小人工升级信号对象。

## 建议修改文件

- `src/agent_core/ta-pool-safety/**`
- `src/agent_core/ta-pool-review/**`

## 边界约束

- 不做真实 UI。
- 不做真正人类反馈系统。
- 只做状态对象和控制面行为。

## 必须包含的测试

- B3 危险请求被阻断测试
- yolo 模式下 reviewer 仍可中断测试
- human escalation 信号生成测试
