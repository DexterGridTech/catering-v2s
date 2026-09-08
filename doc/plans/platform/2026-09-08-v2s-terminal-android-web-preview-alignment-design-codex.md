# TER Android / Web 固定逻辑画布与适配器显示事实详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
SKILL_USED=cs-spec-to-plan

## 0. 状态、授权与阅读顺序

- 日期：2026-09-08；作者：Codex；状态：详设已按最新裁定修订，共享 RN render density 修复已落地，待实施后静态 review；本轮交付范围为 landscape，Web policy 已闭合，portrait 仍为明确的范围外 OPEN。
- REVIEW_TARGET=IMPLEMENTATION；IMPLEMENTATION_AUTHORITY=true（Dexter 已授权按 CP 顺序实施；当前源码与 focused/Android 证据已完成，待 Claude 独立复核，不以文件头自证 review 已完成）。
- 后续仍不授权 DEV、seed、UAT 或部署；P-01 至 P-05 的动态证据必须按实际输出分档记录，不能以静态或 focused 结果替代。实施选择共享 RN render density 路径：副屏保留目标 display 的 hardware density 作为硬件事实，但 React surface 与 JS layout 使用同一 RN runtime 的 render density；该选择已在 §5.2.3 记录。
- 当前问题：Android 副屏出现字体放大与内容截断，Web 预览与 Android 产品承载不遵守同一套逻辑画布。目标不是把业务页面逐项缩小，也不是把 input 包变成平台适配器，而是由 Android 适配器采集每个 surface 的承载事实，交给 JS 共用承载层计算固定画布的显示变换。
- 直接授权：Dexter 已裁定采用“固定逻辑画布 + 承载层非等比拉伸铺满”，并在 Claude 第二轮设计复核后的三项修复闭合后授权实施；本文件的 P-01 跨源判据、`TYPE_APPLICATION` 边界与 CP-1 全量分母是实施前硬约束。
- 上游输入：doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md、同目录 2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md、2026-09-05-v2s-terminal-input-implementation-design-codex.md、2026-09-05-v2s-terminal-input-implementation-plan-codex.md。
- 规范与记忆：doc/platform/terminal-coding-standard.md、doc/platform/foundation-charter.md、project-memory/decisions/terminal-architecture-and-stack-rulings.md、project-memory/operations/terminal-coding-standard.md、project-memory/decisions/deterministic-context-only.md。
- 配套计划：doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md。

本详设采用两个相互配合的关键修正：Android 的通用能力是 per-surface host snapshot，不是全局“当前硬件屏幕”对象；React Native 的文字与 DIP 换算则继续使用同一 runtime 的共享 render metrics。双屏可同时存在，主屏与副屏的 display、window、hardware density、生命周期不同，但同一 JS/RN runtime 的 render density 不能在创建副屏时被目标 display density 改写；否则副屏文字会脱离画布变换而放大。

### 0.1 版本冲突与权威来源闸门

本详设的固定画布数值来自 Dexter 于 2026-09-08 的最新裁定，不是从当前 package.json 或旧文档反推：横屏 PRIMARY 为 1280×800，横屏 SECONDARY 为 960×540。SECONDARY 对应的 sample Android 硬件显示配置仍是 1280×720 physical px / 213 dpi；该 physical 配置不是逻辑画布值。1157×723 与 962×541 均被退役。当前源码和上游需求仍可能保留旧值，属于待同步材料，不得与本详设并列解释。

| 事实 | 当前权威 | 当前代码/旧材料状态 | 实施前处理 |
| --- | --- | --- | --- |
| 横屏 PRIMARY 画布 | Dexter 2026-09-08 最新裁定 | package/source 已出现新 shape，仍有旧测试/文档命中待清理 | CP-0A 记录当前 bytes，再统一同步 |
| 横屏 SECONDARY 画布 | Dexter 2026-09-08 最新裁定：960×540 logical units | package/source 已同步 960×540；部分旧测试/文档仍把 1280×720 physical display 写成 canvas | CP-0A 区分并统一 logical canvas 与 physical display |
| 竖屏画布 | surface-form §3.2 的产品形态 + Dexter 指定的真实硬件 profile | 当前没有可核验数值来源 | 保持 OPEN，不得转置横屏数字 |

CP-0A 未完成前，不得以旧材料中的数字实施 host、键盘高度或测试基线；CP-0A 只解决材料权威冲突，不制造新的硬件事实。当前源码已经出现的新 shape/新数字也只作为待复核的 current bytes，不等于 focused 或运行证据。

## 1. 目标、不变量与明确非目标

### 1.1 目标

1. 每个 surface 使用自己的固定逻辑画布。横屏 PRIMARY 与 SECONDARY 可以是不同宽高比；业务组件只按逻辑坐标布局。
2. Android 适配器读取目标 display/window 的稳定承载事实，并通过现有 Expo native module 传给 JS；JS 共用承载控制器计算 scaleX、scaleY、原点与 IME 逻辑 inset。
3. Android 承载层将画布非等比拉伸到实际稳定显示区域，四边重合、不留边、不裁切；Web dev-host 保持画布比例并让渲染宽度铺满实际 preview content rect，使用同一 uniform scale，不按浏览器高度做 contain，也不做 browser 非等比拉伸。
4. ui/base/input 继续只处理逻辑坐标与最终逻辑 imeInset，不读取 Platform、Dimensions、density、display 或宿主 scale。
5. 所有 scale 的输入、输出、generation、surface 身份与失败原因可被结构化日志关联；未测量不猜尺寸、不渲染依赖尺寸的 keyboard。

### 1.2 不变量

| ID | 不变量 | 责任 owner | 违反时 |
| --- | --- | --- | --- |
| I-01 | surface 声明是画布尺寸的唯一业务输入；不保留 1157×723、962×541 旧基线 | sample-console terminalSurfaces | 设计/实现停机 |
| I-02 | Android host snapshot 以 surfaceKey + displayId + generation 区分，不能用“当前屏幕”单例 | adapter/android/dual-screen | 事件丢弃并报错 |
| I-03 | stableHostLogicalSize 由已验证的 host measurement policy 计算 scale；IME 只允许更新 currentHostLogicalSize，或在 edge-to-edge 手动 inset 模式下保持 current 与 stable 相同 | Android adapter + JS host controller | scale 稳定性失败 |
| I-04 | scaleX = stableHostWidth / canvasWidth，scaleY = stableHostHeight / canvasHeight；Android top-left 非等比铺满 | ui/base/render | 几何验收失败 |
| I-05 | Android imeInset = bottomLogicalBeforeCanvasScale / scaleY；input 只收最终逻辑值 | dual-screen adapter + render | 键盘/滚动单位错误 |
| I-06 | Web preview 使用 width-fill-preserve-ratio：scaleX = scaleY = previewContentWidth / logicalStageWidth；高度由比例推导，超出可视高度时由宿主滚动承载，不缩放、不裁切、不按 browser ratio 变形 | dev-host | 预览失真 |
| I-07 | 没有跨层聚合器；事实由 owner 发出，host controller 只转换和关联 | 各 owner | RD-12 停机 |

