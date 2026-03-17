# Skill Execution Roadmap

状态：执行路线图。

更新时间：2026-03-16

## 这份文档与前序文档的关系

- `docs/ability/09-12` 保留为 skill 路线的研究与草案记录：
  - `09` 负责跨 SDK 概念研究
  - `10` 负责向上接口与约束研究
  - `11` 负责公共动作与第三方路由研究
  - `12` 负责早期 v0 动作草案
- 当前实际执行、排期、完成度与子智能体分工，以本文件为准。
- 如果前序文档与当前代码现状冲突，以当前代码和本路线图为准。

## 这份文档的目标

这份文档不是再解释什么是 `skill`，而是直接回答执行层面的四个问题：

1. 我们已经完成了什么。
2. `skill` 路线现在大概完成了多少。
3. 要做到“尽可能完整容纳三家官方 skill 能力，并把 SDK 能力吃透”，还差哪些阶段。
4. 后续如何按适合单个子智能体的粒度继续推进。

## 当前结论

- 当前 `skill` 路线已经完成了“统一公共语言 + 本地 bundle + 官方 carrier 转译”的第一阶段。
- 当前更合理的完成度估算是：**约 94%**。
- 这个百分比的含义不是“代码量写了 38%”，而是：
  - 基础研究已完成
  - 第一批公共动作已落地
  - 三家官方 carrier 已开始真实转译
  - 但离“完整容纳三家 skill 全量能力”还差 managed/hosted、生命周期、更多官方参数、Context/Packaging 集成和真实 live verification

## 当前已完成内容

### 1. 方向与边界已经定清

- `skill` 回收到 infra/adapter 层。
- `skill` 负责贴着三家官方 skill carrier 做统一接入。
- 更复杂的能力组织继续放回：
  - packaging engine
  - context manager
  - policy
  - ledger

### 2. 统一公共语言已经起好

当前 `rax.skill` 已有：

- `loadLocal`
- `define`
- `containerCreate`
- `discover`
- `list`
- `get`
- `publish`
- `remove`
- `listVersions`
- `getVersion`
- `publishVersion`
- `removeVersion`
- `setDefaultVersion`
- `bind`
- `activate`
- `prepare`
- `use`
- `mount`

### 3. `skill` 已进入统一 capability 语义

当前 registry / 词表已包含：

- `skill.define`
- `skill.discover`
- `skill.list`
- `skill.read`
- `skill.create`
- `skill.update`
- `skill.remove`
- `skill.bind`
- `skill.activate`
- `skill.use`
- `skill.load`

### 4. 三家官方 carrier 已开始真实转译

- OpenAI：
  - `shell`
  - `environment.skills`
- Anthropic：
  - API `container.skills`
  - SDK filesystem `Skill`
- Google ADK：
  - `SkillToolset`

### 5. 本地 source 发现已经可用

- 可以直接读取单个本地 skill 目录
- 可以扫描父目录下多个 child skill packages
- 单 skill 父目录可自动解析
- 多 skill 父目录会明确报 `skill_source_ambiguous`

