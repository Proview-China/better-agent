# Part 3 / 00 Git Realism Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前目标

把 `CMP` 的本地 git 近似真实工作流冻结下来。

## 已冻结前提

- 这一轮优先做本地 git 近似真实 workflow
- 未来和 GitHub PR 对齐，但不以 GitHub 远端为阻塞

## 当前明确要求

- 不只做 refs
- 要逐步做到：
  - branch/head
  - checked refs
  - promoted refs
  - local PR object
  - local merge/promotion/readback
  - repair/repeat/rollback path

## 当前不做

- 不强接 GitHub 远端 PR API
- 不让普通 worker 直接改 `runtime.ts`
