# Agent Capability Interface Task Pack

状态：并行编码任务包。

更新时间：2026-03-18

## 用途

这个目录里的文件，不是架构总纲，而是可直接发给独立 Codex 实例的任务说明书。

目标是为 `agent_core -> capability interface -> capability pool` 这条新主线做并行开发准备。

## 任务背景

当前仓库已经有：

- 可运行的 `src/agent_core/**` raw runtime kernel
- `src/rax/**` 下已存在的能力 runtime：
  - `websearch`
  - `mcp`
  - `skill`
  - 若干 `generate/embed/file/batch` prepare surface

现在要做的新内容，不是继续直接扩更多 capability 接线，而是：

1. 先冻结统一能力接口
2. 再实现统一能力池
3. 再把现有能力桥接进统一能力面

当前总纲已经定在：

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`

## 当前最重要的边界

- `agent_core` 不直接碰厚能力对象
- `agent_core` 只通过 `KernelCapabilityGateway` 调能力
- `KernelCapabilityGateway` 下接 `CapabilityPool`
- `CapabilityPool` 通过 `CapabilityAdapter` 去接：
  - `rax.websearch`
  - `rax.mcp`
  - `rax.skill`
  - `model inference`
  - 未来新增能力

## 执行顺序

不要一口气把所有 Codex 无脑同时打开。

当前更稳的串并行顺序是：

1. `00-phase0-interface-protocol-freeze.md`

2. 第一批并行：
   - `01-kernel-capability-gateway.md`
   - `02-capability-manifest-and-binding.md`
   - `03-capability-invocation-and-lease.md`
   - `06-result-envelope-and-event-bridge.md`

3. 第二批并行：
   - `04-capability-pool-registry-and-lifecycle.md`
   - `05-capability-dispatch-scheduler.md`
   - `11-hot-swap-drain-and-health.md`

4. 第三批并行：
   - `07-model-inference-adapter.md`
   - `08-rax-websearch-adapter.md`
   - `09-rax-mcp-adapter-skeleton.md`
   - `10-rax-skill-adapter-skeleton.md`

5. 第四批：
   - `12-runtime-assembly-and-integration.md`

## 推荐的多智能体开工方法

### Wave 0

- 开 `1` 个协议冻结负责人
- 只做 `00`
- 其他人先不要动类型

### Wave 1

- 开 `4` 个并行 Codex
- 分别做：
  - `01`
  - `02`
  - `03`
  - `06`
- 这批都主要改接口、类型和桥接语义，冲突较少

### Wave 2

- 开 `3` 个并行 Codex
- 分别做：
  - `04`
  - `05`
  - `11`
- 这批开始进入 pool 本体，但仍避免碰具体 provider adapter

### Wave 3

- 开 `4` 个并行 Codex
- 分别做：
  - `07`
  - `08`
  - `09`
  - `10`
- 这批各自拥有独立写入范围，适合并行

### Wave 4

- 开 `1` 个集成负责人
- 做 `12`
- 负责联调、补缝、统一验证

## 总计建议

- 总工作包：`13` 个文件（含 `README`）
- 总可用 Codex 数：`12`
- 单波最大并发：`4`
- 不建议超过 `4` 个同时改核心接口，否则 merge 成本会明显上升

## 冲突规避规则

所有执行这些任务的 Codex 都应：

1. 先阅读：
   - `docs/ability/17-agent-capability-interface-and-pool-outline.md`
   - `docs/master.md`
   - `memory/current-context.md`
2. 不要派生子智能体。
3. 只改自己任务说明里列出的目录和文件范围。
4. 除 `00` 之外，不要擅自扩 shared protocol。
5. 不要顺手改 `src/rax/**` 无关实现。
6. 不要把 provider-specific 细节提到 `agent_core` kernel-facing 层。
7. 不要直接把治理层塞进 pool 第一版。

## 本轮要冻结的共识

- 接口优先，池子其次，治理最后
- 公共语言在上，provider lowering 在下
- 冷路径丰富，热路径极薄
- 热插拔走 `generation + draining`
- `registry catalog` 不等于 `public wired surface`

## 文件列表

- `00-phase0-interface-protocol-freeze.md`
- `01-kernel-capability-gateway.md`
- `02-capability-manifest-and-binding.md`
- `03-capability-invocation-and-lease.md`
- `04-capability-pool-registry-and-lifecycle.md`
- `05-capability-dispatch-scheduler.md`
- `06-result-envelope-and-event-bridge.md`
- `07-model-inference-adapter.md`
- `08-rax-websearch-adapter.md`
- `09-rax-mcp-adapter-skeleton.md`
- `10-rax-skill-adapter-skeleton.md`
- `11-hot-swap-drain-and-health.md`
- `12-runtime-assembly-and-integration.md`

## 一句话收口

这一包不是“直接扩功能”，而是为 Praxis 的第一套可复用池+接口范式做实现开工包；总纲看 `17`，实际分工看这里。
