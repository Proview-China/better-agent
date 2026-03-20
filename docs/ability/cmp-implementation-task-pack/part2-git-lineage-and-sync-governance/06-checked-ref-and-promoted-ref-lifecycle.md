# 06 Checked Ref And Promoted Ref Lifecycle

## 任务目标

实现并冻结 `checked snapshot refs`、`promoted refs` 和 branch head 的关系。

## 必须完成

- `checked ref` 生命周期
- `promoted ref` 生命周期
- branch head 与二者关系

## ownership

- 二层：`Governance Worker`
- 三层协作：`Ref Promotion Worker`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-high`

## 依赖前置

- `00`
- `04`

## 最小验证义务

- `checked ref`、`promoted ref`、`branch head` 三者生命周期不冲突

