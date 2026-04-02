# 2026-04-02 Dev Mainline Batch 1 And RAX Phase A

## 这轮工作的结论

这轮不是继续停在“研究方向”，而是已经把新 `dev` 主线真正往前推了一步：

- `CMP` 的 Batch 1 低耦合资产已经并入并验证
- `memory/current-context.md` 已升级到总装后项目级现状
- `rax` 的 Phase A 已接回并验证
- `cmp-runtime` 的原样移植已被证明当前不诚实，继续后置

一句白话：

- 新主线不再只是有文档
- 它已经拥有 `CMP` 的支撑层与 `rax` 的第一层表面

## 这轮真正落下来的内容

### 一、Batch 1 并入

当前已进入新主线：

- `infra/cmp/**`
- `scripts/cmp-status-panel-server.mjs`
- `src/agent_core/cmp-types/**`
- `src/agent_core/cmp-git/**`
- `src/agent_core/cmp-db/**`
- `src/agent_core/cmp-mq/**`
- `src/agent_core/cmp-runtime/**`
- `docs/ability/29-40`
- `docs/ability/44-46`
- `docs/ability/cmp-*`
- `memory/compaction-handoff-prompt*.md`
- `memory/worklog/2026-03-20-cmp-*`
- `memory/worklog/2026-03-24-cmp-*`
- `memory/worklog/2026-03-25-cmp-*`

### 二、Batch 1 验证

这轮真实通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/cmp-git/*.test.ts`
- `npx tsx --test src/agent_core/cmp-db/*.test.ts`
- `npx tsx --test src/agent_core/cmp-mq/*.test.ts`
- `npx tsx --test src/agent_core/cmp-runtime/*.test.ts`

## 三、`rax` Phase A

当前已进入新主线：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-config.test.ts`
- `src/rax/cmp-status-panel.ts`
- `src/rax/cmp-status-panel.test.ts`
- `src/rax/index.ts` 的 Phase A 出口

这轮真实通过：

- `npm run typecheck`
- `npx tsx --test src/rax/cmp-config.test.ts src/rax/cmp-status-panel.test.ts`

## 四、最关键的新判断

这轮最重要的不是新增了哪些文件，而是确认了：

- `cmp-runtime.ts` 不能按 `cmp/mp` 原样搬回当前新主线

原因不是文本冲突，而是结构性事实：

- 当前主线的 `src/agent_core/runtime.ts` 仍未提供 `cmp/mp` 版 `cmp-runtime.ts` 依赖的那整组 `CMP workflow` 方法
- 当前主线也还没有 `src/agent_core/cmp-five-agent/**`

白话：

- 现在硬接 `cmp-runtime`，会做出一个看起来接上、实际上语义不成立的壳

## 当前最推荐下一步

后续更稳妥的顺序是：

1. 继续盘点 `runtime assembly` 的桥位
2. 判断 `cmp-five-agent` 的最小准入边界
3. 决定 `cmp-runtime` 的最小诚实形态
4. 再决定是否进入下一轮实现

一句收口：

- 新 `dev` 已完成 `CMP` 支撑层与 `rax` Phase A 的第一轮接合
- 下一步开始进入真正的高风险总装前研究
