# 2026-03-20 CMP Outline And Part Guides

## 当前阶段结论

`CMP(context management pool)` 的第一版架构总纲与四份指导性分册已经落地到文档。

当前目标不是立刻写代码，而是先把 `CMP` 的对象、边界、git/DB/MQ 契约与五 agent 运行流固定下来，给后续再拆任务包和大规模编码提供稳定底座。

## 当前新增文档

- `docs/ability/29-cmp-context-management-pool-outline.md`
- `docs/ability/30-cmp-core-interface-and-canonical-object-model.md`
- `docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md`
- `docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md`
- `docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md`

## 当前冻结的关键共识

- `CMP` 不是被动记忆检索层，也不是 summary service，而是主动上下文治理池。
- `CMP` 的 canonical source 是项目级 `git repo`，而不是 embedding/RAG 库。
- 一个项目对应：
  - 一个 `repo`
  - 一个 `CMP DB`
  - 一套 `MQ`
- 一个 agent 拥有自己的 branch family：
  - `work/<agent-id>`
  - `cmp/<agent-id>`
  - `mp/<agent-id>`
  - `tap/<agent-id>`
- `CMP` 内固定五个 agent：
  - `ICMA`
  - `Iterator Agent`
  - `Checker Agent`
  - `DBAgent`
  - `Dispatcher Agent`

## 当前最重要的治理纪律

- `git`、`DB`、`MQ` 默认都遵守逐级管理，不允许常规越级同步 raw state。
- 子节点只能直接向直属父节点提交提升申请。
- 只有父节点有权继续向更上层 promotion。
- 广播发起点是各 agent 的 `ICMA`。
- 广播内容粒度由对应 `core_agent` 决定。
- 广播方向仅允许：
  - 向父节点
  - 向平级节点
  - 向子代节点
- “父级的平级扩散”必须由父节点中转。

## 当前对 DB 的定位

- `CMP DB` 只为 `CMP` 服务。
- 它不是历史真相源，而是：
  - 索引层
  - checked state 投影层
  - context package / skill 交付层
- `checker` 管 git 侧状态维护与 checked usable state。
- `dbagent` 管 DB 侧实时性、高信噪比与可交付性。

## 当前对后续实现拆解的建议

后续代码任务建议沿四部分拆：

1. `CMP` core interface + canonical object model
2. git repo / lineage / sync governance
3. DB projection + MQ neighborhood broadcast contract
4. five-agent runtime + active/passive flow + child-context dispatch

这四部分组合起来，才算真正落实 `CMP` 的第一版完整能力。
