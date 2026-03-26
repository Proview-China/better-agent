# CMP Iterator Rules

状态：冻结设计草案 v0。

更新时间：2026-03-26

## 这份文档解决什么问题

`TAAP` 已基本完成，主 agent 的上下文不再应是被动堆积，而应通过 `agent-loop-runtime`
主动整理后，经 `CMP` 进入长期存储链。

当前链路的大致形态已经明确：

1. `TAAP` 侧 `agent-loop-runtime` 通过 interface 接到 `CMP`
2. `CMP` 中的 `Input-Agent` 把上游上下文转换成内部事件
3. 这些事件被整理成 `section`
4. `section` 进入 Redis 队列后交给 `DB-Agent`
5. `DB-Agent` 将其持续化为 `Stored-Section`
6. `Iterator` 再对 `Stored-Section` 与新进 section 做关系判断
7. 通过判断后，结果返回 `Stored-Agent`，继续供 `RAG` 存储

在这条链里，当前缺的不是：

- 某个 DB 怎么建
- 某个 RAG 怎么索引
- 某个 runtime 怎么调度

真正缺的是：

- `Iterator` 应该按什么规则判断 section
- 什么样的 section 可以被当成长期知识块
- 什么样的 section 应被拆分、合并、更新、继续迭代或拒绝
- `Iterator` 与 `Checker` 的边界如何划分

一句白话：

- `Input-Agent` 负责把上下文变成 section
- `DB-Agent` 负责把 section 落成 `Stored-Section`
- `Iterator` 负责判断“这块东西到底该怎么存”

## 先说结论

- `Iterator` 是 `CMP` 内部负责 section 关系整理的主动 agent，不是被动过滤器。
- `Iterator Rules` 的职责只有两个：
  - 粒度检查
  - 历史层级检查
- `Iterator Rules` 不直接写 DB，不直接改 Git，不直接做索引。
- `Iterator Rules` 只输出结构化动作：
  - `store`
  - `split`
  - `merge`
  - `update`
  - `iterate`
  - `delete`
  - `reject`
- `Checker` 可以继承这些规则继续做更重的历史纠偏与 Git Infra 对齐，但这些不属于 `Iterator`
  自身职责。

一句白话：

- `Iterator` 不是存储器
- `Iterator` 是存储前的裁判

## 当前口径

第一版先冻结下面这些共识：

- `Iterator` 只处理 `section -> Stored-Section` 之间的存储前判断
- `Iterator` 不直接写 DB
- `Iterator` 不直接做 RAG 索引
- `Iterator` 不直接做 Git Infra 对齐
- `Iterator` 的规则只输出有限动作：
  - `store`
  - `split`
  - `merge`
  - `update`
  - `iterate`
  - `delete`
  - `reject`
- `Checker` 可以继承 `Iterator Rules`，但 `Checker` 的 Git 对齐逻辑不回流到 `Iterator` 第一版定义中

一句白话：

- `Iterator` 回答的是“这块东西该怎么存”
- `Checker` 回答的是“存完之后还要不要继续纠偏”

## 与现有 Praxis 架构的关系

这份文档描述的是 `CMP` 这条新链路里的角色口径。

这里的：

- `Input-Agent`
- `DB-Agent`
- `Iterator`
- `Checker`

都应理解为 `CMP` 侧的职责角色，而不是当前 `agent_core` 里已经存在的正式模块名。

它和现有 Praxis 架构的关系，第一版先按下面这条原则对齐：

- `TAAP` 负责上游 agent run 与主动上下文整理入口
- `CMP` 负责把上下文转成 section、持续化 section、比较 section 关系
- `TAP` 继续负责能力治理、审核、provisioning、activation、execution governance
- `CapabilityPool` 继续作为 execution plane 保留

这意味着：

- `CMP Iterator Rules` 不替代 `TAP` 的 mode/risk/governance 规则
- `CMP Iterator Rules` 只补“section 如何成为长期知识块”这条空白

一句白话：

- `TAP` 解决的是“能力怎么被治理”
- `CMP` 解决的是“上下文怎么被整理并长期存储”

