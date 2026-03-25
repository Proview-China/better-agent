# Part 6 / 02 DB Missing Git Rebuild

状态：Part 6 子任务冻结稿。

更新时间：2026-03-25

## 当前目标

当 `DB` projection / package 缺失时：

- 不直接把 `requestHistory` 判成 `not_found`
- 允许从 `git` 的 checked / promoted 状态重建最小历史对象

## 当前冻结结论

- rebuild 先只做最小闭环：
  - 从 git truth 重建 runtime projection
  - 再从这个 projection 重建最小 passive historical package
- 这一层不直接代替完整 recovery
- 这一层是 `DB missing but git truth exists` 时的兜底路径

## 当前最小实现范围

1. 从 `CheckedSnapshot + CmpGitProjectionSourceAnchor` 重建 runtime projection
2. 根据 git truth 推断最小 visibility：
   - 只有 checked -> `local_only`
   - 有 promoted ref -> `promoted_by_parent`
3. 从 rebuild 后的 projection 生成最小 passive historical package
4. 给出清晰 metadata：
   - `source: git_rebuild`
   - `gitCheckedRefName`
   - `gitPromotedRefName`
   - `gitBranchHeadRef`
   - `gitCommitSha`

## 当前不做的事

- 不直接重建完整 DB projection record
- 不在这里处理 MQ delivery rebuild
- 不把这层直接接进 `runtime.ts`

## 最小验收口径

- checked-only 情况可重建 projection/package
- promoted 情况能把 visibility 提升到 `promoted_by_parent`
- rebuild 结果带清晰 metadata
