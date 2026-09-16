# TER screenPart 机型解析 CP-1 步骤级三维对账（fresh 独立只读）

```text
REVIEW_TARGET=STEP_RECONCILIATION
SCOPE=CP-1
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER_AGENT=01a0a922-3edd-78e0-8cf6-96104c290e2f
VERDICT=OPEN
```

## 独立结论

`CP-1=OPEN`。本记录由 fresh 子 agent Hegel 只读完成；未修改文件，未运行 Git、构建、DEV、Web、Metro、Android、seed、部署或设备命令。

## 已核实

- `apps/terminal/ui/base/render/src/types/props.ts:77` 已有 `Content`/`System`/`Transition` failure union，以及 nullable `RenderSurfaceReadyInput.readyPartKey` 与 `contentFailure`。
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:62` 已分离 system/transition/content，system page 受目标 PRIMARY 物理表面限制。
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:102,145` 已将 `container-empty` 与 resolver content failure 包入 `ScreenReadyBoundary`。
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:224` 仅在目标物理 PRIMARY 与正尺寸布局下上报 ready，并包含 nullable `readyPartKey` 与 `contentFailure`。
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx:1218` 已有“内容失败先就绪、随后系统失败显示运行期档位”的时序用例。

## 必须处置的 OPEN

### 1. U-4a 诊断字段不闭合

需求与计划要求 screen not-found 诊断含 `partKey`、当前机型/`surfaceForm`、`containerKey`。当前 `apps/terminal/ui/base/render/src/foundations/diagnostics.ts:7` 的 `missing-catalog-entry` 仅含 `category/reason/partKey/displayMode`，`apps/terminal/ui/base/render/src/components/resolvePart.ts:124` 的生产发出点也只提供这些字段；既有 `apps/terminal/ui/base/render/test/renderSurface.test.tsx:990` 仍断言不完整形状。

### 2. U-5/U-5b 的 content reason 覆盖不完整

`incompatible-catalog-entry` 虽已实现为 content failure，但 focused 测试没有该 reason 的匹配项。四种 content reason 必须都由真实测试覆盖，且把任一 reason 改成另一 category 时对应的 ready/page 分流必须变红。

### 3. SECONDARY 系统失败隔离没有 focused 红夹具

源码将 system page 限制在目标 PRIMARY，但当前 focused 测试没有渲染 SECONDARY system failure 并断言不存在 `startup-failure` page。需要真实 SECONDARY fixture；仅源码门控不足以闭合该红 mutation。

## 处置边界

以上是 CP-1 的证据与测试缺口，不构成对已定产品语义的重新裁决。修复后须重跑 CP-1 focused，并重新交 fresh 独立步骤级三维对账；在 `MATCHED` 前不得进入 A-2。

