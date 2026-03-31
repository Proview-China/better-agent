# TAP Three-Agent Real Usage Outline

状态：冻结中的下一阶段总纲 v1

更新时间：2026-03-30

## 当前实现状态

截至 2026-03-31，这份总纲里最关键的一段已经进入代码主链：

- reviewer / tool_reviewer / TMA 已经不只是 model-backed worker 壳子
- 现在 runtime 内已经有统一的三 agent 过程账本
- 这份账本会跟着 TAP snapshot / hydrate 一起保存和恢复
- 收口这份账本的同时，也顺手把 `provision -> activation -> replay -> auto-continue` 这段 runtime 主链重新接回到了可测试状态

一句白话：

- 这一轮不是只“再补一个记录”
- 而是把三 agent 真正干过的事情，收成了 runtime 可回读、可恢复、可验收的统一过程面

## 这份文档解决什么

前一阶段我们已经完成了两件关键事情：

- `core_agent -> TAP -> model.infer -> gmn -> gpt-5.4` 已真实打通
- `reviewer / tool_reviewer / TMA` 三者已经具备默认的 model-backed 装配能力

但这还不等于“三个 agent 已经进入真实使用状态”。

当前真正的问题变成了：

1. 三个 agent 在真实运行时分别怎么工作。
2. 三者之间默认如何自动串起来。
3. 哪些行为必须停在人类门槛，哪些应该自动继续。
4. 在 `CMP / MP` 即将接入的前提下，三者内部要先把哪些精细实现补好。
5. 这轮的完成定义到底是什么。

一句白话：

- 前一阶段解决的是“能不能接上模型”
- 这一阶段解决的是“接上模型以后到底怎么真实干活”

## 本轮冻结结论

### 1. 总目标

本轮优先目标不是最强自治，也不是前台体验优先。

本轮优先目标是：

- 三 agent 先形成“真实可用闭环”

同时要求：

- 内部有一版初步精细化调整

这意味着：

- 不是只把接口留着
- 也不是只让测试过
- 而是要让真实任务能通过这三条 worker 线顺着跑下来

### 2. TAP 的形态

本轮把 `TAP` 定义成：

- 一个自治的灰盒

这里的“灰盒”含义是：

- 内部会自动流转
- 会自动调用模型
- 会自动生成治理/施工结果
- 但边界、状态机、审批口、handoff 规则仍由 runtime 固定

一句白话：

- 不是完全黑盒放飞
- 也不是全靠主 agent 手动推

### 3. 默认总链路

默认链路冻结为：

1. `reviewer` 先总闸
2. `reviewer` 判断是否要进入 `tool_reviewer`
3. `tool_reviewer` 决定是否生成治理计划、验收意见、TMA 工单
4. `TMA` 负责施工
5. 除 `human gate` 以外，其它链路尽量自动继续

这条链路是默认，不是唯一路径。

保留的例外：

- baseline 低风险直通
- 已经确定的 runtime 快路径
- 明确 blocked / waiting_human / denied 的停止点

### 4. reviewer 的真实落地定义

`reviewer` 本轮不是只做其中一件事，而是三块都做：

- 审批拍板
- 上下文研究
- 人机沟通

但三块的主次顺序是：

1. 先做审批拍板
2. 再补足上下文研究
3. 同时保留白话解释能力

`reviewer` 的写权限先冻结为：

- 只写审批记录

也就是说：

- 可写 durable 决策记录
- 可写审核解释
- 不直接改代码
- 不直接造工具
- 不直接施工

### 5. tool_reviewer 的真实落地定义

`tool_reviewer` 本轮边界冻结为：

- 治理 + 验收

它负责：

- 判断工具/能力是否该存在
- 判断该删、该拆、该合、该替换
- 判断当前 bundle / lifecycle / activation / replay 是否合格
- 输出治理计划、质检报告、TMA 工单

它不负责：

- 直接施工
- 直接修工具
- 直接完成用户原任务

一句白话：

- `tool_reviewer` 是工具治理监理 + 验收官
- 不是第二个施工 agent

### 6. TMA 的真实落地定义

`TMA` 本轮优先做成：

- 施工执行器

它负责：

- 接工单
- 形成施工计划
- 产出 bundle / artifact / usage / verification / replay rationale
- 在允许的边界内恢复并继续施工

它当前不追求：

- 超强自治规划
- 资产全生命周期管理总控
- 前台用户交互

一句白话：

- 先把“能稳定干活”做好
- 再谈“会不会自己想很多”

### 7. 自动继续策略

本轮默认策略：

- 除 `human gate` 外，后链尽量自动继续

因此本轮必须明确：

- reviewer 何时自动转给 tool_reviewer
- tool_reviewer 何时自动转给 TMA
- TMA 何时自动返回 ready bundle
- 哪些完成态必须让 runtime 自动 pickup

不能自动继续的节点：

- `waiting_human`
- `denied`
- `blocked`
- runtime 判定的硬中断

### 8. 上下文策略

这轮不希望长期依赖临时手搓摘要。

冻结结论：

- 先把三 agent 的内部精细实现写好
- 但正式上下文源默认等 `CMP / MP` 接进来

这意味着：

- 当前实现要保留 section/aperture 接口坑位
- 不把临时上下文方案做成永久主路径

### 9. durable 完成定义

本轮 durable 不是只做一个点，而是三类都要纳入完成定义：

1. 三 agent 的会话状态
2. 工单 / 治理 / bundle / replay / gate 台账
3. 面向用户的可解释记录

优先顺序不是三选一，而是一起纳入设计，只是在实现时可以分波。

### 10. 这轮完成标准

本轮完成，不以“结构冻结”单独算完成。

本轮完成标准是：

1. 真实任务可跑
2. reviewer / tool_reviewer / TMA 三条链都参与过真实流转
3. `human gate` 外尽量自动串起来
4. 内部已有一版精细化调整
5. `CMP / MP` 接口坑位已经准备好

一句白话：

- 不是画设计图
- 也不是只做 mock
- 而是能拿真实任务过一遍

## 本轮建议实现顺序

### Phase A: 运行语义冻结

- 冻结 reviewer / tool_reviewer / TMA 的真实职责
- 冻结自动继续与中断点
- 冻结 durable 产物与状态名

### Phase B: 三条 worker 线精细化

- reviewer：总闸 + 解释 + 记录
- tool_reviewer：治理计划 + 验收 + 工单
- TMA：施工执行 + bundle + replay rationale

### Phase C: 自动链路收口

- `reviewer -> tool_reviewer -> TMA`
- `TMA -> tool_reviewer -> runtime pickup`
- `human gate` 合并与停点

### Phase D: CMP / MP 接口对接准备

- 正式 section registry 契约
- aperture 消费位置
- context source 注入点

## 这轮不做什么

- 不把三 agent 直接做成完全自由自治体
- 不提前硬编码 `CMP / MP`
- 不把前台 UI 当本轮主目标
- 不为了“更智能”而放宽 runtime 边界

## 一句话总结

- 本轮不是继续证明“三 agent 能调模型”
- 而是开始定义“三 agent 在真实 TAP 里到底怎么干活、怎么协作、怎么自动继续、哪里必须停”
