# Current Context

更新时间：2026-03-25

## 当前分支与提交状态

- 当前工作分支：`cmp/mp`
- 当前已推送到远端的最近提交：
  - `a073959` `完成 CMP infra 第一波总纲与真实 backend 骨架落地`
- 当前工作区仍有未提交改动，主要集中在：
  - `docs/master.md`
  - `docs/ability/35-36`
  - `docs/ability/cmp-infra-closure-task-pack/**`
  - `docs/ability/rax-cmp-workflow-task-pack/**`
  - `src/agent_core/cmp-*`
  - `src/agent_core/runtime.ts`
  - `src/rax/**`
  - `memory/current-context.md`
- 当前工作区里还有一个需要提交前专门排除的临时目录：
  - `.parallel-worktrees/`

## 当前阶段结论

当前真正的工作重点已经从：

- `CMP` 四波基础协议与 runtime 样板

推进到：

- `CMP infra` 收尾
- `rax.cmp` 工作流接入
- `Section / StoredSection / Rules` 显式化

一句白话：

- 现在不再是“CMP 是什么”
- 而是“CMP 怎样接进当前工作流，并为五个 agent 打地基”

## 已冻结的架构方向

### 1. `CMP` 与 `MP`

- `CMP` 使用传统数据库：
  - `PostgreSQL`
  - `Redis`
  - shared `git_infra`
- `CMP` 不使用 embedding / vector / RAG 作为真相源
- `MP` 后续才使用：
  - `LanceDB`

### 2. `git_infra`

- `git_infra` 是与多智能体系统并行的一层共享协作底座
- `CMP` 只是 `git_infra` 的消费者，不是拥有者
- 每个 agent 都可以和 shared `git_infra` 沟通
- 不是每个 agent 自己带一套 `git_infra`

### 3. `rax.cmp`

- `rax.cmp` 已被确认应作为：
  - facade
  - runtime shell
  - configuration layer
  - workflow integration entry
- 不是：
  - 一组测试 helper
  - 一组散落的 backend contract 包装

### 4. 五个 agent 的顺序

- 先做：
  - `rax.cmp`
  - workflow integration
  - `Section / StoredSection / Rules`
- 后做：
  - 五个 agent 的细致职责与配置

## `CMP` 旧阶段已完成到哪里

下面这些都已经完成并在代码中存在：

- `CMP` 四波基础协议与 runtime 样板
- `AgentCoreRuntime` 的 `CMP` 主链入口：
  - `ingestRuntimeContext(...)`
  - `commitContextDelta(...)`
  - `resolveCheckedSnapshot(...)`
  - `materializeContextPackage(...)`
  - `dispatchContextPackage(...)`
  - `requestHistoricalContext(...)`
- `CMP` 的四部分任务包文档：
  - `29-33`
- `CMP infra` 第一波总纲与任务包：
  - `34`
  - `cmp-infra-task-pack/**`
- `CMP infra` 收尾总纲与任务包：
  - `35`
  - `cmp-infra-closure-task-pack/**`

## 当前未提交但已经完成的关键进展

### 一、`agent_core/CMP infra`

当前已经在 `src/agent_core/**` 里新增或扩展了下面这些内容：

#### 1. `cmp-git`

- `project-repo-bootstrap.ts`
- `branch-runtime.ts`
- `git-backend.ts`
- `in-memory-backend.ts`
- `git-cli-backend.ts`

当前状态：

- 已有 contract
- 已有 in-memory backend
- 已有真实 `git CLI` live backend

#### 2. `cmp-db`

- `postgresql-bootstrap.ts`
- `postgresql-adapter.ts`
- `postgresql-live-executor.ts`
- `CmpProjectDbBootstrapReceipt` 等 bootstrap/readback receipt 类型

当前状态：

- 已有 bootstrap contract
- 已有 query primitive adapter
- 已有真实 `psql` live executor

#### 3. `cmp-mq`

- `redis-routing.ts`
- `redis-bootstrap.ts`
- `redis-adapter.ts`
- `redis-cli-adapter.ts`

当前状态：

- 已有 namespace / lane / topic binding
- 已有 in-memory adapter
- 已有真实 `redis-cli` live adapter

#### 4. `cmp-runtime`

- `backend-contract.ts`
- `infra-bootstrap.ts`
- `infra-state.ts`
- `runtime-snapshot.ts` 已开始承载 `infraState`
- `runtime-recovery.ts` 已开始恢复 `infraState`

当前状态：

- 已能做 project-level infra bootstrap plan / receipt
- 已能把 bootstrap receipt 纳入 runtime infra state

#### 5. `AgentCoreRuntime`

当前新增或扩展了：

