# TER Web surface preview 缩放逐代码—详设对账

```text
REVIEW_CYCLE_ID=TER_WEB_SURFACE_SCALE_2026-09-07
REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_SCOPE=Web host preview scale correction and affected test/document anchors
CODE_TO_DESIGN_RECONCILIATION=MATCHED
RECONCILIATION=PASS
INDEPENDENT_REVIEW=ROUND_2_NO_GO_FINDING_CLOSED
AUTHOR_CLOSURE=PASS
RECONCILIATION_REVISION=2026-09-07
```

本记录是 2026-09-07 用户直接指派的 Web 宿主修复的独立当前记录。范围按本次实际改动的
代码、测试与文档逐项展开，不用旧的 2026-09-06 reconciliation 记录覆盖当前状态。
它只判断代码是否与当前详设的 Web 宿主增补一致；Android、真实 POS 和 Web 外部输入法
仍不在本次证据中。

## 逐代码对账

每一行都使用 `design anchor | code anchor | current observation | evidence | result`；
结论只允许 `MATCHED` 或 `OPEN`。行为项以真实 DOM 或可观察布局结果为证，不以调用次数、
mock callback 或 transform 前逻辑尺寸作为唯一证明。

| 维度 | design anchor | code anchor | current observation | evidence | result |
|---|---|---|---|---|---|
| behavior | implementation design §0.1、§4.8；sample S-26 | `SurfaceCanvas`、`calculateSurfacePreviewGeometry` | 由 canvas 自身宽度计算一套 stage scale；双屏使用同一倍率，surface 各自保持声明宽高 | Web 800×900 dual real DOM rect；surfacePreview tests | MATCHED |
| shape | design §4.8 target tree | `SurfaceCanvas` `scaled-stage` → `logical-stage` → PRIMARY/SECONDARY surface box | 首帧为 `measure-pending`；测量后 stage 有显式 rendered size，logical stage 有固定逻辑 style | dev-host focused test；Web DOM `offsetWidth/offsetHeight` | MATCHED |
| actions | plan §6.2、§9.2 | canvas `onLayout`、`surface-toggle`、surface children | canvas layout 只更新预览几何；toggle 仅改变 SECONDARY 挂载，assembly 复用 | sample-console 15 tests；dev-host lifecycle test | MATCHED |
| relationships | design §0.1、§4.8 | `testExpoApp.tsx` import `surfacePreview.ts`; input subtree unchanged | scale owner 在 dev-host；input 不导入、不读取 host scale；assembly 不新增尺寸桥 | source search；typecheck | MATCHED |
| placement | design §4.8 | `logical-stage` fixed `flexDirection`/gap/alignItems; surface wrappers | column 双屏按 PRIMARY/SECONDARY 逻辑高度顺序布局；窄宽度只缩放，不把两棵 surface 拉成同宽 | Web y/x/rect observations；row/column geometry tests | MATCHED |
| user-visible copy | design §0.1、README | `stageFooter`、header status 与业务 surface | 既有尺寸/模式文案保留；新增实现不注入业务文案或 input 文案 | source read；sample-console test | MATCHED |
| limits | design §0.1、plan §6.2 | `surfacePreview.ts` scale formula | `scaleToFit=true` 为 `min(1, max(0.01, availableWidth/stageWidth))`；false 为 1；gap/border/padding 为统一常量 | 11 geometry tests；Web formula readback | MATCHED |
| state/control | design首帧与resize条款 | `viewportWidth` state、`useMemo` geometry、`handleCanvasLayout` | 首次正宽度前不渲染 stage；宽度变化保留 assembly/surface state，只重新计算几何 | dev-host focused test；Web resize observation | MATCHED |
| failure/recovery | design §0.1 首帧/false 条款 | `calculateSurfacePreviewGeometry` null guard；canvas overflow branch | 无效/未测量 viewport 返回 null；false 分支允许外层 scroll；不猜尺寸、不静默伪造输入成功 | geometry test；source read | MATCHED |
| accessibility/focus | design §4.8、input boundary preservation | surface canvas/stage testIDs；input key action DOM | Web 按键 `text-5` 的 rect 中心由 `elementFromPoint` 命中同一 button action tree；host transform 只出现于 logical stage | Chrome real DOM hit observation | MATCHED |
| data source/invalidation | design §0.1、§5.1、plan §6.2 | `terminalSurfaces` input to `SurfaceCanvas`; `surfacePreview` args | 逻辑尺寸只来自传入声明；resize 只失效 viewport geometry，不复制/清空业务 value 或 selection | sample/dev-host tests；source search | MATCHED |

## 不变边界逐项确认

| anchor | code observation | result |
|---|---|---|
| `ui/base/input` local metrics | 本轮未向 `InputSurfaceFrame`、`InputProvider` 或 `VirtualKeyboard` 增加 host 尺寸/scale prop；input source 未出现 `scaleToFit` | MATCHED |
| `sample-console/src/assembly.tsx#SurfaceInputFrame` | 仍只负责 `SurfaceRoot`/`InputSurfaceFrame` composition 与 `imeInset`；没有把 `terminalSurfaces.surfaces` 穿给 input | MATCHED |
| Android boundary | 本轮只改 Web dev-host、样例测试和文档；没有改 Manifest、方向、Presentation、adapter 或设备策略 | MATCHED |
| sample-only probes | alpha/financial 仍是 `MemberForm` 已批准的 registry-only 字段；本轮没有新增探路组件或 probe 接线 | MATCHED |

## 证据与当前结论

```text
FOCUSED_TYPECHECK=PASS
FOCUSED_TESTS=PASS
WEB_REAL_DOM_RESIZE=PASS_FOR_LOCAL_WEB_PREVIEW
WEB_REAL_POINTER_HIT=PASS_FOR_LOCAL_WEB_PREVIEW
ANDROID=NOT_RUN_IN_THIS_CORRECTION
REAL_POS=NOT_RUN
INDEPENDENT_REVIEW=ROUND_2_NO_GO_FINDING_CLOSED
AUTHOR_CLOSURE=PASS
```

fresh 独立子 agent 的第二轮只读复核发现 active brief 的旧 Web 口径（`S=1`）；主 agent
已按最小修复更新 active brief、当前 Web 证据与本记录，并重新逐项核对代码锚点、证据和
设计锚点。该 review cycle 已达到两轮上限，不创建第三轮；`AUTHOR_CLOSURE=PASS` 只表示
finding 已由主 agent 修复并自证闭合，不把它改写成独立 agent 的 GO。
