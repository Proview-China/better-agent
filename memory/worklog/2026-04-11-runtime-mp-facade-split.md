# 2026-04-11 Runtime MP Facade Split

## 背景

- 在 CMP 分面已经拆开的前提下，MP 仍停留在 `PraxisInspectionFacade.inspectMp()` 这一条 inspection-only 通路。
- 这种状态虽然可用，但边界上仍把 MP 归在“杂项 inspection”，不利于继续补 `workflow / memory / search / readback` 这类宿主无关表面。

## 本轮完成

- 在 `PraxisRuntimeFacades` 中新增独立 `PraxisMpFacade`，把当前 MP 对外表面从 generic inspection bucket 中拆出。
- `PraxisRuntimeFacade` 现在直接暴露 `mpFacade`，而不是要求宿主通过 `inspectionFacade` 间接访问 MP。
- `PraxisRuntimeInterface` 的 `.inspectMp` 已改为走 `runtimeFacade.mpFacade.inspect()`。
- `PraxisRuntimePresentationBridge` 的 CLI / Apple presentation path 也已改为走 `runtimeFacade.mpFacade.inspect()`。
- `PraxisInspectionFacade.inspectMp()` 继续保留，作为兼容层转发，避免现有调用点在迁移过程中整体断裂。

## 影响边界

- 这轮只完成“当前已存在 MP 表面”的迁移闭环，没有额外发明新的 MP command family。
- 也就是说，Swift 侧现在完成迁移的是：
  - `PraxisInspectMpUseCase`
  - `PraxisMpFacade`
  - `PraxisRuntimeInterface.inspectMp`
  - `PraxisRuntimePresentationBridge.inspectMpState`
- 尚未开始的新表面仍然是：
  - MP workflow command surface
  - MP memory/search/readback dedicated command surface
- 因此后续扩展应继续挂在 `PraxisMpFacade` 及对应 interface command 上，而不是把新能力重新塞回 `PraxisInspectionFacade`。

## 验证

- 新增/更新测试确认：
  - `PraxisRuntimeFacadesTests` 直接验证 `mpFacade.inspect()` 是 neutral MP surface，且 `inspectionFacade.inspectMp()` 仅作为兼容代理。
  - `HostRuntimeInterfaceTests` 直接验证 `.inspectMp` 已走 dedicated `mpFacade`，不再依赖 `inspectionFacade` 的 MP 通路。
- `swift test` 全量通过。
- 当前本地快照：`186` tests / `47` suites。

## 后续建议

- 下一步如果继续扩 MP，不要再增加新的 `inspectMp` summary 拼接逻辑。
- 直接按 `workflow / memory / search / readback` 四类宿主无关命令拆到 `PraxisMpFacade`、`PraxisRuntimeInterface`、`PraxisRuntimeUseCasesTests`。
