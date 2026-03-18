# T/A Pool Control-Plane Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-18

## 这份文档要回答什么

Praxis 现在已经有：

- 可运行的 `agent_core` raw runtime kernel
- 已落地的 `Capability Interface v1`
- 已有第一版 `CapabilityPool` 执行骨架

但这还不等于我们已经有了真正可治理、可供给、可审核的工具/能力池。

下一步要说清楚的不是：

- 某个具体工具怎么接
- 某个 MCP 怎么配置
- 某个 provider 怎么执行

而是下面这件事：

1. 主 agent 默认拥有什么工具/能力。
2. 主 agent 在什么情况下需要向池申请更高权限或更厚能力。
3. 谁来审批。
4. 没有工具时，谁来造。
5. 多 agent 并发时，审核和供给怎么不把热路径拖死。
6. 这套东西如何和未来的 agent 治理 system、记忆池、包装机架构兼容。

一句白话：

- `Capability Interface` 解决的是“怎么统一调用”
- `CapabilityPool` 解决的是“怎么高性能执行”
- `T/A Pool` 解决的是“谁默认有、谁申请、谁批准、没有就谁去造”

## 先说结论

- `T/A Pool` 不是单纯的 registry，也不是普通插件市场。
- `T/A Pool` 第一版应该被定义为：围绕现有 `CapabilityPool` 执行面构建的一层控制平面。
- 这一层控制平面至少要包含：
  - 默认放权模型
  - 审核模型
  - provisioning 模型
  - 安全阻断模型
  - 上下文坑位
- `agent_core` 不应该直接知道审核员 agent 或造工具 agent 的内部过程。
- `agent_core` 仍然只应该看到统一结果：
  - 允许执行
  - 等待
  - 被拒绝
  - 转人工
  - 转 provisioning
  - 收到执行结果
- 审核和供给是治理层控制面，不是 raw kernel 数据面。

## 当前事实与新问题

当前仓库已经证明了一件事：

- `Capability Interface v1` 已经成立
- `CapabilityPool` 的第一版执行骨架已经成立

但我们现在面对的新问题已经不是“能力能不能调”。

真正的新问题是：

- 主 agent 是否默认全裸拿到所有能力
- 如果不是，默认基线怎么定
- 如何避免 agent 没眼睛没手脚
- 如何避免 agent 在不会用的时候乱用重能力
- 如何在缺工具时自动补齐能力供给
- 如何在 yolo 模式下仍然保留行为阻断

这就是为什么 `T/A Pool` 必须在现有 `CapabilityPool` 之上再加一层“治理型控制面”。

## 总设计原则

### 1. 热路径继续极薄

主 loop 不应该在每次能力调用时都深度等待复杂治理流程。

所以必须把：

- 默认放权
- 审核判断
- 供给建设
- 人类升级
- 项目态上下文注入

都尽量下沉到控制面缓存、配置、工单和异步队列里。

热路径最好只看到：

- 当前 agent 是否已有某项 grant
- 若无，当前请求是否可立即进入 review
- review 的决定结果是什么
- 若批准，如何 lower 成现有 `CapabilityPool` 的 lease / dispatch

### 2. 默认放权必须存在

如果默认什么都不给，主 agent 就不是 agent，只是聊天器。

所以第一版必须承认：

- 有一组 baseline capability set 是默认可用的

这组 baseline 不是最终真理。

它在长期应由更高层的 agent 治理 system 定义；但在当前阶段，我们必须给出一个临时且合理的默认基线。

### 3. “改代码”不是单一动作

`write code` 不能被视为一个权限。

至少要区分：

- 新建文件
- 小范围修改
- 大范围修改
- 重构迁移
- 删除
- 工作区外修改

否则权限宽度会粗得无法治理。

### 4. 审核员不是执行器

审核员 agent 负责的是：

- 理解申请理由
- 结合当前上下文判断必要性与风险
- 给出批准、部分批准、拒绝、延后、升级人工、转 provisioning 等决定

它不直接替主 agent 干活。

### 5. 造工具 agent 不是临时脚手架

造工具不是一次性劳动，而是资产建设。

它的产物不能只是“装好了”。

至少应交付：

- `tool artifact`
- `binding artifact`
- `verification artifact`
- `usage artifact`

也就是：

- 工具本体
- 如何接到池里的绑定信息
- smoke / health 结果
- skill 或小文档

### 6. 严格模式和 yolo 模式只是策略差异，不是系统分裂

同一个审核控制面，在不同模式下扮演的角色不同：

- `strict`
  - 更像前置门卫
- `balanced`
  - 更像成本和风险折中器
- `yolo`
  - 更像行为审计员和紧急阻断器