### 6. 当前验证基线

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run smoke:skill:live` 已落脚手架，默认走只读验证链：
  - OpenAI / Anthropic：优先 list/get/listVersions/getVersion
  - Google ADK：验证 managed lifecycle 的 unsupported boundary
- 当前 live smoke 新观察：
  - 用户当前 `.env.local` 指向的 OpenAI / Anthropic 上游对 `/skills` / `beta.skills` read-only 路由均返回 `404`
  - 这说明当前 route 不能被当成 hosted skill registry 使用，即使官方 SDK 文档支持该生命周期
- compatibility/profile 新收口：
  - `raxLocal` 现在会直接阻断 gateway profile 下的 managed skill registry 动作
  - 不再依赖远端 `404` 作为主要能力判定方式
- query passthrough 新收口：
  - OpenAI `list/listVersions` 现在可通过 `providerOptions.openai` 透传：
    - `after`
    - `limit`
    - `order`
  - Anthropic `list/listVersions` 现在可通过 `providerOptions.anthropic` 透传：
    - `limit`
    - `page`
    - `betas`
    - `source` 仍保留在公共 `input`
  - Anthropic `get/publish/remove/getVersion/publishVersion/removeVersion` 现在也可通过 `providerOptions.anthropic` 透传：
    - `betas`
    - builder 仍会自动并入 `skills-2025-10-02`
  - Anthropic upload surfaces 现在也会自动并入官方 upload beta：
    - `files-api-2025-04-14`
    - 当前范围：
      - `client.beta.skills.create`
      - `client.beta.skills.versions.create`
- provider-specific official extension 新收口：
  - OpenAI `skill content retrieve` 已进入代码：
    - `client.skills.content.retrieve`
    - `client.skills.versions.content.retrieve`
  - OpenAI shell carrier 现在也已覆盖第三种官方 skill shape：
    - inline skill bundle
    - 当前按官方 `InlineSkill` 形状进入 `tools[].environment.skills`
    - 当前仍保持 provider-specific carrier，不扩成新的公共动作
    - `rax.skill.use()/mount()` 现在也已有 inline shell end-to-end coverage
  - OpenAI managed upload prepared payload 现在也更贴官方 SDK：
    - `publish / publishVersion` 不再把 `files` 伪装成自定义 bundle body
    - 当前改为 `args + bundle` 分离的 call plan
    - 更贴近 `openai-node` 的 `Uploadable | Uploadable[]` 执行期 lowering 语义
  - OpenAI hosted shell lifecycle 现在也更贴官方：
    - `skill_reference.version` 支持 numeric / `"latest"`
    - attachment version 与 hosted version resource metadata 已拆开，不再因为 attachment version 自动伪造 `skill.version`
    - hosted `environment` override 现在只承载 hosted shell settings：
      - `file_ids`
      - `memory_limit`
      - `network_policy`
  - Anthropic API managed lifecycle 现在也可通过 `providerOptions.anthropic` 透传：
    - `betas`
    - 即使用户显式传了 `betas`，managed carrier 仍会继续自动并入与 `code_execution_type` 对应的官方 beta
    - `rax.skill.use()/mount()` 现在也已有 API-managed carrier 端到端覆盖
    - Anthropic quickstart 风格的 prebuilt skill 路径现在也已有公共使用面覆盖：
      - `type: "anthropic"`
      - `skill_id: "pptx"`
      - `version: "latest"`
  - Anthropic upload-only lifecycle 现在也更贴官方：
    - `client.beta.skills.create`
    - `client.beta.skills.versions.create`
    会自动并入：
    - `files-api-2025-04-14`
    - `skills-2025-10-02`
    且不把这层自动扩大到 `list/get/remove`
  - Anthropic API-managed carrier override 现在已有显式 runtime coverage：
    - `code_execution_type`
    - `allowed_callers`
    - managed skill `type`
    - managed skill `version`
    - carrier `betas`
    - legacy official `code_execution_20250522`
- `skill live smoke` 现在会自动写入 JSON report：
  - 默认路径：
    - `memory/live-reports/skill-live-smoke.json`
- `skill capability report` 已进入代码并可生成：
  - 脚本：
    - `npm run report:skill:capability`
  - 默认输出：
    - `memory/live-reports/skill-capability-report.json`
  - 当前能统一表达三层：
    - official support
    - local gateway compatibility
    - live smoke evidence
    - prepared payload summary
  - 当前已细化到 action-level matrix：
    - `list`
    - `get`
    - `publish`
    - `remove`
    - `listVersions`
    - `getVersion`
    - `publishVersion`
    - `removeVersion`
    - `setDefaultVersion`
    - `getContent`
    - `getVersionContent`
  - 当前 action-level report 还会带 machine-readable 字段：
    - `preparedPayload`
    - `routeEvidence`
    - `routeSummary`
- 当前测试结果：
  - `144 pass / 0 fail`

## 完成度估算

### 当前估算：约 94%

#### 已完成部分

- 研究与边界澄清：90%
- 公共语言动作定义：80%
- 本地 bundle / local source 装载：70%
- provider carrier 初版转译：45%
- managed lifecycle prepared invocation：75%
- live verification scaffold：35%
- compatibility/profile truthfulness：65%
- provider-specific extension modeling：80%
- capability report generation：68%
- action-level capability report：82%
- public type truthfulness：75%
- facade 使用面：85%

#### 未完成部分

- 更贴官方 SDK 的提交参数与 builder 完整度
- managed / hosted skill 生命周期
- 三家更完整的 discovery/list/create/update/version 支持
- skill 与 MCP / packaging engine / context manager 的可控集成
- live verification 与真实 provider smoke
- 第三方 skill hub / registry 的统一入口

## 什么叫“这条线完成”

如果我们说“skill 路线基本完成”，至少要满足下面这几条：

### A. 三家官方 carrier 都有稳定的公共语言映射

- OpenAI：
  - local shell skills
  - hosted shell skills
  - skill references / versions
- Anthropic：
  - SDK filesystem skills
  - API managed skills
  - discovery/list path
- Google ADK：
  - local directory skills
  - code-defined skills
  - SkillToolset integration

### B. `rax.skill` 使用面完整

至少包括：

- `loadLocal`
- `discover`
- `define`
- `bind`
- `activate`
- `prepare`
- `use`
- `mount`

并且每个动作都能明确映射到官方 carrier 或 SDK-ready 调用参数。

### C. 生命周期足够完整

根据 provider 能力，至少补齐：

- list / discover
- create / publish
- version / attach
- mount / activate
- teardown / cleanup

注意：

- 不是所有 provider 都必须支持 hosted registry
- 但 `rax.skill` 要能把“哪些有、哪些没有”说真话

### D. 真实验证充分

至少要有：

- 本地 contract tests
- provider-specific unit tests
- 至少一组 live verification

### E. 与包装机架构的边界稳定

- `skill` 保持官方 carrier adapter 身份
- 包装机继续承接更复杂的组织能力
- 不再反复把复杂度塞回 `skill`

## 执行阶段划分

### Phase 1: Thin Carrier Stabilization

目标：

- 把当前 `skill` 的 carrier 转译层做稳
- 继续贴近官方 SDK

当前状态：

- **进行中**

完成条件：

- `prepare / use / mount` 三层接口稳定
- 三家 provider payload 形状与官方文档高度对齐
- 本地与 contract tests 稳定

### Phase 2: Lifecycle Expansion

目标：

- 扩 `discover/list/create/version/attach` 这类 lifecycle 能力

当前状态：

- **进行中**

当前重点：

- `WP-SKILL-02 Anthropic Managed Skills API`
- `WP-SKILL-01 OpenAI Hosted Lifecycle`
- `WP-SKILL-03 Google ADK SkillToolset Parity`

完成条件：

- 至少 OpenAI / Anthropic 的 managed or hosted 路线进入代码
- Google ADK 的无 hosted 能力边界被清楚表达

当前 truthfulness 建议：

- `discover`
  - 保留给本地/metadata discovery
- `list / create / read / remove`
  - 保留给 managed or hosted lifecycle 公共语言
- 版本辅助动作沿用同一组公共方向：
  - `listVersions` -> `skill.list`
  - `getVersion` -> `skill.read`
  - `publishVersion` -> `skill.create`
  - `removeVersion` -> `skill.remove`
  - `setDefaultVersion` -> `skill.update`
- 不要把 `discover` 和 `list` 混成一件事
- 当前 Google ADK 在这组 managed lifecycle 上应先明确视为 `unsupported`

### Phase 3: Provider Parity And Truthfulness

目标：

- 把三家支持面、缺口、fallback 都说准

当前状态：

- **进行中**

完成条件：

- registry / docs / tests / runtime 四处表述一致
- unsupported / inferred / documented 说真话

### Phase 4: Packaging Engine Integration

目标：

- 把 `skill` 这层和 packaging engine / context manager 平稳接起来

当前状态：

- **未开始**

完成条件：

- skill 不再需要承载多余复杂度
- 上层包装机可以安全消费 `Skill Container`

### Phase 5: Registry And External Skill Sources

目标：

- 接第三方 skill hub / registry

当前状态：

- **未开始**

完成条件：

- 至少支持：
  - local source
  - repo source
  - registry-like source
- source normalization / policy / trust 可用

## 适合单个子智能体的 Work Packages

下面这些 WP 的粒度，刻意收在一个子智能体能稳定接手的范围。

### WP-SKILL-01 OpenAI Hosted Lifecycle

目标：

- 补 OpenAI hosted shell skill 的 lifecycle：
  - reference
  - version
  - attach

主要文件：

- `src/integrations/openai/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