### 1.3 非目标

- 不改业务 feature、表单字段、keyboard 键位、提交/取消/登录行为或业务 TS 契约。
- 不扩展 DevicePort、DisplayInfo、PlatformPortBindings、CreatePlatformPortsInput、PlatformPorts；当前 DevicePort.getDisplayInfo() 只有设备级 displayCount，不能承载 per-surface 几何。
- 不重新初始化或按 surface 改写全局 React Native DisplayMetricsHolder；只读取 RN runtime 已建立的共享 render metrics。不创建第二个 React host、JS runtime、store、进程或第二套逐值 scaler。
- 不把 theme/global.css、资产或硬件 API 移入业务 src；不新增 checker 扫描分母。
- 不承诺 Android/Web 字体 hinting、抗锯齿或颜色逐像素一致。可验收的是逻辑盒几何、无溢出/裁切、换行点与实际命中。

## 2. 现状事实到源码矩阵

| 事实 | 当前 owning source | 设计含义 |
| --- | --- | --- |
| Android 主/副屏枚举、Presentation、目标 context、secondary surface 生命周期 | apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt 第 142-302 行、第 700-724 行 | 新 host snapshot 继续归 dual-screen adapter；目标 display hardware density 只作硬件事实，React surface 使用共享 RN render density |
| Android native→JS 模块与 IME 事件 | apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt 第 6-30 行；apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt 第 20-82 行 | 复用现有模块的 async snapshot/event 形态，不造新 bridge |
| JS IME source 已按 displayIndex 过滤 | apps/terminal/adapter/android/dual-screen/src/implementations/imeInsets.ts 第 3-51 行 | host source 使用同一身份过滤，但增加 displayId/window/generation |
| 设备端口只报告 displayCount | apps/terminal/adapter/android/device/src/implementations/androidDevice.ts 第 1-84 行；apps/terminal/kernel/base/platform-ports/src/types/device.ts 第 12-60 行 | 不将承载几何塞入 device port |
| sample 声明与 parser 的 current bytes | apps/terminal/ui/integration/sample-console/package.json 第 11-23 行；apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts 第 14-67 行 | 以当前 orientation → surface → fixed canvas shape 为起点逐项核对所有消费者；不得假定 CP-1 前仍是旧 shape |
| 旧 shape 的直接消费者 | apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx 第 59、223-251 行；apps/terminal/ui/integration/sample-console/test-expo/App.tsx 第 2、9 行；apps/terminal/ui/integration/sample-console/src/index.ts 第 5 行；apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx 第 153-238、274-278、357-367 行；对应 sample-console/dev-host focused tests | shape 迁移必须与声明/parser、sample-console 的公开入口和 Web 预览入口同一个 CP 完成；host 几何算法仍在后续 CP-3/CP-5 分别处理，不保留兼容 shape |
| sample assembly 读取声明并包住 input frame | apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx 第 44-143、216-282 行 | host controller 放在 input frame 外层；input frame 仍由自己 onLayout |
| Web dev-host 当前 width-only scale 与外层 border | apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts 第 1-63 行；apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx 第 152-305、787-790 行 | 按 Dexter 确认的 preview policy 重写 geometry；border 改为不侵占 canvas |
| 旧 shape/基线 fixture 分母 | `sample-console`、`dev-host`、`input` 三个包的全部 `src` 与入口源码，以及三包各自的 test 树 | CP-1 对三包全部源码与入口、再对测试树全量扫描并逐项分类：直接读取 terminalSurfaces shape/旧声明的生产入口和 fixture 必须在 CP-1 迁移；input 测试中的旧数字若只是平台无关行为 fixture 改成中性尺寸，若是画布派生预期则按新画布重算；surfacePreview.test.ts 的 layout/scaleToFit 是 dev-host 自有 geometry policy fixture，保留到 CP-5 按最终 Web policy 迁移，不把它误当 package declaration |
| input scroll 当前 window 坐标与 content offset 混用 | apps/terminal/ui/base/input/src/components/InputScrollArea.tsx 第 19-40 行 | CP-0 先验证 RN Android transform 下测量语义，再选公共 layout API |
| RN ReactSurfaceImpl 以 context metrics 设置初始 AT_MOST constraints | apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt 第 65-84 行 | 必须先验证固定画布子树能否超出 surface 初始 constraints；不能反射/打 node_modules 补丁 |
| RN ReactSurface public API 无 layout constraint setter | apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/interfaces/fabric/ReactSurface.kt 第 15-48 行 | 不能假设 native ReactSurface 可直接设置逻辑画布尺寸 |
| RN Text/PixelUtil 依赖 DisplayMetricsHolder | apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/DisplayMetricsHolder.kt、PixelUtil.kt 与 TextAttributes.kt | 必须证明双 surface 使用同一共享 render density，创建副屏不得把全局 RN metrics 改成目标 hardware density；否则文字尺寸会脱离 canvas transform |
| display-context 已有显示事实 owner | apps/terminal/kernel/base/display-context/src/index.ts 第 3-25 行；apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx 第 3-7 行；apps/terminal/kernel/base/display-context/src/types/display.ts 第 4-6 行 | 复用 DisplayMode 和已有公开读侧；host snapshot 只承载窗口几何事实，不复制 display mode，也不绕过业务事件 command 边界 |

## 3. 方案分层与最小公共面

### 3.1 数据流

Android Display / Presentation / IME
        │ 目标 display 的 per-surface snapshot
        ▼
adapter/android/dual-screen
        │ AsyncFunction 初读 + onSurfaceHostChanged 事件
        ▼
ui/base/render SurfaceHostController
        │ 读取固定 canvas declaration，计算 scaleX/scaleY/imeInset
        ├── Android host canvas：非等比填满目标 window
        └── Web dev-host canvas：width-fill-preserve-ratio（保持比例，宽度铺满 preview content rect）
        ▼
sample assembly → SurfaceRoot → InputSurfaceFrame / business features

