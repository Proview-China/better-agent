# T/A Pool Task Pack

状态：并行编码任务包。

更新时间：2026-03-18

## 用途

这个目录里的文件，是为 `T/A Pool` 第一版准备的并行开发任务说明书。

目标不是重写现有 `CapabilityPool`，而是在它之上补出：

- baseline profile
- review plane
- provision plane
- safety intercept
- context aperture
- runtime assembly

## 任务背景

当前仓库已经有：

- `agent_core` raw runtime kernel
- `Capability Interface v1`
- `CapabilityPool` 第一版执行骨架

当前要做的新内容是：

1. 在现有执行面之上加出 `T/A Pool` 控制面
2. 让主 agent 具备 baseline capability set
3. 让高风险或厚能力进入 review / provisioning 流程
4. 为未来 agent 治理 system、记忆池、包装机预留 context aperture

当前总纲已经定在：

- `docs/ability/20-ta-pool-control-plane-outline.md`

## 当前最重要的边界

- `agent_core` 不直接知道 reviewer / provisioner 的内部过程
- 现有 `CapabilityPool` 保留为 execution plane
- `T/A Pool` 是 control plane
- review 和 provisioning 走异步工单与队列
- 项目状态感知这轮先留坑位，不把上层系统提前做死

## 推荐目录落点

建议新增目录以降低冲突：

- `src/agent_core/ta-pool-types/**`
- `src/agent_core/ta-pool-model/**`
- `src/agent_core/ta-pool-review/**`
- `src/agent_core/ta-pool-provision/**`
- `src/agent_core/ta-pool-safety/**`
- `src/agent_core/ta-pool-context/**`
- `src/agent_core/ta-pool-runtime/**`

## 执行顺序

不要一口气把所有 Codex 同时打开。

更稳的顺序是：

1. `00-phase0-protocol-freeze.md`

2. 第一批并行：
   - `01-baseline-profile-and-tier-model.md`
   - `02-access-request-and-review-decision.md`
   - `03-control-plane-gateway.md`
   - `04-mode-policy-matrix.md`

3. 第二批并行：
   - `05-execution-plane-bridge.md`
   - `06-provision-request-and-artifact-bundle.md`
   - `07-provision-registry-and-lifecycle.md`
   - `10-context-aperture-placeholder.md`

4. 第三批并行：
   - `08-reviewer-runtime-shell.md`
   - `09-provisioner-runtime-shell.md`
   - `11-safety-intercept-and-human-escalation.md`

5. 第四批：
   - `12-runtime-assembly-and-integration.md`
   - `13-end-to-end-smoke-and-test-pack.md`

## 推荐的多智能体开工方法

### Wave 0

- 开 `1` 个负责人
- 只做 `00`

### Wave 1

- 开 `4` 个并行 Codex
- 分别做：
  - `01`
  - `02`
  - `03`
  - `04`

### Wave 2

- 开 `4` 个并行 Codex
- 分别做：
  - `05`
  - `06`
  - `07`
  - `10`

### Wave 3

- 开 `3` 个并行 Codex
- 分别做：
  - `08`
  - `09`
  - `11`

### Wave 4

- 开 `2` 个收口负责人
- 分别做：
  - `12`
  - `13`

## 总计建议

- 总工作包：`14` 个文件（含 `README`）
- 单波最大并发：`4`
- 不建议超过 `4` 个实例同时改 shared protocol

## 冲突规避规则

所有执行这些任务的 Codex 都应：

1. 先阅读：
   - `docs/ability/20-ta-pool-control-plane-outline.md`
   - `docs/ability/17-agent-capability-interface-and-pool-outline.md`
   - `docs/master.md`
   - `memory/current-context.md`
2. 不要派生子智能体。
3. 只改自己任务说明里列出的目录和文件范围。
4. 除 `00` 之外，不要擅自扩 shared protocol。
5. 不要顺手重构现有 `CapabilityPool` 执行面。
6. 不要把 reviewer / provisioner 直接塞进 `agent_core` kernel loop。
7. 不要提前做完整治理 system。

## 本轮要冻结的共识

- `CapabilityPool` 继续做 execution plane
- `T/A Pool` 是 control plane
- 默认放权必须存在
- 高风险能力走 review
- 缺能力时走 provisioning
- `strict / balanced / yolo` 是策略差异，不是系统分裂
- context aperture 先留坑位

## 文件列表

- `00-phase0-protocol-freeze.md`
- `01-baseline-profile-and-tier-model.md`
- `02-access-request-and-review-decision.md`
- `03-control-plane-gateway.md`
- `04-mode-policy-matrix.md`
- `05-execution-plane-bridge.md`
- `06-provision-request-and-artifact-bundle.md`
- `07-provision-registry-and-lifecycle.md`
- `08-reviewer-runtime-shell.md`
- `09-provisioner-runtime-shell.md`
- `10-context-aperture-placeholder.md`
- `11-safety-intercept-and-human-escalation.md`
- `12-runtime-assembly-and-integration.md`
- `13-end-to-end-smoke-and-test-pack.md`

## 一句话收口

这一包不是直接“给 agent 更多工具”，而是为 Praxis 的第一套 `T/A Pool` 控制平面准备可并行落地的开工包；总纲看 `20`，实际分工看这里。
