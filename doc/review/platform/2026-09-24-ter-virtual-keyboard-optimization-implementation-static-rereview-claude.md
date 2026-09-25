# TER 虚拟键盘优化 · 实现静态复核第二轮（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=0/2/2
```

```text
本 verdict 只针对下列当前字节，不沿用上一轮结论：
  doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-review-claude.md
reviewedSourceSha256（前 16 位，路径相对 apps/terminal/ui/base/）:
  input/src/components/InputSurfaceFrame.tsx           f79c84fa5a17fd78
  input/src/components/InputScrollArea.tsx             6b997a922b0b3c33
  input/src/components/InputKeyboard.tsx               4e8cd5184fc3d38f
  input/src/contexts/InputSurfaceGeometryContext.tsx   23b22e5f991da360
  input/src/hooks/useInputFocusController.ts           e3bd806582774d34
  input/src/hooks/useInputField.ts                     cc9f772a978ce267
  input/src/foundations/scrollIntoView.ts              6499eb492a684595
  input/src/foundations/keyboardPresentation.ts        ad85706b4133a360
  console-assembly/src/foundations/consoleAssembly.tsx 05f36a6b14ea2da1
  render/src/components/SurfaceRoot.tsx                d21351ab0e10c3ba
  render/src/components/LayerStack.tsx                 539fbae7dece17fe
  primitives/src/vendor/slots.tsx                      80b22c7263e2419c
  input/test/provider.test.tsx                         dafaadf36db72047
  input/test/scrollArea.test.tsx                       abeb8f59bb3325fa
  render/test/renderSurface.test.tsx                   d292c8109ef7a763
详设：doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md（6e7476755dfff674）
作者处置：doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-review-response-codex.md
EVIDENCE_TIER=仅静态：Claude 回读源码、测试、详设，以及 apps/terminal/node_modules 中 react-native、react-dom、react-native-web 的源码；
  未运行任何测试、类型检查、构建、Web、设备或截图
FOCUSED=作者报告 input 100/100、render 100/100、console-assembly 15/15、三包 typecheck PASS，五项红变异首次红；Claude 未复跑
WEB / ANDROID=本轮 NOT_RUN；此前 Dexter 手工体验为 USER_OBSERVED_ONLY，且早于本轮修改
VISUAL / BUSINESS / CLEANUP=NOT_RUN
SESSION=CONTINUED_SESSION（v2s 仓根会话，经上下文压缩续接，不是 fresh acceptance）；WRITES=仅本文件
AUTHORITY=只做静态代码复核；不授权改代码或测试、动态运行、设备操作，
  也不把 focused、typecheck 或手工体验升级为 Web、Android、视觉或业务验收
