# TER 虚拟键盘优化 · 实现静态复核（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/3/1
```

```text
本 verdict 只针对下列当前字节，不沿用此前任何设计、复盘或独立子 agent 的 verdict。
reviewedSourceSha256（前 16 位）:
  input/src/components/InputSurfaceFrame.tsx          9496ec102e2cc8c4
  input/src/components/InputScrollArea.tsx            448cf8bdb5f4265e
  input/src/components/InputKeyboard.tsx              4ebb2bb5b6e9c7d0
  input/src/components/VirtualKeyboard.tsx            72249a51b29079f4
  input/src/foundations/keyboardPresentation.ts       ad85706b4133a360
  input/src/hooks/useInputFocusController.ts          e3bd806582774d34
  input/src/hooks/useInputField.ts                    03aa757ae7382336
  console-assembly/src/foundations/consoleAssembly.tsx 2c7a45338d25ea34
  render/src/components/SurfaceRoot.tsx               0f6872026b5279f8
  render/src/components/LayerStack.tsx                539fbae7dece17fe
  （路径均相对 apps/terminal/ui/base/；详设当前字节 a7635c63a35d51e1）
EVIDENCE_TIER=仅静态：由 Claude 回读源码与正本；未运行任何测试、类型检查、构建、Web、设备或截图
FOCUSED=作者报告 PASS（input 96、console-assembly 15、sample-console 52、sample-wallpaper-console 26，四包 typecheck），Claude 未复跑
WEB / ANDROID=USER_OBSERVED_ONLY（Dexter 手工体验通过），不是仓内机器证据
VISUAL / BUSINESS / CLEANUP=本轮不采集，见 L3
SESSION=CONTINUED_SESSION；WRITES=仅本文件
AUTHORITY=只做静态代码复核；不授权改代码或测试、扩大功能、改键盘或业务语义，也不把手工体验或 focused PASS 升级为视觉或业务验收
```

## 1. 结论

性能与生命周期方面，大部分都做对了：
- 动画全部是 native driver 驱动的插值，没有逐帧 JS 回调；
- 输入包内没有定时器，也没有新增监听器；
- 高度缓存有界；
- 滚动请求带代际，旧的异步测量回来会被丢弃；
- 字段注销时会清理注册表和待提交状态；
- 调试日志删干净了，startup、display、error 日志都还在。

挡住 GO 的是三个在手工体验路径上不一定出现、但静态可以确证的问题：
- **S-1：** 输入框架被移到画布缩放层之外，宿主缩放比例不为 1 时单位错配；
- **S-2：** 动画 effect 依赖输入状态，状态一变就把进行中的动画从 0 重放；
- **S-3：** 滚动回读没有收敛兜底，待提交焦点可能卡住。

## 2. 核实成立

- **高度缓存有界、不会错误复用。** `InputSurfaceFrame.tsx:479-494`:缓存键是"布局:宽:预期高度",surface 宽高一变整表清空；
  一代之内最多四种布局各一条。写入只发生在 measure 阶段。另有一处无害的小瑕疵：写入键用的是当时的 `state.height`,可能与
  incoming 布局不一致，但这样的键永远不会被读到，也随代际清空。
- **动画没有 listener/timer 泄漏。** 所有进行中的变换都是 `progress.interpolate`(第 704-801 行),非 Web 平台走 native driver
  (第 658-663 行);完成回调按 serial 丢弃过期结果(第 670-673 行);卸载时停止动画并清空计划中的滚动(第 698-702 行)。
  input 包内没有 `setTimeout`、`setInterval`、`requestAnimationFrame` 或新增 `addListener`。
- **交接轨迹正确。** `keyboardPresentation.ts:35-123` 按遮挡高度进度参数化内容位移，两个平台拐点都进了插值断点，
  近等高走 0.5 容差分支并补了上限交点；轨迹最多五六个点。
- **滚动请求的代际正确。** `InputScrollArea.tsx:41-58, 65, 93, 140`:每次请求、视口尺寸或内容高度变化都会递增序号，过期的异步
  测量不会应用，也不会滚动；计划中的滚动只有一个槽位，开始、取消或退出时清空。测量符合契约：视口相对框架根测，字段相对
  scroll content 测，再与 onScroll 回读的偏移合成，不跨 ScrollView。
- **没有每帧重建。** `VirtualKeyboard` 为 `memo`,按键 handler 在 `useMemo` 里；滚动回调每帧只更新 ref,不 setState
  (`PrimitiveScrollView.tsx:69-74`)。字段测量 effect 会随状态变化重跑，但被 `setFocusTargetState` 的 0.5 容差去重挡住，
  最终收敛。
- **注册表会收敛。** `useInputFieldRegistry.ts:51-66`:注销时删除注册条目，清除匹配的待提交状态并通知重算。
- **调试日志清理到位。** input、console-assembly、render 与两个 integration 的源码里，`InputDiagnostic`、`onDiagnostic`、
  `reportDiagnostic`、`console.log` 均为 0 处。`consoleAssembly.tsx` 保留 `startup.surfaces`(2 处)、`startup.device`、
  `startup.ready-dispatch`(3 处)、`startup.runtime-facts`、`display-diagnostics`(3 处)、`runtime.lifecycle` 与 2 处
  `logger.error`。
- **键位与当前正本一致。** full 四行、十个 Shift 符号、无 CAPS;alpha 为"`a` 左侧 Shift、`z` 左侧 Space"(需求第 42、116 行，
  IA 第 34-35 行，详设第 51 行已如此修订);外框 `borderRadius: 0`(`VirtualKeyboard.tsx:168`),dock token 已去掉圆角与限宽
  (`primitives/src/theme/tokens.ts:116`)。

## 3. Findings

### S-1 · 输入框架被移到 SurfaceHostController 的画布缩放层之外，宿主缩放比例不为 1 时，避让计算与平移单位错配 · CONFIRMED（代码路径）· 需 Dexter 裁决：否

**位置**:
- `console-assembly/src/foundations/consoleAssembly.tsx:734-777`:`ConsoleSurfaceInputFrame` 现在包在
  `RenderProvider → SurfaceRoot` 外面，`renderContentFrame` 只包 `AdminLauncher`;
- `render/src/components/SurfaceRoot.tsx:112-116`:`SurfaceHostController` 在 SurfaceRoot 内部包住内容；
- `render/src/components/SurfaceHostController.tsx:124-139`:画布按 `scaleX/scaleY` 缩放；
- `render/src/foundations/surfaceHost.ts:131`:缩放比例 = 宿主逻辑尺寸 / 声明画布；
- Android 装配为两屏都接了宿主源(`apps/terminal/assembly/base/android/src/foundations/androidPlatform.ts:57-59`)。

**事实**:
- 框架的 onLayout 宽高、键盘覆盖层、hit shield,都在缩放层**之外**,是宿主单位；
- 字段、视口用 `measureLayout` 测量时不含 transform,得到的是画布单位；
- 内容平移发生在 SurfaceRoot 内部，也就是缩放层**之内**,屏幕上的实际位移 = offset × scaleY。

**反例**:宿主 1920×1200、画布 1280×800,缩放比例 1.5。字段中心的画布坐标为 700 时，按公式算出 offset=−223,屏幕上实际上移
约 334,超过屏幕上的键盘高度 246,内容底下露缝，中心也不在目标线上。缩放比例 0.9(1280×720)时则上移不足，字段可能被部分遮挡。

**为什么手工体验没暴露**:
- Web 的宿主源尺寸就是声明画布(`ui/base/dev-host/src/components/testExpoApp.tsx:800-806`),比例恒为 1;
- 两台虚拟机的物理分辨率恰为画布的 2 倍(2560×1600 对 1280×800、720×1280 对 360×640),若设备密度为 2,比例也是 1
  (推论，未核实设备密度)。

**影响**：凡是逻辑分辨率不等于声明画布的真机，都会出现焦点居中和位移上限错误；键盘键帽按宿主尺寸计算，与缩放后的内容视觉
比例也不一致；`startup.surfaces.measured` 日志现在报告的是宿主尺寸。

**first failure / LKG / broken boundary**:
- first failure:`consoleAssembly.tsx:734` 把输入框架移出了画布；
- LKG:此前 `ConsoleSurfaceInputFrame` 位于 `renderContentFrame` 内，框架、键盘与内容同处画布、同一单位；
- broken boundary:input 几何(宿主单位)与 render 画布缩放(画布单位)之间。

**与详设的关系**：详设 §4.5 写的是"assembly 只把既有 content 交给 InputSurfaceFrame",实现的装配层级与之不同；详设也没有说明
输入框架与画布缩放的单位关系，因此同时登记为 DESIGN_GAP。

**最小修复**:
- 把 `ConsoleSurfaceInputFrame` 移回 `renderContentFrame` 内；
- SurfaceRoot 改由 `content` 内部的一个子组件读取偏移(它渲染在 provider 之下，能读到 context),而不是在 SurfaceRoot 函数体
  里读——这正是详设"presentation wrapper"的形态；
- 补一个 focused 测试：宿主源尺寸不等于画布时，断言测量、H、K 同一单位，且屏幕位移不超过 K。

在 input 里按缩放比例手工换算单位不是更小的方案：它会把缩放知识扩散到 input,也偏离了详设。

### S-2 · 动画 effect 依赖输入状态回调，状态一变就把进行中的动画从 0 重放 · CONFIRMED（代码）/ 视觉影响 PLAUSIBLE · 需 Dexter 裁决：否

**位置**:`InputSurfaceFrame.tsx:647-696`。effect 依赖含 `finishPendingPresentation`,而后者(第 467-478 行)依赖
`state.owner`、`activeFieldId`、`blockedFieldId`、`blockedCapacity`;effect 体无条件执行 `stop()`、`progress.setValue(0)`,
再重新 `start()`。

**反例**:
1. 键盘正在退出时点另一个字段：`preflightFocusTarget` 或 `handleFocus` 改变了 `blockedFieldId`/`owner`,effect 重跑，退出动画被
   重置到 0,键盘瞬间回到完全升起，随后才被 `retargetPresentation` 的冻结接管。
2. 快速 A→B→C:reposition 或 handoff 进行中，`activeFieldId`/`blockedFieldId` 变化，同样重放。

原生端 `stopAnimation` 的取值请求排在 `setValue(0)` 之前，冻结值大概率仍正确，但重放的几帧会闪回起点(推论);Web 端在同一次
提交里先完成冻结，可能看不到。

**影响**:违反需求 VK-R07"以当前可见状态转向新的目标，不叠加过期动画，不跳变";每次重放还会多挂一个无效的 timing。

**first failure / LKG / broken boundary**:
- first failure:第 692 行的依赖 `finishPendingPresentation`;
- LKG:依赖只有 phase/serial 与稳定回调时的同一 effect;
- broken boundary:动画时钟与输入 owner 状态之间。

**最小修复**:把 `finishPendingPresentation` 放进 ref(每次渲染更新 `ref.current`),完成回调经 ref 调用，effect 只依赖
phase、serial 和稳定回调；补一个 focused 测试：动画中改变 owner/blockedFieldId,断言同一 serial 不会再次 `setValue(0)`。

### S-3 · 滚动回读没有收敛兜底，待提交焦点可能卡在不可输入的交接态；Web 上点外部也无法退出 · CONFIRMED（代码路径）· 需 Dexter 裁决：否

**位置**:
- `InputScrollArea.tsx:124-142, 183-210`:需要滚动时只写入 `readbackRef`,结果只在 `onScrollOffsetChange` 里判定，完全可见
  判成功，恰好到达目标才判失败；
- `InputSurfaceFrame.tsx:467-478`:待提交字段必须等到 `focusReadyFieldRef` 等于它自己才提交；
- 第 390-404 行：成功回报只在 settled 后提交；
- 第 774-801、836-841 行:enter/handoff 阶段键盘不可交互，且有 hit shield;
- 第 460-466 行:Web 上待提交期间忽略一切点击外部；
- `useInputFocusController.ts:142`:首次弹出同样走待提交。

**反例**:InputScrollArea 里的字段需要滚动，动画期间用户拖动了滚动区，最终偏移既不等于目标、字段也不完全可见；或者目标只差
亚像素，滚动宿主没有产生 onScroll 事件。此时回读永不结束，焦点永不提交，键盘停在 settled 的 enter/handoff:键帽不可按，
键盘区被 shield 吞点。Web 上点外部也被忽略，只能点另一个输入框退出。

**影响**：边缘路径，但一旦发生就是卡死。详设 §4.3 最后一句要求"动画结束时核对 scroll readback 与最终焦点框；未达到可见条件按
容量/滚动失败恢复",实现缺这一步。

**first failure / LKG / broken boundary**:
- first failure:`InputScrollArea.tsx:139-142` 只把结果交给未来的 onScroll;
- LKG:不需要滚动的分支(第 133-137 行),它会同步判定；
- broken boundary:滚动宿主事件与呈现完成门之间。

**最小修复**(不引入定时器):
- enter/handoff 动画完成、settled 时，若 incoming 字段的回读仍未结束，用当前 scroll 偏移立即评估一次可见性，判成功或失败；
- Web 的待提交点击保护只放过落在待提交字段自身锚点上的点击，不再忽略所有外部点击。

### N-1 · 每次进入、交接、退出都会把键盘整层卸载重挂；非交互时 onKey 每次渲染新建，使 VirtualKeyboard 的 memo 失效 · CONFIRMED · DESIGN_GAP

**位置**:
- `InputSurfaceFrame.tsx:844`:layer key 为 `${fieldId}:${layout}:${suffix}:${index}`,见第 733-771 行。measure 阶段 incoming
  的 suffix 为 `measure`,到 enter/handoff 变为 `active`;handoff 中 outgoing 的 index 从 0 变为 1;display 变 measure 或 exit 时，
  suffix 从 `active` 变为 `outgoing-0`。每次阶段切换，键盘都会被卸载后重新挂载。
- `InputKeyboard.tsx:57`:非交互时传 `() => undefined`。

**影响**:
- 一次异布局切换大约挂载四次整把键盘(每把约 40 个按钮),原生端交接开始前 JS 线程会多出一段渲染；
- 过渡期间的每次状态变化，都会让非交互键盘整层重渲染。

这些不是逐帧开销，也不影响正确性。

**修法**:
- key 按角色稳定下来，例如 incoming 固定为 `incoming:${fieldId}:${layout}`,outgoing 按 fieldId,不带下标和阶段后缀；
- 用模块级 noop 替代每次新建的空函数。

## 4. SAME_ROOT_SCAN

- **S-1(单位同根)**:共 7 项，全部同根——`useInputField` 相对框架根的测量、`InputScrollArea` 视口测量、PIN visible anchor 测量、
  `presentFocusRect` 用的 H 与 K、键盘覆盖层尺寸、hit shield、focus-visibility 提示层；另有 `startup.surfaces.measured` 日志
  语义随之改变。
- **S-2**:三个 layout effect 中只有动画 effect(第 647 行)受影响；主 effect(第 540 行)本就应响应状态，滚动 effect
  (第 640 行)依赖稳定。
- **S-3**:提交路径两条(`finishPendingPresentation`、`reportFocusVisibilitySuccess`)都依赖回读；不经滚动的字段(`useInputField`
  直接测量)在回调内同步判定，不受影响；Web 点击保护 1 处。
- **N-1**:measure、enter、handoff、exit 四个阶段的 key,加 `InputKeyboard` 的 noop,共 5 处。

## 5. DESIGN_GAPS

- 详设没有定义输入框架相对 `SurfaceHostController` 画布缩放的位置与单位(S-1 的根)。
- 详设的性能契约没有覆盖渲染层稳定性(key 稳定、memo 不被 props 击穿)(N-1)。

## 6. 按评审标准收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/3/1
L1_ENGINEERING=S-1(画布缩放单位错配)；S-2(动画 effect 重放)；S-3(滚动回读无收敛兜底)；N-1(阶段切换重挂、memo 击穿)。
  高度缓存、listener/timer、滚动代际、注册表收敛、调试日志清理与必要日志保留均核实成立。
  sample-console 的并行 5000ms 超时按作者诊断记为并行资源假失败，Claude 未复跑，不作源码回归结论。
L2_USER_VISIBLE=与当前需求/IA 一致：full 四行、十个 Shift 符号、alpha 的 Shift/Space 位置、无 CAPS、外框直角、全宽；
  S-1 在缩放比例不为 1 的真机上会破坏"焦点居中与位移上限"，S-2 违反"不叠加过期动画、不跳变"，S-3 可能留下不可输入状态。
L3_UNVERIFIED=19 个 IA 帧逐控件视觉；双屏 PRIMARY/SECONDARY 与 mobile 的逐帧交接；缩放比例不为 1 的真机表现；快速连续切换
  与退出中点击；滚动中被用户打断的回读；业务提交与 cleanup。Dexter 手工体验为 USER_OBSERVED_ONLY。
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=见 §5
EVIDENCE_TIER=static=Claude 回读；focused=作者报告未复跑；Web/Android=USER_OBSERVED_ONLY；visual/business/cleanup=NOT_RUN
```

本结论只评审当前代码的静态实现，不授权任何修改、功能扩大、键盘或业务语义变更，也不把手工体验或 focused PASS 升级为视觉或
业务验收。