## 规则目标

`Iterator Rules` 的目标，是保证返回 `Stored-Agent` 的内容已经具备“长期知识块”的基本形状，
而不是把上游运行时碎片直接写进 DB。

第一版固定只服务以下两个目标。

### 1. 粒度检查

判断一个进入 `Iterator` 的 `section`，是否已经构成一个可长期存储的最小语义块。

这里的“最小语义块”至少满足：

- 只有一个稳定主题
- 离开当前 run 后仍可理解
- 不依赖隐藏上下文才能成立
- 适合被未来 agent 再次检索与复用

### 2. 历史层级检查

判断一个 `section` 与已有 `Stored-Section` 之间的关系。

至少要区分下面这些关系：

- 同层新版本
- 父子补充
- 并列重复
- 冲突待定
- 过时残留

### 3. 动作收敛

`Iterator` 不输出模糊判断，只输出有限动作。

这套动作是：

- `store`
- `split`
- `merge`
- `update`
- `iterate`
- `delete`
- `reject`

### 4. 存储前净化

`Iterator Rules` 必须把“不适合长期存储的内容”挡在 `Stored-Agent` 之外。

例如：

- 瞬时运行噪音
- 原始 shell 残片
- 活的 runtime handle
- 纯过程日志
- 没有主题的对话碎片

## 输入

`Iterator Rules` 的判断最少基于下面这些输入对象。

### 1. 当前进入迭代器的 `section`

这是来自 `Input-Agent` 或 `DB-Agent` 的当前候选块。

它至少应包含：

- 当前主题
- 来源线索
- 所属作用域
- 时间或代次提示
- 与旧 section 的关系提示

### 2. 目标主题下的历史 `Stored-Section`

这是 DB 中与当前 section 同主题或相邻主题的长期存储块。

它们用于判断：

- 是否重复
- 是否更新
- 是否存在父子关系
- 是否已过时

### 3. 同批次或相邻 `section`

这类输入用于做粒度辅助判断。

例如：

- 一个 section 是否只是某个父块的尾注
- 一个 section 是否与兄弟块共同构成完整意义
- 一个大 section 是否应被拆成多个小 section

### 4. section 的稳定性线索

包括但不限于：

- 是否能脱离当前 run 理解
- 是否仍依赖瞬时状态
- 是否属于原始运行副产物
- 是否具备复用价值

### 5. section 的层级线索

包括但不限于：

- 它是总纲还是细节
- 它是长期规则还是一次性观察
- 它是父块还是子块
- 它是替换还是补充

## 输出

`Iterator Rules` 的输出不是数据库写入行为，而是结构化判断结果。

每次判断最少应输出下面这些字段。

### 1. `section_id`

当前被判断的 section 标识。

### 2. `matched_rule_id`

命中的规则编号。

### 3. `action`

本次规则输出的正式动作。

允许值固定为：

- `store`
- `split`
- `merge`
- `update`
- `iterate`
- `delete`
- `reject`

### 4. `reason`

规则为何输出该动作的说明。

要求：

- 能被 `DB-Agent` 理解
- 能被后续 `Checker` 继承
- 不能写成模糊的“看起来像”

### 5. `related_section_ids`

与本次判断直接相关的历史 section 或邻近 section 标识。

### 6. `can_return_to_stored_agent`

表示当前结果是否允许回到 `Stored-Agent`。

### 7. `needs_further_iteration`

表示是否仍需保留在 `Iterator` 中，等待更多 section 进入后再判断。

## 规则正文

当前第一版按下面四层顺序执行：

1. 合法性检查
2. 粒度检查
3. 历史层级检查
4. 动作决策

不建议的顺序：

- 先看“是不是更新的”
- 先看“像不像新知识”
- 跳过粒度判断直接 `update/store`

### 一、合法性检查规则

#### 1. 明确主题规则

任何 section 若没有明确主题，不得直接进入长期存储。

这里的“明确主题”指的是：

- 可以被一句话概括出当前对象
- 可以说明这块内容到底在回答什么问题

