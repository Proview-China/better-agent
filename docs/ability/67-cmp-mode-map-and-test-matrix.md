# CMP Mode Map And Test Matrix

状态：联调研究基线 / docs-first 工作稿。

更新时间：2026-04-11

## 这份文档回答什么

这份文档专门回答：

1. `CMP` 当前“真正可用的模式”到底有哪些。
2. 哪些是异步工位，哪些是对象流向，哪些是外层入口模式。
3. 后续联调和提示词工程，应该先测什么，再测什么。
4. 为什么 `ICMA -> Iterator -> Checker -> DBAgent -> Dispatcher` 不能被误读成“工作流程”。

一句白话：

- 这份文档不是再解释 `CMP` 存不存在。
- 它是给后面的联调、测试矩阵、prompt engineering 立工作底图。

## 当前唯一目标

在不破坏已经成立的：

- `core_agent -> rax.cmp -> cmp-runtime -> five-agent runtime`

这条主链的前提下，
先把 `CMP` 当前真实可测的模式空间画清楚，
再按模式做测试和联调，
最后才进入 prompt engineering 收敛。

## 先说最重要的纠偏

### 1. 五角色不是顺序流水线

`CMP` 不是：

- 一个大函数
- 里面按 `ICMA -> Iterator -> Checker -> DBAgent -> Dispatcher`
  排队顺序执行

`CMP` 当前更准确的实现方向是：

- 五个独立 loop/runtime
- 各自长期驻留
- 通过对象、事件、包、审批和回执彼此接缝

一句白话：

- 五角色是异步工位
- 不是单线程车间

### 2. 那条“五段箭头”只表示对象治理流向

`ICMA -> Iterator -> Checker -> DBAgent -> Dispatcher`

只能表示一类对象在主动治理面中的常见加工流向，例如：

- ingress material
- candidate commit
- checked state
- package family
- routed delivery

它不是：

- 调度顺序
- 时间顺序
- “上一个干完下一个才能动”的串行流程

## CMP 的四层模式

后续所有测试与 prompt engineering，都必须同时看下面四层。

## Layer 1. 工作模式

### A. `active`

作用：

- 持续治理当前工作现场
- 持续接住新增运行材料
- 持续推进 checked / package / delivery

典型事件：

- ingest
- commit
- checked
- project
- route

### B. `passive`

作用：

- 按需返回高信噪比历史上下文
- 不持续主导当前现场

典型事件：

- request historical context
- resolve checked snapshot
- materialize passive package
- return to core

一句白话：

- `active` 是在线治理面
- `passive` 是按需回包面

## Layer 2. LLM 参与模式

每个角色当前都支持：

- `rules_only`
- `llm_assisted`
- `llm_required`

### A. `rules_only`

用途：

- 测状态机
- 测对象模型
- 测规则面和回退面

### B. `llm_assisted`

用途：

- 模型参与
- 失败可 fallback
- 适合作为默认联调档位

### C. `llm_required`

用途：

- 强制真实模型路径
- 不允许 fallback 蒙混过关
- 是 prompt engineering 收敛时最有价值的验收档位

一句白话：

- `rules_only` 看骨架
- `llm_assisted` 看可用性
- `llm_required` 看真实上限

## Layer 3. 包/路由模式

这层主要由 `Dispatcher` 主导，决定“同样是包，到底该怎么走”。

当前正式模式包括：

- `core_return`
- `child_seed_via_icma`
- `peer_exchange_slim`
- `historical_reply_return`
- `lineage_delivery`

对应的目标 ingress 当前包括：

- `core_agent_return`
- `child_icma_only`
- `peer_exchange`
- `lineage_delivery`

一句白话：

- 这层不是“内容写得好不好”
- 而是“该送给谁、怎么送、边界怎么守”

## Layer 4. 外层使用模式

`rax.cmp` 目前定义的入口模式包括：

- `active_preferred`
- `passive_only`
- `mixed`

它们不是五角色内部 loop 模式，
而是外层使用 `CMP` 的产品/工作风格模式。

一句白话：

- 这是“怎么用 CMP”
- 不是“CMP 内部怎么干活”

## 五个异步工位的当前定位

## 1. `ICMA`

它是什么：

- ingress context shaper

它长期处理什么：

- runtime material
- task intent chunking
- controlled fragments
- operator / child guide

它最关键的模式敏感点：

