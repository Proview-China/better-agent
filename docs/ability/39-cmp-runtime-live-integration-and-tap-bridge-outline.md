# CMP Runtime Live Integration And TAP Bridge Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-25

## 这份文档要回答什么

到当前阶段，`CMP` 已经不再是空白：

- `cmp-runtime` 主链已经存在
- `rax.cmp` facade / runtime shell 已经存在
- shared `git / PostgreSQL / Redis` 的 bootstrap 和 live backend 骨架已经存在
- `Section / StoredSection / Rules` 已经在 `rax` 域层显式化

但这还不等于：

- `core_agent -> rax.cmp -> cmp-runtime -> shared infra` 已经正式接入
- active / passive flow 已经真实落到 shared infra
- `CMP` 已经能真实调用其能力而不是只跑样板链
- `TAP` 已经能为 `CMP` 提供第一批真实工具和外围配置

一句白话：

- 现在的问题已经不是“CMP 是什么”
- 而是“CMP 什么时候才算真的接进系统，并且能开始养五个 agent”

## 先说结论

- 当前还不能进入五个 agent 的细调和实现阶段。
- 在进入五个 agent 之前，必须先完成一轮：
  - `CMP runtime live integration`
  - `shared infra real lowering`
  - `CMP <-> TAP` 最小供给接缝
- 这一轮的核心不是再发明新协议，而是把已经存在的对象、接口和 backend 真正串成工作链。
- 最稳妥的工程顺序是：
  1. 先补 `core_agent -> rax.cmp` 正式接入点
  2. 再补 `cmp-runtime -> shared infra` 的真实 lowering 与 readback
  3. 再补 `CMP <-> TAP` 的最小能力与外围供给接缝
  4. 最后再做五个 agent 之前的 final gate

## 为什么这一轮还不能直接开始五个 agent

因为按当前代码事实，下面几件事还没有全部成立：

### 1. `core_agent -> rax.cmp` 还不是正式主链

现在 `rax.cmp` 已经可用，但它仍然更像：

- 可手动调用的 facade
- 可验证的 workflow shell

而不是：

- `core_agent` 运行时默认经过的上下文治理入口

### 2. `cmp-runtime` 的主链还没有完全 lower 到真实 shared infra

当前 bootstrap 已经能触发真实 backend，但下面这些核心动作还需要继续 lowering：

- `commit_context_delta`
- `resolve_checked_snapshot`
- `materialize_context_package`
- `dispatch_context_package`
- `request_historical_context`

一句白话：

- 现在很多地方还是“内存里状态对了”
- 但还不是“真实 git / pg / redis 都跟着动了”

### 3. `Section / StoredSection / Rules` 还没有进入主运行链

这层现在已经有域模型，但还没真正成为：

- checker 的判断载体
- dbagent 的投影输入
- dispatcher 的 package 依据

### 4. `TAP` 还没正式成为 `CMP` 的工具供给面

后续五个 agent 肯定会需要一批真实能力：

- 读代码
- 读文档
- 生成说明
- 受控 shell
- 跑测试
- 使用 skill
- 使用 MCP

这些能力应该优先从 `TAP` 正式供给，而不是在 `CMP` 里临时手搓。

## 这一轮真正要做的三段打通

## Part A. `core_agent -> rax.cmp`

目标：

- 让 `CMP` 从“手动 API”变成 `core_agent` 的正式上下文治理接入口

至少要完成：

- active ingest entry
- passive history request entry
- core-agent return path
- child reseed entry
- recover / readback / smoke entry

不包含：

- 五个 agent 的 prompt / config 细调

## Part B. `rax.cmp -> cmp-runtime -> shared infra`

目标：

- 让 `CMP` 的主链动作不再只停在 runtime state，而是进入真实 shared infra

至少要完成：

- git 侧真实 commit/ref/readback lowering
- pg 侧 projection/package/delivery lowering
- redis 侧 publish/ack/readback lowering
- checkpoint + recovery + readback 串联

不包含：

- 新一轮 infra 理论讨论

## Part C. `CMP <-> TAP`

目标：

- 让 `TAP` 开始成为 `CMP` 的最小能力供给层

至少要完成：

- `CMP` 所需最小 capability 基线
- capability package 和 `CMP` worker 责任边界
- skill / MCP / docs / code / shell / test 这一批最小能力接缝
- “工具与外围配置由 TAP 准备”的最小工作链

不包含：

- 把 `TAP` 变成 `CMP` 的事实源
- 把 `CMP` 写成 `TAP` 的附庸

## 与图片的对齐结论

这轮必须继续遵守下面这些已经冻结的方向：

1. `CMP` 的真相主干仍然是 `git`，不是向量库。
2. `CMP DB` 仍然是结构化投影层和交付层，不是第二真相源。
3. `MQ` 仍然是邻接传播，不是全局广播。
4. `git_infra` 仍然是 shared collaboration substrate，不是 `CMP` 私有 git 子系统。
5. `TAP` 是 `CMP` 的能力供给层，不是 `CMP` 的历史主干。
6. 五个 agent 依然建立在：
   - 已接好的 interface
   - 已 lower 的主链
   - 已稳定的 shared infra
   - 已接入的最小 capability baseline
   之上。

## 这一轮的四个 closure area

## Area 1. Core-Agent Integration Closure

目标：

- 把 `core_agent -> rax.cmp` 的主动/被动入口接稳

## Area 2. Real Infra Lowering Closure

目标：

- 把 `cmp-runtime` 的关键动作继续 lower 到 git / pg / redis

## Area 3. TAP Supply Closure

目标：

- 让 `CMP` 的最小真实能力和外围配置开始从 `TAP` 供给

## Area 4. Pre-Agent Final Gates

目标：

- 在五个 agent 开工前，把联调、观测、回读、恢复、最小 smoke 关口收齐

## 当前不要做错的事

- 不要把这轮重新做成“CMP 原理再讨论一遍”。
- 不要因为 `rax.cmp` 已存在，就误判 `core_agent` 已正式接入。
- 不要因为 shared infra 有 bootstrap，就误判 active/passive 主链已真实可用。
- 不要跳过 `Section / StoredSection / Rules` lowering 就直接做五个 agent。
- 不要把 `CMP <-> TAP` 写成 `CMP` 直接侵入 `TAP` worker 内部。
- 不要把 `TAP` 的能力供给和 `CMP` 的历史治理混成一团。

## 这一轮的最小完成定义

只有同时满足下面这些条件，才建议进入五个 agent 的实现：

1. `core_agent -> rax.cmp` 有正式主链入口，而不是只有手动 facade。
2. `commit / materialize / dispatch / requestHistory` 已有真实 shared infra lowering 证据。
3. `Section / StoredSection / Rules` 已进入主运行链。
4. `readback / recovery / smoke` 已能对真实 shared infra 给出结构化结果。
5. `CMP` 已能从 `TAP` 拿到一批最小真实能力与外围配置。
6. 五个 agent 开工前的 final gate 已经明确，不再靠口头约定。

## 建议的后续文档顺序

在这份总纲之后，建议紧接着拆一包：

- `cmp-runtime-live-integration-task-pack`

这一包建议拆成 4 个 part：

1. `core_agent -> rax.cmp` 正式接入
2. `cmp-runtime -> shared infra` lowering 与 readback
3. `CMP <-> TAP` 最小能力与外围供给接缝
4. 五个 agent 之前的 final integration gates

一句收口：

- 这轮不是在做五个 agent
- 这轮是在把五个 agent 需要踩的地板，真正焊牢
