# Part 0 / 03 High-Conflict File Policy

状态：主线程编排文档。

更新时间：2026-03-25

## 高冲突文件

下面这些文件默认视为高冲突文件：

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-types.ts`

## 原则

### 原则 1

普通 worker 默认不直接修改高冲突文件。

### 原则 2

如果 worker 必须联动高冲突文件：

- 先在总结里写清“主线程需要怎样接”
- 不自行硬改

### 原则 3

主线程总装时：

- 先收 helper
- 再收 contract
- 最后改高冲突文件

## 冲突发现方式

- `Conflict Sentinel` 只负责报告，不负责改逻辑
- 主线程负责决定：
  - 延后
  - 合并
  - 重切写域
