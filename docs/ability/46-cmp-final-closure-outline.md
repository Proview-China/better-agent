# CMP Final Closure Outline

状态：最终收尾总纲。

更新时间：2026-03-30

## 这份文档回答什么

这份文档专门回答：

- `CMP` 最后收口阶段到底还要做什么
- 五个 agent 的最终实现边界到底是什么
- 真实 infra、对象模型、包 schema、角色 loop、`TAP` 深接线到底怎么收
- 后面 5-8 次上下文压缩里，怎样持续稳定推进而不跑偏

一句白话：

- 现在不是继续“解释设计”
- 而是要把 `CMP` 从“工程化控制系统”收成“可持续运行、可真实联调、可继续扩展”的完成态

## 当前阶段一句话

`CMP` 的非五-agent底座已经基本收口；
五个 agent 的 runtime 骨架、配置面、受控协作协议、`rax.cmp` 可见性、角色级 `TAP profile` 编译层已经进主链。

当前要做的不是重来一遍，而是把下面四层真正做完整：

1. 核心对象模型完成态
2. 五个 agent 的真实 loop 与 LLM I/O 契约
3. `CMP -> TAP` 深执行链
4. 真实 infra + 观测 + recovery + acceptance gate

## 当前唯一目标

在不破坏已经跑通的：

- `core_agent -> rax.cmp -> cmp-runtime -> five-agent runtime`

这条链的前提下，把 `CMP` 收口到下面这个完成口径：

1. 五个 agent 已经不只是配置对象，而是具备真实 agent loop 语义
2. `request / section / package / snapshot` 四类对象已经成为正式对象模型
3. `core return / child seed / peer exchange` 三类包已经 schema 化
4. `CMP -> TAP` 已经不只是 resolve，而是能进入真实审批/执行路径
5. `PostgreSQL + Redis + Git 接入层 + 最小观测面` 已经能做真实联调
6. 同链路回卷恢复已经覆盖 `request / section / package / snapshot`

## 收尾阶段的硬原则

### 1. 规则与模型混合

五个角色第一版都允许明确引入 LLM 步骤，
但以下边界必须继续保持硬规则：

- git 主推进边界
- mq 审批与越级边界
- child seed 入口
- raw truth 写口
- human override 边界

### 2. 事件驱动优先

第一版真实运行时以事件驱动为主：

- ingest 事件
- commit 事件
- checked / review 事件
- request 事件
- route / deliver 事件
- recover / replay 事件

周期性后台整理只作为辅助，
并优先由：

- `DBAgent`
- `Checker`

承担。

### 3. 高保真优先，不靠 embedding 做真相

`CMP` 的真相源仍然是：

- `raw context`
- 版本化 `section`
- `git` 历史
- `DB` 结构化对象
- `MQ` 交付状态

### 4. core 以消费结果为主，只在关键节点显式介入

`core_agent` 第一版默认不深度代替五角色内部治理，
但必须在下面节点显式介入：

- `peer exchange`
- 派子任务目标确认
- 关键回灌前的最终甄选

关键回灌前 `core_agent` 的主要拍板标准：

- 是否和当前目标对齐
- 信噪比是否足够
- 置信度是否足够

## 五个 agent 的最终收口边界

### 1. `ICMA`

最终定位：

- 接住全量会话面
- 预处理成 `pre-section`
- 做任务意图切块
- 挂受控 fragment
- 形成对子链或主链的 guide

第一版 LLM 主要负责：

- 切块
- 挂片
- 引导

默认输入：

- 全量预处理视图

默认输出：

- `intent`
- `source anchors`
- `candidate body`
- `boundary`
- `explicit fragments`
- `dual-layer guide`

### 2. `Iterator`

最终定位：

- 处理有意义的上下文变动
- 把变动推进成自然 git workflow
- 管理：
  - `commit`
  - `PR`
  - `merge`
  - `review ref`
  - 回滚前置节奏

### 3. `Checker`

最终定位：

- 对候选 section 做：
  - 拆分
  - 合并
  - 去噪
  - 精裁
- 做历史检查
- 给出 checked-ready 结果
- 形成 suggest-promote / 精裁建议

第一版 LLM 输出必须至少包含：

