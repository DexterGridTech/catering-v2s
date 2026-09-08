# TER 固定逻辑画布与 Android 适配器事实层设计评审请求

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_REMEDIATION_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_EXTERNAL_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false

## 背景

Dexter 当前要解决的是 Android 副屏显示内容相对 Web 预览明显放大、文字/控件被截断、两端在不同物理 display 上没有遵守同一套逻辑画布的问题。诉求不是给业务页面逐页加特判，而是：

1. 每个 surface 有固定的逻辑画布；
2. Android 原生适配器负责取得目标 display/window 的硬件与承载事实，并传给 JS；
3. JS 由一个共用的 host controller 统一处理画布承载、scale、IME 与命中坐标；
4. 业务组件和 ui/base/input 不读取 Platform、Dimensions、density、物理尺寸或 scale；
5. Android 可以按目标 display 的显示区域用 scaleX/scaleY 非等比铺满、不留边、不裁切；Web dev-host 是 Android 预览，但其具体 preview policy（上一轮候选为按画布比例 uniform contain）尚未得到 Dexter 确认，不得把候选当裁定。

这是对“把通用硬件屏幕能力放到适配器层”的具体化：能力是 per-surface host snapshot，不是全局当前屏幕对象，也不扩张 DevicePort。

## 评审目标

请评审详设与实施计划是否能在不侵入业务的前提下，真实解决 Android/Web 固定逻辑画布、双屏承载、IME 单位和滚动坐标问题。请优先寻找会让方案在实施期必然失败或假绿的条件，并区分可以静态确认的设计缺陷与必须通过 Android/Web 实际运行才能回答的 OPEN。

## 设计方案摘要

- Android 复用现有 adapter/android/dual-screen 与 TerminalDualScreen Expo module；增加 async snapshot 和 host-changed event，不新增第二 bridge。
- snapshot 绑定 surfaceKey、displayId、windowIdentity、generation，分开记录 stableHostLogicalSize 与 currentHostLogicalSize。
- stable 尺寸根据 CP-0 判定的窗口行为分支取得：若 IME 改变 current，使用同一显式 display-context → window-context 的 maximum metrics 与 density；若 edge-to-edge 手动 inset 下 current 不变，使用 owner decorView 与其 resources 的同次 layout snapshot；两者均不允许混用 bounds 与 density 来源。
- JS host controller 计算 Android scaleX、scaleY 和 bottomLogicalBeforeCanvasScale / scaleY；Web policy 待 Dexter 确认，uniform contain 仅为候选。
- landscape PRIMARY 为 1280×800 16:10，SECONDARY 为 1280×720 16:9；portrait 数值没有权威硬件 profile前保持 OPEN，不把横屏数字转置。
- RN 0.86.3 Fabric/bridgeless 的 surface constraints、祖先 transform 下的 measure 坐标、双 surface global DisplayMetrics/PixelUtil 影响是实施前硬门；未知时停机，不用反射、node_modules 补丁、fallback 或第二 host。
- InputSurfaceFrame 继续用自身 onLayout；InputScrollArea 只有在真实探针证明 content-local measurement 后才能改为同坐标系，input 不读 scale。
- CP-1 的旧 shape/基线分母已扩为 sample-console test、dev-host test 与 ui/base/input test 三棵测试树；input 的旧数字必须逐项判为新画布派生预期、中性行为 fixture 或明确 red fixture，不得因此引入 sample-console/宿主依赖。

## 需阅读文件

### 详设与计划

- doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md
- doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md
- doc/review/platform/2026-09-08-ter-logical-canvas-stretch-remediation-independent-review-input-checklist-codex.md
- doc/review/platform/2026-09-08-ter-logical-canvas-stretch-remediation-independent-review-round2-codex.md（独立审查记录；请以当前详设/计划为准重新判断）

### 原始需求与规范

- doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md
- doc/platform/terminal-coding-standard.md
- project-memory/decisions/terminal-architecture-and-stack-rulings.md
- project-memory/decisions/deterministic-context-only.md

### owning source

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt
- apps/terminal/adapter/android/dual-screen/src/implementations/imeInsets.ts
- apps/terminal/adapter/android/device/src/implementations/androidDevice.ts
- apps/terminal/kernel/base/platform-ports/src/types/device.ts
- apps/terminal/ui/integration/sample-console/package.json
- apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx
- apps/terminal/ui/base/render/src
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx
- apps/terminal/ui/base/input/src/components/InputScrollArea.tsx
- apps/terminal/ui/base/input/test/keyboardHeight.test.ts
- apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx
- apps/terminal/ui/base/input/test/scrollArea.test.tsx
- apps/terminal/ui/base/input/test/provider.test.tsx
- apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx
- apps/terminal/ui/base/dev-host/README.md
- apps/terminal/assembly/android/sample-terminal/App.tsx
- apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
- apps/terminal/assembly/android/sample-terminal/app.json

### RN vendor source

- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/interfaces/fabric/ReactSurface.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactDelegate.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivityDelegate.java
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/PixelUtil.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/scroll/ReactScrollViewCommandHelper.kt

## 独立核验重点

### 1. 适配器边界

判断 per-surface snapshot 是否确实属于 dual-screen adapter，是否正确利用已有 Display/Presentation/目标 context/Expo module 能力；是否有理由扩展 DevicePort，或应明确拒绝。检查主副屏同时存在时是否会被全局 singleton、displayIndex 或旧 generation 混淆。

### 2. stable/current 与 Android API

判断 maximumWindowMetrics 是否适合作为不随 adjustResize/IME 改变的 scale 基准；Presentation、display context、window context、system bars、fullscreen bounds 的关系是否写清。请不要只凭记忆判断当前 Android API：若结论依赖版本或 API 行为，请查 Android 官方文档或 AOSP/维护中的一手代码并给出链接。

