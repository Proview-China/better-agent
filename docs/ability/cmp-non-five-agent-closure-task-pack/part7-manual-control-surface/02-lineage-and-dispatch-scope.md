# Part 7 / 02 Lineage And Dispatch Scope

状态：指导性任务文档。

更新时间：2026-03-25

## 本文件要解决什么

先把手动控制里的“范围”收成正式字段。

至少包括：

- project scope
- agent scope
- lineage root scope
- branch family scope
- dispatch scope

## 当前要求

- 范围字段必须可去重、可标准化
- dispatch scope 必须有默认值
- 范围控制先存在于 config/types 层，不要求本轮直接接入 runtime 主线