适配器只提供事实，不依赖 UI 包。ui/base/render 定义结构型 SurfaceHostSource 与 SurfaceHostSnapshot；Android adapter 返回满足该形状的 source，Web dev-host 提供同形 source。sample assembly 只组装 source，不读取平台字段。这样“通用能力在适配器层”和“JS 统一画布处理”同时成立。

### 3.1A DisplayMode 与 TR-11 边界

`surfaceKey` 直接使用既有 `DisplayMode`，不再引入 `SurfaceKey`；已有 `display-context` 继续拥有 displayCount、PRIMARY/SECONDARY 派生和业务显示模式的公开读侧。host snapshot 只增加承载窗口的几何/密度事实，不复制 display mode 的类型或派生逻辑。

`onSurfaceHostChanged` 是 adapter → render infrastructure 的只读事实通知：它不把回调注册面交给业务 actor，不携带 `ActorExecutionContext`、`dispatchAction` 或写能力，也不直接写任何业务 slice。因而它不替代 TR-11 所要求的“外部屏幕事件 → command → 业务 actor → dispatchAction”路径；如果未来 host 事实需要改变业务状态，必须另走 display-context 的 command 路径，本专题不新增该行为。dev-host 继续通过 `display-context` 的公开 `readDisplayInfo`、`resolveSecondarySurfaceAvailable` 与 `DisplayMode` 使用既有 owner，不直接读取 adapter 内部对象。

### 3.2 JS 公共契约（设计形状，不直接作为公共业务契约）

surfaceKey 直接使用 `DisplayMode`（由 `@catering-v2s/kernel-base-display-context` 提供）：PRIMARY | SECONDARY
SurfaceOrientation = portrait | landscape

SurfaceCanvasDeclaration：
  width: number
  height: number

SurfaceHostSnapshot：
  surfaceKey: DisplayMode
  generation: number
  displayId: number | null
  windowIdentity: primary | secondary | web-preview
  orientation: SurfaceOrientation
  stableHostLogicalSize: SurfaceCanvasDeclaration
  currentHostLogicalSize: SurfaceCanvasDeclaration
  ime.visible: boolean
  ime.bottomLogicalBeforeCanvasScale: number
  diagnostics.stableWidthPx / stableHeightPx: number | null
  diagnostics.currentWidthPx / currentHeightPx: number | null
  diagnostics.hardwareDensityDpi / hardwareDensity / hardwareScaledDensity: number | null
  diagnostics.surfaceDensityDpi / surfaceDensity: number | null
  diagnostics.source: android-display-context | web-viewport
  diagnostics.stableMeasurementContext: primary-window-ui | secondary-presentation-window-ui | display-window-context(maximumWindowMetrics) | owner-decorView-layout

SurfaceHostSource：
  getSnapshot(): SurfaceHostSnapshot | null
  subscribe(listener): () => void

约束：

- stableHostLogicalSize 是 scale 唯一输入；不能由 JS 视口或当前 IME 高度临时替换。
- Android raw px 只进入 diagnostics 和 native→JS conversion；不传给 input，不与 CSS px、RN dp 混写。
- bottomLogicalBeforeCanvasScale 已按目标 window 的 native density 转成承载层单位，但还未除以画布 scaleY。
- null snapshot 是“尚未获得事实”，不是默认尺寸；host controller 在拿到 snapshot 前不渲染依赖尺寸的画布/keyboard。
- generation 每次目标 window/display/context 变化递增；旧 generation 的事件不能覆盖新状态。

### 3.3 host controller 输出

SurfaceHostLayout：
  canvas: SurfaceCanvasDeclaration
  host: SurfaceCanvasDeclaration
  scaleX: number
  scaleY: number
  imeInset: number
  transformOrigin: top-left

Android：
  scaleX = stableHostLogicalSize.width / canvas.width
  scaleY = stableHostLogicalSize.height / canvas.height
  imeInset = ime.bottomLogicalBeforeCanvasScale / scaleY

Web：预览使用 width-fill-preserve-ratio。`viewport` 是 preview content rect（不含 canvas border、stage padding、surface gap），按 logical stage 的总宽计算：
  scaleX = scaleY = viewport.width / stageWidth
  renderedWidth = stageWidth * scaleX = viewport.width
  renderedHeight = stageHeight * scaleY
渲染高度不参与 scale 计算；若 renderedHeight 大于 viewport.height，宿主的可滚动内容区承载完整 stage，禁止用 `overflow: hidden` 截断底部。该 policy 仅用于 Web 预览，不把 browser ratio 当 Android 硬件 ratio，也不在浏览器做非等比 stretch。Android 的 scaleX/scaleY 可以不同，这是裁定接受的整体形变。

## 4. 固定画布声明

### 4.1 横屏

apps/terminal/ui/integration/sample-console/package.json 的 terminalSurfaces 设计为方向分组：

  terminalSurfaces:
    orientations:
      landscape:
        PRIMARY: width 1280, height 800
        SECONDARY: width 960, height 540

- PRIMARY 的目标硬件比例是 16:10，对应 sample Android 主屏配置 1280×800。
- SECONDARY 的目标硬件比例是 16:9，对应 sample Android 副屏 1280×720 physical px / 213 dpi；固定画布使用干净的 960×540 logical units，表达 16:9 画布而不是复制 physical px。当前 RN runtime 的共享 render density 为 320dpi，因此副屏 owner raw bounds 1280×720 在 JS/RN layout 单位中是 640×360，承载 scaleX/scaleY 都是 0.6666667；画布仍完整铺满硬件窗口，文字先按共享 RN metrics 栅格化再随同一 canvas transform 缩放，避免目标 213dpi surface context 导致文字脱离变换而放大。
- 1280×800 与 960×540 是本轮采用的逻辑画布值；1280×720 只表示当前 sample 的 physical display 配置，1157×723 与 962×541 退役，不得继续存在于声明、键盘高度基线或验收文档。
- 这两个逻辑画布值的需求权威是 Dexter 2026-09-08 最新裁定；CP-0 仍需用实际模拟器/目标设备记录 display 的 physical 分辨率与 dpi，不能把裁定数字伪装成当前源码已经证明的运行事实。
- layout、scaleToFit 不再作为业务运行时的第二套尺寸来源。若为 dev-host 保留展示排列，应放在 dev-host geometry policy，不得改变 canvas declaration。

### 4.2 竖屏

竖屏需要单独的 target hardware profile 和 clean canvas 数值。当前源码事实只有：

- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml 第 19 行仍钉死 screenOrientation=landscape；
- apps/terminal/assembly/android/sample-terminal/app.json 仍以 landscape 为默认；
- surface-form §3.2 规定了手持 POS 的 PRIMARY-only 拓扑，但没有可核验的竖屏硬件宽高/比例来源。

因此本详设不把横屏数字转置为竖屏数值，也不凭空填入 portrait declaration。本轮明确只交付横屏：不修改 `AndroidManifest.xml` 的 landscape 锁定、不修改 `app.json` 的 landscape 默认、不新增或改写 portrait declaration。竖屏的 target hardware profile 与 PRIMARY-only 运行验证记为 O-01 OPEN，不能声称 F 已实现；该范围外 OPEN 不阻塞本轮 landscape 详设/实施计划交付，但不得用 landscape 证据代替竖屏证据。未来若要开启竖屏，须另行取得真实 profile 与 orientation 授权。

## 5. Android 适配器：per-surface 硬件与窗口事实

### 5.1 归属与桥接

继续使用 apps/terminal/adapter/android/dual-screen，扩展现有 TerminalDualScreenModule，不改 kernel/base/platform-ports：

- native TerminalDualScreenActivityHandler 负责为 PRIMARY Activity 与 SECONDARY Presentation 建立 SurfaceHostRegistry entry；
- 每个 entry 绑定 surfaceKey、displayId、windowIdentity、generation、目标 display context、stable/current bounds、density 与 orientation；
- TerminalDualScreenModule 暴露 getSurfaceHostSnapshot(surfaceKey)（async）和 onSurfaceHostChanged（event），与现有 getImeInsetsSnapshot/onImeInsetsChanged 同一模块、同一 display identity；
- JS createAndroidSurfaceHostSource(surfaceKey) 只接受自身 key，初读后订阅事件，并丢弃 key/display/generation 不匹配的 payload；
- 适配器内部 registry 不是 DevicePort，不进入 PlatformPortBindings 或 root export；它是 assembly 的平台 source。

这符合 Expo 的现有 AsyncFunction/Events 模式和 React Native native→JS event 模式，避免重复造 bridge。模块生命周期必须与 Activity/Presentation 生命周期一致：destroy/remove 时发布不可用或递增 generation 的终态，JS 清除旧 surface snapshot，不保留幽灵尺寸。

### 5.2 stable/current bounds

每个 Android entry 至少有 stableHostLogicalSize 与 currentHostLogicalSize 两组值，但两者是否出现数值差异必须以现有窗口日志和 CP-0 实测为准，不能预设 adjustResize 一定改变 decorView。

### 5.2.1 bounds 与 density 的同源配对

stable bounds 与用于 JS/layout 换算的 render density 必须在同一次 owner snapshot 中可关联，且两者的语义来源必须明确分开：bounds 来自实际 owner window，render density 来自同一 RN runtime 的 surface resources；hardware density 只来自 owner display 的硬件事实。禁止把目标 hardware density 当作 RN Text/layout density，也禁止在缺少 source/identity 关联时静默拼接。

- 使用 maximum metrics 的分支中，PRIMARY 与 SECONDARY 都显式从各自 owner window 的 `decorView.display` 得到 target display，再构造 `ownerWindow.context.applicationContext.createDisplayContext(targetDisplay).createWindowContext(TYPE_APPLICATION, null)` 作为 stable bounds 的 measurement context；从该 context 读取 maximum bounds，但 stable logical conversion 必须使用已关联的 RN render density，而不是把该 window context 的 hardware density写入 React surface。P-01 仍要用 owner decorView 的独立 raw bounds 与 render density 交叉核对，不能单独信任 window context 的 bounds。
- edge-to-edge 且 current frame 不收缩的更小分支中，不需要 maximum metrics：stable bounds 直接取 owner window 的 `decorView.width/height`，render density 取该 surface view 的 `resources.displayMetrics`（同一 RN runtime 的共享 render metrics）；PRIMARY owner 是 `activity.window`，SECONDARY owner 是 `presentation.window`。owner raw bounds、surface render density、hardware density 与 display/window identity 在同一次 layout snapshot 中记录并关联，不能用 target hardware density替代 render density。
- `Presentation.window.context` 只作为 SECONDARY 实际 UI window 的 owner context；它不能被替换成主 Activity context。若上述显式 display-context/window-context 路径在目标 SDK 不可用，或 owner view 路径无法证明同源，CP-0 失败即停机，不做隐式 fallback。
- 现有 `createSurfaceContext`（TerminalDualScreenActivityHandler.kt 第 700-724 行）继续只服务 React surface context 的配置，但它把副屏 context 对齐到 RN runtime 的共享 render density，而不是目标 display hardware density。它不能成为 host measurement context；PRIMARY 与 SECONDARY 的 host raw bounds 仍由各自 owner window 提供。目标 display hardware density 不删除，继续作为 diagnostics/资源与系统窗口事实；不得按 surface 改写共享 RN metrics。

diagnostics 必须同时记录 `stableBoundsSource`、`stableMeasurementContext`、`stableWidthPx`、`stableHeightPx`、转换后的 logical width/height，以及两份独立的 owner-window 非 IME `decorView` layout snapshot。密度字段必须分为 `hardwareDensityDpi`/`hardwareDensity`/`hardwareScaledDensity` 与 `surfaceDensityDpi`/`surfaceDensity`：前者只表示 target display 的硬件事实，后者是 React surface 与 host logical conversion 实际使用的共享 RN render density。当前路径允许 SECONDARY 上两者不同（213 hardware / 320 render）；render density 无效或无法与 RN surface/source 关联时必须失败。stable logical size 使用 owner raw bounds 除以 render density；不再把 `rawPx / (logicalSize * density)` 当作通过条件，因为 logical size 正是由这两个量换算得到，该比值恒为 1，不能证明 context 选对。

P-01 的机械判据改为跨源比较：

1. 在当前锁定的模拟器配置中，记录 PRIMARY 与 SECONDARY 的 `hardwareDensityDpi` 与 `surfaceDensityDpi`，并分别核对 hardware density 与实际 target display、surface render density 与 RN runtime/surface 一致；当前预期为 PRIMARY 320/320、SECONDARY 213/320。若设备实际配置不同，必须记录实际值并按 O-05 停机，不得用常量替代设备事实；SECONDARY 的 320 必须来自共享 RN render metrics 的原始输出。
2. 对每个 surface，把 stable bounds 用 render density 换算出的 logical width/height 与独立捕获的 owner window 非 IME `decorView` raw bounds 除以同一条已记录的 RN render density逐轴比较，`abs(stableLogical - ownerDecorLogical) <= 1` 才通过。不得改用 hardware density，亦不得复用 stable logical 值或同一个计算对象制造对账。
3. P-01 原始记录必须包含 measurement context 的完整路径、context/display/window identity、两次 snapshot 的时间或 generation、两套 raw bounds、两套 density、转换结果与逐轴 delta。不得以同源配对比值、对象 identity、字符串或单一端的结果代替跨源比较。

