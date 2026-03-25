# Part 7 / 01 Active Passive Mode Switch

状态：指导性任务文档。

更新时间：2026-03-25

## 本文件要解决什么

先把：

- `active_preferred`
- `passive_only`
- `mixed`

这三种 `CMP` 工作模式，收成正式控制面字段。

## 当前要求

- mode 能进入 config/defaults
- mode 能进入手动 override
- mode 有稳定默认值
- mode 不依赖 runtime 主线程接线才能存在
