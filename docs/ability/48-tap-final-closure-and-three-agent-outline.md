# TAP Final Closure And Three-Agent Outline

状态：冻结中的总纲 v1，用于把 TAP 真正收尾，并正式做出 reviewer / tool_reviewer / TMA 三种 agent。

更新时间：2026-03-25

## 这份文档要解决什么

前面的工作已经证明：

- `agent_core` raw runtime 能跑
- `TAP` 已经不是纸面控制面
- reviewer / tool_reviewer / TMA 都已经有了部分代码骨架
- durable lane / hydration / replay / activation / negative boundary tests 都已经开始成立

但这还不等于 `TAP` 已经真正收尾。

当前真正的问题已经变成：

1. 怎么定义 `TAP` 的最终完成标准。
2. reviewer / tool_reviewer / TMA 这三种 agent 各自到底负责什么。
3. 三者如何自动串起来，而不把人工审批点做成连环弹窗。
4. 面向普通用户时，前台应该看到什么、能覆写什么。
5. 这套东西如何和未来的 `CMP / MP` 接口对接，而不提前把它们硬编码进当前实现。

一句白话：

- 这份文档不是继续补一个功能点
- 而是在冻结“这套系统最终长成什么样”

## 当前冻结结论

### 1. 三种正式 agent

这次要正式做出的三种 agent，就是：

- `reviewer`
- `tool_reviewer`
- `TMA`

不是别的三种，也不是暂时合并成两种。

### 2. 三者都是真 agent，不是临时 hook

三者最终都按：

- 独立 runtime
- 独立 session / state / snapshot / recovery
- 统一接进 `TAP`

来做。

但它们不是三个一模一样的 agent。

它们是：

- 同属 `TAP`
- 各自职责不同
- 各自 baseline 能力不同
- 各自上下文入口不同

### 3. TAP 的最终目标不是“恢复后还要手动点很多次”

冻结目标：

- 除了必须由人类插手的节点
- 其它 reviewer / tool_reviewer / TMA 后链尽量自动继续

一句白话：

- 默认目标是“全自动闭环”
- 但人类门槛仍然保留

### 4. human gate 是主要人工门槛

默认策略：

- 系统尽量只在人类门槛停
- 如果 reviewer / tool_reviewer / TMA 连续都认为要人工插手
- 默认由 reviewer 先判断能不能合并成人类一次决策

不能合并时，才拆成多个点。

### 5. 面向普通用户时，前台是半透明的

用户前台默认应看到：

- 当前是 reviewer / tool_reviewer / TMA 哪一层在工作
- 风险说明
- 审批结果
- 工具准备进度

但不要求用户理解全部内部细节。

同时，用户应能通过预留接口覆写：

- 审批与自动化开关
- 工具策略
- agent 规则解释的部分内容

### 6. 15 种视角这次必须冻结

这次不是只留一个框架。

这次要冻结：

- `5` 种安全策略
- `3` 类行为视角
- 组合出来的 `15` 种视角

但是结构不是三套完全独立矩阵。

冻结结构是：

- 一张共享总矩阵
- reviewer / tool_reviewer / TMA 各自映射到这张总矩阵

### 7. 规则对象挂在 pool 上，不挂在单个 agent 上

从 OOA 的角度看：

- 统一治理规则源首先属于 `TAP pool object`
- agent 不是规则拥有者
- agent 是规则消费者

但实例化层是双层的：

- 工作区级实例
  - 主要承接人类定义的 `5`
- 任务/会话级实例
  - 主要承接 agent/reviewer 动态估计出的 `3`

一句白话：

- 人类定大框
- agent 在大框内做细判断

## 三种 agent 的正式职责

## reviewer

### reviewer 是什么

- 主行为审查员
- 安全超级核心
- 它审的是“agent 想做什么”

### reviewer 负责什么

- 判断主 agent 的行为是否合理
- 判断是否需要高风险工具/能力
- 判断是否需要人工批准
- 判断是否需要把工具需求转交给 `tool_reviewer`
- 在可自动审批的情况下给出正式 decision
- 在需要时生成面向用户的白话解释

### reviewer 不负责什么

- 不直接造工具
- 不直接维护工具资产
- 不直接执行原任务
- 不直接替 `tool_reviewer` 做工具治理

### reviewer 的默认输出

正式输出必须同时包含两层：

- 机器决策层
  - 结构化 decision
- 用户解释层
  - 白话风险说明

### reviewer 的默认 baseline

不是极薄只读，而是中等厚度：

- 代码/文档读取
- 项目态读取
- 记忆 section 消费
- 搜索
- 受限测试执行

但不做厚施工、不直接造工具。

### reviewer 的默认上下文

最少必须有：

- 任务摘要
- 当前 run 状态
- capability profile
- 风险摘要
- 当前可用工具/能力快照

后续再由 `CMP / MP` 通过 section 接口喂更多内容。

## tool_reviewer

### tool_reviewer 是什么

- 工具意图审查员
- 工具治理负责人
- 它审的是“这个工具/能力该不该存在、该不该改、该怎么改”

### tool_reviewer 负责什么

- 接 reviewer 转来的工具需求
- 判断目标工具是否存在、是否可用
- 判断现有工具是否过时、失效、重复、粒度失衡
- 对工具/能力做：
  - 增
  - 删
  - 合
  - 拆
  - 替换
  - 淘汰
- 把这些要求转成给 TMA 的正式治理任务
- 对 TMA 产物做验收
- 主导运行期 smoke
- 输出最终质检报告

### tool_reviewer 不负责什么

- 不直接造工具
- 不替 TMA 施工
- 不直接完成主 agent 的原任务

### tool_reviewer 的拍板范围

默认：

- 能拍板大多数工具治理

但它的权力不是绝对常量。

