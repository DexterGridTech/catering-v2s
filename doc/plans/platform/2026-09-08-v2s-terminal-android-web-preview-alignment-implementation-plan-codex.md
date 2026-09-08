# TER Android / Web 固定逻辑画布与适配器显示事实实施计划

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
SKILL_USED=cs-spec-to-plan

## 0. 计划状态与边界

- 日期：2026-09-08；状态：详设已按最新裁定修订，共享 RN render density 修复已落地，待实施后静态 review；本轮实施范围锁定为 landscape，Web policy 已闭合，portrait profile 仍为明确的范围外 OPEN。
- REVIEW_TARGET=IMPLEMENTATION；IMPLEMENTATION_AUTHORITY=true（Dexter 已授权按 CP 顺序实施；当前源码与 focused/Android 证据已完成，待 Claude 独立复核，不以文件头自证 review 已完成）。
- Dexter 已授权后续实施；本计划采用共享 RN render density 路径：副屏保留 target display 的 hardware density 作为诊断事实，但 React surface 与 JS layout 使用同一 RN runtime 的 render density。后续仍不授权 DEV、seed、UAT 或部署。P-01 至 P-05 未全部取得原始输出前不得进入 CP-1。
- 目标：Android adapter 采集 per-surface display/window/IME 事实，交给 JS 共用 SurfaceHostController；固定画布由承载层处理，业务 feature 与 input 不感知平台细节。
- 详设正本：doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md。
- 旧需求与设计的同步必须先经过 CP-0A；在 CP-0A 完成前不得留下“声明只是验收基线”与“声明是运行时画布输入”两套有效解释。

## 1. 固定顺序与全局停止规则

每个 CP 采用同一闭环：

1. 重开该 CP 的原始需求、详设条款、项目记忆与 owning source。
2. 只做该 CP 允许的最小变更。
3. 立即做 focused proof，并保存原始输出。
4. 用同一组原文逐点回读代码与证据。
5. 阶段三维对账：需求文档、详设/IA、项目记忆；每条只写 MATCHED 或 OPEN。
6. 由 fresh 独立子 agent 只读做本 CP 的阶段三维对账和证伪；任一 OPEN 由主 agent 修复后
   重新做该阶段对账，再进入下一 CP。这里的阶段对账是实施步骤控制，不是正式的
   `REVIEW_TARGET=IMPLEMENTATION` 对抗 review cycle：它不使用 `REVIEW_CYCLE_ID`、
   `REVIEW_ROUND` 或 `REVIEW_ROUND_LIMIT`，不消耗也不受正式两轮上限约束；每次修复后都可以
   重新召集 fresh reviewer，直到本阶段只有 `MATCHED`。正式 implementation adversarial review
   仍按第 13 节与独立审查治理的两轮上限执行，二者不得混称。

全局停止条件：

- CP-0 的 RN surface public path、transform hit-test、measure 坐标或共享 global DisplayMetrics 结果不支持方案；
- portrait profile 缺失却试图填入横屏转置值；
- 发现需要扩展 platform-ports 公共契约、创建第二 React host、读取 Dimensions 或向业务下发 scale；
- 任一变更改变业务断言语义、键盘行为、输入焦点/滚动结果或 window 生命周期；
- 任一证据缺失、静态结果冒充动态结果、模型 red FAIL 冒充生产 FAIL、cleanup 未 PASS。

上述任一情况都报告 first failure、last known good、broken boundary、影响面与需要 Dexter 的精确决策，不用 fallback、兼容层、临时常量或放宽门关闭。

## 1A. CP-0A：权威来源与旧材料 supersede 预处理

这是 CP-0 的材料前置，不是源码实施。必须在任何代码变更、测试基线更新或运行 probe 前完成。

### 动作

1. 在详设与计划中固定记录：横屏 PRIMARY 逻辑画布 1280×800、横屏 SECONDARY 逻辑画布 960×540 来自 Dexter 2026-09-08 最新裁定；sample Android 副屏的 1280×720 physical px / 213 dpi 只作为硬件配置记录；当前 package/source 若已出现新 shape/新数字，先作为 current bytes 记录；其余 1157×723、962×541 只作为待同步旧材料。
2. 逐一标记并同步所有仍把旧数字写成有效运行时基线的 requirements、keyboard design、implementation design/plan、dual-screen README 与 sample README；统一改为固定画布输入的语义，不保留两套有效解释。
3. 将竖屏保留为明确的范围外 OPEN：只记录 surface-form §3.2 的 PRIMARY-only 产品形态和待提供的真实硬件 profile，不填转置数字，不修改 portrait declaration，不修改 landscape manifest/app.json，也不用 landscape manifest 作为竖屏证据。本轮仅完成横屏材料。
4. 对每一处变更做需求、详设/IA、项目记忆三维回读；记录逐代码与详设对账的设计锚点，不把“文档已改”当成 Android/Web 运行证据。