任一 surface 的 density 关系、跨源 logical delta、context/window identity 或 generation 无法核实时，P-01=OPEN；这不是通过调整 tolerance 或改用另一密度来关闭。

`TYPE_APPLICATION` 的选择理由与边界：API 30+ 的 `createWindowContext` 需要窗口类型来计算该类型窗口在目标 display 上的 configuration/resources；这里选 `TYPE_APPLICATION` 是因为被测承载是应用顶层窗口，且该 context 只用于一次 stable maximum-bounds measurement，不是把 Presentation 伪装成 TYPE_APPLICATION。由于窗口类型会影响返回 bounds，maximum metrics 不能单独被信任：P-01 必须把它换算出的 logical bounds 与实际 PRIMARY Activity 或 SECONDARY Presentation owner 的非 IME decorView logical bounds 做上述跨源核对。该 window context 按 display/window generation 创建一次，不在 layout 回调或 render loop 中反复创建。若两者任一轴差值超过 1，按 O-05 停机，不改变窗口类型、判据或容差迁就实现；host-ready decorView 分支不经过此 context。

### 5.2.2 IME 窗口行为分支与更小路径比较

CP-0 先读取已有的 `primary-window-layout`、`secondary-presentation-window-layout` 与 `ime-root-layout` 日志，在 IME 弹出前后比较 decorView/window bounds：

| 实测窗口行为 | stableHostLogicalSize 来源 | currentHostLogicalSize | H-02 判据 | maximumWindowMetrics |
| --- | --- | --- | --- | --- |
| IME 导致 current frame 改变 | 由同源 measurement context 的 maximum metrics 提供稳定边界；current 仍取真实 window layout | 允许随 IME 改变，仅作诊断/可见状态 | 把 IME 收缩后的 current 注入 stable，必须使 scale 变化并失败；正确实现 stable 不变 | 保留，并由 P-01 证明 SDK/API 可用 |
| edge-to-edge + 手动 inset，current frame 不改变 | 在 host-ready 且非 IME 的 decorView layout 中捕获稳定 bounds；在 rotation/display/config generation 变化时重新捕获 | 与 stable 数值相同是允许的，仍记录为 current | 在测试 source 中只改变后续 current、保持 stable 不变；若 controller 从 current 算 scale 必须失败。真实 IME 日志只证明当前设备走此分支 | 不作为 scale 必需依赖；可不引入 API 30 maximum metrics |

第二行是更小路径：既然仓内 `InputSurfaceFrame` 已通过 paddingBottom 消化 IME，且窗口日志证明 decorView 不收缩，则直接使用窗口 owner 的首个稳定 layout 作为 scale 基准，仍保留 stable/current 字段以隔离 host 生命周期与 IME 语义，但不增加 `maximumWindowMetrics` 依赖。它不能事先假定，必须由 CP-0 的既有日志选择；无论选择哪一行，scale 都不能由 IME 期间重新测得的 current frame驱动。

适配器要同时记录 raw px 与 converted logical size；raw px 只用于诊断。`stableHostLogicalSize` 与对应 density 必须在同一个 measurement context 内换算，不能用主屏 density 解释副屏。

实施前 CP-0 必须先完成上述窗口行为判定，再确认所选 context/API 路径和 Presentation fullscreen bounds；若两种路径都无法以同源事实实现，停机交 Dexter，不自行引入隐藏 API 或猜测常量。

### 5.2.3 surface density 路径选择

本轮比较过两条能把画布铺满当前副屏的路径：

| 路径 | 副屏 React surface density | 副屏 host logical size | 当前物理结果 | 栅格化路径 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 目标 display density 作为副屏 RN render density | 213dpi，与 Presentation/owner window 同源 | 约 961.5×540.85 | 960×540 画布经约 1.0016 变换铺满 1280×720 | RN Text 受共享 `DisplayMetricsHolder` 影响，可能以 320dpi 栅格化但不经匹配的 canvas scale，表现为放大/截断 | 拒绝，实测旧 APK 复现 |
| 共享 RN render density | 320dpi，来自同一 JS/RN runtime 的 `DisplayMetricsHolder.screen`；不冒充副屏 hardware density | 640×360 | 960×540 画布经 0.6667 变换铺满 1280×720 | 先约 28 physical px 栅格化，再随 canvas 变换到约 18.7px，物理尺寸与 PRIMARY 对齐 | 采用 |

两条路径的最终物理尺寸近似相同，但第一条让副屏 React surface 的 layout context 与 RN Text 的共享度量语义分裂：当前 RN 0.86.3 的 Text/PixelUtil 仍依赖 runtime 级 `DisplayMetricsHolder`，因此目标 213dpi 不能作为第二个 surface 的独立 render density。共享 RN render density 不是画布的第二套尺寸来源，也不是逐值 scaler；它只是保证同一 JS/RN runtime 内所有 DIP/Text 换算在同一单位体系中，canvas 声明仍唯一来自 sample-console 的 package.json，scale 仍只负责把固定画布铺满 owner window。硬件 density 与 render density 可以不同，必须分别记录并禁止把硬件事实写回 RN shared render metrics。

### 5.3 partial-real 与失败边界

- snapshot 必须明确 source、displayId、windowIdentity、generation；不能把“无副屏”变成 SECONDARY 的 PRIMARY 尺寸。
- stable bounds 与 surface render density 必须带同一个 owner/window/generation 关联和配对结果；`hardwareDensity*` 只作 target display diagnostics，`surfaceDensity*` 是 React surface 与 host conversion 实际使用的共享 RN render density，二者允许不一致但不得互相替代。
- 缺少 stable bounds、density≤0、window/display identity 不一致或 generation 过期时，source 返回不可用并记录原因；JS 不 fallback 到 declaration 作为宿主尺寸。
- displayId、hardware/surface density、raw bounds 只属于 diagnostics。它们不变成业务组件 prop，也不扩张公共 TS port。

### 5.4 RN public-path 硬门

当前 RN 0.86 source 显示 ReactSurfaceImpl 创建时用 context metrics 设置 AT_MOST constraints，而 public ReactSurface 没有 layout constraint setter。设计不能假设“JS 子画布固定尺寸一定能在 surface 上自由变换”。CP-0 必须用最小实验确认：

