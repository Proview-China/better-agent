# CMP/MP Ten-Agent Minimum Capability Baseline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-25

## 这份文档要回答什么

我们后面会让 `CMP / MP` 方向的十个小 agent 真正开始干活。

但在那之前，必须先回答一个更基础的问题：

- 这些 agent 至少要拥有什么能力，才能不是“空壳多智能体”

这份文档不讨论：

- 十个 agent 最终怎么分工
- `CMP / MP` 的高层治理系统怎么设计
- 记忆池、包装机、权限系统的最终细节

这份文档只定义：

- 在当前阶段，为了让 `CMP / MP` 十个小 agent 可以正常使用，我们最少要先接好的能力基线是什么

一句白话：

- 先解决“他们最少得看见什么、能做什么”
- 再去谈更复杂的 agent 编队和治理细则

## 先说结论

对 `CMP / MP` 十个小 agent 来说，当前最小可用能力基线分成三层：

### 第一层：所有 agent 的通用只读基线

- `code.read`
- `docs.read`
- `project.summary.read`
- `inventory.snapshot.read`
- `memory.summary.read`
- `search.ground`

### 第二层：允许本地推进工作的最小施工基线

- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

### 第三层：只给少数专门 agent 的高外部性能力

- `skill.use`
- `skill.prepare`
- `skill.mount`
- `mcp.listTools`
- `mcp.readResource`
- `mcp.call`
- `mcp.native.execute`
- `dependency.install`
- `network.download`
- `mcp.configure`

## 为什么不能一上来就给所有 agent 全权

因为后面的十个小 agent 不是都在做同一件事。

如果默认全给：

- 容易让只读检查 agent 变成胡乱执行 agent
- 容易让上下文整理 agent 越权改代码
- 容易让多个 agent 同时争用高外部性能力
- 容易让 `TAP` 审批链在真实负载上直接变得混乱

所以当前阶段必须把能力分层，而不是平铺。

## 建议的 agent 能力分层

### A. 通用观察层

给所有 `CMP / MP` agent。

能力：

- `code.read`
- `docs.read`
- `project.summary.read`
- `inventory.snapshot.read`
- `memory.summary.read`

作用：

- 看代码
- 看文档
- 看项目现状
- 看池里现在有哪些能力
- 看记忆摘要

这一层的目标是：

- 让 agent 至少有眼睛

### B. 外部查证层

给需要外部验证、对齐官方文档、检查外部状态的 agent。

能力：

- `search.ground`

作用：

- 查官方文档
- 查 SDK 能力变化
- 查外部说明与证据

这一层的目标是：

- 让 agent 不只能在 repo 里盲找

### C. 本地施工层

给需要在 repo 内推进工作的 agent。

能力：

- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

作用：

- 修改仓库内文件
- 跑受限命令
- 跑针对性测试
- 生成 skill / doc 产物

这一层的目标是：

- 让 agent 真能交付工作，而不是只能提建议

### D. 资产化能力层

给负责造工具、装工具、接工具的 agent。

能力：

- `skill.use`
- `skill.prepare`
- `skill.mount`
- `mcp.listTools`
- `mcp.readResource`
- `mcp.call`
- `mcp.native.execute`

作用：

- 复用 skill
- 探测 MCP
- 调 MCP
- 把已有外部能力族变成可接的 capability package

这一层的目标是：

- 让 agent 开始拥有“工具即资产”的能力

### E. 高外部性施工层

只给少数专门 agent，例如后续真正的 `TMA`、infra agent、系统集成 agent。

能力：

- `dependency.install`
- `network.download`
- `mcp.configure`

这一层暂时不要默认给 `CMP / MP` 的普通 worker。

## 当前阶段给十个小 agent 的推荐基线

如果现在就要让 `CMP / MP` 十个小 agent 开始工作，推荐先按下面这条最小配置来：

### 默认给全部十个 agent

- `code.read`
- `docs.read`
- `project.summary.read`
- `inventory.snapshot.read`
- `memory.summary.read`
- `search.ground`

### 默认只给其中“会提交工作”的少数 agent

- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

### 默认不直接给普通 worker

- `mcp.call`
- `mcp.native.execute`
- `dependency.install`
- `network.download`
- `mcp.configure`

这些动作必须通过 `TAP` 审批或分配给专门 agent。

## 和 `TAP` 的关系

这套基线不是绕过 `TAP`。

恰恰相反，它要求：

- 所有能力都经由 `TAP` 的统一 capability/package/pool 语义接入
- 普通 agent 不直接绕过 `TAP`
- 高外部性动作继续通过 reviewer / `TMA` / human gate 控制

也就是说：

- `CMP / MP` 十个小 agent` 只是能力消费者
- `TAP` 仍然是能力总闸门

## 为什么现在先补这套基线

因为当前最真实的短板不是：

- `CMP / MP` 概念不清楚

而是：

- 后面的十个小 agent 即使开始跑，也还没有一套最小、稳定、真实的能力地基

如果这套基线不先补好，会出现三种常见坏情况：

1. agent 只能看 prompt，不能看 repo 和文档
2. agent 能看，但不能真正推进本地工作
3. agent 一旦要做厚能力动作，就直接越权或卡死在审批链前

## 当前阶段最重要的三条原则

### 1. 先让所有 agent 有眼睛

也就是先补：

- `code.read`
- `docs.read`
- `project.summary.read`
- `inventory.snapshot.read`
- `memory.summary.read`

### 2. 再让少数 agent 有手

也就是再补：

- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

### 3. 最后再让专门 agent 拥有重工具

也就是：

- `skill.*`
- `mcp.*`
- `dependency.install`
- `network.download`
- `mcp.configure`

## 推荐推进顺序

### 第一阶段

先把 reviewer 的真只读基线补好。

目标：

- reviewer 不再只吃 placeholder
- 普通 worker 也能先看清现状

### 第二阶段

把 bootstrap `TMA` 和少数本地施工 worker 的最小施工基线补好。

目标：

- 后面的十个小 agent 里，至少有一部分能真推进 repo 内工作

### 第三阶段

把 `search.ground` 正式接成 TAP first-class capability。

目标：

- 十个小 agent 可以做外部查证和官方对齐

### 第四阶段

把 `skill.*` 和 `mcp.*` 逐步接入。

目标：

- 让专门 agent 开始具备真正的工具资产化和外部能力使用能力

### 第五阶段

最后才放开 extended `TMA` 的高外部性能力。

目标：

- 安装、下载、配置这类动作继续保持受控

## 验收标准

当这份文档对应的能力基线成立时，至少要满足下面这些事实：

1. `CMP / MP` 十个小 agent 都能稳定读取代码、文档、项目摘要与能力库存
2. 至少有一部分 agent 能在 repo 内受控写入并跑测试
3. `search.ground` 已能被十个小 agent 直接复用
4. `skill.*` / `mcp.*` 已能被专门 agent 在 `TAP` 下受控使用
5. 高外部性能力仍然没有被普通 worker 默认拿走

## 一句收口

对后面 `CMP / MP` 的十个小 agent 来说，当前最重要的不是再发明更多 agent 角色，而是先把一套最小、真实、可运行的能力基线准备好。

没有这套基线：

- 十个 agent 只是十个会说话的壳

有了这套基线：

- 十个 agent 才开始成为一个真正能协作、能查、能做、能受控升级的系统
