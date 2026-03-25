# TAP Wave0-Wave1 Implementation Status

状态：已开始落地。

更新时间：2026-03-25

## 这一步实际做成了什么

这轮没有直接冲进 `reviewer / tool_reviewer / TMA` 的 durable 主链，而是先把 `Wave 0 -> Wave 1` 的基础验收面做成了正式代码：

- `src/agent_core/tap-availability/formal-family-inventory.ts`
- `src/agent_core/tap-availability/availability-contract.ts`
- `src/agent_core/tap-availability/availability-audit.ts`
- `src/agent_core/integrations/tap-capability-family-assembly.ts`

一句白话：

- TAP 现在已经不只是“看文档知道有这些 family”
- 而是代码里已经能统一回答：
  - formal family 到底有哪些
  - 每个 capability 的 health / smoke / report contract 是什么
  - 当前有没有注册、有没有 activation factory、有没有健康信号
  - 在 availability 维度上是不是 ready / review_required / blocked

## 当前 formal family inventory

当前 formal family 仍然是这四组：

- `foundation`
- `websearch`
- `skill`
- `mcp`

并且 inventory 已经带上：

- package source refs
- register helper refs
- assembly ref
- activation factory refs

## 当前 availability contract

每个 formal capability 现在都能统一映射出：

- health contract
- smoke contract
- report contract
- evidence records
- observed registration / health state
- gate status

这意味着后面做 `Wave 2` 时，我们不需要再靠肉眼去判断“这个东西算不算接进去了”。

## 这一步最重要的工程价值

### 1. family assembly 开始有 registration audit

`tap-capability-family-assembly` 现在不只是返回 packages / bindings / factory refs，还会产出：

- `registrationAudit`
- `activationFactoryAudit`

这给 availability report 提供了统一的第一手输入。

### 2. health / smoke / report contract 不再散落

之前这些信息分散在：

- capability package
- adapter health hook
- activation spec
- usage doc ref

现在已经被 availability contract 收成统一对象，后面 reviewer / tool_reviewer / TMA 都可以直接消费。

### 3. Wave 2 的检查入口已经准备好了

现在我们已经能稳定生成：

- formal family inventory
- capability availability truth table
- capability availability report

所以下一步就可以正式开始逐个 family 做可用性检查，而不是继续先补新 helper。

## 当前验证结果

这轮已经验证通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/tap-availability/*.test.ts src/agent_core/integrations/tap-capability-family-assembly.test.ts`
- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 当前还没有做的事

这一步还没有进入：

- `tool_reviewer` 真 agent 化
- `TMA provision -> activation/replay -> recovery` durable 收口
- backlog / half-wired capability 的统一待收口矩阵

也就是说：

- availability 底座已经立住
- 但 durable closure 还在下一波
