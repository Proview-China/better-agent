# 2026-03-14 Websearch Native First

## 本次结论

- `search.ground` 不再按“三家各写一套规范”推进，而是明确采用 `native-first + governed-task` 设计。
- 上层当前只暴露一个便捷入口：
  - `rax.websearch.create()`
- `rax.websearch.create()` 已从 prepare-only 升级为真实执行入口。
- `rax.websearch.prepare()` 仅作为内部/测试检查位保留。
- 底层仍保留 canonical 语义：
  - `search.ground`

## 设计收口

- 路由优先尊重上游协议世界与官方 native tooling，而不是优先看模型品牌名。
- `rax` 在 search 这条线上的责任收成三层：
  - 统一任务入口
  - 治理与 compatibility gating
  - 证据外壳
- `rax` 当前不负责：
  - 自建搜索引擎
  - 自建通用抓取主链
  - 用 fallback 抹平三家原生能力差异

## 当前实现

- OpenAI:
  - `rax.websearch.create()` -> `search.ground`
  - lower 到 `Responses API + web_search`
  - 请求 `web_search_call.action.sources`
- Anthropic:
  - lower 到 `Messages API + web_search`
  - 提供 `urls` 时附加 `web_fetch`
- DeepMind / Gemini:
  - lower 到 `Interactions API + google_search`
  - 提供 `urls` 时附加 `url_context`

## compatibility 策略

- unofficial gateway 默认不承诺原生搜索能力。
- `raxLocal` 当前对以下 profile 显式阻断：
  - `openai-chat-only-gateway`
  - `anthropic-messages-only-primary`
  - `deepmind-openai-compatible-gateway`
- 结论是：
  - 不因为模型名像 GPT / Claude / Gemini，就假设它拥有对应官方 search 语义。

## 结果 contract

- 新增统一 search 结果外壳：
  - `WebSearchOutput`
  - `WebSearchCitation`
  - `WebSearchSource`
- 新增归一化 helper：
  - `normalizeWebSearchOutput()`
  - `toWebSearchCapabilityResult()`
  - `toWebSearchFailureResult()`
- 当前已补三家 raw payload 的归一化测试：
  - OpenAI-style payload
  - Anthropic-style payload
  - Gemini-style payload

## 执行闭环

- 新增 `WebSearchRuntime`：
  - 复用官方 SDK
  - 读取 `live-config`
  - 真正执行 OpenAI / Anthropic / DeepMind 的 native websearch 请求
- `createRaxFacade()` 现在允许注入自定义 `WebSearchRuntimeLike`，便于测试和后续替换执行基座。

## 本地验证

- `npm run typecheck` 通过
- `npm test` 通过
- 当前测试数：
  - `42 pass / 0 fail`
- 补做了真实 `rax.websearch.create()` smoke，当前 `.env.local` 下结论更细：
  - OpenAI route (`gmn.chuangzuoli.com/v1`):
    - `gpt-5.4` 可成功跑原生 `responses + web_search`
    - `gpt-5` 当前返回 `502 Bad gateway`
  - Anthropic route:
    - `.env.local` 里的 `claude-opus-4.6-thinking` 当前返回 `503 No available channels`
    - 同一路由下 `claude-opus-4-6-thinking` 可成功跑普通 `messages.create`
    - 但 search 行为不稳定：
      - 有时直接给出防御性/偏离问题的回答
      - 有时停在 `stop_reason: "tool_use"`，search loop 未闭环
    - 因此当前 Anthropic `rax.websearch.create()` 已改为对这类结果返回 `partial`，不再误报 `success`
  - DeepMind route: 当前上游对 `interactions` 返回 `404 Invalid URL`

结论：

- 代码层的 native-first 路由与结果 contract 已接通。
- 但当前本地 live config 仍不是“三家都能稳定承接官方原生搜索”的完全官方直连组合。
- 所以运行层下一步要么：
  - 把 search smoke 切到真正官方 upstream
  - 要么给 gateway 场景显式走 `raxLocal` / compatibility 画像，而不是拿 `rax` 官方 runtime 直撞。

## 下一步

1. 明确 `websearch.create()` 的统一结果与 evidence contract。
2. 评估是否需要直接暴露 `search.web` / `search.fetch` facade，还是继续只保留自治入口。
3. 把 live config 和 runtime 选择关系说清楚：
   - 官方 upstream -> `rax`
   - unofficial gateway -> `raxLocal` + compatibility profile