如果做不到，应 `reject` 或继续回到上游重写。

#### 2. 来源存在规则

任何 section 若完全缺失来源线索，不得直接 `store`。

无来源内容最多只能：

- `iterate`
- `reject`

不能直接升级成 `Stored-Section`。

#### 3. 禁入对象规则

下面这些内容不得直接成为 `Stored-Section`：

- live runtime/session/tool handle
- raw shell handle
- raw patch object
- secret literal
- 纯临时日志
- 只在当前 run 才成立的瞬时状态

这些内容若必须保留，只能先被上游抽象成稳定 section，再重新进入迭代器。

一句白话：

- 合法性检查回答的不是“好不好用”
- 而是“能不能进长期知识流程”

### 二、粒度检查规则

#### 4. 单一语义规则

一个 section 默认只允许表达一个稳定语义单元。

若一个 section 同时混入：

- 多个主题对象
- 多个能力域
- 多个不相关结论
- 多个生命周期阶段

则必须输出 `split`。

#### 5. 非混合生命周期规则

同一 section 中不应无边界地混入：

- 背景说明
- 当前判断
- 未来计划
- 验证结果

如果混在一起，应 `split`，不能整块入库。

#### 6. 最小独立性规则

一个 section 只有在脱离当前 run 和相邻 section 后仍能独立理解，才允许 `store`。

若它严重依赖父块或兄弟块才能成立，应输出 `merge`。

#### 7. 残片拒收规则

下面这类碎片默认不得直接入库：

- 半句约束
- 只有尾注没有主体
- 只有警告没有对象
- 只有动作没有语义背景

这类内容应优先 `merge`；若无可合并对象，则 `reject`。

一句白话：

- 粒度检查解决的是“切得对不对”
- 不是“这块内容最后要不要覆盖旧块”

### 三、历史层级检查规则

#### 8. 同层更新规则

当新 section 与旧 `Stored-Section` 满足下面条件时，可输出 `update`：

- 主题相同
- 作用域相同
- 层级位置相同
- 新内容更准确、更完整或更新

也就是说，`update` 只允许发生在同层语义块之间。

#### 9. 父子补充规则

若新 section 不是替换旧块，而是对旧块的展开、细化、阶段推进或补充说明，则不得直接覆盖旧块。

这类内容应：

- `iterate`
- 或保留为父子层级关系后再决定是否回存

#### 10. 并列重复规则

若两个 section 是同层同义近重复，不应重复存储。

处理原则：

- 保留来源更强、边界更清晰的一块
- 另一块做 `merge`、`update` 或 `delete`

#### 11. 冲突暂缓规则

若新旧 section 存在冲突，但当前不能证明谁更权威，则不得直接 update 或 delete。

这种情况一律优先：

- `iterate`

等待更多材料进入后再定。

#### 12. 高层优先规则

长期架构约束、正式定义、稳定协议类 section，不能被一次性实验观察或低层运行碎片直接覆盖。

低层内容若与高层内容冲突，只能先作为补充或冲突候选进入迭代，不得直接改写高层存量。

#### 13. 时间非绝对优先规则

“更新的”不一定“更对”。

时间只能作为辅助因素，不能代替：

- 来源强度
- 层级位置
- 稳定性

一句白话：

- 历史层级检查回答的是“它和旧块是什么关系”
- 而不是“只要更新就覆盖”

### 四、动作决策规则

#### 14. `store`

满足下面条件时可 `store`：

- 合法
- 单一主题
- 可独立理解
- 与历史关系明确
- 适合长期复用

#### 15. `split`

满足下面任一条件时应 `split`：

- 混多个主题
- 混多个生命周期阶段
- 混父层与子层内容
- 一块内容过大且可拆成多个稳定小块

#### 16. `merge`

满足下面任一条件时应 `merge`：

- 内容过碎
- 离开邻接块就失义
- 只是尾注/补句/局部 caveat

#### 17. `update`

仅在同层语义块之间允许，且必须有明确旧块作为更新目标。

