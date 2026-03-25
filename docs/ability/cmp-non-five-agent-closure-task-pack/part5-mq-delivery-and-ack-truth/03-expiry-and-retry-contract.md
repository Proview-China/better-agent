# Part 5 / 03 Expiry And Retry Contract

状态：指导性分册。

更新时间：2026-03-25

## 当前结论

`CMP` 的 delivery 真相至少要表达：

- 已发布
- 已确认
- 已安排重试
- 已过期

## 第一版最小对象

- `CmpMqRetryPolicy`
- `CmpMqExpiryPolicy`
- `CmpMqDeliveryStateRecord`
- `CmpMqDeliveryProjectionPatch`

## 第一版最小动作

- create from publish
- acknowledge
- schedule retry
- expire
- project into DB delivery state
