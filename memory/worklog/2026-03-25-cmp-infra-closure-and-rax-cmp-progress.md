# 2026-03-25 CMP Infra Closure And RAX CMP Progress

## 当前阶段结论

这轮工作的本质，是把 `CMP` 从：

- 协议 + runtime 样板

继续推进到：

- `CMP infra` 收尾
- `rax.cmp` 工作流接入
- `Section / StoredSection / Rules` 显式化

一句白话：

- 不再只是“CMP 能跑”
- 而是“CMP 开始像一个真正的工作流组件”

## 这轮完成了什么

### 一、`CMP infra closure`

补齐了：

- git live backend
- PostgreSQL live executor
- Redis live adapter
- runtime infra bootstrap / infra state / snapshot / recovery 对接

关键文件：

- `src/agent_core/cmp-git/git-cli-backend.ts`
- `src/agent_core/cmp-db/postgresql-live-executor.ts`
- `src/agent_core/cmp-mq/redis-cli-adapter.ts`
- `src/agent_core/cmp-runtime/infra-bootstrap.ts`
- `src/agent_core/cmp-runtime/infra-state.ts`
- `src/agent_core/runtime.ts`

### 二、`rax.cmp`

新增并总装：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-connectors.ts`
- `src/rax/cmp-domain.ts`

并接入：

- `src/rax/facade.ts`
- `src/rax/runtime.ts`
- `src/rax/index.ts`

### 三、`Section / StoredSection / Rules`

显式化为一等对象：

- `CmpSection`
- `CmpStoredSection`
- `CmpRule`
- `CmpRulePack`
- `CmpRuleEvaluation`

## 当前验证

这轮最后回读通过了：

- `npm run typecheck`
- `npm run build`
- `npx tsx --test src/rax/*.test.ts src/rax/cmp-*.test.ts src/agent_core/runtime.test.ts src/agent_core/cmp-runtime/*.test.ts`

结果：

- `219 pass`
- `0 fail`
- `1 skipped`

## 当前尚未完成

### 1. `Section / StoredSection / Rules` 还没有真正 lowering 到 `cmp-runtime` 的主链

### 2. `active/passive flow` 还没全面消费这层对象

### 3. `rax.cmp` 现在已经是 facade，但还需要更深 workflow integration

### 4. 五个 agent 的职责细调还没开始

这是故意延后，不是遗漏。

## 当前最推荐的下一步

1. 先把 `Section / StoredSection / Rules` 接进 `cmp-runtime`
2. 再把 `ingest / commit / materialize / requestHistory / dispatch` 接到这层
3. 再继续推进 `rax.cmp` 的 workflow integration
4. 最后才做五个 agent 的细调