#### 18. `iterate`

满足下面任一条件时应 `iterate`：

- 冲突待定
- 父子关系未稳定
- 仍需等待更多 section 对照
- 当前无法安全 store/update/delete

#### 19. `delete`

只有在确认旧 section 已被更高质量同层 section 完全取代，且保留它只会制造误导时，才允许 `delete`。

#### 20. `reject`

以下情况直接 `reject`：

- 无主题
- 无来源
- 纯临时噪音
- 明显不属于长期知识块

## 边界

`Iterator Rules` 明确不负责下面这些事：

1. 不负责 `Input-Agent` 如何从 `TAAP` 上下文生成初始 section。
2. 不负责 `DB-Agent` 如何执行真实 DB 写入。
3. 不负责 Redis 调度与消费策略。
4. 不负责 RAG 的索引算法。
5. 不负责 Git Infra 对齐。
6. 不负责 `Checker` 的继承规则。
7. 不负责 TAP 的权限审批、放权矩阵、grant compiler、execution governance。
8. 不负责 provider/runtime 绑定、activation、replay、builder 等能力包执行问题。

当前更稳的边界是：

- `Input-Agent` 负责把上游上下文压成 `section`
- `DB-Agent` 负责持续化和索引
- `Iterator` 负责存储前关系判断
- `Checker` 负责继承结果继续做历史纠偏与 Git Infra 沟通

一句白话：

- `Iterator Rules` 只判断“该怎么存”
- 不判断“由谁执行”
- 也不判断“是否和 Git 对齐”

## 例外

第一版允许下面这些有限例外，但必须显式写出原因，不得隐式放行。

### 1. 高价值短期结论例外

某些内容虽然来自短期运行，但如果已经被主动抽象成稳定结论，且具备：

- 明确主题
- 明确来源
- 明确复用价值

则允许例外 `store`。

### 2. 父块缺失例外

当一个 section 明显应与父块 `merge`，但父块当前缺失或尚未到达迭代器时，可暂时输出 `iterate`，而不是立刻 `reject`。

### 3. 冲突冻结例外

当新旧 section 都具有一定来源强度，且当前无法定胜负时，可暂时保留双方并进入 `iterate`，不得直接删除任一方。

### 4. 粒度折中例外

当一个 section 虽然略大，但一旦拆分会严重损失语义完整性时，可作为“粒度折中块”例外 `store`，但必须记录原因。

### 5. 迁移期例外

在 `CMP` 第一版迁移阶段，若历史 `Stored-Section` 本身结构质量不稳定，可允许更宽松的 `merge/update`
判断，但必须在输出中显式标记为“迁移期判断”，供后续 `Checker` 再次复核。

## 当前不要做什么

第一版先不要把下面这些提前压进 `Iterator Rules`：

- Git diff 对齐规则
- RAG 检索排序规则
- provider-specific indexing policy
- 审批策略
- 权限放权矩阵
- 运行时调度策略
- Redis 队列策略

原因不是这些不重要，而是：

- 这些都不是 `Iterator` 的单一职责
- 现在先把“section 如何成为长期知识块”这件事冻结清楚

## 当前冻结结论

第一版 `CMP Iterator Rules` 先冻结下面这些共识：

- `Iterator` 是 `CMP` 内部主动运行的 section 关系 agent
- `Iterator Rules` 只负责粒度检查和历史层级检查
- section 进入长期存储前必须先经过合法性检查
- `update` 只发生在同层语义块之间
- 父子补充与冲突待定默认先走 `iterate`
- 混合主题块优先 `split`
- 失义碎片优先 `merge`
- `Iterator` 不负责 Git Infra 对齐
- `Checker` 继承 `Iterator Rules`，但不反向扩张 `Iterator` 的第一版边界

## 一句话收口

`Iterator Rules` 的本质，是把进入 `CMP` 的 section 裁剪成真正可长期存储的最小知识块，并在返回
`Stored-Agent` 之前，先完成粒度检查与历史层级检查，避免把原始运行碎片直接写进 DB 和 RAG。
