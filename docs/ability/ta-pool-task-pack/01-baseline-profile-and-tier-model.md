# WP01: Baseline Profile And Tier Model

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把主 agent 的默认放权模型做成稳定的数据模型和判定辅助层。

## 你的任务

1. 实现 `B0-B3` tier 模型。
2. 实现 `AgentCapabilityProfile` 及其校验逻辑。
3. 提供：
   - baseline capability 判定
   - capability pattern 匹配
   - 默认 grant 生成辅助函数
4. 准备临时工程基线：
   - baseline 不是最终治理 system 的永久真理
   - 但当前阶段要可运行

## 建议修改文件

- `src/agent_core/ta-pool-model/**`

## 边界约束

- 不做 reviewer runtime。
- 不做 provision 流程。
- 不要把项目态 context 提前耦合进来。

## 必须包含的测试

- baseline capability 命中测试
- 高风险 tier 判定测试
- profile schema 校验测试
