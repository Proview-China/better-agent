# 2026-03-20 CMP Wave 1 Code Landing

## 当前阶段结论

`CMP` 已经不再只是文档总纲和任务包。

当前在 `cmp/mp` 分支上，第一波代码骨架已经真实落地，并完成了主线程接线与最小联调验证。

## 当前已落地的模块

- `src/agent_core/cmp-types/**`
  - `cmp-lineage.ts`
  - `cmp-context.ts`
  - `cmp-delivery.ts`
  - `cmp-interface.ts`
  - `cmp-types.test.ts`
- `src/agent_core/cmp-git/**`
  - `cmp-git-types.ts`
  - `lineage-registry.ts`
  - `commit-sync.ts`
  - `cmp-git-types.test.ts`
- `src/agent_core/cmp-db/**`
  - `cmp-db-types.ts`
  - `project-db-topology.ts`
  - `agent-local-hot-tables.ts`
  - `projection-state.ts`
  - 各自测试
- `src/agent_core/cmp-mq/**`
  - `cmp-mq-types.ts`
  - `topic-topology.ts`
  - `neighborhood-topology.ts`
  - 各自测试
- `src/agent_core/cmp-runtime/**`
  - `runtime-types.ts`
  - `ingress-contract.ts`
  - `active-line.ts`
  - `materialization.ts`
  - `delivery.ts`
  - 各自测试

## 主线程已完成的接线

- `src/agent_core/index.ts`
  - 已统一导出 `cmp-types/cmp-git/cmp-db/cmp-mq/cmp-runtime`
- `src/agent_core/runtime.ts`
  - 已新增第一版 `CMP` in-memory stores
  - 已新增：
    - `ingestRuntimeContext(...)`
    - `commitContextDelta(...)`
    - `resolveCheckedSnapshot(...)`
    - `materializeContextPackage(...)`
    - `dispatchContextPackage(...)`
    - `requestHistoricalContext(...)`
  - 已用 `cmp-git/cmp-db/cmp-mq/cmp-runtime` 模块做第一版桥接，而不是另起一套并行逻辑

## 当前这波能力边界

当前已经可以：

- 接住 `core_agent` 上下文材料
- 生成 `ContextEvent`
- 归并成 `ContextDelta`
- 通过默认 checker 占位路径得到 `CheckedSnapshot`
- materialize 出 `ContextPackage`
- dispatch 出 `DispatchReceipt`
- 走一条最小的 passive historical reply

当前还没有完成：

- Part 2 后半：
  - PR / merge / promotion governance
  - checked ref / promoted ref lifecycle
  - git runtime orchestrator
  - non-skipping / escalation guard 的完整治理实现
- Part 3 后半：
  - package persistence
  - delivery registry 真交付链
  - `DBAgent` runtime 同步
- Part 4 后半：
  - runtime assembly 深接
  - non-skipping enforcement 真闭环
  - end-to-end / recovery / multi-agent tests

## 当前验证基线

- `npm run typecheck` 通过
- `npx tsx --test src/agent_core/cmp-types/cmp-types.test.ts src/agent_core/cmp-git/*.test.ts src/agent_core/cmp-db/*.test.ts src/agent_core/cmp-mq/*.test.ts src/agent_core/cmp-runtime/*.test.ts src/agent_core/runtime.test.ts` 通过
  - `51 pass / 0 fail`
- `npm run build` 通过

## 下一步最自然的推进顺序

1. Part 2:
   - `04/06/07`
2. Part 3:
   - `05/08/10/11`
3. Part 4:
   - `04/05/06`
4. 主线程最后继续收：
   - `runtime.ts` 深接
   - end-to-end / recovery / multi-agent 测试