### 出口

- 全部旧材料都只有 superseded 或新语义，且 portrait OPEN 被明确保留：CP-0A MATCHED，进入 CP-0。
- 发现横屏权威数字或上游语义仍冲突：停止并报告需要 Dexter 的精确决策，不进入 CP-0 之后的代码步骤；portrait profile 缺失本身已被本轮明确排除，不阻塞 landscape。

## 2. CP-0：事实源、SDK 与 RN public path 预检

### 输入与 owning source

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt 第 142-302、700-724 行。
- 同目录 TerminalDualScreenModule.kt 第 6-30 行、TerminalImeInsetsCoordinator.kt 第 20-82 行。
- apps/terminal/ui/base/input/src/components/InputScrollArea.tsx 第 19-40 行。
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt 第 65-84 行。
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/interfaces/fabric/ReactSurface.kt 第 15-48 行。
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/PixelUtil.kt 与 scroll command helper。

### 动作

1. 先读取现有 `primary-window-layout`、`secondary-presentation-window-layout`、`ime-root-layout` 的 IME 前后日志，判定 current frame 是否变化；不以 adjustResize manifest 或 `setDecorFitsSystemWindows(false)` 单独推断窗口行为。
2. 从项目实际 min/target SDK确认所选路径：若 current 随 IME 改变，PRIMARY/SECONDARY 均从各自 owner window 的 `decorView.display` 构造 `ownerWindow.context.applicationContext.createDisplayContext(targetDisplay).createWindowContext(TYPE_APPLICATION, null)`，并从该同一 measurementWindowContext 读取 maximum metrics 与 density；该 `TYPE_APPLICATION` context 只承担一次 stable maximum-bounds measurement，因为被测承载是应用顶层窗口，不能当作 Presentation owner。P-01 必须把该 context 换算出的 logical bounds 与实际 owner 非 IME `decorView` logical bounds 交叉核对，逐轴 delta ≤1；任一轴不一致按 O-05 停机，不能调类型或容差迁就。若 current 不变，则不引入 maximum metrics，直接从 PRIMARY `activity.window.decorView`、SECONDARY `presentation.window.decorView` 的同一次 layout snapshot读取 bounds 与其 `resources.displayMetrics` density。不得混用两条路径的 bounds/density。
3. 做最小 Android probe，分别在 PRIMARY Activity 与 SECONDARY Presentation 记录 stable/current bounds、measurement context kind、RN surface render density、target display hardware density、独立 owner decorView logical bounds、逐轴 cross-source delta、surface parent constraints、canvas layout、scaleX/scaleY。
4. 在实际 RN 0.86.3 Fabric/bridgeless sample 中对同一 input 记录 onLayout、measure、measureLayout、measureInWindow、currentOffset、真实 content offset；祖先使用非 1 且 scaleX≠scaleY。
5. 用同一 JS runtime 检查双 surface 的 PixelRatio/DisplayMetrics/scroll conversion 是否产生 cross-surface 污染；PixelRatio/DisplayMetrics 只记录在 `display-diagnostics`，不得进入 canvas geometry、业务组件或 input 布局。只读记录，不修改 node_modules。

### CP-0 硬证据清单

CP-0 必须产出以下五项原始记录，不能以结论摘要替代：

| ID | 原始记录 | 通过条件 |
| --- | --- | --- |
| P-01 | 实际 min/target SDK、API matrix、所选 measurement context 完整路径、measurement context bounds/density 原始输出、PRIMARY/SECONDARY owner 非 IME decorView 原始输出、Presentation fullscreen bounds，以及 IME 前后窗口行为日志 | 明确选择 maximum-metrics 或 host-ready decorView 分支；当前模拟器 PRIMARY/SECONDARY hardware/surface density 分别为 320/320、213/320，并与实际 display/RN surface 对账；每个 surface 的 stable logical size 与独立 owner decorView logical size 逐轴 delta ≤1；不把 current frame 混入 stable。不得用 `rawPx / (logicalSize * density)` 恒真比值代替跨源判据 |
| P-02 | RN 0.86.3 Fabric/bridgeless 的 surface parent、fixed child layout 与 constraints | child 在实际 target surface 内可承载并完成布局 |
| P-03 | scaleX/scaleY 不相等配置下的真实视觉边界与真实 Android tap | 视觉位置与 inverse hit-test 一致，无局部偏移累积 |
| P-04 | 同一 input 的 onLayout、measure、measureLayout、measureInWindow、currentOffset、content offset | 能选出与 currentOffset 同坐标系的 scroll delta 路径 |
| P-05 | 双 surface 同一 JS runtime 的 PixelRatio/DisplayMetrics 与 host snapshot 对账 | 主副 surface 不污染，per-surface 输入可追踪；不得把 display-context 的 DisplayMode 重复定义为 SurfaceKey |

