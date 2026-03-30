# Part 4 TAP Deep Bridge And Role Enforcement

## 目标

把 `CMP -> TAP` 从 capability resolution 推进到更真实的审批/执行路径。

## 子任务

1. role-specific profile 深接线
- baseline / allowed / denied patterns

2. git/db/mq capability family
- `ICMA` 不拿 git 写
- `Iterator` git 主推进
- `Checker` git 有限修正
- `DBAgent` DB 主写
- `Dispatcher` mq 主发

3. 审批 lane
- 不同角色申请相同能力时也要能区分角色

4. 执行 lane
- 不只是 resolve
- 至少把关键能力走进 review / allow / execution bridge
