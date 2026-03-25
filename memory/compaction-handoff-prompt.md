# CMP / RAX CMP Compaction Handoff Prompt

下面是一份给压缩上下文后的新会话直接使用的 handoff prompt。

你可以在压缩后把下面整段直接发给新的模型：

---

当前唯一目标是继续在 `/home/proview/Desktop/Praxis_series/Praxis` 的 `cmp/mp` 分支上推进 `CMP`，并且优先做 `rax.cmp` / workflow integration，不先做五个 agent 的细调。

请先读取并对齐下面这些文件：

- [memory/current-context.md](/home/proview/Desktop/Praxis_series/Praxis/memory/current-context.md)
- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- [docs/ability/35-cmp-infra-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/35-cmp-infra-closure-outline.md)
- [docs/ability/36-rax-cmp-workflow-integration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/36-rax-cmp-workflow-integration-outline.md)
- [docs/ability/cmp-infra-closure-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/README.md)
- [docs/ability/rax-cmp-workflow-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/README.md)

当前已确认的关键事实：

1. `CMP` 使用传统数据库，不用 RAG/vector 作为真相源。
2. `MP` 后续才使用 `LanceDB`。
3. `git_infra` 是与多智能体系统并行的一层共享协作底座，不是 `CMP` 私有系统。
4. 每个 agent 可以和 shared `git_infra` 沟通，但不是每个 agent 各带一套 `git_infra`。
5. `rax.cmp` 现在已经开始存在，并已接进 `src/rax/facade.ts`、`src/rax/runtime.ts`、`src/rax/index.ts`。
6. `Section / StoredSection / Rules` 已经在 `src/rax/cmp-domain.ts` 中显式化。
7. 当前不要先做五个 agent 的细调，先把 `Section / StoredSection / Rules` 真正 lowering 到 `cmp-runtime` 和 workflow 主链。

当前已经落下来的关键代码包括：

- `src/agent_core/cmp-git/git-cli-backend.ts`
- `src/agent_core/cmp-db/postgresql-live-executor.ts`
- `src/agent_core/cmp-mq/redis-cli-adapter.ts`
- `src/agent_core/cmp-runtime/infra-bootstrap.ts`
- `src/agent_core/cmp-runtime/infra-state.ts`
- `src/agent_core/runtime.ts`
- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-connectors.ts`
- `src/rax/cmp-domain.ts`

当前最新验证基线：

- `npm run typecheck` 通过
- `npm run build` 通过
- `npx tsx --test src/rax/*.test.ts src/rax/cmp-*.test.ts src/agent_core/runtime.test.ts src/agent_core/cmp-runtime/*.test.ts`
  - `219 pass / 0 fail / 1 skipped`

当前工作区还有未提交改动，且 `.parallel-worktrees/` 是多智能体临时目录，提交前必须排除。

下一步最推荐的实现顺序：

1. 把 `Section / StoredSection / Rules` 接进 `cmp-runtime`
2. 让 `ingest / commit / materialize / requestHistory / dispatch` 真正消费这层对象
3. 继续深化 `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 的 workflow integration
4. 再做 preflight / gate / observability
5. 最后才开始五个 agent 的细调

要求：

- 使用中文
- 先全量阅读再动手
- 优先使用多智能体，但保持写域隔离
- 不要把 `CMP` 写回私有 `git_infra`
- 不要把图里的 `DB(RAG)` 带回 `CMP`
- 不要先去做五个 agent 的 prompt / config 微调

---