每项记录必须包含 session 是否 fresh、surfaceKey、display/window identity、scaleX/scaleY、原始输出路径和 MATCHED/OPEN；P-03/P-04 的结构输出不能替代真实行为输出。

### 出口

- 若 P-01 至 P-05 全部有原始输出且 public path、稳定 bounds、hit-test、scroll 测量与 global metrics 均可证：CP-0 MATCHED，进入 CP-1。
- 若任何一项不成立：IMPLEMENTATION_NOT_READY，停止，不进入 CP-1。

## 3. CP-1：固定画布声明与结构型 host contract

### 允许改动

- apps/terminal/ui/integration/sample-console/package.json 的 terminalSurfaces。
- apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts。
- apps/terminal/ui/integration/sample-console/src/index.ts：保留并同步 terminalSurfaces 的公开入口；若 shape 类型/解析符号改变，在本 CP 一并更新导出，不留旧 shape 旁路。
- apps/terminal/ui/integration/sample-console/test-expo/App.tsx：这是 sample-console Web 预览的生产入口，必须在本 CP 同步 createTestExpoApp 的新 shape 入参；不把它留给 CP-5。
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx：只做 terminalSurfaces 新 shape 的读取与诊断字段迁移，不在本 CP 接入 host transform。
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx：只做新 shape 的读取与 dev-host 自有 layout/overflow policy 接线，不在本 CP 完成几何算法重写。
- apps/terminal/ui/integration/sample-console/test/packageSurface.test.ts、apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx、apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx：同步 shape fixture 与断言输入；既有业务断言语义不变。
- apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx：同步其旧 1157×723/962×541 frame 与 logical-stage fixture；它是 sample-console 的直接 shape/基线消费者，必须在 CP-1 迁移，不得留到 CP-5。
- apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts：纳入 CP-1 的旧 shape/旧基线分母扫描并记录分类；其 `layout`/`scaleToFit` 是 dev-host 自有 geometry policy fixture，不是 terminalSurfaces package shape，具体迁移在 CP-5，不能因分类不同而漏扫。
- apps/terminal/ui/base/input/test/keyboardHeight.test.ts、virtualKeyboard.test.tsx、scrollArea.test.tsx、provider.test.tsx：纳入 CP-1 的旧数字分母并逐项分类；不把 input 包绑定到 sample declaration，平台无关的 962/541/1157/723 只改成中性行为 fixture，若某断言确实表达画布派生预期则按新 declaration 重算；断言语义不变。
- apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts、apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx：纳入 CP-1 的直接业务行为 fixture 分母；其中标记为 landscape PRIMARY/landscape confirm 的 frame 是固定画布消费者，分别同步到 PRIMARY 1280×800/SECONDARY 960×540；Android 副屏 1280×720 physical px / 213 dpi 只进运行证据，portrait 360×720 与 320×541 只保留合成边界行为，不得被写成 target hardware profile。
- apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts：纳入 CP-3 的启动诊断 fixture 分母；其 declared/measured 数字是合成 payload 输入而非设备事实，但必须同步到当前横屏声明/测量语义，保留事件序列和断言语义。
- apps/terminal/ui/base/render 内新增或调整 host controller 的类型与纯计算 foundation。

### 规则

1. landscape PRIMARY 固定为 1280×800 logical units（16:10），SECONDARY 固定为 960×540 logical units（16:9）；Android 副屏 1280×720 是 physical display 配置，不是声明值。
2. 1157×723、962×541 从声明、键盘基线、测试与文档中退役。
3. 结构为 orientation → surfaceKey → canvas declaration；不把 layout/scaleToFit 放回 package declaration。dev-host 的排列与 overflow 只由 dev-host 自有 policy 提供，CP-1 仅完成读取迁移，CP-5 再改几何实现。
4. portrait 不填数字，直到 Dexter 提供真实 target hardware profile；不得把横屏宽高转置。
5. `surfaceKey` 直接复用 `@catering-v2s/kernel-base-display-context` 的 `DisplayMode`；SurfaceHostSnapshot/SurfaceHostSource 只作为 render infrastructure 的结构型 source，不进入 DevicePort、PlatformPortBindings 或 root public business contract。
6. host controller 必须在 null snapshot 时保持未测量态，不渲染依赖尺寸的 canvas/keyboard，不 fallback 到 declaration/上一次 host。