```

## 1. 结论

上一轮四项里，S-1、S-2 修对了，Web 点击保护也收窄对了。挡住 GO 的是本轮新引入的两个问题：

- **S-1：** 滚动回读固定在 250ms 动画结束时判定。平台滚动动画不保证在这之前结束，没滚完就会被误判为“焦点框无法完整显示”，并退出输入。
- **S-2：** 改成按角色定 key 后，快速往返切换（A→B→A→C）会出现两个同 key 的 outgoing 层。React 对重复 key 的行为不作保证，Web 上可能残留一层旧键盘。
- **N-1：** 第 1 项（输入框架位于画布内）没有能红的测试；render 测试里有一条恒真断言。
- **N-2：** 这个功能还没有 TR-16 要求的两端证据（先 Expo Web，再设备，同一份场景清单逐场景对照），最终 GO 之前必须补齐。初稿漏核这一项，定稿时补入。

**我的自报：** 这两处缺陷都出自我上一轮给的修法，不是实现走偏。
- 上一轮 S-3 的“最小修复”写的就是“动画完成时用当前 scroll 偏移立即评估一次”；
- 上一轮 N-1 写的是“outgoing 按 fieldId，不带下标”。

作者照做了。问题在于我当时写了自己没有验证过的修法。

## 2. 七项逐条核验

### 第 1 项 · ConsoleSurfaceInputFrame 位于 SurfaceHostController canvas 内 — 成立

- `consoleAssembly.tsx:751-771`：`SurfaceRoot` 的 `renderContentFrame` 返回 `ConsoleSurfaceInputFrame`，里面包着 `AdminLauncher`；
- `SurfaceRoot.tsx:114-118`：`framedContent = renderContentFrame?.({content})`，再整体放进 `SurfaceHostController`。

因此输入框架在画布缩放子树内，测量、K、offset、hit shield 都用画布逻辑单位，上一轮 S-1 的 LKG 已恢复。但它被移出画布时没有测试会变红，见 N-1。

### 第 2 项 · SurfaceRootContent 在 provider 下读取 offset — 成立

- `SurfaceRoot.tsx:13-24`：`SurfaceRootContent` 第 14 行调 `useSurfacePresentationOffset()`，第 17 行把它用作 translateY；
- 第 114 行的 `content` 作为参数传给 `renderContentFrame`，外面包着 `InputSurfaceFrame` 的 `SurfacePresentationOffsetProvider`；
- `LayerStack.tsx:101` 自己读同一个 offset（本轮未改，哈希与上一轮相同），同样在 provider 下；
- `renderSurface.test.tsx:362-399`：host 800×600、canvas 960×540，断言画布缩放，并断言 translateY 取自 provider 的值。作者的变异（provider offset 置 0）能让它变红。

### 第 3 项 · 同一 serial 内 owner/blocked 变化不会重置 progress — 成立

- 动画 effect（`InputSurfaceFrame.tsx:669-722`）的依赖只有：
  - `animationPhase`、`animationSerial`（第 660-661 行）；
  - `progress`；
  - 四个空依赖的稳定回调：`setPresentationState` 第 255 行、`assignPresentationOffset` 第 259 行、`startScheduledScrollFor` 第 276 行、`settleScrollReadback` 第 290 行。
- 完成回调通过 `finishPendingPresentationRef`（第 499-500 行）调用最新闭包。
- `provider.test.tsx:581-606`：enter 中途提交 pending，断言没有任何 `setValue(0)`。

### 第 4 项 · 滚动回读在动画完成时收敛 — 收敛成立，但判定时刻错误，见 S-1

- 完成回调第 697-705 行：第 699 行先 `settleScrollReadback`，再在同一 serial 上置 settled，并调 `finishPendingPresentationRef`；
- `InputScrollArea.tsx:68-72`：以 `'scroll-settled-before-visible'` 为失败原因评估，所以结果一定是成功或明确失败；
- 失败走 `reportFocusVisibilityFailure`（第 390-401 行）：dismiss、blur，并显示提示；
- 卸载时清理：第 724-729 行，`InputScrollArea.tsx:230-232`。

Web 点击保护（第 476-486 行）只放过待提交字段自身的目标，其余点击都会 dismiss。

我还追了“pending 期间点另一个输入框 C”这条路径，结论是正常，不列 finding：
- Web 上 `slots.tsx:61` 把 `onPressIn` 当 `onClick` 传下去；RNW 0.21.2 的 TextInput 会把 `onClick` 转给 DOM（`react-native-web/dist/exports/TextInput/index.js:52` 的 `forwardPropsList` 含 `clickProps`）；
- `useInputField.ts:192-195` 先 `stopPropagation`，所以框架的 onClick 不会触发；接着 `preflightFocusTarget(C)`，由 `useInputFocusController.ts:83-89` 把 pending 换成 C；
- mousedown 时触发的 `handleFocus(C)` 会在第 131 行被忽略，但 click 上的预检会补上。

### 第 5 项 · layer key 与 passive noop 稳定 — noop 成立；key 在 measure→enter/handoff 稳定，但可能重复，见 S-2

- `InputKeyboard.tsx:30, 59`：使用模块级 `noopKeyboardKey`。
- incoming 层在 measure、enter、handoff 三个阶段的 key 都是 `incoming:${fieldId}:${layout}`（第 765、774、781 行），测量用的实例就是入场的实例。
- 角色切换时仍会重挂一次：enter→display（incoming→active），display→measure/exit（active→outgoing）。
  - 这是我上一轮建议的“按角色”方案本身带来的；
  - 只在静止时挂载一次，不影响正确性；
  - 本轮不列 finding。

### 第 6 项 · 红变异能让 focused 用例失败 — 四项成立，第 1 项缺红

- S-2：`provider.test.tsx:581-606`。恢复不稳定依赖会多出 `setValue(0)`，能红。
- N-1 key：第 608-630 行。按 test renderer 实例身份比较，key 只要带阶段就会重挂，能红。
- N-1 noop：第 632-646 行，能红。
- S-3：`scrollArea.test.tsx:200-219`。删掉 settle 就不出现错误提示，能红。
- S-1：作者的变异是把 provider offset 置 0，只覆盖第 2 项；第 1 项缺红，见 N-1。

### 第 7 项 · 不把本轮结果升级为验收 — 成立

作者处置写明 Web、Android、视觉、业务、cleanup 本轮都是 NOT_RUN。本文同样只作静态结论。TR-16 的两端证据见 N-2。

## 3. Findings

### S-1 · 滚动回读固定在动画结束时判定，平台滚动没结束就误报失败 · 逻辑 CONFIRMED / 发生概率 PLAUSIBLE · DESIGN_GAP · 需 Dexter 裁决：否

**仓内事实：**
- 滚动与 progress 同时发起：`InputSurfaceFrame.tsx:687-692` 先 `startScheduledScrollFor`，再 `animation.start`。滚动本身是 `scrollTo({y, animated: true})`（`InputScrollArea.tsx:173-176`）。
- progress 固定 250ms（第 682 行），完成时用当前 offset 强制判定（第 699 行 → `InputScrollArea.tsx:68-72`）。
- 目标 offset 按最小 delta 计算，正好让字段边缘贴住可见带边缘（`scrollIntoView.ts:84-91`）。
- 可见判定没有容差（`scrollIntoView.ts:59-61`）。
- 判定后回读立即清除（`InputScrollArea.tsx:63`），迟到的 onScroll 救不回来。

所以完成时 offset 只要比目标少一点点，就会判失败：显示“焦点框无法完整显示，请调整窗口尺寸或退出输入”，然后 dismiss 并 blur（第 390-401 行）。用户得再点一次才能输入。

**外部事实：**
- CSSOM View 规范把平滑滚动的时长交给浏览器决定，不保证 250ms 内结束。
- Android 平滑滚动的时长，以及它与 native-driver 动画谁先开始，Claude 没有核实（UNVERIFIED）。
- 即使两边都是 250ms，完成回调和最后一次 onScroll（节流 16ms，`primitives/src/components/PrimitiveScrollView.tsx:74`）谁先到 JS 也没有保证。

**推论：**
- Web 与 Android 都可能发生，概率取决于滚动距离和平台。
- 还有次要的一面：零容差与“到达目标”的 0.5 容差不一致。以下两种情况同样会判失败（PLAUSIBLE）：
  - 平台取整后偏移少了不到 0.5；
  - 所需 delta 落在 (0, 0.5] 区间，平台没有滚动（`InputScrollArea.tsx:166` 用的是严格相等）。

**测试：**
- `scrollArea.test.tsx:200-219` 把“已发出滚动、动画结束前没收到 onScroll”断言为失败。这正是“还在滚”的形态，等于把竞态写成了规格。
- 第 170-198 行只覆盖“结束前已到达目标”。

**DESIGN_GAP：**
- 详设第 96 行要求“必要滚动已结束且 readback 证明 B 全框可见”后才提交；
- 详设第 102 行写“动画结束时核对 scroll readback”，默认滚动与 progress 同时结束，但只约束了同时开始，没约束时长；
- 详设没有定义“滚动已结束”靠什么信号观测。

我上一轮照第 102 行写了修法，没有核实平台的滚动时长。

**first failure / LKG / broken boundary：**
- first failure：`InputSurfaceFrame.tsx:699` 在动画结束时强制 `settleScrollReadback`；
- LKG：不需要滚动的分支（`InputScrollArea.tsx:166-171`），以及结束前已到达目标的路径（第 220-228 行）；
- broken boundary：呈现时钟与平台滚动动画之间。

**验收判据（必须能逮住本条）：**
- 新增 focused 用例，步骤如下，期望提交成功，没有错误提示，也没有 blur。按现有代码它会在第 3 步判失败，所以会红。
  1. 发出滚动；
  2. 动画完成前，送一个还没到目标、字段仍不可见的中间 onScroll；
  3. 推进到动画完成；
  4. 送到达目标的 onScroll。
- 保留上一轮的收敛要求：用户拖动后停在不可见位置，或完全没有 onScroll，都必须最终明确收敛，不能卡在 pending。
- 偏移与目标相差不超过 0.5 时，不得只因这点差值判失败。
- 第 200 行的用例按新语义重写。

**修法边界：**
- 本轮不再指定具体修法。“滚动已结束”用什么信号判断，由 Codex 先在详设里定，再落到实现。可选信号包括：到达目标、滚动事件停止、有界等待、改为非动画滚动。
- 如果改为非动画滚动，会改变详设第 102 行的视觉语义，要先回详设。
- 只放宽容差这个更小的方案不够，解决不了“还在滚”的情况。

### S-2 · 快速往返切换产生重复的 outgoing key · 重复 CONFIRMED / React 行为 CONFIRMED（源码）/ Web 残留层为推论 · 需 Dexter 裁决：否

**仓内事实：**
- outgoing 层的 key 只有 `outgoing:${fieldId}`，measure、handoff、exit 三处都一样（`InputSurfaceFrame.tsx:764、789、796`）。
- `retargetPresentation` 中断时，把所有可见层（包括 outgoing 和 incoming）冻结成新的 outgoing（第 369-374 行），只过滤掉完全不可见的层（第 371 行）。
- `samplePresentation` 的 handoff 分支会同时返回全部 outgoing 与 incoming。

**反例：**
1. A（l1）→B（l2）交接途中点回 A：冻结出 outgoing [A 旧, B]，incoming 为 A 新。
2. 第二次交接的早期再点 C（或 B）：冻结出 outgoing [A 旧, B, A 新]，其中有两个 `outgoing:A`。

详设第 94 行明确支持动画中的 A→B→C 重定向，所以这是设计内的路径。

**React 事实**（仓内 `apps/terminal/node_modules`，React 19.2.3）：
- 重复 key 走 `mapRemainingChildren`（`react-native/Libraries/Renderer/implementations/ReactFabric-prod.js:2516-2523`）：靠后的同 key fiber 会覆盖前一个。
- 收尾时只删除 Map 里剩下的项（第 2878-2905 行），被覆盖的那个 fiber 既不复用也不删除。
- measure 列表是 outgoing 在前（第 763-770 行），handoff 列表是 incoming 在前（第 780-792 行）。换序必然走 Map 路径。
- react-dom 19.2.3 开发版遇到重复 key 会报错，原文说明这种情况“may cause children to be duplicated and/or omitted”（`react-dom/cjs/react-dom-client.development.js:6605`）。

**推论（未运行验证）：**
- Web（react-dom，变更式提交）：旧层的 DOM 节点不会被移除，屏幕底部可能一直残留一条旧键盘，直到框架卸载。
- Fabric：宿主子树按 fiber 重建，旧视图大概率会消失，但它的卸载清理不会执行，造成泄漏。
- 在 Expo Web 开发模式下，两种情况都会打出重复 key 的错误。

**来源：** 上一轮 key 带下标，不会重复。是我上一轮“outgoing 按 fieldId，不带下标”的建议去掉了唯一性。

**first failure / LKG / broken boundary：**
- first failure：第 764 行（以及第 789、796 行）构造 outgoing key 的地方；
- LKG：上一轮带下标的 key，唯一，但每个阶段都会重挂；
- broken boundary：中断冻结与层身份之间。

**验收判据：**
- 新增 focused 用例：驱动 A(l1)→B(l2)→A(l1)→C，每次都在交接早期中断。
  - 断言每个阶段渲染出的层 key 两两不同，且没有重复 key 的控制台错误；
  - 最终 display 时只挂载一个键盘层。
- 现有的 measure→enter 实例稳定用例（第 608 行）保持绿。

### N-1 · 第 1 项没有能红的测试；render 测试里有一条恒真断言 · CONFIRMED

- 把 `ConsoleSurfaceInputFrame` 从 `renderContentFrame` 挪回 `SurfaceRoot` 外（也就是上一轮 S-1 的原样回退），`console-assembly/test/` 里的六个文件没有一个会失败，它们都不涉及嵌套。
- `renderSurface.test.tsx` 自己构造 provider，不经过 `consoleAssembly`。
- 作者 S-1 的变异（provider offset 置 0）只测到第 2 项。
- `renderSurface.test.tsx:397` 的 `expect(Math.abs(-246 * (600 / 540))).toBeGreaterThan(246)` 只算常量，永远为真，不测任何行为。

**验收判据：**
- 上一轮 S-1 的回退应当能让某个 focused 用例变红。例如渲染 console assembly 后，断言输入框架节点位于 `ui-base-render:surface-host-canvas` 子树内。
- 第 397 行删掉，或换成真正依赖被测代码的断言。

### N-2 · 这个功能还没有 TR-16 要求的两端证据 · CONFIRMED（证据缺失）· 需 Dexter 裁决：否

**仓内事实：**
- `doc/platform/terminal-coding-standard.md` 第 655 行起的 `TR-16` 规定：
  - 不涉及 adapter 的功能，先在 `ui/integration` 的 Expo Web 上按批准的场景清单验证通过，再到虚拟机或真机跑 `assembly`；
  - 设备上用同一份场景清单重跑，逐场景并列两端结果；
  - implementation review 逐项核对。
  - 该条举的仓内实例就是本功能。
- 本功能的键盘外框、键位、Shift、覆盖避让和交接动画都在 `ui/base/input` 与 `ui/base/render`，不依赖 adapter。只有“双屏各自独立”依赖双屏承载，可以直接在设备上验证。
- 本轮作者处置写明没有动态运行。此前的设备运行早于 TR-16，没有 Web 先行记录，也没有两端对照。Dexter 的手工体验是 USER_OBSERVED_ONLY。

**性质：** 本轮作者只声明了静态修复，没有声称动态验收，所以不算违规，只记为收口前必须补齐的证据。初稿漏核这一项，定稿时补入。

**验收判据：**
- 实施计划补上两个阶段和共享场景清单。清单以已批准的 IA 帧与 AC 为准，并包含本轮 S-1、S-2 的触发场景：需要滚动的字段首次聚焦；A→B→A→C 快速中断。
- 每个场景先有承载该功能的 integration 包（如 sample-console）Expo Web 通过记录，时间早于它自己的第一次设备运行，且两端针对同一份源码字节。
- 单机双屏、mobile 两台虚拟机用同一份清单重跑，逐场景并列两端结果。有差异时，要么说明是平台固有差异且不影响行为判据，要么修复后两端重跑。
- vitest/jsdom 的 focused 结果不算 Expo Web 验证。

## 4. 方案合理性

- **问题对不对：** 本轮只修上一轮的四项，没有扩大范围，对。
- **S-1、S-2 的修法：** 一个恢复原来的结构，一个用 ref 保存最新回调，都是最简单直接的做法，对。
- **S-3 的修法：** 实现简单，但它依赖“滚动与动画同时结束”这个前提，而这个前提没有证据。代价是核心路径上会误报。更好的取舍要回到详设，把“滚动已结束”的观测信号定下来。
- **N-1 的修法：** 方向对，但丢了层身份的唯一性。
- **代价：** 复杂度与当前阶段匹配，没有过度工程。

**UI 自问：** NOT_APPLICABLE。本轮没有新增或改动用户操作、控件、文案或 Journey。唯一相关的用户可见文案是原有的焦点失败提示，它被误触发的问题就是 S-1。

## 5. SAME_ROOT_SCAN

**S-1：**
- 回读判定有两个入口：完成回调第 699 行、onScroll 第 220-228 行；两者的零容差都来自 `scrollIntoView.ts:59-61`。
- 不经滚动的字段在测量回调里同步判定，不受影响；PIN 没有滚动宿主，也不受影响。
- reposition 阶段也会发起滚动（第 689-690 行），但完成时不 settle 回读（第 709-711 行），只受零容差那一面影响。

**S-2：** outgoing key 有三处（第 764、789、796 行）。incoming 与 active 各只有一层，不会重复。

**N-1：** 嵌套 1 处，恒真断言 1 处。

## 6. DESIGN_GAPS

- 详设第 96 行和第 102 行对提交时机的说法不一致：一处要求“滚动已结束”，一处写“动画结束时核对”。“滚动已结束”的观测信号和取整容差都没有定义。这是 S-1 的根。
- 详设的性能契约要求层稳定，但没有要求中断冻结后层身份仍然唯一。这是 S-2 的根。

## 7. 按评审标准收口

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=0/2/2
L1_ENGINEERING=S-1（回读固定在动画结束时判定，误报失败）；S-2（重复 outgoing key）；N-1（第 1 项缺红，有恒真断言）；N-2（TR-16 两端证据未提供）。
  第 1、2、3、7 项成立；第 4 项能收敛；第 5 项 noop 稳定；第 6 项四项变异有效；
  Web 上 pending 期间点另一个输入框的路径正常。
L2_USER_VISIBLE=S-1：需要滚动的字段第一次聚焦时，可能误报“焦点框无法完整显示”并退出输入；
  S-2：快速往返切换后，Web 上可能残留旧键盘层。
L3_UNVERIFIED=Android 平滑滚动时长及其与 native 动画谁先开始；各浏览器平滑滚动时长；
  重复 key 在 Web 上实际的残留形态；缩放比例不为 1 的真机表现；19 个 IA 帧的逐控件视觉；业务提交与 cleanup。
SAME_ROOT_SCAN=见 §5
DESIGN_GAPS=见 §6
EVIDENCE_TIER=static=Claude 回读；focused=作者报告，未复跑；Web/Android=本轮 NOT_RUN（此前的 USER_OBSERVED_ONLY 早于本轮）；
  visual/business/cleanup=NOT_RUN
SESSION=CONTINUED_SESSION，v2s 仓根，不是 fresh acceptance
```

本结论只评审当前字节的静态实现，不授权后续 Roadmap step、动态运行、设备操作或数据操作；也不把 focused、typecheck 或手工体验升级为 Web、Android、视觉或业务验收。
