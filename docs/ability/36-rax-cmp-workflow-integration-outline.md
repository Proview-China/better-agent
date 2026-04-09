# RAX CMP Workflow Integration Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-24

## 这份文档要回答什么

到当前阶段，`CMP` 的协议、runtime 主链、infra backend contract、以及 `git / PostgreSQL / Redis` 的第一轮 live executor 都已经有了。

但我们仍然缺一层真正决定“怎么把 `CMP` 融进现在工作流”的运行壳。

这份文档要回答下面这些问题：

1. `rax.cmp` 到底应该是什么。
2. `git_infra` 在这里扮演什么角色。
3. 为什么 `git_infra` 不是 `CMP` 私有子系统。
4. 为什么下一步不该先去细调五个 agent，而该先把 `rax.cmp` 和 workflow integration 做出来。
5. `Section / StoredSection / Rules` 为什么要在五个 agent 之前显式化。

一句白话：

- 这份文档不是再解释 `CMP` 是什么
- 而是解释“`CMP` 怎么真正接入现在的多智能体工作流”

## 先说结论

- `git_infra` 应被视为与多智能体系统并行的一层共享协作底座。
- `CMP` 只是 `git_infra` 的一个消费者，不是 `git_infra` 的拥有者。
- 每个 agent 可以和共享的 `git_infra` 沟通，但不是每个 agent 都要带一套自己的 `git_infra`。
- `rax.cmp` 的第一目标不是实现五个 agent，而是把：
  - `core_agent`
  - `CMP runtime`
  - shared `git_infra`
  - `PostgreSQL`
  - `Redis`
  收成统一、稳定、可配置的工作流入口。
- 五个 agent 的细致职责与配置应该建立在：
  - `rax.cmp`
  - workflow integration
  - `Section / StoredSection / Rules`
  已经稳定之后再做。

## 为什么 `git_infra` 是共享协作底座

当前应该把 `git_infra` 理解成：

- 模拟人类团队协作机制的组织套件
- 多智能体系统共享的历史、分支、PR、merge、rollback 骨架

它的层级应与多智能体组织管理器平级，而不是被塞进 `CMP` 内部。

### 这意味着什么

- `CMP` 会使用 `git_infra`
- `MP` 后续也可能使用 `git_infra`
- `TAP` 也可能依赖 `git_infra`
- `work/*` 线天然就在 `git_infra` 上

但这些都不代表：

- `CMP` 应该自己再造一层私有 git 系统
- 每个 agent 都该单独拥有一个 `git_infra`

一句白话：

- `git_infra` 更像整家公司共用的 GitHub
- `CMP` 更像其中一个上下文治理部门

## `rax.cmp` 的定位

当前建议把 `rax.cmp` 固定为：

一个把 `CMP` 接入当前工作流的 facade / runtime shell / configuration layer。

它不应该只是：

- 一组 helper 导出
- 一组测试专用入口
- 一堆 backend contract 的再包装

它应该至少负责：

1. `CMP` runtime 的创建与配置
2. shared `git_infra` connector 的接入
3. `PostgreSQL / Redis` backend 的接入
4. `bootstrap / readback / recover / smoke` 的统一入口
5. 主动/被动工作流入口

## 为什么现在先做 `rax.cmp`

因为现在仓库里，`CMP` 的运行事实仍然主要散在：

- `src/agent_core/runtime.ts`
- `src/agent_core/cmp-git/**`
- `src/agent_core/cmp-db/**`
- `src/agent_core/cmp-mq/**`
- `src/agent_core/cmp-runtime/**`

这意味着：

- 有底层
- 有 contract
- 有样板
- 但没有真正面向工作流的统一壳层

而 `TAP` 给我们的经验很明确：

- execution plane 和 control plane 要分层
- worker 职责不能直接漏给上层
- 资产和生命周期要先于角色微调
- 热路径要薄，配置与治理要下沉

所以 `rax.cmp` 要像 `TAP` 的 facade 一样，先把外部看到的那一层收稳。

## `rax.cmp` 应该至少暴露什么

当前建议第一版至少暴露下面这些能力：

### 1. `create`

作用：

- 创建 `CMP` runtime shell
- 加载 config
- 安装 backends

### 2. `bootstrap`

作用：

- 为项目接入 shared `git_infra`
- 初始化 `CMP DB`
- 初始化 `Redis` namespace
- 建立 readback receipt