CP-1 的 fixture denominator 由下表全量命中组成，不按“九组”或文件名预设分母；三包全部源码与入口、三包 test 树以及下列直接消费者均属于扫描范围，逐项记录分类与处置：

| fixture | 分类 | CP-1 处置 |
| --- | --- | --- |
| `apps/terminal/ui/integration/sample-console/test/packageSurface.test.ts` | 直接读取 terminalSurfaces shape 与声明值 | 同步 orientation → DisplayMode → canvas；旧值退役 |
| `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` | sample assembly 的 measured-frame/声明基线 fixture | 同步新的声明输入；断言语义不变 |
| `apps/terminal/ui/integration/sample-console/test/terminalSurfaces.test.ts` | parser 的 landscape 与 optional PRIMARY-only portrait 合成 fixture | landscape 使用 1280×800/960×540；其中 360×720 只验证 parser 形态，不是 portrait target hardware profile，不关闭 O-01 |
| `apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx` | 直接读取 sample Web host 的 shape、旧 frame 与 logical-stage 基线 | 在 CP-1 一并迁移；不得留下旧基线 |
| `apps/terminal/ui/integration/sample-console/src/index.ts` 第 5 行 | sample-console 的包公开入口，重新导出 terminalSurfaces | 保持唯一公开入口并同步新 parser/type；不能新增旧 shape 导出 |
| `apps/terminal/ui/integration/sample-console/test-expo/App.tsx` 第 2、9 行 | sample-console Web 预览生产入口，向 createTestExpoApp 传入 terminalSurfaces | 在 CP-1 同步新 shape 入参与类型；若 host options 变化，直接更新此入口，不保留兼容参数 |
| `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx` | dev-host 注入 terminalSurfaces 的直接 shape fixture | 同步新 shape；host geometry 行为留给 CP-5 |
| `apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts` | dev-host 自有 `layout`/`scaleToFit` geometry fixture，不是 package shape | CP-1 完成扫描和分类记录；CP-5 按 `width-fill-preserve-ratio` 迁移，不能退回 height-contain |
| `apps/terminal/ui/base/input/test/keyboardHeight.test.ts` | keyboard height 纯函数的 frame 行为 fixture；不应读取 terminalSurfaces | 逐个判断旧数字是画布派生预期还是中性 fixture；前者按新画布重算，后者改为命名的中性尺寸；不改变业务断言语义 |
| `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx` | VirtualKeyboard 的 frameWidth/height 渲染 fixture；不应读取 terminalSurfaces | 旧 surface 数字改成中性或由测试本身定义的尺寸；保留键位、区域、handler 与布局关系断言 |
| `apps/terminal/ui/base/input/test/scrollArea.test.tsx` | InputSurfaceFrame 自身 onLayout 与滚动行为 fixture；不应读取 terminalSurfaces | 用命名的中性 frame，CP-4 再叠加 scaleY/非零 offset 的真实坐标行为；不改变 scroll 结果断言的语义 |
| `apps/terminal/ui/base/input/test/provider.test.tsx` | InputSurfaceFrame/provider 的默认 frame 与 unsupported 边界 fixture；不应读取 terminalSurfaces | 用命名的中性 frame 或新画布派生 frame，逐项保留 unmeasured、supported、unsupported 行为断言；不把旧数字当作有效基线 |
| `apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts` | `landscape PRIMARY` 与默认 mount 的直接业务行为 fixture | 1280×800；portrait 360×720 保留为合成行为 fixture；既有 keyboard/action 断言语义不变 |
| `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` | 默认 mount 与 `landscape confirm` 代表 SECONDARY 顾客确认 surface；`landscape PRIMARY` 是显式 PRIMARY fixture | 默认/SECONDARY 使用 960×540、PRIMARY 使用 1280×800；320×541/portrait 360×720 仅作为边界/合成行为 fixture；既有 customer/member action 断言语义不变；默认值改变后若断言结果变化必须单列报告，不得调断言掩盖 |