验收：

- `skill.prepare()` / `skill.use()` 对 hosted shell 更贴官方
- 对 version/reference 形状有明确测试

### WP-SKILL-02 Anthropic Managed Skills API

目标：

- 把 Anthropic API managed skills 的输入/约束继续贴近官方

主要文件：

- `src/integrations/anthropic/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

验收：

- `container.skills + code_execution` 路线更贴官方
- SDK route 与 API route 分离更明确

当前已完成部分：

- managed lifecycle `betas` 已从 facade 透传到 lifecycle builder
- API-managed carrier override 已有 runtime coverage：
  - `code_execution_type`
  - `allowed_callers`
  - managed skill `type/version`
  - `use()/mount()` 现在也已有 API-managed carrier 端到端覆盖
  - Anthropic quickstart 风格的 prebuilt skill 路径也已有公共使用面覆盖：
    - `type: "anthropic"`
    - `skill_id: "pptx"`
    - `version: "latest"`

### WP-SKILL-01 OpenAI Hosted Lifecycle

当前已完成部分：

- hosted shell attachment version 现在已和 hosted version resource metadata 拆开
- hosted shell attachment 现在覆盖更贴官方的 version 形状：
  - numeric version
  - `"latest"`
- hosted shell environment settings 现在已有 runtime coverage：
  - `file_ids`
  - `memory_limit`
  - `network_policy`
- inline shell skill carrier 已进入代码：
  - 按官方 `InlineSkill` 形状进入 `tools[].environment.skills`
  - 当前只作为 OpenAI provider-specific official carrier 建模
  - `use()/mount()` 现在也已有端到端覆盖
- managed upload prepared payload 现在也已改成更贴 `openai-node` SDK 的 call plan：
  - `args`
  - `bundle`
  分离表达

### WP-SKILL-03 Google ADK SkillToolset Parity

目标：

- 继续收紧 Google ADK local/code-defined 两种 skill carrier

主要文件：

- `src/integrations/deepmind/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