- chunking mode
- fragment inference
- seed discipline

它不是：

- 最终裁决者
- git 主推进者
- DB 真相写手

## 2. `Iterator`

它是什么：

- 可审查推进工位

它长期处理什么：

- candidate commit
- review ref
- progression verdict

它最关键的模式敏感点：

- progression hold / advance
- commit 作为最小审查单元
- review ref 稳定性

它不是：

- checker
- dbagent
- dispatcher

## 3. `Checker`

它是什么：

- checked review / evidence restructure 工位

它长期处理什么：

- split
- merge
- trim
- checked-ready
- suggest-promote

它最关键的模式敏感点：

- checked 与 promote 分离
- executable semantics 而不是 prose-only advice
- parent-side assistance 与 local check 的区别

## 4. `DBAgent`

它是什么：

- package / snapshot / passive reply 的物化工位

它长期处理什么：

- primary package
- timeline package
- task snapshot
- passive reply
- reintervention request
- parent-side review entry

它最关键的模式敏感点：

- active package family
- passive packaging strategy
- parent review / reintervention

## 5. `Dispatcher`

它是什么：

- lineage-aware context logistics 工位

它长期处理什么：

- child seed
- peer exchange
- passive return
- delivery receipt
- approval state

它最关键的模式敏感点：

- target ingress
- body strategy
- scope policy
- peer approval discipline

## 当前联调真正应该关注的三条主轴

## Axis A. 模式正确性

要回答：

- 当前触发的是 `active` 还是 `passive`
- 当前路由的是 `child_seed`、`peer_exchange` 还是 `historical_return`
- 当前是 `rules_only`、`llm_assisted` 还是 `llm_required`

如果这三件事没先钉死，
后面的 prompt engineering 极容易改偏。

## Axis B. 信噪比

要回答：

- `ICMA` 有没有切出真正高信噪比的 intent chunk
- `Checker` 有没有把 checked 和 promote 真分开
- `DBAgent` 有没有把 active / timeline / passive reply 真分开
- `Dispatcher` 有没有把 child / peer / passive return 真分开

一句白话：

- 看的是“有没有分工干净”
- 不是“有没有一堆输出”

## Axis C. 自主性与异步性

要回答：

- 五个工位是否都能独立推进自己的对象与事件
- 失败时是否能在本工位内 fallback / recover
- 不依赖单个串行 helper 时，角色意义是否依然成立

一句白话：

- 看的是“是不是五个真工位”
- 不是“demo 能不能串一遍”

## 当前测试矩阵 v0

后续优先按下面这个矩阵推进。

## Phase 1. 骨架与契约

目标：

- 证明五工位和对象模型成立

优先测试：

- `src/agent_core/cmp-five-agent/*.test.ts`
- `src/agent_core/runtime.cmp-live.test.ts`
- `src/agent_core/runtime.cmp-five-agent.test.ts`
- `src/rax/cmp-runtime.test.ts`
- `src/rax/cmp-facade.test.ts`

重点观察：

- 角色 stage 是否独立
- role summary / live summary 是否可回读
- package mode / scope policy 是否可见

## Phase 2. 严格 live 主链

目标：

- 证明真实模型路径下，主动/被动主面能稳定工作

优先 smoke：

- `src/rax/cmp-five-agent-live-smoke.ts --strict-live --no-retry`

先测：

- `active`
- `passive`

再看：

- 全角色耗时
- fallback 是否出现
- 哪个角色最慢

## Phase 3. 路由专项

目标：

- 证明 `Dispatcher` 不是“随便送”

优先覆盖：

- `child_seed_via_icma`
- `historical_reply_return`
- `peer_exchange_slim`

重点观察：

- `targetIngress`
- `bodyStrategy`
- `scopePolicy`
- peer approval state

## Phase 4. Prompt Engineering 主战区

第一优先角色：

- `ICMA`
- `Checker`
- `DBAgent`

原因：

- 这三个角色最直接决定信噪比和延迟
- 也是后续迁移经验到 `MP` 时最值钱的部分

`Dispatcher` 第二优先，
因为它的 prompt 当前已经比较窄，
更多像 route contract 稳定性问题。

### Prompt 对照基线

为了在现有实现上做性能对照，
当前建议不直接覆盖 baseline，
而是在现有 prompt pack 上增加可切换变体。

当前第一版建议保留：

- `baseline`

并增加：