该分母由 `apps/terminal/ui/integration/sample-console`、`apps/terminal/ui/base/dev-host`、`apps/terminal/ui/base/input` 三个包的全部 `src` 与入口源码、三包 test 树，以及上表列出的直接业务消费者，对 `terminalSurfaces`、`scaleToFit`、`1157|962|723|541` 旧数字和 surface/input layout fixture 的全量扫描产生，不按文件名猜测。`sample-console/src/index.ts`、`sample-console/test-expo/App.tsx` 与 `sample-console/test/terminalSurfaces.test.ts` 均是分母的一部分，不得因不在某个 `test` 目录或被误认为 synthetic 而排除。新增命中必须回到本表重新分类；未分类命中时 CP-1 不得闭合。input 测试不得为了消除数字而引入 sample-console 或宿主依赖。`apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts` 的合成 startup payload 在 CP-3 单独闭合，不得被当作设备运行证据。

### focused proof

- declaration parser 对两种方向、PRIMARY/SECONDARY、正数与缺失字段的测试；
- 纯函数对 Android scaleX/scaleY、Web `width-fill-preserve-ratio`、IME 除 scaleY 的测试；Web 正常/窄宽/短高均按 `scaleX=scaleY=viewport.width/stageWidth` 验证，高度不进入公式；
- negative control：将旧基线、Web height-contain、Web 非等比 scale、单一 Android scale、portrait 转置或 null fallback 注入，测试必须失败。

### 阶段对账

逐条把 JSON shape、所有现有消费者、解析符号、输出类型与详设第 3-4 节记录为 MATCHED/OPEN。CP-1 只有在 package、parser、sample assembly、dev-host 和已枚举测试 fixture 全部可编译/可读时才闭合；禁止把测试通过写成 Android 已运行。

### 为什么不把 shape 迁移拆到后续 CP

只改 package.json/parser 会立即让 sample assembly、dev-host 和它们的 fixture 继续读取旧字段，CP-1 无法编译；把声明变更后移又会让新旧 shape 在 CP-3/CP-5 之间并存，focused proof 无法确认唯一输入。故 CP-1 一次迁移所有直接消费者，但仅改读取 shape 与 dev-host 自有 policy 接线，不引入兼容层，也不提前实现 host transform。

## 4. CP-2：Android dual-screen adapter 的 per-surface snapshot

### 允许改动

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt。
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt。
- apps/terminal/adapter/android/dual-screen/src/implementations/ 下的 host source。
- 该 adapter 的 README/局部 focused tests。

### 设计实现

1. 在 Activity/Presentation 生命周期中创建 SurfaceHostRegistry entry，key 为既有 `DisplayMode`、displayId、windowIdentity、generation；不再定义新的 SurfaceKey 类型。
2. 先按 CP-0 既有 `primary-window-layout`、`secondary-presentation-window-layout`、`ime-root-layout` 的 IME 前后结果选择窗口行为分支；stable bounds 与 density 必须在同一 measurement context/同一次 snapshot 配对。current 收缩时使用显式 display-context → window-context 的 maximum metrics；current 不收缩时使用 owner decorView 与其 resources 的同次 layout snapshot。
3. current 若随 IME 改变，stable 走同源 maximum-metrics 分支；current 若不变，stable 走 host-ready decorView layout 的更小路径，并只在 rotation/display/config generation 变化时刷新。React surface context 必须使用 RN runtime 的共享 render density；target display hardware density 继续作为独立 diagnostics/系统窗口事实，不得按 surface 改写 RN shared metrics。
4. TerminalDualScreenModule 增加 async snapshot 与 host-changed event，复用现有 Expo module，不创建第二模块或第二 bridge。
5. event payload 做 key/display/window/generation 完整过滤；remove/destroy 清理旧 entry，不能以 PRIMARY 尺寸冒充 SECONDARY。
6. raw px、density、display id 只进 diagnostics；不扩张 DevicePort 或公共 TS port。

### focused proof

- 两个 surface key 正确匹配各自 display/window；
- stale generation、wrong display、missing bounds、density≤0 全部明确失败；
- 与 CP-0 选择的窗口行为分支一致：若 IME 改变 current，证明 current 变化而 stable 不变；若 edge-to-edge 下 current 不变，证明真实日志不变且错误地从后续 current snapshot 计算 scale 的实现会被 H-02 控制夹具击穿；
- adapter source 初读与事件顺序不会被旧事件覆盖。

### 动态出口

Android 真实运行证据必须区分 static/focused/Android；若 presentation context 或 max metrics 在目标 SDK上不成立，停止交 Dexter。

## 5. CP-3：JS SurfaceHostController 与 Android/Web 接线

### 允许改动

