# TER 虚拟键盘视觉与交互 · IMPLEMENTATION 独立评审（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=1/2/3
```

```text
EVIDENCE_TIER=STATIC_SOURCE_READBACK（逐行对照详设；未运行任何构建/测试/设备命令）
SESSION=CONTINUED_SESSION
FOCUS=Dexter 指定：逐行对照详设核代码、是否满足业务需求、重点看虚拟键盘性能
WRITES=仅本文件
AUTHORITY=只覆盖本次键盘改动；不代表 implementation acceptance、visual、Web、Android、release 或 cleanup PASS
```

## 1. 性能结论（Dexter 的重点）

**热路径没有回归。** 我顺着完整读写链核过：`useInputKeyboardController.ts:27-31` 只在
`effect==='mode'` 或 shift/capsLock 变化时调 `forceKeyboardUpdate`，而 `editText.ts` 的 text key
返回 `effect:'edit'`；因此普通字符不触发 provider 重渲染。`VirtualKeyboard` 是 `memo`，props 全
是基本类型加一个稳定的 `onKey`——`InputKeyboard.tsx:34` 传的 `controller.handleKeyboardKey` 经
InputProvider 的 useCallback/useMemo 链保持引用稳定，所以 `handlers` Map 也不会重建。按下反馈的
`useState` 在 `PrimitiveButton` 内部，父级和表单业务组件都不重渲染。详设 §3.1/§3.2 的效率不变量
成立。

**但按下这条路径的开销类别变了，且键盘里存在一项与键盘无关的每键订阅**——见 S-1、S-2。两者都不
足以判定"卡"，需要真机测量；我只做静态分析，不把推导升格为性能结论。

## 2. Findings

### M-1 · dock 的 1px 边框不在高度预算里，四种布局底部各溢出 2px，而现有判据集合抓不到 · CONFIRMED

**仓内事实**：详设第 84 至 85 行冻结的高度公式是 `3*48 + 2*8 + 28 = 188`（alpha）与
`4*48 + 3*8 + 28 = 244`（full/numeric/financial）；`keyboardHeight.ts:78-81` 的
`calculateVerticalRequired` 与之逐项一致：`rowCount*48 + (rowCount-1)*8 + 14*2`。**两边都没有
边框项。** 而详设第 215 行的 recipe 要求 dock 带 border，`tokens.ts:28` 的 `keyboardDock` 实现为
`w-full self-center rounded-[20px] border border-keyboard-border bg-keyboard-surface`，
`border` 即 `borderWidth: 1`。

**推论**：`VirtualKeyboard.tsx:164` 给 dock 固定 `height`（188 或 244）。RN 只有 border-box，
dock 内容盒 = height − 2。而其唯一子节点 content View（`:168-174`）的自然高度 =
paddingTop 14 + paddingBottom 14 + 行高 + 行间距 = 恰好 188/244。内容比可用空间多 2px。

**反例——为什么不会被吸收**：RN 的 `flexShrink` 默认为 0，子节点不会被压缩；且 dock 路径上没有
任何 `overflow`。我在 `tokens.ts`、`PrimitiveKeyboardSurface.tsx`、`VirtualKeyboard.tsx` 三处
都查过，全仓 `overflow-hidden` 只出现在 `containerBoundedCard` 与 `buttonLoginPrimary`。旧实现的
`dock` 样式里原本有 `overflow: 'hidden'`，随 dock 迁进 primitive 后没有保留——当前详设第 215 行
也不再要求它，所以这不算违背详设，但它正是本会掩盖这 2px 的那一层。

**影响面**：四种布局、两个平台、laptop 与 mobile 全中。compact 同样成立：
`3*38 + 2*5 + 10*2 = 144`，内容盒 142，溢出 2。底行键会压上或越过 dock 底边框。

**为什么当前判据逮不住**：alpha dock 约 820×188 ≈ 154k px²，2px × 820 ≈ 1640 px² ≈ **1.1%**，
低于 `changedFraction <= 0.02`；geometry 机器门比的是 key/row bounds 与详设常量，而两边用的是
同一套没有边框项的公式，自洽。只有详设 §6.2 第 4 步的人工复核有机会看出来。

**最小修复**：`calculateVerticalRequired` 增加 dock 边框项（`+ DOCK_BORDER_WIDTH * 2`），并同步
详设第 84 至 85 行的两条公式与 `keyboardHeight.test.ts:42-45` 的 188/244。不建议改用
`overflow-hidden` 掩盖——裁切比溢出更难被发现。

**档位**：static/推导级。我没有运行渲染，2px 是按 RN box model 与常量算出来的；真机上它表现为
溢出还是被某层裁掉，需要 CP-5 的截图确认，但公式缺项这一条本身是确定的。
**阻断**：是——这是本批唯一一处会让用户看见的几何缺陷。

### S-1 · 按下反馈从非布局属性变成布局属性，落在产品最高频的交互上 · CONFIRMED

**仓内事实**：`PrimitiveButton.tsx:55` `const keyboardSelected = selected || pressed`；
`:56-62` 据此在 `keyboardKey`（`tokens.ts:29`，`border` → borderWidth 1）与
`keyboardKeySelected`（`tokens.ts:31`，`border-2` → borderWidth 2）之间切换，action 同理
（`tokens.ts:33`/`:35`）；`:88-89` 的 `onPressIn`/`onPressOut` 驱动 `pressed`。

**改前对比**：pressed 只影响 `style` 里的 `opacity` 与 `transform.scale`（`:20-21`、`:90`），
两者都是非布局属性。**改后**每次按下与抬起都会改变 `borderWidth`，而 `borderWidth` 参与 Yoga
布局（内容盒 46→44，compact 36→34）。于是每次击键各触发一次该键子树的布局 + 一次 NativeWind
className 解析，而不再是一次纯 opacity/transform 变更。

**我核过但没有发生的坏情况**：不裁切标签（内容盒 44 仍 ≥ 标签所需的 `leading-[25px]` + `py-2`
= 41）；不让父级或表单业务组件重渲染；不让 `VirtualKeyboard` 重渲染。范围严格限于单个键。

**详设口径**：第 234 至 236 行写"在不改变外框几何的前提下"。外框确实不变，但内容盒每次按下
内缩 1px，标签会随之重新居中。这句话字面为真，却掩盖了布局成本和 1px 的标签抖动。

**证据缺口**：是否人眼可感、是否影响连续击键，需要真机测量。我不能断言它一定卡，也不接受
"应该没事"作为结论。

**最小修复（若要消除）**：selected 保留 `border-2`（低频，CAPS/SHIFT），pressed 改用不参与布局
的表达——在 idle recipe 上只换边框颜色不换宽度，或保留现有 opacity/scale 再叠加阴影。是否要改
由 Dexter 定；若保留现状，建议在 CP-5 的真机记录里专门加一条连续击键观察，并把详设那句话改成
"外框不变、内容盒随按下内缩 1px"。

### S-2 · 每个 PrimitiveButton 在 native 上订阅两个键盘永远用不到的主题变量 · CONFIRMED

**仓内事实**：`PrimitiveButton.tsx:49-50` 无条件调用
`useNativeVariable('--color-login-action-start')` 与 `('--color-login-action-end')`，而这两个值
只有 `appearance === 'login-primary'` 分支（`:92-98`）会用。`nativeVariable.native.ts:4-5` 走
`useUnstableNativeVariable`（react-native-css-interop），是真实的变量订阅；
`nativeVariable.ts:3` 的 Web 实现直接返回 `undefined`。因此这是 **Android-only** 的开销。

**推论**：`full` 布局渲染 40 个 `PrimitiveButton` → 挂载 80 个 native 变量订阅，键盘每次重渲染
全部重跑，读到的值键盘从不使用。

**定性**：这是既有问题，不是本批引入的回归。但 Dexter 本轮的问题就是键盘性能，而它是键盘里
单键固定开销最大的一项，所以列入。

**最小修复**：把渐变读取下沉到一个只在 `appearance === 'login-primary'` 时渲染的子组件，hooks
便不会在键上执行。改动限于 primitives，不触及键盘。

### N-1 · `styles.region` 的 `gap: 3` 是死值，且与当前 8 的行间距矛盾

`VirtualKeyboard.tsx:294` 仍写 `gap: 3`，但 `:179` 每次渲染都用 `{gap: rowGap}`（8 或 5）覆盖。
它是旧 3px 行间距的残留，读代码的人会被误导。另：`:278` 的 `styles` 已改为普通对象字面量
（`:2` 的 `StyleSheet` import 也删了），而 `PrimitiveKeyboardSurface.tsx:31` 仍用
`StyleSheet.create`，两处风格不一致。都属清理项。

### N-2 · `compact` 回退分支拿 dock 宽度去比 host 阈值

`VirtualKeyboard.tsx:140` 的 `compact = compactOverride ?? frameWidth <= MOBILE_SYMBOL_MAX_FRAME_WIDTH`
中，`frameWidth` 是经 `calculateVirtualKeyboardDockWidth` 之后的 dock 宽度；而
`InputKeyboard.tsx:21` 判定 compact 用的是 `state.frameWidth`（host 宽度）。生产路径总会传
`compact`，所以回退只在直接渲染（如 focused test）时生效，此时两者会给出不同结论。建议去掉
回退，或把阈值改成 dock 口径并注明。

### N-3 · `INDEPENDENT_DESIGN_REVIEW` 同名字段两个值

evidence 文档结尾披露 `INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN`，而详设第 449 行
的完成门块写 `INDEPENDENT_DESIGN_REVIEW=ROUND_2_NO_GO_REPAIRED`。两者指的不是同一件事（前者是
本次实施轮有没有跑独立盲审，后者是 DESIGN cycle 的历史状态），但同名双值会让下一个读者搞混。
建议 evidence 改为 `INDEPENDENT_IMPLEMENTATION_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN`。

## 3. 逐行对照详设：核过且成立

- **alpha CAPS**：`keyboardLayout.ts` 的 alpha 第二行是
  `compoundRow([actionKey('caps'), ...asdfghjkl])`，与 full 同形、`visualRowCount=3`、
  `maxColumns=10`，region 随之归入 actions——与详设第 121 至 126 行的显式决定一致。
- **numeric 三列**：底行三个 `span:1` 列，顺序 `backspace | 0 | complete`，`maxColumns=3`、
  `visualRowCount=4`，未回退跨列 0。
- **七个 token 三侧齐全**：两个 `global.css` 各 7 条、两个 integration `tailwind.config.cjs`
  各 7 条、Android `sharedColors` 第 86 至 92 行 7 条且只放 `rgb(var(--color-keyboard-*))`
  映射不持有 RGB。上一轮 M-1 的 Android 分母缺口已真正闭合。
- **palette 符合 Dexter 裁定**：两个主题的 surface `19 23 25`、key `40 45 49`、action
  `40 45 49`、两个 foreground `248 250 252`、border `55 62 66` 全部同值，`keyboard-key ===
  keyboard-action`；focus 为 `59 130 246` 与 `225 29 72`，两主题不同。且 surface/key 与我上轮
  从 approved IA 量到的 `#131719`/`#282D31` 吻合，不是另拟的值。
