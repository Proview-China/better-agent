# CMP v0.1.0 Freeze

状态：封板说明 / 冻结基线。

更新时间：2026-04-12

## 当前结论

`CMP` 现在可以冻结为：

- `cmp-version-0.1.0`

这里的 `0.1.0` 含义不是：

- `CMP` 已经完全完成

而是：

- `CMP` 已经形成一套可工作的异步上下文治理基线
- 其核心工作方式、提示词工程候选、active/passive 主面、peer approval 主链和 readback/smoke 效果门已经有实测支撑

一句白话：

- 这是“可用的 v0”
- 不是“所有细枝末节都收尾的最终版”

## 本次冻结冻结了什么

### 1. 角色工位定义

当前冻结的角色口径是：

- `ICMA`：前处理工位
- `Iterator`：分线 / 粒度治理工位
- `Checker`：信噪比与方向守门工位
- `DBAgent`：高价值 section / 持久化工位
- `Dispatcher`：控制台 / 回送 / 播种纪律工位

这份口径对应文档：

- [69-cmp-role-workmode-prompt-design.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/69-cmp-role-workmode-prompt-design.md)

### 2. 当前最佳提示词工程候选

当前冻结的 prompt engineering 候选是：

- `workmode_v8`

它的冻结策略是：

- `ICMA / Iterator / Dispatcher` 保留 baseline 风格
- `Checker / DBAgent` 使用更贴工位的工作方式版

当前判断：

- `CMP` 的最优提示词工程不是“五角色风格统一”
- 而是“按工位分层取最优”

### 3. 当前冻结的主工作面

当前冻结并视为可用的主工作面包括：

- `active`
- `passive`

具体已经验证过的关键流动包括：

- `child seed`
- `peer_exchange pending`
- `peer_exchange approved`
- `passive historical return`

### 4. 当前冻结的效果门

当前冻结的效果门包括：

- `runtime summary`
- `statusPanel`
- `readback`
- `smoke`

也就是说，`CMP` 不只是“内部对象存在”，而是已经有：

- 可读的运行摘要
- 可读的状态面板
- 可读的 readback 结论
- 可执行的 smoke gate

## 本次冻结的实测依据

### 定向测试

当前冻结前通过的关键测试包括：

- `src/agent_core/cmp-five-agent/dispatcher-runtime.test.ts`
- `src/agent_core/cmp-five-agent/five-agent-runtime.test.ts`
- `src/rax/cmp-runtime.test.ts`
- `src/rax/cmp-facade.test.ts`

它们覆盖了：

- five-agent runtime 主链
- peer approval 状态迁移
- `RaxCmpRuntime -> AgentCoreRuntime` 的真实链路
- `facade/readback/smoke` 的效果门

### strict live smoke

冻结前的关键 live smoke 结论是：

- `cmp-five-agent-live-smoke`
- `provider=openai`
- `role=all`
- `flow=both`
- `strict-live`
- `prompt-variant=workmode_v8`

当前结果为全绿，覆盖：

- `ICMA`
- `Iterator`
- `Checker`
- `DBAgent active`
- `Dispatcher child`
- `Dispatcher peer pending`
- `DBAgent passive`
- `Dispatcher passive`

一句白话：

- 这不是只有本地 stub 在过
- 真实 live 路径也已经能跑通当前主面

## 本次冻结最重要的结论

### 1. `CMP` 已经像“异步伴侣”而不是“被动查历史模块”

它现在已经体现出：

- 整理
- 去噪
- 持久化
- 分线
- 脉络化
- 可回取化
- 精准化
- 迭代化

这些后台治理能力。

### 2. `peer approval` 主链已经成立

当前已经明确验证：

- `peer_exchange` 可以形成 pending approval
- approval 通过后：
  - `pendingPeerApprovalCount` 会清零
  - `approvedPeerApprovalCount` 会增加
  - `cmp.five_agent.flow` 会恢复成 `ready`

### 3. `flow` 恢复不等于整板全绿

当前必须冻结的一条认知是：

- `peer approval` 通过后，`CMP flow` 会恢复
- 但 `final acceptance / readbackStatus` 不保证自动全绿

因为它们还受：

- object model
- bundle schema
- TAP execution bridge
- live infra
- recovery

这些 gate 影响

一句白话：

- `peer` 这条路通了
- 不等于整个 `CMP` 项目面板没有其他问题

## 本次冻结不承诺什么

`cmp-version-0.1.0` 不承诺下面这些事情已经全部完成：

- 所有内部对象和所有流动细链都已经彻底终态化
- 所有 `receipt / snapshot / recovery` 深层保真都已经完全补满
- `reintervention / parent-side review / requestHistory 回流` 全链都已经收口
- 仓库整体所有无关模块都已经可一键 typecheck / 封板

这里尤其要注意：

- 当前 worktree 还有其他 Codex 在改 `surface / tap-tooling / live-agent-chat / docs` 等无关部分
- 本次冻结只对 `CMP` 相关代码和文档负责

## 冻结后的下一阶段

冻结 `cmp-version-0.1.0` 之后，
下一阶段默认进入：

- `CMP <-> TUI` 联调

重点不是重写 `CMP`，
而是让 `TUI` 正确消费：

- `statusPanel`
- `readback`
- `smoke`
- five-agent summary
- pending / approved / degraded 这些状态面

一句话收口：

- `CMP v0.1.0` 现在是可冻结基线
- 后面重点转向“怎么把它接进 TUI 用起来”