- `lean_v2`

使用原则：

- `baseline` 继续代表当前默认行为
- `lean_v2` 用来压缩 `ICMA / Checker / DBAgent` 的 `system_prompt`、`mission`、`guardrails`
- 两者共用同一套 runtime、同一套 smoke、同一套上游

一句白话：

- 不换系统
- 只换 prompt 负载
- 这样才有真正可对照的性能差异

### 第一轮真实对照读回

2026-04-11 在当前 `integrate-dev-master-cmp` 工作树上，
已使用同一 smoke 入口对 `baseline` 与 `lean_v2` 做首轮 strict-live 对照。

当前已读回的样本包括：

- `ICMA`
- `Checker`
- `DBAgent passive`

第一轮现象：

- `ICMA`: `lean_v2` 明显更快
- `Checker`: `lean_v2` 反而明显更慢
- `DBAgent passive`: `lean_v2` 略慢于 baseline

这轮最重要的结论不是“短 prompt 一定更快”，而是：

- `ICMA` 适合继续压缩系统提示与 guardrails
- `Checker` 与 `DBAgent` 不能只做简单缩写，必须进一步按 schema 与任务拆分来优化

### 第二轮真实对照读回

在确认 prompt variant 已真正接入角色 runtime 之后，
又新增了一个更贴工作方式的：

- `workflow_v3`

它主要只重做：

- `Checker`
- `DBAgent`

第二轮可信对照结果：

- `ICMA`
  - `baseline`: 24.7s
  - `lean_v2`: 20.7s
  - `workflow_v3`: 16.4s
- `Checker`
  - `baseline`: 9.9s
  - `lean_v2`: 34.0s
  - `workflow_v3`: 6.6s
- `DBAgent passive`
  - `baseline`: 14.5s
  - `lean_v2`: 12.5s
  - `workflow_v3`: 9.7s

当前解释：

- `ICMA` 继续证明“压缩 root-system 附近的说明负载”是有效方向
- `Checker` 的关键不是单纯缩写，而是把 `checked core / suggest-promote / split-merge` 明确按工作方式拆开
- `DBAgent passive` 的关键不是继续堆解释，而是把“最小完整 clean historical return”放到 prompt 的中心

### 第三轮真实对照读回

在继续按真实工作方式重写之后，
新增了：

- `workmode_v5`
- `workmode_v6`

第三轮先用小范围 strict-live 只对照：

- `ICMA`
- `Checker`
- `DBAgent passive`

第三轮可信结果：

- `ICMA`
  - `baseline`: 24.7s
  - `workmode_v5`: 失败，出现 non-JSON 输出
  - `workmode_v6`: 23.0s
- `Checker`
  - `baseline`: 13.2s
  - `workmode_v5`: 14.7s
  - `workmode_v6`: 5.0s
- `DBAgent passive`
  - `baseline`: 19.7s
  - `workmode_v5`: 19.8s
  - `workmode_v6`: 4.8s

当前解释：

- `workmode_v5` 在 `ICMA` 上说明过重，已经开始诱导模型偏离 strict JSON 输出纪律，应视为淘汰方向
- `workmode_v6` 证明“按真实工位改写 prompt，同时进一步收紧 contract 纪律”是当前最有效方向
- `Checker` 与 `DBAgent passive` 在 `workmode_v6` 下已经同时拿到：
  - 更贴工作方式
  - 更好的 strict-live 效果
  - 更快的响应时间

### 第四轮整轮对照读回

在继续优化后，
没有再强行把五角色都改成同一版工作方式 prompt，
而是新增了混合版：

- `workmode_v8`

当前策略：

- `ICMA / Iterator / Dispatcher` 继续保留 baseline 风格
- `Checker / DBAgent` 使用更贴工作方式的 `workmode_v6` 风格

整轮 strict-live 可信结果：

- `baseline`
  - 整轮：约 `63s`
- `workmode_v8`
  - 整轮：约 `49s`

按角色看：

- `ICMA`
  - `baseline`: 18.9s
  - `workmode_v8`: 20.7s
- `Iterator`
  - `baseline`: 3.3s
  - `workmode_v8`: 3.6s
- `Checker`
  - `baseline`: 7.8s
  - `workmode_v8`: 4.9s
- `DBAgent active`
  - `baseline`: 13.9s
  - `workmode_v8`: 10.0s
