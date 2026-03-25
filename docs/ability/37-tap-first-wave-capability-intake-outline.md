# TAP First-Wave Capability Intake Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-25

## 这份文档要回答什么

到当前阶段，`TAP` 已经不是空壳：

- `capability_call` 默认先走 `TAP`
- reviewer / provisioner / activation / replay / human gate / durable snapshot 都已经有主链骨架
- `capability-package` 七件套模板已经成立
- `search.ground`、`mcp.*`、`skill.*`、`model.infer` 这些 adapter 本体已经存在

但这还不等于：

- 第一批真实 capability 已经正式接入 `TAP`
- reviewer / `TMA` 已经有足够的真工具可用
- 后续 `CMP / MP` 的多个 agent 已经能直接复用这套能力

这份文档只解决一个问题：

- 我们现在先把哪些“已经能接、并且接进去就能正常使用”的能力，优先接进 `TAP`

一句白话：

- 先不要追求把所有能力一口气接完
- 先把现在最成熟、最值钱、最能立刻服务后续多智能体工作的那一批能力接进来

## 先说结论

当前最适合优先接入 `TAP` 的，不是 reviewer / `TMA` lane 语义里那批“未来要有的工具名”，而是下面两层东西：

### 第一层：已经在当前代码里有真实 adapter 的外部能力族

- `search.ground`
- `skill.use`
- `skill.prepare`
- `skill.mount`
- `mcp.listTools`
- `mcp.readResource`
- `mcp.call`
- `mcp.native.execute`

### 第二层：为了让 reviewer / `TMA` 真能干活，必须尽快补成正式 capability 的内部基线

- `code.read`
- `docs.read`
- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

而下面这些高外部性能力，应当放到第一波之后：

- `dependency.install`
- `network.download`
- `mcp.configure`

## 当前真实状态

### 已经成立的部分

- `TAP` 已经是默认 capability 控制面
- `capability-package` 七件套已经可以作为能力接入模板
- runtime 已经提供：
  - `registerCapabilityAdapter(...)`
  - `registerTaActivationFactory(...)`
  - `activateTaProvisionAsset(...)`
- adapter 层当前已有可复用实货：
  - `search.ground`
  - `mcp.*`
  - `skill.*`
  - `model.infer`

### 还只是骨架的部分

下面这些现在主要还停在：

- reviewer / provisioner lane budget
- prompt contract
- 文档冻结语义

而不是已经默认注册进 capability pool 的真 capability：

- `code.read`
- `docs.read`
- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`
- `dependency.install`
- `network.download`
- `mcp.configure`

## 为什么先接外部能力族

因为它们已经具备下面三个条件：

1. 已有真实 adapter 或 runtime 实现
2. 已有 prepare / execute 级测试
3. 已有明确的 capability family 语义

也就是说：

- 我们不是从 0 发明能力
- 我们是在把已经存在的能力，正式整理进 `TAP`

这比先去补十几个全新内部工具更容易形成闭环。

## 三个最值得优先吸收的能力族

### 1. `search.ground`

这是当前最适合成为 `TAP` 第一个 first-class 外部 capability package 的能力。

原因：

- 在 [01-basic-implementation.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/01-basic-implementation.md) 里本来就属于 `Shared Pool`
- 当前代码里同时有旧桥和新 adapter
- runtime / TAP 测试已经把它当默认烟雾线
- 后续 `CMP / MP` agent 很快就会需要查资料、看文档、做外部验证

这一族当前最值得吸收的收口点：

- OpenAI `maxOutputTokens -> max_output_tokens`
- Anthropic governed-task prompt 构建
- compatibility blocked 的可解释性测试
- `RaxWebsearchAdapter` 的 TAP 透传测试补强

### 2. `skill.*`

这一族最适合给 `TMA` 和后续包装机链打底。

当前最值得吸收的收口点：

- `skill.use` 支持 `source | container | reference`
- `virtual skill reference`
- `composeStrategy / composeNotes`
- TAP 侧真实调度测试

一句白话：

- 这组能力直接关系到“工具+说明书+复用入口”能不能成立

### 3. `mcp.*`

这一族当前最值钱的不是“再扩更多动作”，而是先把 truthfulness 做对。

当前最值得吸收的收口点：

- OpenAI agent-hosted native support matrix 收真
- duplicate connection 替换的“先连后换，失败保旧连接”
- 更细的 launch / connect error 分类
- `rax-mcp-adapter` 对 unsupported native route 的负向测试

一句白话：

- MCP 是厚能力
- 厚能力第一件事不是更会吹，而是别 overclaim

## reviewer / TMA 第一批内部基线

在三族外部能力正式整理进 `TAP` 的同时，必须补齐 reviewer / `TMA` 的最小内部基线。

### reviewer 最小只读基线

- `code.read`
- `docs.read`
- `project.summary.read`
- `inventory.snapshot.read`
- `memory.summary.read`

目标不是让 reviewer 会执行，而是让 reviewer 终于看到真实上下文，而不是 placeholder。

### bootstrap TMA 最小施工基线

- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

再加上上面的：

- `code.read`
- `docs.read`

这才构成最小“真施工队”。

## 第一波接入顺序

建议严格按下面顺序来：

1. reviewer 只读基线：
   - `code.read`
   - `docs.read`
   - `project.summary.read`
   - `inventory.snapshot.read`
   - `memory.summary.read`
2. bootstrap `TMA` 本地施工基线：
   - `repo.write`
   - `shell.restricted`
   - `test.run`
   - `skill.doc.generate`
3. `search.ground`
4. `skill.use -> skill.prepare -> skill.mount`
5. `mcp.listTools -> mcp.readResource -> mcp.call -> mcp.native.execute`
6. extended `TMA`：
   - `dependency.install`
   - `network.download`
   - `mcp.configure`

## 第一波不要做的事

- 不要一口气接完所有厚能力
- 不要把 reviewer 放宽成执行 agent
- 不要把 `TMA` 做成替主 agent 完成任务的 agent
- 不要整条 cherry-pick 旧分支
- 不要把不同 provider 的 `websearch` / `mcp` / `skill` 合同硬说成完全等价

## 第一波验收标准

第一波做完后，至少要成立下面这些事实：

1. `search.ground` 已成为 `TAP` 的正式 capability package
2. `skill.*` 已至少有一条能穿过 `TAP` 真调度
3. `mcp.*` 的 truthful support matrix 已修正
4. reviewer 不再只吃 placeholder-only 上下文
5. bootstrap `TMA` 拥有最小本地施工基线
6. 后续 `CMP / MP` agent 已有一批可直接复用的真实能力

## 和下一阶段的关系

这份文档不是在取代：

- `CMP`
- `MP`
- 包装机
- 记忆池

而是在给它们清理出一个最小、真实、可运行的能力地基。

一句收口：

- 先把现在已经成熟的能力族和最小内部基线接进 `TAP`
- 后面的多智能体系统才不会继续踩在“只有 lane 语义、没有真实能力库存”的地板上