它仍然要受：

- 15 种视角
- 当前模式
- 安全策略

约束。

### tool_reviewer 可以主动治理

即使 reviewer 没明确发起，它也可以在策略允许下主动发起治理，例如：

- 工具过时
- 工具重复
- 工具失效
- 粒度不合理

### tool_reviewer 的默认输出

不是一次性小工单。

它的正式输出更像：

- 持续治理计划

但每一次具体行动仍然要落成：

- 结构化任务单
- 验收标准
- smoke 要求
- 上线/回炉建议

### tool_reviewer 的默认 baseline

默认是中厚治理基线，只针对工具/能力：

- 池状态读取
- 工具资产读取
- bundle / asset / version / usage / smoke / history 读取
- 少量工具诊断

但不直接施工。

### tool_reviewer 的默认上下文

最少必须有：

- reviewer 下发的工具需求
- 当前池状态
- 当前工具资产
- 版本/依赖/使用情况

项目态和用户目标可作为补充，但不是第一位。

## TMA

### TMA 是什么

- tool make agent
- 纯造工具 agent
- 它只负责把 `tool_reviewer` 的要求变成真实工具/能力资产

### TMA 负责什么

- 根据 TR 工单进行工具建设
- 安装/下载/配置/接线
- 产出完整 capability asset
- 提交 smoke 资料
- 提交 bundle / evidence / rollback / usage 等结构化回执

### TMA 不负责什么

- 不拍板工具治理策略
- 不替 reviewer 审主 agent 行为
- 不替 TR 决定是否上线
- 不直接完成原始用户任务

### TMA 的默认 baseline

在三者里最厚：

- repo.write
- 受限 shell
- test.run
- skill / doc 生成
- 安装
- 下载
- 配置

一句白话：

- 它就是施工队

### TMA 的正式输出

默认是：

- 结构化回执
- 结构化质检证据

至少应包含：

- tool artifact
- binding artifact
- verification artifact
- usage artifact
- rollback / version / dependency / smoke evidence

### TMA 的恢复目标

冻结目标：

- 恢复后默认自动继续
- 直到产出 `ready bundle`

但：

- 不自动 activation
- 不自动 dispatch 原始任务

## 三者之间的自动链

默认主链如下：

1. 主 agent 发起能力/工具请求
2. reviewer 审查行为与风险
3. 如果缺工具或需要工具治理
   - reviewer 自动转给 tool_reviewer
4. tool_reviewer 做工具治理判断
5. tool_reviewer 给 TMA 下正式任务
6. TMA 自动施工直到产出 `ready bundle`
7. tool_reviewer 主导运行期 smoke
8. tool_reviewer 验收并决定是否正式入池
9. 通过后，后链自动继续
10. 只有在人工门槛时才停给人

## 15 种视角的冻结方式

这次总纲不再只写“模式矩阵存在”。

需要正式冻结：

- 一张共享 5×3 总矩阵
- reviewer 映射
- tool_reviewer 映射
- TMA 映射

### 五种安全策略

- `bapr`
- `yolo`
- `permissive`
- `standard`
- `restricted`

### 三类行为视角

当前总纲固定为：

- 人类定义的宏观安全视角
- agent / reviewer 推导出的任务级风险视角
- agent 层级差异带来的 runtime 权职视角

这三类视角组合到每一个 agent 身上时，会形成各自可执行的治理裁面。

### 冻结要求

这次必须在总纲中明确：

- 每种模式下 reviewer 的默认审批权
- 每种模式下 tool_reviewer 的默认治理权
- 每种模式下 TMA 的默认施工权
- 哪些点自动继续
- 哪些点必须停给人
- 哪些人工点允许合并

## CMP / MP 接口坑位

当前冻结结论：

- `CMP / MP` 是接口级强依赖
- 但不是这轮实现的完成定义

所以这次要在总纲里明确：

- reviewer / tool_reviewer / TMA 都会吃 `section`
- section 走标准注册表
- section 至少应有：
  - schema
  - source
  - freshness
  - trust level

当前实现先保留占位，联调时再和 `CMP / MP` 对齐最终标准。

## 普通用户前台要求

目标不是只让工程师能用。

这次最终收尾目标更偏：

- 面向普通用户可用

所以前台应至少支持：

- 模式切换
- 审批开关
- 自动化深度
- 人类插手点
- 工具策略覆写
- agent 规则解释的部分自定义

但前台默认不是把整个内部策略表全摊出来。

更合理的是：

- 预设档位
- 少量高级开关
- 允许通过接口进一步覆写

## TAP 真正收尾的退出标准

当前冻结的最终退出标准不是单纯“技术闭环”。

而是：

- 端到端全链都齐

更具体地说，至少应达到：

1. reviewer / tool_reviewer / TMA 三个独立 runtime 成立
2. 15 种视角冻结完成
3. 三者的职责、输入、输出、自动链路冻结完成
4. human gate / replay / activation / lifecycle / TMA resume 都有明确终态
5. 普通用户前台的模式/审批/覆写接口语义冻结完成
6. `CMP / MP` 的 section 接口坑位冻结完成
7. TAP/CMP/MP 的联调准备态已经明确，不是留成黑盒

## 下一步文档输出

基于这份总纲，下一步必须立刻产出：

- 并发任务包
- 每个 worker 的具体职责
- 共享文件所有权
- 联调顺序
- 压缩上下文后给新会话继续开发的 handoff prompt

## 一句话收口

TAP 的真正收尾，不再是“把 reviewer / tool_reviewer / TMA 各自再补几个函数”，而是把它们作为三个独立可恢复 runtime、放进同一张 15 视角治理矩阵里，接上半透明用户前台与未来 `CMP / MP section` 接口，然后让除了人工门槛之外的整条后链尽量自动跑完。
