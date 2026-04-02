# Dev-Master Runtime Bridge Audit

状态：高风险接口审计 / `cmp-runtime` 前置判断。

更新时间：2026-04-02

## 这份文档回答什么

这份文档专门回答：

- `cmp/mp` 里的 `src/rax/cmp-runtime.ts` 到底依赖当前主线的哪些 runtime 能力。
- 这些能力在新 `dev` 上到底存不存在。
- 为什么当前不能把 `cmp-runtime` 当作一个可直接并入的薄壳。

一句白话：

- 这份文档不是再讲“runtime assembly 很危险”。
- 它要把危险具体到方法级别，让后面的人没法再靠想象推进。

## 当前审计对象

本轮只审下面两边：

- `origin/cmp/mp:src/rax/cmp-runtime.ts`
- 当前新主线：
  - `src/agent_core/runtime.ts`
  - `src/agent_core/index.ts`

## 当前核实结果

### 1. `cmp-runtime.ts` 直接依赖一整组 `AgentCoreRuntime` 的 `CMP` 方法

`origin/cmp/mp:src/rax/cmp-runtime.ts` 当前直接调用：

- `bootstrapCmpProjectInfra`
- `getCmpProjectInfraBootstrapReceipt`
- `getCmpRuntimeInfraProjectState`
- `getCmpRuntimeRecoverySummary`
- `getCmpRuntimeProjectRecoverySummary`
- `getCmpRuntimeDeliveryTruthSummary`
- `getCmpFiveAgentRuntimeSummary`
- `createCmpRuntimeSnapshot`
- `resolveCmpFiveAgentCapabilityAccess`
- `dispatchCmpFiveAgentCapability`
- `reviewCmpPeerExchangeApproval`
- `advanceCmpMqDeliveryTimeouts`
- `recoverCmpRuntimeSnapshot`
- `ingestRuntimeContext`
- `commitContextDelta`
- `resolveCheckedSnapshot`
- `materializeContextPackage`
- `dispatchContextPackage`
- `requestHistoricalContext`

白话：

- 它不是只包了一层 connectors
- 它是在直接代理一整条已经存在的 `CMP` workflow 主链

### 2. 当前新主线的 `src/agent_core/runtime.ts` 还没有这些方法

主线程已经核实：

- 当前新主线的 `src/agent_core/runtime.ts`
  没有暴露上面这组 `CMP` runtime 方法
- 当前 `src/agent_core/index.ts`
  也还没有把：
  - `cmp-git`
  - `cmp-runtime`
  - `cmp-five-agent`
  这批面整体导出来

### 3. 当前新主线也还没有 `cmp-five-agent`

当前新主线中：

- `src/agent_core/cmp-five-agent/**`
  仍然不在位

这意味着：

- `getCmpFiveAgentRuntimeSummary`
- `resolveCmpFiveAgentCapabilityAccess`
- `dispatchCmpFiveAgentCapability`
- `reviewCmpPeerExchangeApproval`

这几条链不仅 runtime 没接口，连上层依赖对象本身也还没回到主线

## 当前判断

### 结论 1. `cmp-runtime.ts` 不能照 `cmp/mp` 原样移植

原因不是：

- 小范围 import 不一致
- type 名字没对齐

而是：

- 当前主线底层根本没有它要代理的那组 runtime 能力

### 结论 2. 现在去做 `cmp-runtime` 很容易做成“假壳”

如果现在硬接：

- 最可能出现的结果不是“先接一个薄壳”
- 而是“看起来接口有了，但实际功能并不存在”

这会直接带来两个坏处：

1. 误导后续 worker，以为 `CMP` 已经接到 runtime 主链
2. 让 `rax.cmp` facade 更早建立在假前提上

### 结论 3. `Phase B` 目前不应直接开工

当前更诚实的表述应该是：

- `Phase A` 已经成立
- `Phase B` 当前受 runtime bridge 阻塞

## 当前最合理的下一步

在继续碰 `cmp-runtime` 之前，必须先在主线程回答一个更基础的问题：

### 路线 A

- 是不是要先把 `agent_core/runtime.ts` 的 `CMP` 桥位接回来

### 路线 B

- 还是先定义一个只包 connectors/config/readback shell，
  不假装自己已经拥有 `CMP workflow passthrough` 的更窄 `RaxCmpRuntimeLike`

当前更保守的建议是：

- 先把这个 bridge 策略决定掉
- 再判断 `cmp-runtime` 是否能进入真正施工

## 一句话结论

- 现在阻塞 `cmp-runtime` 的，不是文件没拷回来
- 而是底层 runtime bridge 还不存在