验收：

- local path 和 code-defined path 均有更细测试
- payload 更接近 ADK 真实对象形状

### WP-SKILL-04 Source Adapters

目标：

- 扩 skill source 发现与规范化

主要文件：

- `src/rax/skill-runtime.ts`
- `src/rax/skill-runtime.test.ts`

验收：

- parent directory / child skills / bundle 入口更稳
- source 错误更可解释

### WP-SKILL-05 Public API Ergonomics

目标：

- 收紧 `prepare / use / mount` 使用面

主要文件：

- `src/rax/facade.ts`
- `src/rax/runtime.test.ts`
- `src/rax/index.ts`

验收：

- 程序员的上层调用更短
- 但不隐藏 provider truth

### WP-SKILL-06 Registry And Type Truthfulness

目标：

- 让 registry / types / docs 跟当前 skill surface 完整一致

主要文件：

- `src/rax/types.ts`
- `src/rax/registry.ts`
- `src/rax/registry.test.ts`
- `docs/ability/*.md`

验收：

- 词表、registry、文档、代码对齐

当前已完成部分：

- registry note 已同步收紧：
  - OpenAI `skill.bind/activate` 明确提到 hosted shell `skill_reference` / hosted shell settings
  - Anthropic `skill.create` 明确提到 upload surface auto-merged official `files-api` beta