- apps/terminal/ui/base/render/src 的 SurfaceHostController、Canvas host component 或 foundation。
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx 的非业务 host 注入。
- apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts 的 source wiring。
- apps/terminal/assembly/android/sample-terminal/App.tsx 的 host source wiring（不改变业务 action）。
- apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts：同步 synthetic
  `startup.surfaces` 的当前横屏 declared/measured 输入；只改 fixture 数值，不改 startup
  事件序列、相关性、终态或 descriptor 断言语义。

### 规则

1. Android canvas 逻辑尺寸等于当前方向 declaration，transformOrigin top-left，scaleX/scaleY 分别按 stable host / canvas 计算。
2. host viewport fill parent；四边重合，不留边，不裁切；非等比形变允许但必须是整体变换。
3. Web 使用同一 declaration 与 host controller，采用已裁定的 `width-fill-preserve-ratio`：`scaleX=scaleY=previewContentRect.width/logicalStage.width`，高度按比例推导；viewport 高度不参与 scale，超高由可滚动内容区承载，不做 contain 或 browser 非等比 stretch。
4. InputSurfaceFrame 仍由自身 onLayout 测量，不能接收 scale、host snapshot 或 physical px。
5. source 未就绪时不渲染 keyboard，不猜尺寸，不保留旧 surface 状态。

### 结构与行为 proof

- 结构：依赖方向为 adapter → source → render host → assembly → input/business；业务源码无 Platform/density/Dimensions/screen-size 分支。
- 边界：复用 `@catering-v2s/kernel-base-display-context` 的 `DisplayMode`、`readDisplayInfo` 与既有派生；`onSurfaceHostChanged` 只通知 render infrastructure，不把屏幕事实交给业务 actor，不替代 TR-11 的 command 路径。
- 行为：Android 真实不同 scaleX/scaleY 配置下真实 tap 命中与视觉元素一致；不能用 props、调用次数或 mock callback 代替。
- 行为：startup.surfaces 的 measured frame来自 InputSurfaceFrame/真实 layout，而非 declaration emitter 自己回读。

## 6. CP-4：IME 单位与 content-local scroll

### 6.1 IME

1. 保留 TerminalImeInsetsCoordinator 的 target hardware-density conversion；这只是系统 IME 窗口事实到 owner logical 单位的转换，不是 React surface 的 render density 选择。
2. host controller 只计算 finalImeInset = bottomLogicalBeforeCanvasScale / scaleY。
3. scaleX、scaleY 的稳定性按 CP-0 选择的窗口行为分支在 IME show/hide 前后记录；current frame 可变化，也可在 edge-to-edge 手动 inset 模式下保持不变，但不得驱动 stable scale。
4. input 只收到 final logical imeInset；不新增 Dimensions、Platform 或 host scale读取。

### 6.2 scroll

按 CP-0 的 probe 结果选唯一公共路径：

- 若 measureLayout/onLayout 是 content-local：改 InputScrollArea 为同坐标系 delta；
- 若仍是 transformed window坐标：停机补设计，不在 input 内反向猜 scale。

focused fixture 必须具备 before offset≠0、scaleY≠1、实际多余内容与逻辑下沿+200，保存 request/actual onScroll 与字段可见性。

### 6.3 RD-10

测试文件仅允许因路径/source wiring更新 import；既有业务断言语义不得改。新增 proof 必须是结果型行为断言，不把调用一次、prop 值或字符串搜索当行为证明。

## 7. CP-5：Web preview 与装饰盒

### 允许改动

- apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts。
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx。
- dev-host focused tests。

### 动作

1. geometry 读取按方向分组的 declaration，使用明确的 `width-fill-preserve-ratio` policy；stageWidth 按既有 row/column 排列计算，`scaleX=scaleY=previewViewportRect.width/stageWidth`，`renderedHeight=stageHeight*scaleY`。
2. 删除含义不清的 height-contain 分支和 browser 非等比分支；若保留内部布尔参数，必须在本 CP 改名/收口为只表达该 policy 的配置，不得再以 `scaleToFit` 暗示按宽高 fit。记录 scaleX=scaleY、viewport、browser zoom/visualViewport.scale 与 CSS rect。
3. 将 styles.surface 的 border 从 measured canvas 外层移到 outline/绝对定位装饰层；InputSurfaceFrame 的盒不能少 2。
4. 保留现有 preview 排列，不将排列 gap/装饰尺寸写入 canvas declaration。
5. 明确 previewViewportRect 的 owner 是 SurfaceCanvas 内部不带 border 的 preview-viewport 节点（testID 为 testIdPrefix:canvas:preview-viewport），由实际 layout/ResizeObserver 提供可用 content rect；不得用 window.innerHeight、外框或固定高度计算 scale。若 renderedHeight 超出 viewport.height，由 dev-host 可滚动内容区承载完整 stage，禁止 `overflow:hidden` 截断。

