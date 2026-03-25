# RAX CMP Workflow Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 1 负责做出 `rax.cmp` 的 facade、config 和 startup shell。

## 推荐文件列表

- `00-facade-protocol-freeze.md`
- `01-rax-cmp-types-and-config.md`
- `02-rax-cmp-create-and-bootstrap-entry.md`
- `03-rax-cmp-readback-recover-smoke-entry.md`
- `04-env-defaults-and-profile-loading.md`
- `05-part1-gates-and-readback.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`
- `03`

### Wave 2

- `04`
- `05`

## 最小验收口径

- `rax.cmp` 存在且有稳定入口。
- 配置和运行壳已明确。