1. target context 的 React surface/parent 在实际 display 上能承载 root host；
2. fixed logical canvas 的 child 可以在 parent 内按 scaleX/scaleY 充满；
3. Fabric/bridgeless 下 transform 后视觉与 pointer hit-test 使用同一坐标映射。

若失败，设计停在 IMPLEMENTATION_NOT_READY：只能提出 adapter-owned native host wrapper / RN upstream-supported path 的补充设计并另行 review；不得 reflection、patch node_modules、创建第二 host 或让 input 自己读取 scale。

CP-0 的 probe 必须先产出以下五项硬证据，逐项写入 CP-0 记录；没有五项记录不得进入 CP-1：

| ID | 最小证据 | 通过条件 | 失败处置 |
| --- | --- | --- | --- |
| P-01 | 目标 SDK/API matrix、所选 measurement context 完整路径、measurement context bounds/density 原始输出、PRIMARY/SECONDARY owner 非 IME decorView 原始输出、Presentation fullscreen bounds，以及 IME 前后既有 window-layout 日志 | 明确选择 maximum-metrics 或 host-ready decorView 分支；当前模拟器 PRIMARY/SECONDARY `hardwareDensityDpi` 与 `surfaceDensityDpi` 分别对账为 320/320、213/320，并与实际 display/RN surface 对账；每个 surface 的 stable logical size 与独立 owner decorView logical size 逐轴 delta ≤1；不把 current frame 混入 stable。不得用恒真配对比值代替跨源判据 | 停在 O-05，交 Dexter，不猜尺寸 |
| P-02 | RN 0.86.3 Fabric/bridgeless 最小 surface parent 与 fixed child layout 输出 | fixed child 能在目标 surface parent 内承载并完成布局 | 停在 O-02，不加第二 host |
| P-03 | 非等比 scaleX/scaleY 下真实视觉边界与真实 Android tap 命中输出 | 视觉坐标和 inverse hit-test 同一映射，且无局部累积偏移 | 停在 O-02，不以 prop/mock 代替 |
| P-04 | 同一 input 的 onLayout、measure、measureLayout、measureInWindow、scroll offset 原始输出 | 至少一条公共 API 路径能把 scroll delta 与 currentOffset 放在同一坐标系 | 停在 O-03，不修改 input 猜 scale |
| P-05 | 双 surface 同一 JS runtime 的 PixelRatio/DisplayMetrics 与 host snapshot 对账输出 | 主副 surface 不互相污染，且 scale/IME 输入来自各自 snapshot | 停在 O-04，不把全局 metrics 当 per-surface 事实 |

P-01 至 P-05 是设计硬门，不是对运行结果的预先承诺；CP-0 只在真实 probe 原始输出全部可审计时闭合。

## 6. JS 共用承载层

### 6.1 承载层位置与输入

新增的 host controller 属于 ui/base/render 的承载基础设施，不能放进 sample feature，也不能让 Android adapter import UI 包。推荐的最小依赖方向是：

  surface declaration → SurfaceHostController → SurfaceCanvas/SurfaceRoot → sample assembly → input/business
  Android adapter ───────────────────────────────┘
  Web dev-host source ───────────────────────────┘

sample assembly 只接受一个可选的结构型 SurfaceHostSource 或由 assembly 外层注入 host controller；它不解构 Android snapshot，也不读取 platform fields。InputSurfaceFrame 仍使用自己的 onLayout 记录实际逻辑盒，不能接收 host scale 作为 prop。

Android/React Native 的 `PixelRatio` 与 `DisplayMetrics` 只允许作为 `display-diagnostics` 诊断载荷记录，不能成为 canvas geometry、业务组件或 input 的布局输入；真正的 per-surface geometry 只能来自 surface declaration 与该 surface 的 host snapshot。

### 6.2 Android canvas

在目标 surface 的 React root 内，host controller 创建一个逻辑尺寸等于当前 orientation declaration 的 canvas，并让外层 host viewport 填满 Presentation/Activity 的稳定 host area。canvas 的 transform 只有一处：

- transformOrigin 为 top-left；
- transform 同时含 scaleX 与 scaleY；
- scale 来源只来自 snapshot.stableHostLogicalSize / declaration；
- host overflow 只负责裁掉系统窗口外的非业务内容，scale 精确到稳定边界时不得发生裁切；
- pointer hit-test 必须由真实 Android tap 验证其 inverse mapping 与视觉位置一致。

当前 React surface 的 native parent constraints 仍是 CP-0 的前置硬门；不能先在 JS 添加 transform 再以“看起来铺满”作为证明。

### 6.3 Web dev-host

Web dev-host 的 SurfaceCanvas 是预览承载，不是 Android product host。它读取相同的 orientation declaration，采用已由 Dexter 确认的 `width-fill-preserve-ratio`：

  scaleX = scaleY = previewContentRect.width / logicalStage.width
  renderedWidth = previewContentRect.width
  renderedHeight = logicalStage.height * scaleY

- `previewContentRect` 是 SurfaceCanvas 内部不带 border 的实际内容节点；只用其 CSS layout width 计算 scale，不使用 `window.innerHeight`、浏览器外框、devicePixelRatio 或 visualViewport.scale 作为逻辑尺寸；
- width-fill 不等于 contain：viewport 高度不参与 scale，渲染高度超出时由 dev-host 可滚动内容区承载完整 stage，禁止为了塞进高度而二次缩放或裁切；
- scaleX 与 scaleY 必须相等，Web 不得做 browser 非等比 stretch；
- viewport resize 只重新计算 preview scale，不改变 declaration；
- 记录 browser viewport、devicePixelRatio、visualViewport.scale 与 CSS rect 作为诊断，但不把物理像素当逻辑尺寸；
- 多 surface 仍按现有 layout policy 排列，排列间距不能改变各自 canvas declaration。

previewViewportRect 的 owner 必须是 dev-host SurfaceCanvas 内部一个不带 border 的明确 View/DOM 承载节点，建议 testID 为 testIdPrefix:canvas:preview-viewport。它测量的是实际可用的 host content rect（不含 canvas border、stage padding 与 surface gap），由该节点的 layout/ResizeObserver 结果传给 geometry policy；不得用 window.innerHeight、浏览器窗口外框或猜测的固定高度替代。正常、窄宽和短高 viewport 都必须记录 rect、可用宽高、scaleX/scaleY 与最终 rendered rect；短高只验证可滚动且不裁切，不把高度塞进 scale 公式。

