# Part 0 / 02 Global Wave Release Rules

状态：主线程编排文档。

更新时间：2026-03-25

## 放行规则

只有满足下面条件，主线程才允许下一波开始：

### Wave 1 -> Wave 2

- 各 Part `00` 已提交冻结结论
- 写域冲突已标注
- 高冲突文件没有被普通 worker 改动

### Wave 2 -> Wave 3

- helper / contract / schema 已落下
- 至少有一条对应测试或 fixture
- 没有人直接改 `runtime.ts`

### Wave 3 -> Wave 4

- 至少一层真实 lowering 或真对象主链已成立
- 对应 readback 口径已出现
- sidecar 已给出最小 smoke 证据

### Wave 4 -> Wave 5

- cross-part 接缝已清楚
- degraded path 至少有一条明确说明或测试
- 主线程已准备好高冲突总装

### Wave 5 -> Wave 6

- acceptance gate 文档已就绪
- 关键主链测试通过
- 回读证据可被主线程总结
