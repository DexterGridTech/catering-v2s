# CP3/CP4 fresh code review — Mill

```text
REVIEW_TARGET=IMPLEMENTATION_PRE_DYNAMIC
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEW_STATUS=PRE_STATIC_FIX_RECORD
VERDICT=NO-GO_REQUEST_CHANGES
M_S_N=2/1/4
```

本记录保留 fresh 独立只读审查在 `RenderLayerDismissal` invariant 修复前的真实首败，
不作为修复后的最终对账结论。

## Findings

### M-1 — render public-surface invariant 漂移

仓内事实：`apps/terminal/ui/base/render/src/index.ts` 已导出
`RenderLayerDismissal`，但 `apps/terminal/ui/base/render/terminal-invariants.json`
未列出该公开类型。审查时执行 `node tools/terminal-ui-render/check-static.mjs`
首败为 `render-public-surface`，`extra=["RenderLayerDismissal"]`。

处置：主 Codex 已把该类型加入 `publicExports`，并修复了 targeted mutation
原先误命中另一个 `displayMode` 声明的问题；随后静态 gate 与其 model test 均通过。

### M-2 — 动态前置记录未闭合

仓内事实：审查时 B0 frozen/sample2 full acceptance、fresh stage/whole-scope
reconciliation 与 code↔design 仍有 OPEN/PRE-REPAIR 记录；该审查结论与当前授权下
后续必须取得 fresh matched records 的门控一致。此 finding 不因本记录而宣称动态可运行。

处置：保留为动态前置条件，待当前源码修复后的 CP0–CP4 fresh 三维对账、全批三维对账
及逐代码/详设对账分别产生新记录后再判断。

### S-1 — U13 release bundle proof 未执行

仓内事实：U13 seam 位于 picker test-only module，focused/projection proof 已有，
但审查时没有真实 release APK bundle scan。处置：纳入 release 动态证据，分别保留
business 与 cleanup；不得以该静态审查代替 APK proof。

## 已核实边界

- D-14 三条关闭路径已通过 feature-owned `layerDismissals` map 调用 feature helper；
  button 与 backdrop/Android back 共用同一 feature intent。
- shared console assembly、admin shell assembly、feature factory 与 D-12 exact
  table test 均已存在并与详设主体相符。
- `node tools/terminal-skeleton/check-static.mjs`、focused package tests/typechecks、
  native projection/startup diagnostics/production-bundle fixture checks 在审查范围内为
  已知 good；Web/Android/release/device/U8/U10/U13 dynamic 未由本审查执行。

## 首败链

```text
FIRST_FAILURE=render-public-surface
BROKEN_BOUNDARY=public API 与 terminal-invariants.json 不一致
LAST_KNOWN_GOOD=scoped typecheck + focused tests + skeleton static
```

## 核验命令

```sh
node tools/terminal-ui-render/check-static.mjs
node tools/terminal-ui-render/check-static.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
```