换句话说：

- yolo 不是没有审核员
- yolo 只是把“权限闸门”改成“行为防撞气囊”

### 7. 上下文感知必须留坑位，但不提前耦合

未来 reviewer 一定需要接：

- agent 治理 system
- 记忆池
- 包装机
- 项目状态镜像

但当前阶段不要把这些高层系统提前硬塞进 `agent_core`。

更稳的做法是：

- 在 `T/A Pool` 第一版里预留 `review context aperture`
- 先定义 reviewer 需要被喂什么类型的信息
- 后面再决定由哪些上层系统来真正供给

## 五个平面

为了不把这件事说乱，建议把 `T/A Pool` 固定成五个平面。

### 1. `kernel plane`

这是 `agent_core` 所在平面。

它只负责：

- 推进 run
- 发出能力申请意图
- 接收审核后的统一结果
- 接收执行结果

它不负责：

- 审核细节
- 工具建设
- 项目态解释
- 人工升级判断

### 2. `execution plane`

这是现有 `CapabilityPool` 所在平面。

它负责：

- manifest / binding / generation
- lease / prepare / dispatch
- queue / backpressure / drain
- adapter execute / result

一句白话：

- 这是“真正跑工具”的地方

### 3. `review plane`

这是审核控制面。

它负责：

- 接收 access request
- 结合当前 agent profile 与模式判断是否批准
- 决定是否部分批准、拒绝、延后、升级人工、转 provisioning
- 在 yolo 模式下承担行为阻断职责

一句白话：

- 这是“拍板的人”

### 4. `provision plane`

这是供给平面。

它负责：

- 发现缺失工具
- 安装 / 配置 / 更新 / 修复
- 产出 artifact bundle
- 注册回执行面
- 对工具资产提出拆分、合并、淘汰、迭代建议

一句白话：

- 这是“造工具的人”

### 5. `context plane`

这是未来 reviewer / provisioner 的现状感知平面。

第一版只留坑位，不把上层治理系统提前做死。

它未来应能提供：

- 当前项目状态摘要
- 当前 session / run 目标摘要
- 当前 agent 身份与默认画像
- 当前已有 t/a 清单与健康状态
- 当前用户模式
- 当前记忆层摘要

一句白话：

- 这是“让审核员知道现在发生了什么”

## 权限分层：B0 到 B3

第一版建议固定为四层。

注意：

- 这不是最终治理 system 的永久真理
- 这是当前为了把池子做出来而采取的临时工程基线

### `B0 baseline`

默认给。

建议先包含：

- 仓库内代码读取
- `docs/` 读取
- `memory/` 读取
- 工作区内普通新建文件
- 工作区内小范围修改
- 本地只读检索
- 本地验证：
  - `typecheck`
  - `test`
  - `build`
  - `lint`
- 基础网络搜索

### `B1 requestable`

可以申请，通常由审核员决定。

建议先包含：

- 普通 MCP 使用
- 普通浏览器自动化
- 受限 shell
- 普通代码执行
- 中等范围代码改动
- 非默认网络能力

### `B2 sensitive`

强审查。

建议先包含：

- 安装新依赖
- 修改本地工具配置
- 工作区外读取
- 大范围迁移 / 重构
- 批量写入 / 覆盖
- 长时间运行的重能力

### `B3 critical`

默认拒绝或必须升级人工。

建议先包含：

- 危险 shell
- `sudo`
- 删除目录
- 工作区外写入
- 破坏性 git
- 凭据操作
- 系统级环境修改

## 三种运行模式

### `strict`

- `B0` 默认放行
- `B1` 进入明确审核
- `B2` 强审查
- `B3` 默认升级人工

适合：

- 普通用户
- 非科班用户
- 高安全要求环境

### `balanced`

- `B0` 默认放行
- `B1` 快审
- `B2` 正常审查
- `B3` 强阻断或人工升级

适合：

- 常规工程工作流

### `yolo`

- `B0` 默认放行
- `B1` 基本自动放行
- `B2` 允许更激进，但保留行为审计与紧急阻断
- `B3` 仍然可被 reviewer 拦截

适合：

- 高自治用户
- 强信任调试模式

## 六个核心对象

### 1. `AgentCapabilityProfile`

表示某类 agent 的默认画像。

至少包含：

- `agentClass`
- `defaultMode`
- `baselineTier`
- `allowedCapabilityPatterns`
- `deniedCapabilityPatterns`
- `notes`

### 2. `AccessRequest`

主 agent 发起的能力申请。

至少包含：

