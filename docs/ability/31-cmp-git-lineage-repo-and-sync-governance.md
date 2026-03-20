# CMP Git Lineage Repo And Sync Governance

状态：指导性分册，不是冻结实现。

更新时间：2026-03-20

## 这份文档要回答什么

`CMP` 的 canonical source 是 `git`。

既然如此，必须先把下面这些事情钉死：

1. 一个项目的 git 仓库怎么组织。
2. branch family 如何表达 agent lineage。
3. commit / PR / merge / promotion 分别代表什么。
4. 为什么必须逐级同步，不能越级。

## 先说结论

- 当前建议一项目一仓库。
- 这个仓库是项目级历史主干，不是 `CMP` 私有物。
- 每个 agent 在这个仓库里拥有自己的 branch family。
- branch family 默认包含：
  - `work/<agent-id>`
  - `cmp/<agent-id>`
  - `mp/<agent-id>`
  - `tap/<agent-id>`
- `CMP` 只负责系统化使用 `cmp/*` 线，但它必须理解整个 branch family。
- 同步和提升默认逐级，不允许常规越级。

## 项目级仓库模型

当前建议：

- 一个项目 -> 一个 `repo`
- 一个 agent -> 一组 lineage branches

例如主 agent：

- `work/main`
- `cmp/main`
- `mp/main`
- `tap/main`

子 agent `yahoo`：

- `work/yahoo`
- `cmp/yahoo`
- `mp/yahoo`
- `tap/yahoo`

## 为什么是一个 repo 多 branches

当前推荐这样做，而不是多 repo，原因有 4 个：

1. `git` 本来就擅长在同一仓库中表达谱系与分叉。
2. 人类工作流的 PR / merge / rollback / blame / audit 能天然复用。
3. 后续 `CMP/MP/TAP/work` 可以共享项目级历史骨架。
4. 上云、协作、CI/CD 接轨会更自然。

## branch family 的职责

### `work/<agent-id>`

作用：

- 表达该 agent 真正执行任务、写代码、处理工作产物的开发线。

### `cmp/<agent-id>`

作用：

- 表达该 agent 的上下文治理线。
- `CMP` 主要维护这一条。

### `mp/<agent-id>`

作用：

- 预留给后续 `MP` 的记忆治理线。

### `tap/<agent-id>`

作用：

- 预留给 `TAP` 工具制造与治理线。

## commit / PR / merge / promotion 的语义

### commit

在 `cmp/*` 线上，commit 代表：

- 一次上下文增量已被记录
- 一次结构化状态推进已经产生

它不自动代表“已经可以向更上层扩散”。

### PR

PR 代表：

- 子节点向直属父节点申请提升状态

例如：

- `cmp/yahoo -> cmp/main`

### merge

merge 代表：

- 父节点已经接住这次提升申请

它仍然不自动代表“祖先或全局都可见”。

### promotion

promotion 代表：

- checker + parent side 的 DB projection 已经确认这部分内容可以进入父节点的 promoted 视野

一句白话：

- commit = 记下来
- PR = 请求上交
- merge = 父亲接住
- promotion = 父亲决定能继续进更高层视野

## 逐级治理规则

这是 `CMP` 的核心纪律。

### 默认规则

- 子节点只能向直属父节点提 PR
- 只有直属父节点有权 merge 该 PR
- merge 之后仍需 checker / projection 才能 promotion
- 孙辈不能默认越级把 raw state 扔给祖先

### 同级交换

同级节点可以交换信息，但应视为：

- peer exchange
- 不是向更高层 promotion

### 父级平级传播

父级的同级传播不能由子节点自己做。

必须由父节点自己决定是否继续横向广播。

## 例子

如果：

- 1 级 agent 拥有 3 个 2 级 agent
- 每个 2 级 agent 又拥有 2 个 3 级 agent

那么：

- 3 级 agent 只能正常向自己的 2 级父节点提 `cmp/*` PR
- 2 级父节点 merge 后，才有资格把其中一部分 promotion 到自己的 checked / promoted state
- 1 级默认只看到 2 级已 promotion 的状态，而不是 3 级 raw history

## 哪些状态需要 ref/tag

当前建议至少要有两类额外引用：

### `checked snapshot refs`

作用：

- 标记 checker 已通过的状态点

### `promoted refs`

作用：

- 标记已可进入父节点或主 agent 可见面的状态点

这样可以避免“只靠 branch head 猜当前可用状态”。

## iterator 与 checker 的 git 侧职责

### iterator

负责：

- 创建 commit
- 管理 `cmp/*` 线上的推进动作
- 触发 PR / merge 流程

### checker

负责：

- 判断哪个 commit / merge 后状态当前可用
- 维护 checked state
- 决定哪部分值得 promotion

## 当前不要做错的事

- 不要把每次 commit 都当成全局可见状态。
- 不要把 merge 直接当成可分发状态。
- 不要让子节点直接越级 merge 到祖先 branch。
- 不要让 `cmp/*` 线的 PR/merge 和 `work/*` 线完全混为一谈。