- `section-level split/merge decisions`
- `trim result`
- `short structured reason`
- `detailed explanation`

### 4. `DBAgent`

最终定位不是简单 DB writer，而是：

- `section / package / snapshot / request state` 的状态总控
- 收候选，出定版
- 负责：
  - 完整性校验
  - section 定版方案
  - package materialization
  - passive request 审查与出包
  - reintervention 审查与补包决议
  - 父侧主审

默认正式候选源：

- `ICMA` 的 `pre-section`
- `Checker` 的拆并/精裁结果
- 各角色正式请求

默认请求审查维度：

- 任务相关性
- 状态缺口
- 信噪影响

### 5. `Dispatcher`

最终定位：

- 管三类包的最终路由
- 对子链、平级、主链分别发出不同 schema 的包
- 回灌给 `core_agent`
- 发子 seed
- 发 peer exchange
- 管理 delivery / approval / governance fields

## 核心对象模型

### 1. `Request`

`Request` 是独立主对象，不只是日志附属。

第一版状态机至少包括：

- `received`
- `reviewed`
- `accepted`
- `denied`
- `served`

### 2. `Section`

`Section` 是处理后的 `raw_context` 片段，
加上可复用说明层后，
可以成为高保真上下文块。

生命周期第一版明确为：

- `raw`
- `pre`
- `checked`
- `persisted`

演化方式：

- 版本化演化
- 尽量不直接覆盖

一个 `section` 变动默认与一次有意义的 `commit` 对齐。

持久化落盘第一版默认：

- 一个 `persisted section`
- 一个目录项

### 3. `Snapshot`

`Snapshot` 是阶段快照，不是最终摘要。

### 4. `Package`

`Package` 由定版 `section` 派生而来。

变更策略：

- 尽量版本化再派生
- 不随便原地改已派生 package

## 三类包 schema 的最终方向

### 1. 共同主干字段

三类包共同必须至少有：

- `target`
- `body`
- `governance`
- `source anchors`

治理字段至少包括：

- 来源
- 目标
- 权限
- 置信 / 信噪

### 2. `core return`

主层次顺序：

1. 正文
2. 引导
3. skill
4. timeline

### 3. `child seed`

主层次顺序：

1. 子任务
2. 边界
3. 引导
4. 背景

### 4. `peer exchange`

主层次顺序：

1. 协作意图
2. 依赖变更
3. 局部正文
4. 引导

同父平级允许厚交换包，
但必须：

- 父节点检视
- 审批记录双挂：
  - 包本身
  - Dispatcher 路由记录

## `TAP -> CMP` 最终接线方向

### 当前已成立

- 五角色 capability contract
- role-specific `AgentCapabilityProfile`
- `resolveCmpFiveAgentCapabilityAccess(...)`
- `rax.cmp.roles.resolveCapabilityAccess(...)`

### 收尾阶段还要做的

- 把 role-specific profile 更深挂进实际审批/执行路径
- 让不同角色申请能力时，真正走不同的审查/执行 lane
- 把 git/db/mq 相关能力族正式挂到五角色的运行面
- 再补角色所需工具能力

## 真实 infra 收尾方向

第一版真实 infra 偏：

- `PostgreSQL`
- `Redis`
- `Git 接入/服务层`
- 结构化日志
- 状态面板

## recovery 与 human override

同链路回卷恢复第一版至少覆盖：

- `request`
- `section`
- `package`
- `snapshot`

human override 第一版仍然只开放：

- `pause`
- `resume`
- `retry`
- `rebuild`

## 最终完成定义

只有同时满足下面这些条件，才算 `CMP` 这部分真正完成：

1. 五个 agent 都已经具备真实 loop 语义，而不是只剩配置对象
2. `request / section / package / snapshot` 已成为正式对象模型
3. 三类包 schema 已明确落地并接进 runtime
4. `TAP -> CMP` 已进入真实审批/执行路径，而不只是 capability resolution
5. `Postgres + Redis + Git 接入层 + 日志/状态面板` 已经可以真实联调
6. recovery 已覆盖 `request / section / package / snapshot`
7. `rax.cmp` 已经能稳定读回：
   - 角色阶段
   - 包流向
   - request 状态
   - reintervention 状态
   - peer approval 状态
