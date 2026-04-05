# 15 First-Wave Baseline Profile And Registration Assembly

## 任务目标

把前面已经整理好的第一波 capability，真正组装回当前 `TAP` runtime/profile/registration 主链。

## 必须完成

- 明确第一波 baseline / allowed pattern / review-only 的分配策略
- 把第一波 capability 的注册入口整理出来
- 决定哪些能力：
  - 默认 baseline
  - allowed pattern
  - 仅供专门 agent
- 让 runtime / profile / package 三层语义一致

## 允许修改范围

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/agent_core/ta-pool-model/**`
- `src/agent_core/capability-package/**`
- 必要时 `src/agent_core/index.ts`

## 不要做

- 不要在这里继续扩 provider runtime
- 不要再新增新的 capability family

## 验收标准

- 第一波 capability 已经能被 runtime 看见并组装
- baseline / allowed pattern / review-only 分配清楚
- reviewer / bootstrap `TMA` 的最小基线能被代码表达

## 交付说明

- 明确第一波 capability 的推荐默认开放矩阵
