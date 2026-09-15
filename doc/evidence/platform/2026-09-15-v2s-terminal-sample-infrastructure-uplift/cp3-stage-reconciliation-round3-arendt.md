# CP-3/B3 fresh 三维对账：Arendt

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-3/B3 ui-state, shared console assembly, readiness, feature-owned notice dismissal, picker two-hop
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER_ID=01a0a1c9-69cd-75d0-a091-4a554e5f42df
REVIEW_TIME=2026-09-15
BLIND_REVIEW=true
READ_ONLY=true
VERDICT=PARTIAL_OPEN

## 输入与边界

fresh reviewer 读取当前 v3.6 requirements、详设/计划、命中项目 memory、CP-3/B3 owning
source、tests/evidence；不写文件、不做 Git、不执行动态，也不把旧 reviewer 报告当真相。

## 当前源码核验

- ui-state hydration/persistence：静态与 focused test 文件级 MATCHED，覆盖 durable layers、
  ephemeral/非法行、unknown/stale/duplicate 与 containers 保留。
- 三个 feature 的 `src/application/module.ts`、`src/assembly/assembly.ts` 已接入
  `ui.base.feature-assembly`，并保留 feature owner。
- sample-console 已在 `src/assembly/assembly.tsx:69-117` 创建真实 runtime module。
- shared `consoleAssembly.tsx:224-270,410-427` 统一 catalog/runtime/ui-state/startup writer
  与 SurfaceRoot/AdminLauncher。
- `LayerStack.tsx:175-199` 先调用 `layerDismissals[partKey]`；三 feature 的 helper 由
  feature 自己持有，integration 汇总 map，未由 base 反向 import feature。
- picker actor 当前消费 child result，focused fixture 有真实 runtime child write-after 注入；
  但完整 PF-01..PF-10/U13 journey 仍未闭合。
- `ScreenReadyBoundary.tsx:102-150` 以 resolved real part + host layout 作为 ready，
  `SurfaceRoot.tsx` 两处旧诊断仍是 dev-only；U8 release/device OPEN。

## 阶段结论

CP-3/B3 整体 OPEN。首败是 B0 sample2 frozen/full acceptance 与当前 post-repair stage
evidence 尚未闭合，而非已发现的 feature-owned mechanism 反例。

broken boundary：局部源码/focused fixture 与完整 U10/U13、release/device、whole-scope 之间。
last known good：当前 source-level shared assembly、feature dismissal、ui-state 与 picker
child handling。

## 可复现核验

```bash
nl -ba apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx | sed -n '224,270p;395,428p'
nl -ba apps/terminal/ui/base/render/src/components/LayerStack.tsx | sed -n '175,205p'
nl -ba apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts | sed -n '76,142p'
```

