# CMP DB Projection And Neighborhood Broadcast Contract

状态：指导性分册，不是冻结实现。

更新时间：2026-03-20

## 这份文档要回答什么

既然 `CMP` 的真相源是 `git`，那数据库和消息队列就必须被定义清楚：

1. `CMP DB` 到底存什么。
2. 它和 `git` 的关系是什么。
3. `MQ` 的广播拓扑是什么。
4. 为什么广播不能做成谁都能订阅的全局 pub/sub。

## 先说结论

- `CMP DB` 只为 `CMP` 服务。
- `CMP DB` 不是历史真相层，而是投影层、索引层、交付层。
- 当前建议一项目一个 `CMP DB`。
- 逻辑上每个 agent 应有自己的热状态表。
- 同时必须有项目级共享控制表。
- `MQ` 的广播发起点是各个 agent 的 `ICMA`。
- 广播内容粒度由当前 `core_agent` 决定。
- 广播方向严格限制为：
  - 向父节点
  - 向平级节点
  - 向子代节点
- 跨父级的横向传播必须由父节点中转。

## `CMP DB` 的定位

当前建议 `CMP DB` 只做三类东西：

### 1. 索引

作用：

- 快速定位某个 lineage / branch / snapshot / package 当前在哪。

### 2. 投影

作用：

- 把 `git` 历史投影成结构化 current-state / checked-state / promoted-state。

### 3. 交付

作用：

- 存储可直接分发给 agent 的 context package / skill / 状态缩影。

## 什么不应该进 `CMP DB`

- 不应该把未经检查的 raw 历史偷偷当成第二事实源长期私藏。
- 不应该把 embedding / 向量召回层混进来。
- 不应该让 DB 决定“哪版 git 历史是真的”。

这件事是 checker 管，不是 DB 管。

## 数据表分层

### A. agent 私有热表

逻辑上每个 agent 至少要有自己的热状态表。

例如可接受：

- `cmp_events_<agent-id>`
- `cmp_snapshots_<agent-id>`
- `cmp_packages_<agent-id>`
- `cmp_dispatch_<agent-id>`

这里主要存：

- local raw events
- candidate snapshots
- checked package drafts
- 局部 dispatch 状态

### B. 项目共享控制表

项目级共享表至少建议有：

- `agent_registry`
- `agent_lineage`
- `branch_registry`
- `sync_event_registry`
- `promotion_registry`
- `delivery_registry`

一句白话：

- agent 表存“自己的热状态”
- 共享表存“全局对齐关系”

## visibility / promotion 纪律

当前建议每条投影型对象至少有下面这些状态之一：

- `local_only`
- `submitted_to_parent`
- `accepted_by_parent`
- `promoted_by_parent`
- `dispatched_downward`
- `archived`

这意味着：

- 子 agent 的状态默认不自动进入父节点可见面
- 必须经过提交、接收、提升三步

## `DBAgent` 的职责

### `DBAgent` 负责什么

- 把 checker 已认可的状态投影入 DB
- 维持 DB 的实时性
- 维持 DB 的高信噪比
- 产出可交付的 context package / skill / summary artifact

### `DBAgent` 不负责什么

- 不负责判定 git 历史真伪
- 不负责自己发明新的 canonical history
- 不负责跨层越级提升

## `MQ` 的邻接广播模型

当前必须明确：

- 广播发起点是各个 agent 的 `ICMA`
- 广播内容粒度由当前 `core_agent` 决定
- 广播不是全局扩散，而是邻接传播

## 广播允许方向

### 1. 向父节点广播

作用：

- 子节点把重要上下文变化逐级上报给直属父节点

### 2. 向平级节点广播

作用：

- 同级节点互相交换必要信息

### 3. 向子代节点广播

作用：

- 父节点把已经过筛的高信噪比上下文播给子代

## 广播不允许方向

- 不允许默认向祖先越级广播 raw state
- 不允许默认向“父级的同级”直接广播
- 不允许默认向无关 lineage 节点广播

一句白话：

- 我只能和“我爸、我同事、我孩子”这个局部圈正常广播
- 更大范围扩散必须逐层中转

## 为什么“父级的同级传播”要由父亲中转

因为父节点才拥有：

- 对子节点 raw 信息的筛选权
- 对是否值得横向扩散的判断权
- 对上级信噪比的最终责任

所以：

- 子节点不能自己去打扰“父亲的同事”
- 必须由父节点自己决定要不要转发

## `MQ` topic 结构建议

当前建议按邻接和 lineage 做 topic，而不是按“全局一锅炖”做 topic。

例如：

- `project.<id>.agent.<agent-id>.local`
- `project.<id>.agent.<agent-id>.to-parent`
- `project.<id>.agent.<agent-id>.peer`
- `project.<id>.agent.<agent-id>.to-children`
- `project.<id>.agent.<agent-id>.promotion`

## 极少数越级例外

当前建议只保留一种极窄的例外：

### `critical escalation`

满足全部条件时，才允许越级：

- 直属父节点失联或不可恢复
- 当前事件属于系统级严重风险
- checker / guardian policy 判定为 `critical`
- 越级内容只能是 alert envelope，不是 raw context dump

## 当前不要做错的事

- 不要把 `CMP DB` 做成第二真相源。
- 不要把 `MQ` 做成全局自由广播系统。
- 不要让所有节点都能订阅所有子孙事件。
- 不要让 `DBAgent` 抢走 checker 的历史裁决权。

