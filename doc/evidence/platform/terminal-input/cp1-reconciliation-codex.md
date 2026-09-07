# CP-1 逐项三维对账

```text
REVIEW_CYCLE_ID=TERMINAL-INPUT-IMPLEMENTATION-2026-09-06
STEP=CP-1
RECONCILIATION_TARGET=SurfaceRoot frame seam + LayerStack focus boundary + PrimitiveInput contract
RECONCILIATION_STATUS=PASS
```

| 项 | 需求正本 | 详设/计划 | 当前源码与 focused proof | 结论 |
|---|---|---|---|---|
| frame seam | input 可在 content 下方挂 keyboard sibling；render 不 import input | `renderContentFrame({content})` 单一窄接缝；content 内含 children、ScreenContainer、LayerStack | `SurfaceRoot.tsx` 只调用一次 frame callback；render 只提供结构，不 import input；37/37 render tests PASS | MATCHED |
| shrinkable content | keyboard 出现时内容区可收缩，LayerStack 留在 content | frame adapter 接收一个 content frame，不拆两个 owner prop | content View `flex:1`，ScreenContainer/LayerStack 在同一 content subtree 内；tree test PASS | MATCHED |
| layer focus boundary | 首层 open suspend，末层 close restore；layer focus 胜，实际恢复 focus 后再交给 input | Context 只传 `suspend`/`restore`；LayerStack 保留 native focus 保存/恢复 | `LayerStack` 顺序为 save→suspend→layer focus，close 为 restore→previous focus；transition test 覆盖第二层/顶层关闭不重复 boundary | MATCHED |
| render/input direction | render 不反向依赖 input | input 后续消费 render protocol，render 保持业务无关 | `SurfaceFocusBoundaryContext` 只含 phase listener；静态扫描无 render→input import | MATCHED |
| PrimitiveInput contract | 既有六项语义不变；新增四个可选 prop；拒绝 `inputMode` | `selection`、`onSelectionChange`、`showSoftInputOnFocus`、`maxLength` 透传，selection end 默认 start | 真实 RN TextInput tree 断言四项与 selection event；未传 callback 时保持 undefined；primitives 6/6 PASS | MATCHED |
| public face | public/invariants/README/test 同步 | 不扩张业务词汇或 automation backend | render/primitives index、invariants、README 已同步；primitives README 说明四 prop、ScrollView、layout 共同授权边界 | MATCHED |
| feature boundary | feature 不直连 RN、不用 `className` | 只由 primitives 提供呈现控件 | 当前 feature 生产源码无裸 RN import、`className`、`inputMode` | MATCHED |

CP-1 第一份独立 round-1 曾指出焦点顺序测试不足、PrimitiveInput 未传 callback 时仍挂包装函数、README 口径不全；主 agent 已修复并复跑 focused/typecheck。随后 fresh 只读复核报告 `CP1_GATE=OPEN`、`M/S/N=0/0/0`。