testExpoApp.tsx 当前 styles.surface 第 787-790 行的 border 必须移到不参与 canvas layout 的外壳，或改为 outline/绝对定位装饰层。验收必须证明 InputSurfaceFrame 的 onLayout 等于 declaration，而不是 declaration 减去 border。

## 7. IME 与滚动坐标

### 7.1 IME

Android 系统键盘属于系统窗口，不受 JS canvas transform。TerminalImeInsetsCoordinator 继续在目标 window 读取 WindowInsetsCompat.Type.ime()，用目标 window 的 native density 得到 bottomLogicalBeforeCanvasScale。JS host controller 才做画布换算：

  finalImeInset = bottomLogicalBeforeCanvasScale / scaleY

不能扣额外 padding/offset，也不能用 scaleX 或单一 scale。若 CP-0 证明 IME 改变 current frame，则 stableHostLogicalSize 由同源 maximum-metrics 分支保持不变；若 CP-0 证明 edge-to-edge 手动 inset 下 current frame 不变，则 stable/current 可以相等，stable 只在 host-ready 或非 IME 的 rotation/display/config generation 变化时刷新。两种分支下，stableHostLogicalSize、scaleX、scaleY 在 IME 弹出和收起前后都必须相等到日志允许精度。

当 IME source 或 host source 的 displayId/windowIdentity 不匹配时，不得把主屏 inset 投给副屏。未获得有效 host snapshot 时，keyboard 不渲染，不以 declaration height 或上一次 window 的 inset 猜测。

### 7.2 输入滚动

InputScrollArea.tsx 第 19-40 行当前把 measureInWindow 的 window 坐标与 currentOffset/scrollTo 的 content 坐标相加。固定 canvas 有祖先 transform 后，这个假设必须先被实验证伪。

CP-0 的最小探针固定记录同一输入在以下 API 的结果：onLayout、measure、measureLayout（相对 scroll content）、measureInWindow；同时记录祖先 scaleX/scaleY、scroll currentOffset、真实 content offset 与窗口 rect。Android 必须在 RN 0.86.3 Fabric/bridgeless 实际 sample 上执行，不能用 Web 结果代替。

只有以下结论之一可以进入实施：

1. measureLayout/onLayout 能给出未受祖先矩阵变换的 content-local 坐标：将 InputScrollArea 的 delta 计算改为同一 content 坐标系，scrollTo({y}) 仍使用 currentOffset + delta；input 不读 scale。
2. public layout API 也返回被变换的 window 坐标：停机，补充设计必须把 transform 移到不污染 scroll 测量的宿主边界，或采用 RN 已支持的上游 host path；不得在 input 里读 scale、读 Dimensions 或偷偷除以 scaleY。

验收固定为 scaleY 明显不为 1 时，先把 offset 置于非零，再聚焦逻辑位置比可见底沿低 200 的字段；真实 after offset 必须是 before + 200（受最大 scroll clamp 时，fixture 要保证有余量），并同时证明字段未被键盘遮挡。只 mock scrollTo(320) 或只测 offset 0 不合格。

## 8. 启动日志与诊断

启动日志由事实 owner 产生，logger 只关联同一 startupRunId、phase、sequence，不新增跨层 aggregator：

| category | owner | 必须记录 |
| --- | --- | --- |
| surface declaration | sample assembly | surfaceKey、orientation、canvas width/height |
| surface host | Android dual-screen adapter / Web dev-host | display/window identity、generation、stable/current logical size、scaleX/scaleY、source、stable measurement context、bounds/density pair、window behavior branch |
| IME | TerminalImeInsetsCoordinator + JS host controller | bottomPx（诊断）、bottomLogicalBeforeCanvasScale、scaleY、final imeInset、visible |
| measured frame | InputSurfaceFrame / host seam | surfaceKey、logical onLayout width/height、declared width/height、delta |
| scroll | InputScrollArea | before offset、content-local input/viewport rect、delta、requested after、actual onScroll |

日志只在 __DEV__/dev 构建打开详细 raw metrics；不得记录密码、手机号、token、cookie、Authorization、原始输入或 raw payload。生产构建不应包含 dev-only diagnostics emitter，必须以生产 bundle DCE 证据确认，不以 __DEV__ 静态字符串搜索代替。

## 9. 可验证性、red fixture 与 negative control

### 9.1 设计级硬门

| ID | red fixture | negative control | 证明 |
| --- | --- | --- | --- |
| H-01 | Android snapshot 把 SECONDARY 的 displayId 换成 PRIMARY | 两个 key 各自匹配正确 displayId | per-surface identity 过滤会红 |
| H-02 | 在已判定的窗口行为分支中让 host controller 从 current 计算 stable：若 current 会收缩则注入 IME 后 shrink；若 current 不收缩则在后续 snapshot 中只改变 current、保持 stable 不变 | 分支一：真实 current 变化且 stable 不变；分支二：真实 current 不变，控制夹具改变 current 时 scale 仍不变 | scale 不能由 IME 期间的 current 驱动；两分支都必须能击穿错误实现 |
| H-03 | emitter 用手写 declaration 或零值替代真实 host bounds | 真实 adapter snapshot 传递已知 bounds | source provenance 与内容有效 |
| H-04 | Android canvas 只给 scaleX 或宽度 scale | scaleX/scaleY 明显不同的 host | 非等比铺满且无局部错位 |
| H-05 | IME final inset 错除 scaleX/不除 scaleY | scaleY=2、bottomLogical=100 得 final=50 | 单位换算轴正确 |
| H-06 | Web 外层 border 继续占 canvas | 装饰层不影响 canvas | InputSurfaceFrame onLayout 等于 declaration |
| H-07 | InputScrollArea 用 measureInWindow 值直接加 currentOffset | scaleY≠1、before offset≠0、200 delta fixture | scroll 坐标同系 |
| H-08 | host snapshot 缺失时 fallback declaration/上次 snapshot | 缺失期间无 canvas keyboard | 未测量不猜尺寸 |

H-01/H-02/H-03 是行为事实门，不能用 prop 值、调用次数或字符串搜索作唯一证据。H-04/H-05/H-07 必须有真实布局/系统窗口/真实 tap 或 scroll 结果；结构测试只能补充不能替代。

### 9.2 A-G 实施验收

