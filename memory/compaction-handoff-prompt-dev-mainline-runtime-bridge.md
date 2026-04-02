# Dev Mainline Runtime Bridge Handoff Prompt

当前唯一目标是在 `/home/proview/Desktop/Praxis_series/Praxis` 的新 `dev` / `dev-master` 主线上，继续推进 reboot 基座与 `CMP` 主体的总装，但不要越界直接硬改 `main`、不要回跳 legacy `dev`、也不要把 `cmp/mp` 整包粗暴 merge 回来。

## 你接手时必须先知道的事实

1. 当前主线已经不是 legacy 线，而是新的 reboot-based `dev` / `dev-master`。
2. 当前主线已经完成：
   - reboot 基座
   - `CMP` Batch 1
   - `rax` Phase A
3. 旧 `dev` 已归档到 `archive/dev-legacy-2026-04-01`。
4. `CMP`、`MP`、`TAP` 是并列池：
   - `CMP` 管主动上下文治理
   - `TAP` 管能力供给与治理
   - `MP` 仍是未来方向
5. `git_infra` 是共享底座，不是 `CMP` 私有系统。
6. `CMP` 的 canonical source 仍然是 `git`，`CMP DB` 仍是结构化投影层，不是第二真相源。

## 当前主线上已经有什么

### 一、reboot/TAP 基座

- `agent_core` raw runtime kernel
- capability interface / pool
- `T/A Pool`
- `TAP` runtime completion
- three-agent real usage
- reboot 阶段的 `skill` / `websearch` / `MCP`

### 二、`CMP` Batch 1

已经接回：

- `infra/cmp/**`
- `scripts/cmp-status-panel-server.mjs`
- `src/agent_core/cmp-types/**`
- `src/agent_core/cmp-git/**`
- `src/agent_core/cmp-db/**`
- `src/agent_core/cmp-mq/**`
- `src/agent_core/cmp-runtime/**`
- `CMP` 的主文档 / task pack / handoff / worklog

### 三、`rax` Phase A

已经接回：

- `src/rax/cmp-domain.ts`
- `src/rax/cmp-domain.test.ts`
- `src/rax/cmp-connectors.ts`
- `src/rax/cmp-connectors.test.ts`
- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-config.test.ts`
- `src/rax/cmp-status-panel.ts`
- `src/rax/cmp-status-panel.test.ts`
- `src/rax/index.ts` 的 Phase A 出口

## 当前真实通过的验证

- `npm run typecheck`
- `npx tsx --test src/agent_core/cmp-git/*.test.ts`
- `npx tsx --test src/agent_core/cmp-db/*.test.ts`
- `npx tsx --test src/agent_core/cmp-mq/*.test.ts`
- `npx tsx --test src/agent_core/cmp-runtime/*.test.ts`
- `npx tsx --test src/rax/cmp-domain.test.ts`
- `npx tsx --test src/rax/cmp-connectors.test.ts`
- `npx tsx --test src/rax/cmp-config.test.ts src/rax/cmp-status-panel.test.ts`

## 当前最关键的阻塞判断

不要误以为下一步是直接把 `cmp-runtime.ts` 或 `cmp-facade.ts` 原样接回。

已经核实的事实是：

- 当前主线的 `src/agent_core/runtime.ts` 还没有 `cmp/mp` 版 `src/rax/cmp-runtime.ts` 所依赖的那整组 `CMP workflow` 方法
- 当前主线也还没有 `src/agent_core/cmp-five-agent/**`

所以：

- `cmp-runtime.ts` 当前不能原样移植
- `cmp-facade.ts` 继续后置
- `runtime assembly` 仍然是最大风险口，而且只能主线程主导

## 当前仍明确后置的部分

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-facade.ts`
- `src/agent_core/cmp-five-agent/**`
- `src/agent_core/integrations/model-inference*.ts`
- 更深的五角色 live LLM 化

## 你接手后的正确顺序

1. 先阅读：
   - `docs/master.md`
   - `memory/current-context.md`
   - `docs/ability/52-dev-master-integration-outline.md`
   - `docs/ability/53-dev-master-cmp-import-checklist.md`
   - `docs/ability/54-dev-master-conflict-research-plan.md`
   - `docs/ability/55-dev-master-batch1-task-pack.md`
   - `docs/ability/56-dev-master-batch2-preflight.md`
   - `docs/ability/57-dev-master-deepcheck-report-wave2.md`
   - `docs/ability/58-dev-master-rax-surface-task-pack.md`
2. 然后重新核实：
   - `git status --short --branch`
   - `git rev-parse --short HEAD`
   - `git rev-parse --short origin/dev`
   - `git rev-parse --short origin/dev-master`
3. 接着只做一件事：
   - 继续研究并定义 `cmp-runtime` 的最小诚实形态
   白话：判断它是继续后置，还是先做一个 thin runtime shell
4. 不要同时开改：
   - `src/agent_core/runtime.ts`
   - `src/rax/cmp-runtime.ts`
   - `src/rax/cmp-facade.ts`

## 当前唯一推荐动作

如果没有新的用户指令覆盖，下一步应优先做：

- `cmp-runtime` 的 runtime bridge / thin shell 方案研究

不要直接跳去：

- `cmp-five-agent`
- `runtime assembly`
- `main` 分支切换