- `Dispatcher active`
  - `baseline`: 1.7s
  - `workmode_v8`: 2.1s
- `DBAgent passive`
  - `baseline`: 12.7s
  - `workmode_v8`: 4.8s
- `Dispatcher passive`
  - `baseline`: 2.7s
  - `workmode_v8`: 1.6s

当前结论：

- `workmode_v8` 是当前最像真实工作流、同时又能守住 strict-live 效果和整体性能的版本
- 最优策略不是“五角色统一一套 prompt 风格”
- 而是按工位分层取最优：
  - 前处理与控制台保持窄而稳
  - 守门与持久化工位更贴真实工作方式

## 当前已知研究假设

### Hypothesis 1

`ICMA` 当前最容易过厚。

原因：

- 同时做切块
- fragment 推断
- guide 生成

### Hypothesis 2

`DBAgent` 在 passive 模式下最容易 prompt 负担过重。

原因：

- 同时要考虑 primary / timeline / task snapshot / passive strategy

### Hypothesis 3

`Checker` 的主要价值不在“更长输出”，而在“更稳定的结构化 checked semantics”。

### Hypothesis 4

`Dispatcher` 更像 contract-stability 角色，
其 prompt 优化重点不是扩写，而是继续压短、压硬、压 schema。

## 多智能体开工建议

为了真正开始，而不是停在单线程研究，建议按下面方式并行：

### Agent A. Active 模式研究

只负责：

- `ICMA`
- `Iterator`
- `Checker`
- `DBAgent active`
- `Dispatcher active`

目标：

- 建立 active 模式的角色、事件、对象、延迟基线

### Agent B. Passive 与路由研究

只负责：

- `DBAgent passive`
- `Dispatcher passive`
- `peer exchange`
- `child seed`

目标：

- 建立 passive / routing 模式的边界与测试缺口

### Agent C. Prompt Engineering 预审

只负责：

- 五角色 prompt pack
- live mode
- schema / contract

目标：

- 找出真正该先改的 prompt 瓶颈

## 当前不要做错的事

- 不要把对象流向图当成调度模型。
- 不要只测 `active`，忽略 `passive`。
- 不要只测 `llm_assisted`，不跑 `llm_required`。
- 不要把 `Dispatcher` 的路由 contract 问题误看成普通文风问题。
- 不要一上来同时大改五个角色 prompt。

## 最新联调结论

### `peer approval` 全链验证新增了什么

当前已经补上两类最关键的验证：

- `runtime summary` 级：
  `peer_exchange` 从 `pending_parent_core_approval` 变成 `approved` 后，
  `pendingPeerApprovalCount` 会从 `1 -> 0`，
  `approvedPeerApprovalCount` 会从 `0 -> 1`，
  并且 dispatcher bundle 的 `approvalStatus` 会更新为 `approved`。

- `facade/readback/smoke` 级：
  同一个 session 里，
  `cmp.roles.approvePeerExchange(...)` 之后，
  `statusPanel.requests` 会反映：
  - `pendingPeerApprovalCount = 0`
  - `approvedPeerApprovalCount = 1`
  同时 `cmp.five_agent.flow` 这条 smoke check 会从 `degraded` 回到 `ready`。

### 这次联调最重要的白话结论

`peer approval` 通过后，
`CMP` 的 **flow 层** 会恢复，
但 **整个 final acceptance / 整体 readbackStatus** 不保证自动一起转绿。

原因很简单：

- `cmp.five_agent.flow`
  只关心：
  - pending peer approval
  - pending reintervention

- 但 `final acceptance`
  还同时受：
  - object model
  - bundle schema
  - TAP execution bridge
  - live infra
  - recovery
  这些 gate 影响

一句白话：

- `peer approval` 过了，说明“这条 peer 流动不再卡审批”
- 但不等于“整个 CMP 项目面板已经完全健康”

### 这对后续联调意味着什么

后面看 `peer_exchange` 的效果时，要分两层判断：

- 第一层：
  `flow` 有没有恢复
- 第二层：
  `final acceptance` 为什么还没恢复

不要把这两层混成一个判断。

## 当前阶段一句话收口

`CMP` 当前最值得研究的，不是“它有没有五个角色”，而是：

- 这五个异步工位在不同模式下到底怎么协作
- 哪些模式已经能用
- 哪些模式还缺测试
- 哪些 prompt 真的决定性能上限