### 3. JS 统一承载

判断 Android native snapshot 到 JS host controller 的数据流是否真的能让 JS 统一处理画布，且没有把 hardware fields、scale 或 Dimensions 泄漏给业务/input。检查 Android nonuniform fill 与待裁决的 Web preview policy 是否边界清楚，而不是互相矛盾。

### 4. RN public path、transform、hit-test、measure

重开实际 RN 0.86.3 source，判断 public ReactSurface constraints 是否允许 fixed canvas child 按 scaleX/scaleY 承载；Fabric/bridgeless 下 transform 后视觉与 pointer hit-test、measureLayout/onLayout/measureInWindow 的坐标系是否能支持方案。不能从结构或字符串搜索替代真实 probe；如果必须运行才能回答，请标 UNVERIFIED_REQUIRES_EVIDENCE 并指出 exact probe，而不是替设计做保证。

### 5. IME 与 scroll

逐项检查是否严格使用 scaleY、是否把 native density conversion 与 canvas conversion 分开、stable scale 是否在 IME show/hide 前后不变。检查 InputScrollArea 是否在未知 RN measure 语义时避免头痛医头；其最终要求必须是 currentOffset 与 scroll delta 同一坐标系，input 不知 scale。

### 6. 画布声明与 portrait

检查 1280×800 / 1280×720 的来源、比例与是否误把物理 px、Android dp、Web CSS px混写；同时全量核验 sample-console、dev-host、ui/base/input 测试树中的旧 1157/962/723/541 命中是否逐项分类，不能让旧 keyboard/scroll/provider oracle 漏出。portrait 没有 hardware profile时保持 OPEN 是否正确；不接受横屏转置或凭空常量。

### 7. 证据与计划

检查 H-01 至 H-08 red fixture 是否能击穿错误 display identity、current-as-stable、手写常量、错误缩放轴、border侵占、混坐标和 null fallback；行为判据不能只靠 props、调用次数、mock callback 或字符串搜索。检查旧基线分母是否覆盖 ui/base/input 测试及 dev-host README 的旧 width-only 描述。检查计划是否保留逐代码/详设对账，且 RD-10 不改变既有业务断言语义。

## 外部资料要求

若判断涉及当前 API、库版本或成熟方案，请先查官方一手资料/维护仓库，不要凭记忆或博客推断。至少核对：

- Android Presentation API reference
- Android WindowManager / WindowMetrics API reference
- Expo Modules API reference
- React Native communication/native module documentation
- 项目 vendored RN 0.86.3 source

若没有成熟的固定逻辑画布库，不要为了“有库”而引入逐值 scaler；请明确说明现有官方机制与本设计的最小组合。

## 期望结论

请输出：

VERDICT=GO 或 NO-GO
M=数量 / S=数量 / N=数量

每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并给出：

- 仓库根相对路径与第 X 行或唯一 symbol；
- 失败场景；
- 影响面；
- 最小修复；
- 是否需要 Dexter 裁决；
- 使用的官方来源链接或明确的现场证据要求。

严格边界：本轮只审详设与实施计划，不改文件，不实施，不构建，不运行 Android/Web，不把“设计上应该成立”写成“已验证通过”。

请特别指出是否存在比 per-surface adapter snapshot + JS host controller 更小、已有且成熟的方案；如果不存在，请说明为什么不是在重复造轮子。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 固定逻辑画布与 Android 适配器事实层做一次独立设计评审。

背景：当前 Android 副屏出现字体放大、内容截断，Web 是 Android 预览。Dexter 裁定采用固定逻辑画布 + 承载层处理：Android 适配器采集每个 surface 的 display/window/IME 事实并传给 JS，JS 共用 host controller；Android 允许按实际显示区域使用 scaleX/scaleY 非等比铺满，Web preview policy 仍待 Dexter 确认，uniform contain 只是候选。业务组件和 ui/base/input 不得读取 Platform、Dimensions、density、物理尺寸或 scale。

目标：请证伪式核验设计与计划是否可执行，重点检查 per-surface identity、maximumWindowMetrics 的 stable/current 分离、RN 0.86.3 Fabric/bridgeless surface constraints、祖先 transform 下的 measure/hit-test、IME 必须除 scaleY、InputScrollArea 的 content 坐标、Web preview、portrait profile、旧基线分母、red fixture、RD-10 与逐代码对账。

请先阅读并重开当前源码：doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md、doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md、doc/review/platform/2026-09-08-ter-logical-canvas-stretch-remediation-independent-review-input-checklist-codex.md、doc/review/platform/2026-09-08-ter-logical-canvas-stretch-remediation-independent-review-round2-codex.md，以及 apps/terminal/adapter/android/dual-screen、apps/terminal/ui/base/render、apps/terminal/ui/base/input、apps/terminal/ui/base/dev-host、apps/terminal/ui/integration/sample-console、apps/terminal/assembly/android/sample-terminal 和 apps/terminal/node_modules/react-native/ReactAndroid 相关 owning source。

如果结论依赖当前 Android、Expo、React Native 或库版本行为，请务必查 Android/Expo/React Native 官方一手文档或维护中的上游代码，不要只凭记忆，也不要为了有库而引入逐值 scaler。需要真实运行才能回答的事项请标 UNVERIFIED_REQUIRES_EVIDENCE，不要把设计预期写成 PASS。

期望结论：GO 或 NO-GO，并给出 M/S/N。每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，写仓库根相对路径与第 X 行/唯一 symbol、失败场景、影响面、最小修复、是否需要 Dexter 裁决及来源链接。

授权边界：本轮只评审详设与实施计划，不修改文件、不实施、不构建、不运行 Android/Web、DEV、seed、UAT 或部署。谢谢。
```