### 3. `ingest`

作用：

- 主动模式入口
- 接 `core_agent` 的上下文输入

### 4. `commit`

作用：

- 推进一次 `CMP` 上下文变化

### 5. `readback`

作用：

- 读取当前 bootstrap / backend / state 的结构化结果

### 6. `requestHistory`

作用：

- 被动模式入口

### 7. `recover`

作用：

- 从 checkpoint + infra readback 重建运行态

### 8. `smoke`

作用：

- 验证当前项目的 `CMP` 是否真的处于可运行状态

## 为什么要先显式化 `Section / StoredSection / Rules`

看你这张图，`CMP` 里除了五个 agent，本身还有一层非常重要的中间治理对象：

- `Section`
- `Stored Section`
- `Rules`

这层现在在代码里还是隐含的，不是稳定的一等对象。

### 这会带来的问题

- `ICMA` 的截获粒度不稳定
- `Checker` 的规则判断缺明确载体
- `DBAgent` 的存储和投影对象会继续混在 helper 里
- `Dispatcher` 拿到的 package 不容易回溯“它到底从哪个 section 来”

### 所以当前建议

在五个 agent 微调前，先把下面这些对象正式立起来：

#### `Section`

作用：

- 当前运行中被切出来的上下文片段

#### `StoredSection`

作用：

- 已经进入可持久化/可回读面的 section

#### `Rules`

作用：

- 判断 section 该如何被：
  - 接纳
  - 延迟
  - 提升
  - 分发
  - 丢弃

一句白话：

- 五个 agent 最后做的是“围绕这些对象工作”
- 不是先有五个 agent，再让它们反过来发明这些对象

## 与 `TAP` 设计准则的对齐结论

从 `TAP` 那边可以直接复用的原则有：

### 1. facade 先于 worker 微调

先把：

- 外部入口
- 运行模式
- 统一结果

做稳，再去调内部 worker。

### 2. execution plane 与 control plane 分离

`rax.cmp` 不应把：

- git executor
- pg executor
- redis executor
- checker rules
- dispatcher logic

揉成一个大方法。

### 3. 资产先于角色

像 `TAP capability package` 那样，
`CMP` 这里也应该先有稳定资产：

- config
- section model
- stored section
- rule pack
- bootstrap receipt
- readback surface

然后才去调五个 agent 的职责。

### 4. 热路径要薄

`core_agent` 不该直接知道：

- git 怎么跑
- pg 怎么回读
- redis 怎么 publish
- rules 怎么判

它只该通过 `rax.cmp` 看到统一入口和统一结果。

## 当前建议的四层结构

## Layer 1. Shared Infra Connector Layer

包含：

- shared `git_infra` connector
- `PostgreSQL` connector
- `Redis` connector

## Layer 2. CMP Domain Layer

包含：

- `Section`
- `StoredSection`
- `Rules`
- state model

## Layer 3. CMP Runtime Layer

包含：

- bootstrap
- ingest
- commit
- readback
- requestHistory
- recover

## Layer 4. RAX Facade Layer

包含：

- `rax.cmp.session.open(...)`
- `rax.cmp.project.bootstrap(...)`
- `rax.cmp.project.readback(...)`
- `rax.cmp.project.recover(...)`
- `rax.cmp.project.smoke(...)`

## 当前不要做错的事

- 不要把 `git_infra` 继续写成 `CMP` 自己的私有 infra。
- 不要跳过 `rax.cmp`，直接去调五个 agent。
- 不要在 `Section / StoredSection / Rules` 还没显式化前就锁死五个 agent 分工。
- 不要把 `CMP` 的 facade 做成一组测试 helper。
- 不要把 `MP` 的考虑提前揉进这一轮。

## 当前阶段的最小完成定义

只有下面这些同时成立，才算这一步方向正确：

1. `rax.cmp` 已经存在并有稳定入口。
2. `CMP` 已能作为工作流组件接入 shared `git_infra`。
3. `Section / StoredSection / Rules` 已经成为明确对象。
4. `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 这条链成立。
5. 这之后再去做五个 agent 微调时，不需要回头重构基础层。

一句话收口：

- 先做 `rax.cmp`
- 先做 workflow integration
- 先做 `Section / StoredSection / Rules`
- 再做五个 agent
