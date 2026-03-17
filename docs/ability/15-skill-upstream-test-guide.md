# Skill Upstream Test Guide

更新时间：2026-03-16

## 目的

这份说明给负责 `skill` 线的 Codex 使用。

目标不是继续扩功能，而是先复用当前仓库已经验证过的上游与 smoke 脚本，快速判断：

- 路由本身通不通
- 当前模型/上游是否支持原生联网
- `skill` 问题到底是 `skill` 自己的实现问题，还是上游/模型/网关的问题

## 结论先行

当前建议把测试分成两段：

1. 先跑 `websearch` live smoke，做 route 预检。
2. 再跑 `skill` live smoke，验证 managed registry 或 unsupported boundary。

白话解释：

- `websearch` 更适合当“上游心跳”和“模型原生联网能力”探针。
- `skill` smoke 更适合验证我们对官方 skill carrier 的转译是不是对的。
- 如果第一段都不通，第二段失败大概率不是 `skill` 代码本身的问题。

## 预备条件

仓库默认从项目根目录运行：

```bash
cd /home/proview/Desktop/Praxis_series/Praxis
```

Node 要满足 `package.json` 里的要求：

- Node `>=22`

并准备好 `.env.local`。

当前 live smoke 读取的是：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`
- `DEEPMIND_API_KEY`
- `DEEPMIND_BASE_URL`
- `DEEPMIND_MODEL`

脚本现在也支持用进程环境临时覆盖这些值。

这意味着你可以不改 `.env.local`，直接做一次性的上游适配实验，例如：

```bash
ANTHROPIC_MODEL=claude-opus-4-6-thinking npm run smoke:websearch:live -- --provider=anthropic
DEEPMIND_MODEL=gemini-3.1-pro-preview npm run smoke:websearch:live -- --provider=deepmind
```

如果你想整组切到另一份配置，也可以：

```bash
PRAXIS_LIVE_ENV_FILE=/abs/path/to/.env.alt npm run smoke:skill:live -- --provider=openai
```

不要把密钥、完整 `.env.local` 内容或带密钥的命令输出贴进 commit、文档或测试回报。

## 标准测试顺序

### 1. 基础回归

```bash
npm run typecheck
npm test
```

这一步先保证不是本地类型或单测已经坏掉。

### 2. 路由预检：websearch live smoke

按 provider 分开跑：

```bash
npm run smoke:websearch:live -- --provider=openai
npm run smoke:websearch:live -- --provider=anthropic
npm run smoke:websearch:live -- --provider=deepmind
```

脚本会输出逐行 JSON，重点看这些 `step`：

- `native_plain`
- `native_search`
- `rax_websearch`

判断规则：

- `native_plain` 失败：通常是 base URL、密钥、模型名、或网关本身就不通。
- `native_search` 失败：通常是该模型/该上游不支持原生联网，或者参数形状不对。
- `rax_websearch` 失败但 `native_search` 成功：优先怀疑 Praxis 的路由、lowering 或结果归一化。

### 3. Skill smoke

```bash
npm run smoke:skill:live -- --provider=openai
npm run smoke:skill:live -- --provider=anthropic
npm run smoke:skill:live -- --provider=deepmind
```

OpenAI / Anthropic 这条会尝试只读的 managed registry 调用，例如：

- `managed_list`
- `managed_get`
- `managed_list_versions`
- `managed_get_version`

DeepMind 这条当前不是测“成功”，而是测 unsupported boundary 还在不在。预期看到的是：

- `managed_list`
- `managed_publish`

都以“unsupported boundary held as expected”收口。

### 4. 可选：产出汇总报告

```bash
npm run report:skill:capability
```

如果只想单独写 smoke 报告，也可以：

```bash
npm run smoke:skill:live -- --provider=openai --report=memory/live-reports/skill-live-smoke.openai.json
```

如果不显式传 `--report=`：

- `--provider=all` 会写到固定汇总文件：
  - `memory/live-reports/skill-live-smoke.json`
  - `memory/live-reports/websearch-live-smoke.json`
- 单 provider 运行会默认写到 provider 级文件：
  - `memory/live-reports/skill-live-smoke.openai.json`
  - `memory/live-reports/skill-live-smoke.anthropic.json`
  - `memory/live-reports/skill-live-smoke.deepmind.json`
  - `memory/live-reports/websearch-live-smoke.<provider>.json`

这样做的目的，是避免你顺序跑多个 provider 时，后一个实验把前一个实验的报告覆盖掉。

### 5. 真实执行链：skill execution smoke

如果你要验证的不是 `/skills` registry，而是“skill 真挂到请求上以后能不能工作”，现在可以直接跑：

```bash
npm run smoke:skill:execution:live -- --provider=openai
npm run smoke:skill:execution:live -- --provider=anthropic
npm run smoke:skill:execution:live -- --provider=deepmind
```

这条 smoke 当前的目标是：

- OpenAI：验证 inline skill bundle 真正并进 `responses.create` 后，上游能不能承接
- Anthropic：验证 prebuilt skill (`pptx`) 真正并进 `messages.create + container.skills` 后，上游会不会把它当成可用 skill
- DeepMind：当前只保留 truthful skip，不假装 JS baseline 已经有统一 skill execution runtime

到 2026-03-16 当前实测为止：

- OpenAI 当前 route 在 inline skill execution 上返回 `502`
- Anthropic 当前 route 就算切到正确模型 `claude-opus-4-6-thinking`，prebuilt skill execution 也还没有真正被识别成可用 skill

所以这条 smoke 更适合用来回答：

- skill carrier 真的挂上去以后，上游有没有承接
- 问题出在 registry、模型名、还是 execution carrier 本身

## 当前推荐测试组合

下面是到 2026-03-16 为止，仓库里已经跑过、相对靠谱的组合。

### OpenAI

推荐：

- route: 当前 `.env.local` 对应的 OpenAI route
- layer: `api`
- 最稳模型：`gpt-5.4`

已知现象：

- `gpt-5.4` 可跑原生 `responses + web_search`
- 同一路由下 `gpt-5` 仍可能返回 `502`

所以：

- 如果你只是想验证 route 和联网能力，优先用 `gpt-5.4`
- 不要先拿 `gpt-5` 失败就回头怀疑 `skill` 代码

### Anthropic

推荐：

- route: `https://viewpro.top`
- `search.ground` 最稳层：`agent / Claude Code`