### proof

- 正常 viewport、窄宽、短高、resize、主副同时显示，并记录 previewViewportRect、可用宽高、scaleX/scaleY 与最终 rendered rect；每次都验证 `scaleX=scaleY=viewport.width/stageWidth`、renderedWidth 等于 viewport.width，短高时通过滚动承载完整 stage，不留边、不裁切；
- border 打开/关闭时 canvas onLayout 不变；
- Web elementFromPoint 使用逻辑坐标乘当前 preview scale 后命中真实节点；
- 只搜 transform 字符串、只验 outer box 的负例必须不足以通过。

## 8. CP-6：文档、portrait 范围与测试基线回读

### 文档

CP-0A 已完成首轮文档语义同步；本 CP 不重新建立第二套基线，只对 CP-0A 的每个源码/文档锚点逐条回读并补齐实施后测试与 README 事实，删除残留的两套有效解释：

- surface-form requirements：声明是运行时固定画布输入；FORM-R2/R4/R5与 scale 禁令按 Dexter 最新裁定改写；
- keyboard visual redesign requirements 与 v2；
- input implementation design/plan 的旧高度表；
- apps/terminal/ui/base/dev-host/README.md：删除旧 width-only `scaleToFit` 有效解释，写成 `width-fill-preserve-ratio`（宽度铺满、比例保持、超高可滚动）；不得写 uniform contain 或 browser 非等比 stretch；
- dual-screen README 中复制主 Activity density 的旧说明；
- sample-console 与 sample-terminal README 的 source/host 边界说明。

### portrait

本轮只完成 landscape。portrait 没有 target hardware profile，因此只写 O-01 OPEN 与未来验证位置：不新增/修改 portrait declaration，不修改 `AndroidManifest.xml` 的 landscape 锁定，也不修改 `app.json` 的 landscape 默认；不以 landscape 证据声称竖屏支持。未来若获准开启 orientation，须另立范围记录 manifest/app.json 影响面、PRIMARY-only 拓扑和 keyboard 形态。

### 测试

- 更新声明基线相关测试；
- 新增 host controller/adapter/geometry/IME/scroll focused tests；
- 建立职责到测试矩阵：每个生产职责、状态转移、失败边界各绑定 behavior oracle；找不到 oracle 先补测试再拆生产代码；
- 测试断言语义与原业务行为逐条对账。

## 9. CP-6A：CP-7 前全批三维对账

CP-6 完成后、任何整体 Web/Android 运行前，必须重新逐条走需求、详设/IA、project-memory，检查行为、形态、位置、来源、限制、失败/恢复、焦点/命中与文案；不能把各 CP 结论相加。范围覆盖详设每一个源码锚点和计划每一个允许变更点，结论只能是 MATCHED 或 OPEN。

- 任一 landscape 范围内的 OPEN：先根因修复并重新对账，不得进入 CP-7；
- O-01 portrait 是已声明的范围外 OPEN，不允许被填成 MATCHED，也不阻塞横屏 CP-7；记录必须标注 `SCOPE_OUT_OF_ROUND`，且不得声称 F/竖屏通过；
- 本 CP 是开发阶段的全批三维准入，不以动态运行替代。

## 10. CP-7：生产与端到端证据

仅在设计获批、CP-0A 与 CP-0 到 CP-6、CP-6A 已闭合且取得后续运行授权后执行：

1. 编译/typecheck/focused test；
2. 七类 host/geometry/IME/scroll red fixture 与 negative control；
3. Web fresh run：正常与窄 viewport，记录 scaleX/scaleY、onLayout、elementFromPoint；
4. Android fresh run：PRIMARY/SECONDARY，记录 serial、displayId、分辨率、dpi、target context、stable/current logical bounds、scaleX/scaleY、IME、真实 tap；
5. 生产 bundle DCE：确认 dev-only raw diagnostics 不进入 production；
6. Android cleanup 与 Web runner cleanup 分开记录，cleanup 非 PASS 不闭合。

证据档位分开写：static、focused、Web、Android；任何“预期数字”不得写成运行结果。模型 red fixture FAIL 与生产源码 PASS/FAIL 分栏。

## 11. CP-8：运行证据回读与逐代码/详设对账

### 11.1 运行证据回读

CP-7 后重新回读 CP-6A 的全批三维对账，将真实 focused/Web/Android 原始输出附回相同条目；不得用 CP-7 结果反向放宽 CP-6A 的设计/代码要求。

