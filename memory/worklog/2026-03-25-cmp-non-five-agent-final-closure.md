# 2026-03-25 CMP Non-Five-Agent Final Closure

## 这轮工作的结论

这轮不是继续铺文档，也不是继续讨论任务拆分。

这轮真正做的是：

- 直接把 `CMP` 非五-agent 部分最后一层运行治理收住

一句白话：

- 现在 `CMP` 的公共底座已经不只是“能跑”
- 而是已经开始具备“可恢复、可回读、可控、可验收”的样子

## 这轮落下来的关键改动

### 一、`runtime` 最后一层收口

主线程继续加厚了：

- `src/agent_core/runtime.ts`

这轮补上的关键主线包括：

- `section-first` 继续向前贯通
- `requestHistory` 正式吃 `DB-first + git rebuild fallback`
- recovery 正式吃 `reconciliation`
- `MQ delivery truth` 的 dispatch / ack 主线继续收口
- runtime 新增 delivery timeout 推进能力：
  - `advanceCmpMqDeliveryTimeouts(...)`

### 二、`rax.cmp` 开始更像控制台

这轮继续加厚了：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`

现在 `rax.cmp` 已经不只是 facade 壳子，还开始体现：

- `readbackPriority`
- `fallbackPolicy`
- `recoveryPreference`

在这些入口上的真实效果：

- `readback(...)`
- `recover(...)`
- `requestHistory(...)`
- `smoke(...)`

### 三、delivery truth / recovery summary 变成结构化输出

这轮新增了可直接给 facade 吃的结构化 summary：

- project recovery summary
- recovery aggregate summary
- delivery truth summary

白话：

- 现在外层不只知道“有没有问题”
- 也开始知道“问题在哪一层、该往哪边修”

### 四、补了一批直接贴着这轮代码的测试

新增或补强了这些测试方向：

- `strict_not_found` 的 history gate
- `dry_run` 的 recover gate
- `MQ timeout -> retry / expired`
- `delivery truth` summary
- `section-first` 物化辅助层

## 这轮关键验证

这轮最后真实通过的验证包括：

- `npm run typecheck`
- `npm run build`
- `npx tsx --test src/agent_core/runtime.test.ts`
- `npx tsx --test src/rax/cmp-facade.test.ts`
- `npx tsx --test src/agent_core/cmp-runtime/*.test.ts`

## 当前对“完成定义”的判断

如果问题是：

- “除了五个 agent，`CMP` 其他应有的底座是不是已经基本收完了？”

当前最诚实的回答是：

- `基本已经收完`

还可以继续做的东西仍然有，但它们已经更像：

- final gate 打磨
- live evidence 补强
- manual control 深挖

而不是：

- 还缺关键主链模块
- 还缺真相层
- 还缺恢复链

## 当前最推荐下一步

除非用户想继续收 final gate，不然当前最推荐下一步已经是：

- 开始五个 agent 的实现、配置与联调