- `cmpInfraBackends`
- `createCmpProjectInfraBootstrapPlan(...)`
- `bootstrapCmpProjectInfra(...)`
- `getCmpProjectInfraBootstrapReceipt(...)`
- `listCmpProjectInfraBootstrapReceipts(...)`
- `getCmpRuntimeInfraProjectState(...)`

当前状态：

- 已能持有 git / dbExecutor / mq backend
- 已能做 project bootstrap
- 已能把 bootstrap receipt 写入 runtime infra state

### 二、`rax.cmp`

当前已经在 `src/rax/**` 里新增了：

- `cmp-types.ts`
- `cmp-config.ts`
- `cmp-facade.ts`
- `cmp-runtime.ts`
- `cmp-connectors.ts`
- `cmp-domain.ts`

并且已经总装到：

- `src/rax/facade.ts`
- `src/rax/runtime.ts`
- `src/rax/index.ts`

当前状态：

- `rax` / `raxLocal` 默认已经带 `cmp`
- `rax.cmp` 已经提供：
  - `create`
  - `bootstrap`
  - `readback`
  - `recover`
  - `ingest`
  - `commit`
  - `requestHistory`
  - `smoke`

### 三、`Section / StoredSection / Rules`

当前已经在：

- `src/rax/cmp-domain.ts`

显式定义了一等域模型：

- `CmpSection`
- `CmpStoredSection`
- `CmpRule`
- `CmpRulePack`
- `CmpRuleEvaluation`

这层已经不再是隐含 helper。

## 当前验证基线

以下验证已经在当前工作区真实跑过，并通过：

- `npm run typecheck`
- `npm run build`
- `npx tsx --test src/agent_core/cmp-git/*.test.ts src/agent_core/cmp-db/*.test.ts src/agent_core/cmp-mq/*.test.ts src/agent_core/cmp-runtime/*.test.ts src/agent_core/runtime.test.ts`
- `npx tsx --test src/rax/*.test.ts src/rax/cmp-*.test.ts src/agent_core/runtime.test.ts src/agent_core/cmp-runtime/*.test.ts`

最新综合结果：

- `219 pass`
- `0 fail`
- `1 skipped`

当前这个 `1 skipped` 是显式可选的 live smoke：

- `PRAXIS_CMP_INFRA_LIVE=1` 时才会跑：
  - live `git CLI`
  - live `psql`
  - live `redis-cli`
  - runtime bootstrap 整链 smoke

## 当前还没收好的部分

这部分是压缩后最重要的续工目标。

### 1. `Section / StoredSection / Rules` 还没有真正 lowering 到 `cmp-runtime` 主链

也就是说：

- `rax` 域模型已经有了
- 但 `ingest / commit / materialize / requestHistory / dispatch` 还没有真正消费这层对象

### 2. `active/passive flow` 还没有完全在真实 backend 上收口

现在已经有：

- live executor
- bootstrap
- readback
- runtime infra state

但还缺：

- active ingest -> section -> stored section -> git/db/mq lowering
- passive historical read -> stored section / rules / package 统一路径

### 3. `rax.cmp` 还没有形成更厚的 workflow integration

现在 `rax.cmp` 已成型，但更像“统一入口已存在”。

还没有完全做完的是：

- `core_agent -> rax.cmp -> cmp-runtime -> shared infra`
  这条链上对 section/rules 的显式参与

### 4. 五个 agent 还没开始细调

这是刻意延后的，不是漏做。

原因：

- 先稳住：
  - `rax.cmp`
  - workflow integration
  - `Section / StoredSection / Rules`
- 再细调五个 agent

### 5. 文档层还没提交

当前已新增但未提交的文档包括：

- `35-cmp-infra-closure-outline.md`
- `36-rax-cmp-workflow-integration-outline.md`
- `docs/ability/cmp-infra-closure-task-pack/**`
- `docs/ability/rax-cmp-workflow-task-pack/**`

## 下一步推荐顺序

压缩后恢复工作时，建议严格按这个顺序继续：

1. 把 `Section / StoredSection / Rules` 接进 `cmp-runtime`
2. 让 `ingest / commit / materialize / requestHistory / dispatch` 真正消费这些对象
3. 继续强化 `rax.cmp` 的 workflow integration
4. 做 preflight / gate / observability
5. 最后才开始五个 agent 的细调

## 当前不要做的事

- 不要先去调五个 agent prompt / config。
- 不要把 `CMP` 重新写成私有 `git_infra`。
- 不要把图里的 `DB(RAG)` 带回 `CMP`。
- 不要把 `.parallel-worktrees/` 误提交。
- 不要把当前未提交工作当作已经完成并已提交。