### 11.2 逐代码与详设对账（独立交付闸门）

范围逐代码，不抽样，至少覆盖详设每一个源码锚点和计划每一个允许变更点。记录格式：

| code path | symbol/anchor | design clause | expected behavior | actual observation | evidence tier | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 仓库根相对路径 | 唯一符号或“第 X 行” | 详设章节/I-xx | 可观察事实 | 源码/原始输出 | static/focused/Web/Android | MATCHED/OPEN |

所有 landscape 范围内条目必须是 MATCHED 才能进入交付 brief。O-01 portrait 只能以 `SCOPE_OUT_OF_ROUND / OPEN` 单列，不能被写成 MATCHED 或竖屏完成。其余任一 OPEN：

- IMPLEMENTATION_NOT_READY
- DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED
- 保留 first failure，不得用后续绿结果覆盖。

此表不是 evidence hash-chain、package ledger 或已退役 compliance control，不记录 hash、批次身份或路径基线；它只是逐条把详设和实际代码对齐的可读记录。

## 12. 阶段三维对账模板

每个 CP 结束时追加一份：

| ID | requirement source | design clause | memory/standard | code/evidence | verdict | finding/status |
| --- | --- | --- | --- | --- | --- | --- |
| CP-x-01 | 仓库根相对路径+第 X 行 | 详设 §x/I-x | 规范路径+第 X 行 | 原始观察 | MATCHED/OPEN | 状态分类 |

不写“全部符合”这种不可逐条核验的总括语句。若需要 Dexter 决策，单列精确问题、已完成只读核查、最小选择与影响。

## 13. fresh 独立设计审查与交付

详设/计划完成后，由 fresh 独立子 agent 盲审：

- REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_REMEDIATION_20260908
- REVIEW_TARGET=DESIGN
- REVIEW_ROUND=1|2
- REVIEW_ROUND_LIMIT=2
- reviewerKind=INDEPENDENT_SUBAGENT
- 先读冻结输入与当前源码形成独立 verdict，再读作者材料；只读，不修改。

重点反证：

1. adapter snapshot 是否真正 per-surface、是否会把 current/maximum bounds 混淆；
2. JS host 是否真的统一处理且没有向 input 下发平台细节；
3. RN 0.86 public surface/transform/hit-test/measure 是否有未解决硬门；
4. IME 必须除 scaleY、scroll 必须同坐标系；
5. Web preserve ratio 与 Android nonuniform fill 是否互相矛盾；
6. portrait 是否被无来源数字伪造；
7. 是否存在更小的现有能力复用方案或不必要的第二桥/第二单位系统。

主 agent 逐条重开 finding；确认项才修详设/计划。第二轮必须声明 ROUND_FINAL_DECISION=SELF_DECIDED；不得召集第三轮，不能把作者收口写成独立 reviewer GO。

实施完成后，生成给 Dexter/Claude 的 implementation review brief，逐条区分 static、focused、Web、Android 证据；不得把设计 review 或模型 red fixture 写成运行 PASS。Web policy 作为已裁定行为写明，portrait O-01 以范围外 OPEN 显式保留。

### 13.1 Claude implementation review brief 固定字段

brief 必须直接包含以下可复制内容，而不是仅给文件链接：

1. 背景与目标：Android/Web 固定逻辑画布、per-surface host snapshot、横屏范围、Web `width-fill-preserve-ratio`；
2. 当前源码、详设、实施计划、逐代码/详设对账表与原始输出的仓库根相对路径；
3. 逐条核验重点：P-01～P-05、Android hardware/render density 分离、scaleX/scaleY、IME 除 scaleY、content-local scroll、Web 宽度铺满/比例保持/真实 elementFromPoint、RD-10 断言语义、没有第二 bridge/host/public port 扩张；
4. 证据档位：static、focused、Web、Android 分栏；模型 red fixture FAIL 与生产源码 PASS/FAIL 分栏；每条注明 fresh、surfaceKey、display/window identity、scaleX/scaleY、模拟器分辨率与 dpi；
5. O-01 portrait=`SCOPE_OUT_OF_ROUND / OPEN` 的精确卡点，明确横屏交付不声称竖屏完成；
6. 期望结论格式：`VERDICT=GO|NO-GO`、`M=n / S=n / N=n`；每条 finding 给根相对路径和第 X 行、失败场景、影响面、最小修复、是否需要 Dexter 裁决；
7. 授权边界：Claude 只做只读静态 implementation review，不修改文件、不运行 Android/Web、不启动 DEV、不 seed、不做 UAT 或部署。
