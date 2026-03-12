# Praxis

`reboot/blank-slate` 是 Praxis 的空白重启线。

这条分支的目标不是修补旧实现，而是从一个干净、可讨论、可验证的起点重新建立项目骨架。

## 当前状态

- 旧实现没有被带入这条分支。
- `dev`、`main`、`deploy` 保持原样，作为历史参考与回滚抓手。
- 当前仓库只保留最小文档和协作约束，后续目录结构将围绕新架构逐步落地。

## 接下来先做什么

1. 明确新的系统边界和模块职责。
2. 先写可验证的架构约束，再开建目录与基础代码。
3. 把第一批里程碑拆成可以单独验证的小步提交。

更具体的重启约束见 [docs/reboot-charter.md](/home/proview/Desktop/Praxis_series/Praxis-reboot/docs/reboot-charter.md)。
