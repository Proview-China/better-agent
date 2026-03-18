# WP2: CapabilityManifest And Binding

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现能力池的冷路径描述层：`CapabilityManifest` 与 `CapabilityBinding`。

## 项目背景

- 统一能力接口的第一步，不是执行，而是把“能力名片”和“当前执行绑定”分开
- 当前总纲已要求：
  - manifest 描述能力是什么
  - binding 描述当前谁在接这个活
- 后续热插拔、generation、draining 都依赖这层

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/rax/registry.ts`
- `src/rax/facade.ts`
- `src/agent_core/capability-types/**`

## 你的任务

1. 落地 manifest/binding 的实际类型与辅助构造器。
2. 明确区分：
   - `capability catalog`
   - `public wired surface`
3. 为一个能力支持：
   - 多 generation
   - 多 binding
   - `active/draining/disabled` 生命周期
4. 提供最小校验函数。

## 建议新增文件

- `src/agent_core/capability-model/capability-manifest.ts`
- `src/agent_core/capability-model/capability-binding.ts`
- `src/agent_core/capability-model/capability-model.test.ts`
- `src/agent_core/capability-model/index.ts`

## 边界约束

- 不实现 registry 本体
- 不实现 queue/scheduler
- 不改 `src/rax/**` 运行逻辑
- 不把 provider-specific payload 放进 manifest 热字段

## 必须考虑的性能点

- manifest/binding 应适合热冷分离
- hot lookup 所需字段必须短小
- generation 切换时不做全量拷贝

## 验证要求

- `npm run typecheck`
- 覆盖：
  - manifest 构造校验
  - binding 生命周期状态切换
  - generation 共存
  - wired surface 与 catalog 区分

## 最终汇报格式

1. 你实现了哪些文件
2. manifest 与 binding 的职责边界是什么
3. 你如何表达 generation 和 draining
4. 哪些字段属于冷路径，哪些属于热路径
5. 后续 registry 会依赖哪些关键结构