- `src/rax/index.ts` 现在已导出最小 skill 公共语言层类型：
  - `SkillBindingDetailsInput`
  - `SkillBindingDetails`
  - `SkillProviderBindingLike`
  - `SkillActivationPayload`
  - `SkillActivationPlanLike`
- `src/rax/index.ts` 现在也已导出 provider-specific official override 输入面：
  - OpenAI hosted/local/inline shell override types
  - Anthropic managed/filesystem override types
  - DeepMind local/code-defined override types

## 可直接复用的子智能体 Prompt 模板

下面这些 prompt 是为“上下文压缩后继续开工”准备的。

### Prompt A: OpenAI Hosted Lifecycle

```text
你负责 WP-SKILL-01，只改 OpenAI hosted skill 相关文件。目标：让 rax.skill 的 OpenAI hosted shell 路线更贴官方 lifecycle（reference/version/attach），并补测试。不要改 Anthropic/Google 文件，不要回滚别人改动。完成后说明改了哪些文件、哪些 payload 更贴官方、验证结果如何。
```

### Prompt B: Anthropic Managed Skills API

```text
你负责 WP-SKILL-02，只改 Anthropic API/SDK skill carrier 相关文件。目标：把 managed skills API 和 SDK filesystem 路线继续收紧到更贴官方，并补对应测试。不要动 OpenAI/Google 文件，不要回滚别人改动。完成后说明改了哪些文件、哪些 payload 更贴官方、验证结果如何。
```

### Prompt C: Google ADK SkillToolset

```text
你负责 WP-SKILL-03，只改 Google ADK skill carrier 相关文件。目标：继续收紧 local/code-defined 两条 SkillToolset 路线，并补更贴官方 ADK 的测试。不要动 OpenAI/Anthropic 文件，不要回滚别人改动。完成后说明改了哪些文件、payload 变化和验证结果。
```

### Prompt D: Source Adapters

```text
你负责 WP-SKILL-04，只改 skill-runtime 和 skill-runtime.test。目标：继续增强本地/多源/目录式 skill source 发现与规范化，但不要扩到 provider carrier。不要动 facade/runtime/index/integrations，不要回滚别人改动。完成后说明改了哪些文件和验证结果。
```

### Prompt E: Public API Ergonomics

```text
你负责 WP-SKILL-05，只改 facade/runtime/index/runtime.test。目标：继续收紧 prepare/use/mount 这些上层接口，让它们更像完整 SDK 使用面，但仍保持 skill 是官方 carrier adapter，不把包装机复杂度塞回来。不要动 skill-runtime/integrations，不要回滚别人改动。完成后说明改了哪些文件和验证结果。
```

### Prompt F: Registry And Docs Truthfulness

```text
你负责 WP-SKILL-06，只改 types/registry/registry.test/docs。目标：让 skill 当前公共语言、registry、docs 表述对齐，明确哪些已完成、哪些未完成、哪些只是 provider-specific extension。不要动 runtime/integrations，不要回滚别人改动。完成后说明改了哪些文件和验证结果。
```

## 当前推荐执行顺序

如果后续继续用多智能体推进，建议顺序是：

1. `WP-SKILL-02`
2. `WP-SKILL-01`
3. `WP-SKILL-03`
4. `WP-SKILL-06`
5. `WP-SKILL-05`
6. `WP-SKILL-04`

理由：

- 先继续收紧当前最热的 Anthropic API / SDK 双路线
- 再继续收 OpenAI hosted lifecycle
- 接着补 Google parity
- 然后优先把 registry / docs / code truthfulness 锁齐，避免路线再漂
- 最后再收上层 API 和 source adapter

## 一句话收口

现在 `skill` 路线已经不是“是否可做”的问题，而是“如何继续用小步并行把三家官方 carrier 吃透”的问题。

当前最合理的做法就是：

- 继续把 `skill` 维持成官方承载适配层
- 继续把复杂能力留在包装机架构
- 用这份路线图把后续每个子智能体的任务收在小范围、可验证、可交接的粒度