已知现象：

- 当前主上游里，`.env.local` 那种带点号的 `claude-opus-4.6-thinking` 可能 `503`
- 同系列的连字符模型名 `claude-opus-4-6-thinking` 更适合做 route 预检
- `messages + web_search` 这条 API server-tool 路不稳定
- `rax.websearch.create()` 走 Anthropic agent path 时更稳

所以：

- 跑 `websearch` 预检时，如果 API 搜索失败，不要立刻判定 Anthropic 全线不通
- 先区分是 API server-tool 不稳，还是 agent path 也挂了

### DeepMind / Gemini

推荐：

- layer: `api`
- 方法: `models.generateContent + googleSearch`
- 更稳模型：`gemini-3.1-pro-preview`

已知现象：

- 老的 `interactions` 风格路由可能 `404`
- 官方风格的 `generateContent` 路由更可靠
- 在正确模型和正确通道下，`googleSearch` 可以返回 grounding metadata

所以：

- 看到 `interactions` 失败，不要直接归因为 `rax.websearch` 设计错误
- 先确认自己是不是还在用旧上游或旧方法

## 结果回报模板

其他 Codex 回报时，建议直接用下面这个格式，避免口头描述太散：

```md
## Skill Upstream Smoke

- provider: openai|anthropic|deepmind
- route: <脱敏后的 base url>
- model: <model name>
- websearch preflight: pass|fail
- skill smoke: pass|fail|expected-unsupported
- conclusion: route issue | model issue | gateway issue | praxis skill issue | unsupported-by-design

关键证据：
- `native_plain`: ...
- `native_search`: ...
- `rax_websearch`: ...
- `managed_list` / `managed_get`: ...
```

## 一条很重要的判责规则

如果出现失败，优先按这个顺序归因：

1. `.env.local` 配置错没错
2. base URL / 模型 / 路由形状是不是当前推荐组合
3. `native_plain` 是否通过
4. `native_search` 是否通过
5. 只有当前面都成立时，才优先怀疑 `skill` 或 `rax` 的实现

这条规则的目的，是防止把“上游今天坏了”误报成“我们 skill 设计坏了”。

## 对 Skill 负责人的一句话建议

你如果只是要验证 `skill` 线，最省时间的顺序是：

1. `npm run typecheck`
2. `npm test`
3. 先跑自己负责 provider 的 `smoke:websearch:live`
4. 再跑对应的 `smoke:skill:live`
5. 只在 `websearch` 预检通过后，再把问题升级成 `skill` 代码问题
