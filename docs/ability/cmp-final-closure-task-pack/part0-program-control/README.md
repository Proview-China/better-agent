# Part 0 Program Control

## 目标

锁死这次 `CMP` 最终收尾阶段的工程纪律，避免后面 5-8 次压缩里跑偏。

## 任务

1. 固定当前唯一目标：
- 只收 `CMP`
- 不回跳 `MP`
- 不回跳非五-agent底座

2. 固定收口顺序：
- 先对象模型
- 再五角色真实 loop
- 再 bundle schema
- 再 `TAP` 深桥
- 再真实 infra / recovery / acceptance gate

3. 固定主线程职责：
- runtime / rax 收口只由主线程改

4. 固定验证纪律：
- 每完成一部分都必须至少过：
  - `npm run typecheck`
  - 局部测试
- 真实 infra 动作必须有回读证据