- **pressed red mutation 可证伪**：`primitives.test.tsx:261-291` 对普通 key 与 action 各断言
  按下前不含 `border-2 border-keyboard-focus`、按下后含、抬起后又不含。Codex 所说"删除 pressed
  recipe 必须红"成立。
- **几何常量与详设一致**：详设第 80 至 85 行的 48 / gap 8 / padding 14 / dock 圆角 20 / key
  圆角 9 与 `keyboardHeight.ts:38-48` 逐项对得上，`keyboardHeight.test.ts:42-45` 断言
  188/244。我原本怀疑详设仍停在旧的 168/219，复查后确认详设已同步，该怀疑**不成立**。
- **Web/native 事件入口在 render 期求值**：`PrimitiveKeyboardSurface.tsx:7-12` 的
  `interactionPropsOf` 是在 JSX 内调用的函数，不再是模块级常量，符合详设第 214 至 216 行。
- **financial 的 `−` 与 `·` 只是 label**：`VirtualKeyboard.tsx:45-46` 只改显示，写入走
  `keyboardKeyOf:36-38` 的 `definition.text`，插入的仍是 ASCII 的 `-` 和 `.`。这条我专门查了，
  因为往金额字段插 U+2212 会是真 bug。
- **档位诚实**：evidence 把 Web、fixed-ROI visual/98%、release 全标 OPEN，未把 focused/static
  升格为 visual 或 acceptance。

## 4. 结论

`VERDICT=NO-GO`，`M/S/N=1/2/3`。

唯一的 Major 是高度公式漏掉 dock 边框导致的 2px 溢出——它确定存在、全布局全平台，而且恰好落在
98% ROI 门的盲区里（约 1.1%），修法是给 `calculateVerticalRequired` 加一个边框项并同步详设公式
与高度断言。两条 Significant 都是性能口径：pressed 从非布局属性变成布局属性（需要真机测量才能
判断可感性），以及每个键在 Android 上多挂两个用不到的变量订阅（既有问题，但键盘是它最密集的
消费场景）。三条 Note 是清理与措辞。

本结论只覆盖本次键盘改动的源码正确性与详设符合度；不代表 implementation acceptance、visual、
Web、Android、release 或 cleanup PASS。