- A：Android 与 Web 每个 surface 的 InputSurfaceFrame onLayout measured 与对应 declaration 的差值，必须按布局量化的真实上界判定，而不是要求恒为零：`|deltaAxis| ≤ 0.5 / surfaceDensity`。推导是单轴最终布局最多有半个物理像素的取整误差，再用该 surface 实际用于 React/layout 换算的 density 折回逻辑单位；当前 Android PRIMARY 与 SECONDARY 的 `surfaceDensity=2.0`，每轴上界均为 `0.25` logical unit。SECONDARY 的 `hardwareDensity=1.3312501` 不能用于该换算。Web CSS layout density 取 `1`，其整数 CSS layout 观测上界为 `0.5` CSS logical unit。`surfaceDensity` 必须来自同一次 surface/layout 事实并记录在 evidence 中，不能换成 hardware density 或任意宽松常量。本项只验证 frame 与 canvas 之间没有超过量化上界的 border/padding 侵占，不承担 scale、宿主铺满或裁切证明。
- B：Android 非同宽高比 display 上，canvas 的四边分别与宿主实际 content rect 的左上、右上、左下、右下边界重合，无留边/裁切；同一配置下对四角及其内缩安全点做真实 tap，证明视觉元素与 inverse hit-test 一致。
- C：scaleX 与 scaleY 明显不等时，截图/布局日志证明整体形变而不是局部错位；截图只作可见性辅助，不作跨渲染器逐像素相等结论。
- D：IME 弹出/收起各一次，scaleX/scaleY 不变；最终 imeInset 是画布逻辑单位。
- E：scaleY 非 1 且有非零 offset 时，scroll target 为 before+200，实际结果与字段可见性一致。
- F：取得 Dexter 确认的 portrait hardware profile 后，PRIMARY-only 手持拓扑与对应 keyboard 真跑通；在 profile 未给出前标 OPEN。
- G：既有 focused/typecheck/build/test 与必要 Web/Android 运行均是真实 fresh 输出。模型 red fixture 的 FAIL 必须和生产 PASS 分开写。

## 10. 依赖与边界对账

| 方向 | 允许 | 禁止 |
| --- | --- | --- |
| Android adapter → JS | 现有 TerminalDualScreen Expo module 的 async snapshot/event；per-surface registry | 新 React host、进程、store；全局 current display；把 hardware object 直接暴露给业务 |
| JS render → sample assembly | 结构型 host source/controller 注入 | 让 sample feature 读取 Platform、Dimensions、density、screen size |
| render → input | 最终 logical imeInset 与自身 onLayout | scale prop、physical px、host snapshot、Dimensions |
| platform-ports | 保持现有 DevicePort/DisplayInfo 公共面 | 增加 per-surface fields 或 root export |
| Web dev-host | width-fill-preserve-ratio、viewport measurement 与可滚动 overflow | 用 uniform contain/高度参与 scale；非等比 browser stretch；用 CSS physical px 冒充 Android dp |
| Android surface | target display context、hardware density diagnostics、共享 RN render density、JS canvas transform | 删除目标 display 的硬件事实；以 transform 替代 display context；按 surface 改写 RN shared metrics；让 target hardware density 直接成为副屏 Text/layout density |

### 10.1 不重复造轮子核验

- Android display facts 使用 framework 的 Display/Presentation/WindowManager；
- native→JS 使用已经存在的 Expo module async/event bridge；
- JS 承载复用现有 SurfaceCanvas/SurfaceRoot 与 input frame；
- 不引入 react-native-scaler 等逐值缩放库，不增加第二个单位系统；
- 若 RN public path 不足，只能走上游支持的 host/wrapper 设计，不能复制一套隐藏实现。

官方机制依据：Android Presentation 的 context/resources 按目标 Display 配置；非当前 display 的 WindowManager 应从目标 display 的 UI context 或显式 display-context/window-context 获取，bounds 与 density 必须同源；maximumWindowMetrics 只在 CP-0 选定的 IME 分支中使用；Expo module 提供 AsyncFunction 与 Events；React Native 原生到 JS 可用 module/event 通道。实施期仍须按项目锁定的 RN 0.86.3/Android SDK 做实际 probe，不能以文档替代版本实测。

## 11. 实施前 OPEN 与停机条件

| OPEN | 需要的证据/决策 | 未闭合时 |
| --- | --- | --- |
| O-01 portrait canvas 数值与 target hardware profile | Dexter 提供真实竖屏 display/window logical bounds、比例与 sample orientation 授权 | F 不可声称完成；不填猜测值 |
| O-02 RN surface public path 能否承载固定 canvas + transform + hit-test | 最小 Fabric/bridgeless Android probe，含实际 Presentation | 停在 CP-0；不写 workaround |
| O-03 RN 0.86 Android transform 下 measure API 坐标语义 | 真机/虚拟机探针逐 API 原始日志 | 不改 InputScrollArea |
| O-04 global DisplayMetrics/PixelUtil 对双 surface 的影响 | 同一 JS runtime 主副 surface 的 focused behavior evidence | 不得声称字体/滚动已统一 |
| O-05 stable bounds context/API 与 fullscreen Presentation bounds 的 SDK 适配 | min/target SDK、目标 window UI context 或显式 display/window context 的原始路径、IME 前后现有 layout 日志与所选分支 | 不混用 context/density；若 edge-to-edge 下 current 不变，允许采用 host-ready decorView 的更小路径，不无理由强依赖 maximumWindowMetrics |

任何 OPEN 若在实施中被源码或运行事实否定，必须报告 first failure、broken boundary、影响面和需要 Dexter 的精确决策；不能以 fallback、兼容层、临时常量或放宽验收关闭。

## 12. 逐代码可对账形态

详设和计划必须能逐条回到源码，使用固定记录字段：

| 字段 | 内容要求 |
| --- | --- |
| source path | 仓库根相对路径 |
| symbol/anchor | 唯一函数、类、常量或明确行号 |
| design clause | 本详设章节与不变量 ID |
| expected behavior | 可观察的尺寸、关系、来源、失败边界 |
| code observation | 实际代码或运行输出，不写推测 |
| verdict | 只能 MATCHED 或 OPEN |
| evidence tier | static / focused / Web / Android，不能混写 |

dev-host README 的旧 width-only `scaleToFit` 描述必须改为已裁定的 `width-fill-preserve-ratio`：宽度铺满 preview content rect、scaleX=scaleY、渲染高度按比例推导并由可滚动内容区承载；不得保留 contain 或 browser 非等比 stretch 的有效解释。

“逐代码与详设对账”是交付前单独步骤，不被三维对账、focused test、Web 运行或 Android 运行替代。任一源码锚点为 OPEN，交付标记必须是 IMPLEMENTATION_NOT_READY。
