# 04 PR Merge Promotion Governance

## 任务目标

把子提 PR、父 merge、checker promotion、祖先默认不可见的治理主线写实。

## 必须完成

- 子向直属父提 PR
- 只有直属父可 merge
- merge 后仍需 checker / projection promotion
- 祖先默认只看父节点 promoted state

## ownership

- 二层：`Part2 Lead / Integrator`
- 二层协作：`Governance Worker`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- `03`

## 最小验证义务

- 子提 PR、父 merge、父 promotion 规则完整
- 孙辈默认不可见

