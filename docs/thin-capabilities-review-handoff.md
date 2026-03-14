# Thin Capabilities Review Handoff

本文用于帮助同事快速 review `reboot/blank-slate` 上已经完成的第一批薄能力实现。

当前对应提交：
- `09b6dfb` - `Build rax capability routing and provider compatibility scaffolding`

## 1. 这次到底做了什么

这次不是在做完整产品，而是在为 `rax` 建第一版控制面骨架，并打通第一批“薄能力”。

完成内容：
- 建立 `rax` 核心骨架：
  - 类型系统
  - 能力注册表
  - 路由器
  - facade
  - runtime
  - compatibility profiles
- 建立三家 provider 目录与第一批 API 侧适配层：
  - OpenAI
  - Anthropic
  - DeepMind / Gemini
- 重写基础能力规格文档：
  - `docs/ability/01-basic-implementation.md`
- 建立测试与 live smoke harness

## 2. 本轮已打通的薄能力

当前第一批薄能力是：
- `generate.create`
- `generate.stream`
- `embed.create`
- `file.upload`
- `batch.submit`

注意：
- 这五个能力是“统一入口 + provider lowerer”意义上的打通。
- 不代表每一个 unofficial upstream 都完整可用。

## 3. Review 入口建议

### A. 先看设计规格

建议先读：
- [01-basic-implementation.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/01-basic-implementation.md)

重点看这些部分：
- Capability planes
- Capability pools
- Thin vs thick
- Unified request / result
- Canonical verbs

如果 reviewer 不认可这套能力词汇，后面的代码实现就没必要继续看细节。

### B. 再看 `rax` 核心

核心文件：
- [types.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/types.ts)
- [contracts.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/contracts.ts)
- [registry.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/registry.ts)
- [router.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/router.ts)
- [facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/facade.ts)
- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/runtime.ts)
- [compatibility.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/compatibility.ts)

建议 review 问题：
- `CapabilityRequest` / `CapabilityResult` 外壳是否够稳
- `provider + capability + action + layer + variant` 这套路由键是否合理
- `compatibility profile` 是否应该存在于 runtime 前置层，而不是 adapter 内部
- `rax` 与 `raxLocal` 双 runtime 的边界是否清晰

### C. 最后看三家 provider lowerer

OpenAI：
- [src/integrations/openai/api/index.ts](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/index.ts)
- [responses adapter](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/generation/responses/adapter.ts)
- [chat compat adapter](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/generation/chat_completions_compat/adapter.ts)
- [embeddings adapter](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/modalities/embeddings/adapter.ts)
- [files adapter](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/resources/files/adapter.ts)
- [batches adapter](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/openai/api/operations/batches/adapter.ts)

Anthropic：
- [src/integrations/anthropic/api/index.ts](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/anthropic/api/index.ts)
- [messages descriptor](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/anthropic/api/generation/messages/descriptor.ts)
- [files descriptor](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/anthropic/api/resources/files/descriptor.ts)
- [batches descriptor](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/anthropic/api/operations/batches/descriptor.ts)
- [unsupported embeddings marker](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/anthropic/api/modalities/embeddings/index.ts)

DeepMind / Gemini：
- [src/integrations/deepmind/api/index.ts](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/index.ts)
- [common helper](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/common.ts)
- [generate create](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/generation/generate_content/create.ts)
- [generate stream](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/generation/generate_content/stream.ts)
- [embed create](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/modalities/embeddings/create.ts)
- [file upload](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/resources/files/upload.ts)
- [batch submit](/home/proview/Desktop/Praxis_series/Praxis/src/integrations/deepmind/api/operations/batches/submit.ts)

建议 review 问题：
- lower 到 SDK 参数时，有没有丢语义
- descriptor 形状是否足够统一
- unsupported 的地方是否明确，而不是偷偷空实现
- unofficial upstream 的兼容画像是否被错误写进官方 adapter

## 4. 当前已知边界

这几条是故意保留的，不是漏做：

- 这次只做薄能力，不做厚能力：
  - `mcp`
  - `session.resume/fork`
  - `agent`
  - `computer`
  - `code`
  - `trace`
  - `memory`
  - `guardrail`
  - 这些都还没进入正式实现阶段

- `Anthropic embed.create` 明确是 `unsupported`
  - 这是故意的，不是遗漏

- unofficial upstream 不等于官方平台
  - 所以 `raxLocal` 和 `compatibility profile` 是有意存在的

## 5. 当前已知风险点

建议 reviewer 重点盯这几类问题：

- `compatibility.ts` 会不会膨胀成“所有脏逻辑大杂烩”
- `raxLocal` 是否会和默认 `rax` 路径逐渐分叉
- `variant` 是否够用，还是以后要升级成更正式的 `protocol flavor` 路由
- facade 现在只开放了第一批薄能力，未来扩展时命名是否还能稳住
- live smoke 的结果是否不应该过多影响核心 runtime 结构

## 6. 已做验证

本地验证已通过：
- `npm run typecheck`
- `npm test`

当前测试结果：
- `12 pass / 0 fail`

另外已经有 live smoke harness：
- [live-smoke.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/live-smoke.ts)

它主要用来验证 unofficial upstream compatibility，不应被误解为“平台能力已全部稳定”。

## 7. 希望 reviewer 优先给的反馈

最希望 reviewer 回答这 5 个问题：

1. `rax` 作为 control-plane 骨架，这次的对象边界是否合理？
2. `thin capability` 的定义是否过宽或过窄？
3. `compatibility profile` 放在 runtime 前置层，这个位置是否合适？
4. 三家 provider adapter 的统一描述器形状是否足够干净？
5. 下一步继续做厚能力时，当前结构是否会妨碍扩展？
