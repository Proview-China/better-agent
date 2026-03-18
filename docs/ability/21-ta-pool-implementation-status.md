# T/A Pool Implementation Status

状态：阶段性实现总结，不是最终收口结论。

更新时间：2026-03-18

## 先说结论

`T/A Pool` 这一部分现在已经不是纯概念设计了。

它已经完成到下面这个程度：

- 第一版控制面协议已落地
- 第一版 review / provision / safety / context / runtime 骨架已落地
- `AgentCoreRuntime` 已开始接入 `T/A Pool`
- 第一个 pool 已经接进 `raw_agent_core` 预留接口
- 当前类型检查和 `agent_core` 定向测试都已通过

但它**还不能被叫做“完整做完”**。

更准确的判断是：

- 第一版 `T/A Pool` 控制面已经成立
- 基础 runtime assembly 已经打通
- 但它还没有成为所有 capability intent 的默认主路径
- 也还没有把高层项目状态、记忆池、包装机真实接进 reviewer

一句白话：

- 我们已经不只是有“工具池设计稿”
- 我们已经有了第一版可运行的 `T/A Pool`
- 但现在还处在“控制面已成立，完整治理未完成”的阶段

## 这次到底完成了什么

### 1. 控制面协议层

当前已落地：

- `src/agent_core/ta-pool-types/**`

这里已经冻结了第一版最关键的对象：

- `AgentCapabilityProfile`
- `AccessRequest`
- `ReviewDecision`
- `CapabilityGrant`
- `ProvisionRequest`
- `ProvisionArtifactBundle`

同时也已经固定了：

- `B0-B3`
- `strict / balanced / yolo`
- `approved / partially_approved / denied / deferred / escalated_to_human / redirected_to_provisioning`

这意味着：

- `T/A Pool` 的公共语言已经存在
- 不再只是讨论层

### 2. baseline 与模式矩阵

当前已落地：

- `src/agent_core/ta-pool-model/**`

这里已经做成了：

- baseline profile 判定
- 默认 grant 辅助
- mode policy matrix
- `strict / balanced / yolo` 行为差异

这意味着：

- 默认放权已经不只是口头约定
- 第一版的权限宽度与模式差异已经有纯函数底座

### 3. reviewer 控制面

当前已落地：

- `src/agent_core/ta-pool-review/**`

这里已经做成了：

- review decision engine
- review routing
- reviewer runtime shell
- LLM reviewer hook 占位口

这意味着：

- review plane 已经不是空壳
- 即使现在还没接真实大模型审核，也已经有最小控制面行为

### 4. provision 控制面

当前已落地：

- `src/agent_core/ta-pool-provision/**`

这里已经做成了：

- provision registry
- provision lifecycle
- provisioner runtime shell
- mock builder
- `building -> ready / failed` 状态链

这意味着：

- “没有就去造”这条路已经不是纸面
- 现在虽然还只是 mock builder，但供给面骨架已经成立

### 5. safety 控制面

当前已落地：

- `src/agent_core/ta-pool-safety/**`

这里已经做成了：

- `allow`
- `interrupt`
- `block`
- `downgrade`
- `escalate_to_human`

并且已经补了：

- yolo 下对高风险能力的紧急阻断

这意味着：

- yolo 现在已经不是“没有审核员”
- 第一版行为气囊已经成立

### 6. context 坑位

当前已落地：

- `src/agent_core/ta-pool-context/**`

这里已经做成了：

- reviewer / provisioner 的 context aperture placeholder

这意味着：

- 项目状态、记忆池、包装机这些更高层东西虽然还没真正接进来
- 但坑位已经留好了

### 7. runtime assembly 第一段

当前已落地：

- `src/agent_core/ta-pool-runtime/**`
- `src/agent_core/runtime.ts`

这里已经做成了：

- control-plane gateway
- execution bridge
- `resolveTaCapabilityAccess(...)`
- `dispatchTaCapabilityGrant(...)`
- `dispatchCapabilityIntentViaTaPool(...)`

并且已经打通下面三条基础链路：

- review -> dispatch
- review -> provisioning
- safety -> interrupt

这意味着：

- 第一个 `T/A Pool` 已经不是孤立模块集合
- 它已经接进 `raw_agent_core` 预留接口

## 当前还没做完的部分

### 1. 默认 capability intent 主路径还没切

现在 `T/A Pool` 已经能被 runtime 使用。

但还没有做到：

- 所有 capability intent 默认先走 `T/A Pool`

也就是说：

- 当前 assembly 已通
- 但还不是默认总入口

### 2. reviewer 还没吃真实高层上下文

当前 reviewer 还只是：

- 规则 + runtime shell + placeholder context

还没有做到：

- 读取真实项目状态镜像
- 读取真实记忆池
- 读取包装机态上下文
- 做真实 LLM reviewer 决策

### 3. provisioner 还只是 mock builder

当前已经有供给面 runtime。

但还没有做到：

- 真正配置工具
- 真正安装依赖
- 真正接 MCP / shell / skill builder

### 4. safety 还没完全联到更广的运行面

当前 safety 已经能挡第一波危险请求。

但还没有做到：

- 更细粒度的行为账本
- 更复杂的 downgrade / recover 流程
- 与人工审批链路的完整集成

## 当前验证基线

当前已回读通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
  - `115 pass / 0 fail`

这意味着：

- `T/A Pool` 第一波代码不是局部能跑
- 它已经在当前 `agent_core` 基线上通过了完整验证

## 这一阶段最准确的外部说法

当前最合适的说法是：

- Praxis 的第一版 `T/A Pool` 控制面已经落地并通过验证。
- 第一个 pool 已经接进 `raw_agent_core` 预留接口。
- `T/A Pool` 的基础 runtime assembly 已经打通。
- 但它还没有完成默认主路径切换，也还没有完成更高层治理接入。

一句压缩版：

- 第一个 `T/A Pool` 已经从总纲进入可运行骨架，并接入 `raw_agent_core`
- 但当前仍处在“第一版控制面已成立，完整治理与主路径收口未完成”的阶段