- `requestId`
- `sessionId`
- `runId`
- `agentId`
- `requestedCapabilityKey`
- `requestedTier`
- `reason`
- `taskContext`
- `requestedScope`
- `requestedDuration`
- `metadata`

### 3. `ReviewDecision`

审核员的决定结果。

建议枚举固定为：

- `approved`
- `partially_approved`
- `denied`
- `deferred`
- `escalated_to_human`
- `redirected_to_provisioning`

其中 `deferred` 的含义必须明确：

- 不是拒绝
- 是“条件未满足，先挂起等待”

典型原因包括：

- 信息不足
- 工具正在 provisioning
- 当前资源忙或 drain 中
- 等待更高层上下文供给

### 4. `CapabilityGrant`

审核通过后发给主 agent 的授权结果。

至少包含：

- `grantId`
- `requestId`
- `capabilityKey`
- `grantedScope`
- `expiresAt`
- `mode`
- `constraints`

### 5. `ProvisionRequest`

转给造工具 agent 的工单。

至少包含：

- `provisionId`
- `sourceRequestId`
- `requestedCapabilityKey`
- `reason`
- `desiredProviderOrRuntime`
- `requiredVerification`
- `expectedArtifacts`

### 6. `ProvisionArtifactBundle`

供给层完成后的交付包。

至少包含：

- `toolArtifact`
- `bindingArtifact`
- `verificationArtifact`
- `usageArtifact`
- `status`

## 四类主流程

### 1. baseline fast path

流程：

1. 主 agent 触发能力使用
2. 控制面检查当前 agent profile 是否已默认拥有
3. 若已默认拥有，直接 lower 到 execution plane
4. 返回执行结果

特点：

- 不经过重审核
- 必须是最热路径

### 2. access review path

流程：

1. 主 agent 发 `AccessRequest`
2. reviewer 判断
3. 若批准，签发 `CapabilityGrant`
4. grant lower 到 execution plane
5. 执行并返回结果

### 3. provisioning path

流程：

1. reviewer 判断当前没有合适 t/a
2. 发 `ProvisionRequest`
3. provisioner 安装 / 配置 / 绑定 / 测试
4. 返回 `ProvisionArtifactBundle`
5. reviewer 复核
6. 若通过，再签发 grant
7. 主 agent 使用

### 4. safety interrupt path

流程：

1. 主 agent 发出高风险请求
2. reviewer 或安全拦截器检测到异常
3. 立即：
   - 中断
   - 降级
   - 升级人工
   - 要求主 agent 改写方案
4. 记录行为证据

这条路径在 yolo 模式下尤其关键。

## 并发原则

这一套东西天然要支持多 agent 并发。

所以第一版就应该明确：

- 审核队列和 provisioning 队列分离
- reviewer 不应被慢 provisioning 拖死
- provisioning 不应阻塞已有能力的快审批
- 允许多个 agent 同时申请同一类 t/a
- 对相同 provisioning 需求应尽量去重

建议至少分三条 lane：

- `fast lane`
  - baseline / 已有 grant
- `review lane`
  - 需要审核
- `provision lane`
  - 缺工具 / 缺绑定 / 缺升级

## 与现有 `CapabilityPool` 的关系

这一点必须说清楚：

- 现有 `CapabilityPool` 不应被推翻
- 它应该作为 `execution plane` 保留

新增的 `T/A Pool` 第一版更像是：

- `review + provisioning + baseline profile + safety + context aperture`
  包住
- 现有 `CapabilityPool`

换句话说：

- `CapabilityPool` 负责“怎么跑”
- `T/A Pool` 负责“能不能跑、谁来给、没有就谁去造”

## 第一版明确不做什么

第一版不要把下面这些全做进来：

- 完整 agent 治理 system
- 完整记忆池
- 包装机编排系统
- 跨项目全局安全中心
- 分布式工具市场
- 自学习 policy engine

这些都不是不做。

而是：

- 现在先留接口坑位
- 后续在更高层逐步接进来

## 当前建议的工程顺序

1. 先冻结 `T/A Pool` 的控制面协议和对象。
2. 先做 `B0-B3` 与 `strict / balanced / yolo` 的最小行为矩阵。
3. 先做 review path 与 provision path 的工单契约。
4. 再做 reviewer / provisioner 的最小 runtime 壳。
5. 再把它们桥接到现有 `CapabilityPool` execution plane。
6. 最后才逐步接入更高层的项目态、记忆态、包装机态上下文。

## 一句话收口

`T/A Pool` 的第一版，不是要让 `agent_core` 变复杂，而是要在现有 `Capability Interface + CapabilityPool` 之上，新增一层默认放权、审核、供给和安全阻断的控制平面，让 agent 既不残疾，也不裸奔。
