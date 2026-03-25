# CMP Infra Closure Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-24

## 这份文档要回答什么

`CMP infra` 现在已经不是空白阶段了。

我们已经完成了两类工作：

1. `CMP` 的协议、状态机、主动/被动链、五个 agent 运行流都已经落过一轮。
2. `git / PostgreSQL / Redis` 的第一波真实 backend contract、bootstrap skeleton、runtime 注入边界也已经落下来了。

所以当前不再需要继续讨论：

- `CMP` 是什么
- 为什么不用 embedding/RAG 作为 `CMP` 真相源
- branch family 为什么是 `work/cmp/mp/tap`
- 父/平级/子代广播为什么必须逐级管理

现在要回答的是更收口、更工程化的问题：

1. `CMP infra` 还差哪些最后一公里，才能算真正收尾。
2. 这些剩余工作应该怎么拆，才不会把 runtime、真实 backend、五个 agent 的职责搅在一起。
3. 这一阶段的完成定义到底是什么。

一句白话：

- 这份文档讨论的不是“CMP 的原则”
- 而是“CMP infra 还差什么，才能放心进入五个 agent 的真正落地”

## 先说结论

- `CMP infra` 当前已经完成：
  - protocol layer
  - in-memory/runtime sample layer
  - first-wave backend contract layer
  - first runtime bootstrap boundary
- `CMP infra` 当前还没有真正收尾。
- 剩余工作应集中在 4 个 closure area：
  1. real backend execution and readback closure
  2. runtime bootstrap / wiring / recovery closure
  3. active-passive flow on real infra closure
  4. five-agent preflight / observability / final infra gates
- 这一步依然不建议直接把五个 agent 拆成五个独立服务。
- 最稳妥的顺序仍然是：
  1. 先把 `CMP infra` 做到真正可运行、可回读、可恢复
  2. 再进入五个 agent 的默认配置、角色收口和联调

## 当前已完成到哪里

## 1. `git`

当前已经有：

- project repo bootstrap plan
- branch runtime
- checked/promoted ref contract
- in-memory git backend
- runtime bootstrap 侧的接入点

还没有真正收尾的部分：

- live git executor / real CLI or process runner
- repo readback 与 runtime state 的双向校对
- bootstrap repeat / already-exists / repair path
- interruption 后的 ref/state consistency 收口

## 2. `PostgreSQL`

当前已经有：

- project DB topology
- shared tables / local hot tables schema
- bootstrap SQL contract
- readback receipt
- query primitive adapter

还没有真正收尾的部分：

- real pg client execution layer
- transaction boundary 的 runtime 接入
- readback receipt 到 runtime consistency decision 的收口
- durable recovery / hydration 的正式写入点

## 3. `Redis`

当前已经有：

- namespace contract
- lane selection
- topic binding
- in-memory redis adapter
- publish / critical escalation 的第一版接口

还没有真正收尾的部分：

- real redis client execution layer
- publish / ack / retry / expiry 的更完整路径
- live readback / replay / reconnect 处理
- neighborhood routing 与 runtime delivery 的更深整合

## 4. `runtime`

当前已经有：

- `cmpInfraBackends`
- `createCmpProjectInfraBootstrapPlan(...)`
- `bootstrapCmpProjectInfra(...)`
- runtime 可持有真实 backend contract

还没有真正收尾的部分：

- bootstrap receipt -> runtime durable state 的正式接入
- bootstrap / recovery 与 checkpoint 的正式桥接
- active/passive path 在 real backend 上的真正 lowering
- final preflight gate / smoke gate / observability gate

## 为什么这一阶段要叫 closure，而不是再来一轮 bootstrap

因为现在问题已经不是“能不能初始化”了，而是：

- 初始化之后能不能长期运行
- 重启之后能不能恢复
- 回读结果能不能和 runtime 状态对得上
- active/passive flow 在真实 backend 上能不能不漂
- 后面五个 agent 接进来时，会不会发现 infra 其实还不稳

一句白话：

- bootstrap 只是“起起来”
- closure 要求“起起来以后不散架”

## 本轮收尾阶段的 4 个 area

## Area 1. Real Backend Execution Closure

目标：

- 把当前的 in-memory backend contract，补成真实 backend execution path

包含：

- git executor
- PostgreSQL execution layer
- Redis execution layer
- error model / retry / readback / already-exists / repair path

不包含：

- 五个 agent 的角色配置

## Area 2. Runtime Closure

目标：

- 把 `CMP infra` 的 bootstrap、wiring、checkpoint、recovery、hydration 做到真正可接主线程

包含：

- runtime durable write-in points
- runtime bootstrap receipt consumption
- runtime recovery/hydration
- runtime consistency guard

不包含：

- 新一轮协议发明

## Area 3. Flow Closure

目标：

- 让 active mode 和 passive mode 在真实 backend 上都能跑通

包含：

- active ingest -> git/db/mq lowering
- passive historical read path
- parent-child reseed
- peer exchange stays local
- escalation exception on real backend

不包含：

- 五个 agent 的最终提示词或角色配置细节

## Area 4. Preflight And Gate Closure

目标：

- 在五个 agent 真正接入之前，把 infra 最后的观测、门控和 smoke 证据收口

包含：

- bootstrap gate
- readback gate
- recovery gate
- multi-agent neighborhood gate
- five-agent preflight checklist

不包含：

- 五个 agent 的全部实作

## 与图的对齐结论

按当前图和你前面的口径综合起来，这一轮 `CMP infra closure` 要继续遵守下面几条：

1. `Git Infra` 仍然是共享层级，不是 `CMP` 独占物。
2. `CMP` 的 DB 继续按传统 DB 写，不按图里的 `DB(RAG)` 写。
3. `CMP` 仍然通过 interface 与 `core_agent` 主链连接。
4. `CMP` 和 `TAP` 是并列池，但 `CMP` 的 infra 收尾不应回头扩写 `TAP`。
5. `MP` 继续保持独立方向，后续再按 `LanceDB` 体系做，不混进这轮 `CMP infra closure`。

## 当前不要做错的事

- 不要把 `CMP infra closure` 变成五个 agent 的实现总包。
- 不要把 `MP`、`TAP`、`CMP` 的 infra 收尾混成一个大阶段。
- 不要因为现在已经有 in-memory backend，就误以为 runtime recovery 已经真的完成。
- 不要把图里的旧草图标签重新带回 `CMP` 的 DB 设计。
- 不要把“可以 bootstrap”误当成“可以稳定长期运行”。

## 这一阶段的最小完成定义

只有同时满足下面这些条件，才算 `CMP infra` 真正收尾：

1. `git / PostgreSQL / Redis` 都有真实 execution path，而不是只有 contract。
2. runtime 能消费 bootstrap/readback receipt，并把它们纳入 durable state。
3. active / passive flow 能在真实 backend 上跑通最小链路。
4. recovery / hydration / interruption path 有明确证据。
5. 五个 agent 接入前的 preflight gate 已经明确，不再靠口头约定。

## 建议的后续文档顺序

在这份总纲之后，建议紧接着拆一包：

- `CMP infra closure task pack`

这包任务清单建议继续拆成 4 个 part：

1. real backend executors and readback closure
2. runtime bootstrap / checkpoint / recovery closure
3. active-passive flow and delivery closure
4. preflight, observability, and final gates

一句话收口：

- `CMP infra` 现在已经过了“从 0 到 1”的阶段
- 接下来要做的是把最后一公里收掉，让它真的能托住五个 agent
