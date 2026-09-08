# TER terminal input implementation-facing 详设

```text
DESIGN_GRANULARITY=implementation-facing
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
BUSINESS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md
ANALYSIS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md
SAMPLE_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
INTERACTION_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
AUTHORIZED=详设/计划已 GO；当前授权 CP-0 至 CP-3 实施与验证
NOT_AUTHORIZED=真实 POS 硬件、UAT、部署、seed、浏览器自动化、§9 比例静态门、Git
IMPLEMENTATION_AUTHORITY=true
DESIGN_STATUS=IMPLEMENTATION_AUTHORIZED_CP0_TO_CP3
```

本文件是 implementation-facing 设计输入，不是实施授权。所有“真实树结果”均只在实施后
才可宣称；本文件把已完成的探针结果、尚缺证据和实施时的最低证明档位分开。

## 1. 真实业务目标与方案比较

### 1.1 这一批要解决的结构性问题

`ui/base/input` 要解决的不是再造一个漂亮键盘，而是让终端在受限的双屏/单屏 surface
上同时满足以下四个业务事实：

1. PRIMARY 上的姓名等中文字段仍可借助系统 IME，数字、金额和拉丁字段可用终端内的可预测虚拟键盘；SECONDARY 当前不承载系统 IME，顾客年龄只走虚拟键盘；
2. 输入编辑只改变当前字段的局部呈现，提交时一次性读取同一份原子快照，不把每个按键变成
   全局 command 或全树重渲染；
3. 键盘属于承载输入控件的 surface，主屏与副屏不靠部件读取屏数来分支；
4. 沉浸式 Android 主屏 window 在 `setDecorFitsSystemWindows(false)` 后仍能正确消费 IME inset，
   且主屏系统 IME 或任一 surface 的虚拟键盘弹出后不会遮住该 surface 的决策动作。

若不做这些，当前 POC 的每键 command/整树更新会把输入延迟和焦点稳定性绑定到业务树大小；
而 `adjustResize` 也不能作为沉浸式窗口的可信布局信号。只修 virtual keyboard 的视觉层而不
补 adapter/assembly 的 IME inset owner，会让系统键盘路径继续与虚拟键盘路径分叉。

### 1.2 方案比较

| 方案 | 形态 | 结果 | 结论 |
|---|---|---|---|
| A | 继续沿用 POC：每个按键派 command，业务树受控 value 全量更新 | 每键跨越 runtime/selector/renderer；输入延迟随树规模增长，提交快照还要从业务 state 反推 | 拒绝；它重复制造本批要消除的根因 |
| B | 把 `react-native-keyboard-controller` 作为唯一键盘/IME owner，并让它同时处理 Web、主屏和 Presentation | Web 可导出，但 Android 原生模块的当前临时验证未跨过其旧 AGP fallback；它与仓内 adapter 直接管理 edge-to-edge/insets 的 owner 会重叠 | 拒绝；未证明的 native build 与双 window owner 冲突不应成为 base input 的基础 |
| C | input provider + 当前字段本地草稿/ref 快照 + selection-aware 虚拟编辑器；系统 IME 由 adapter/assembly 的 WindowInsets owner 提供；SurfaceRoot 用一个通用 frame render prop 接入 | 输入和提交解耦；业务组件零屏数分支；两类键盘共享收缩模型；没有新增 native 依赖 | **采用** |

我选了 C 而不是 A/B，因为 C 直接解决编辑/提交和布局 owner 的根因，且使用现有 RN/TextInput
和仓内 surface 声明；B 的两项运行事实尚未形成可交付证据，不应在当前阶段把新的 native owner
引入所有 assembly。

### 1.3 阶段复杂度判断

这不是“只写四套按键”的小组件，但复杂度仍与当前阶段匹配：快照、selection 编辑、一个
SurfaceRoot 接缝和一个 adapter inset 协调器是闭合性能与体验要求所必需的最小闭环。以下内容
明确排除在本批之外：输入法引擎、拼音/候选词、Kiosk 中文录入、跨 app 主题、automation
backend、通用表单库、KBC native dependency 和比例静态门。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 | 停止条件 |
|---|---|---|---|---|---|
| CP-0 | 主屏 IME inset 与副屏虚拟输入前置验证 | `dual-screen` adapter / assembly | 主屏 IME 消费形态、副屏虚拟输入路径、KBC 取舍 | 现有 Android host/surface | 只能改 MainActivity、只能造第二 host/VM，或主屏 IME inset 无法被解释地消费 |
| CP-1 | SurfaceRoot frame 接缝与 `PrimitiveInput` 加法契约 | `ui-base-render` / `ui-base-primitives` | 一个通用 frame render prop；四个 input prop；render 不 import input | CP-0 只需确定 owner，不需先有 input | Provider/内容/底部 sibling 无法同时成立，或 public contract 被破坏 |
| CP-2 | input 核心、原子快照、四种虚拟布局与高度计算 | `ui-base-input` | provider、field registry、编辑纯函数、keyboard dock、scroll/focus 规则 | CP-1 | 出现全局每键 dispatch、快照受 React batching 影响、布局依赖屏数或键盘遮挡决策动作 |
| CP-3 | sample 年龄场景、系统 IME 接线、端到端 focused proof | sample feature + assembly/adapter | age 读取/规范化/confirm 链路、单/双屏交互和 S-30…S-39 证据 | CP-0 至 CP-2 | 契约/actor 闭环不一致、任一路径进入“有焦点但不能输入也不能继续” |

CP-0 是 implementation 的第一刀，但本详设阶段只记录运行结论和 stop condition，不提前
写 carrier 或 native 实施代码。CP-1/2 不得绕过 CP-0 的主屏 IME 结论声称系统输入已具备收缩行为；
副屏虚拟键盘不依赖 Presentation 的系统 IME。

## 3. 运行探针与证据边界

### 3.1 `react-native-keyboard-controller`

探针在隔离的 `/tmp/ter-input-web-probe.9VZ4VN` Expo scratch 中完成，不改仓内文件。
版本采用本机安装解析：Expo `57.0.18`、React Native `0.86.3`、React `19.2.3`、
`react-native-web 0.21.2`、`react-native-keyboard-controller 1.22.4`。

| 探针 | 结果 | 可以证明什么 | 不能证明什么 |
|---|---|---|---|
| `npx expo export --platform web`，scratch import `KeyboardProvider`/`KeyboardAvoidingView` | **PASS**，Metro 生成 2630ms，导出 `dist` | KBC 的 Web fallback 能被 Expo 57 + RN Web 解析、打包 | 不能证明浏览器中的键盘布局行为符合本终端设计 |
| `npx expo prebuild --platform android --no-install` | **PASS**，生成 autolinking；模块含 `KeyboardControllerPackage`、Fabric descriptors 和 CMake path | Expo/RN 的自动链接发现了 KBC | 不能证明 native binary 已构建或运行 |
| Gradle `:react-native-keyboard-controller:compileDebugKotlin --offline` | **FAIL（环境/模块边界）**：KBC 自带 fallback buildscript 要求旧 `com.android.tools.build:gradle:4.2.2`，本 scratch 离线缓存没有 | 当前组合的 native build 尚未形成可复现 PASS | 不能把这个失败归因成 RN 0.86.3 不兼容；在线重试停在同一 legacy fallback 的下载/配置边界 |

KBC Android 源码确实通过 `WindowInsetsCompat.Type.ime()` 读取 inset，并安装
`WindowInsetsAnimationCompat.Callback`/`OnApplyWindowInsetsListener`；同时其 build script
自带旧 AGP fallback 和 `react-native-is-edge-to-edge`。仓内
`TerminalDualScreenActivityHandler.kt` 直接设置 `FLAG_FULLSCREEN`、system UI flags、
`setDecorFitsSystemWindows(false)`，并在 focus 时重复应用。两者不是同一层的无害读取：
如果同时成为 window/insets owner，就会出现监听、动画和 window flag 的职责重叠，尤其在
Presentation 上无法从当前证据推断最终 inset 的消费次序。

**设计结论：本批不引入 KBC。** 若将来 PF-7/PF-8 的真实 measured evidence 显示必须要原生
动画能力，另开 spike，先解决当前 native build 边界并让它只成为明确的 adapter owner；不得在
本批通过 `KeyboardProvider` 掩盖 IME consumer 缺失。

### 3.2 Presentation 副屏系统 IME 边界

本机双屏模拟器 `emulator-5554` 的实跑观察：`dumpsys display` 能看到 display 0 与 display 2；
`dumpsys window` 能看到 Presentation window 注册为 display 2 的 `imeInputTarget`/`imeControlTarget`。
临时 direct-RN probe 进一步证明副屏 `TextInput` 可以获焦、回写与提交，但系统 IME token 与可见 inset
仍落在 display 0。该事实现在按 Dexter 2026-09-06 产品裁定解释为当前边界，而不是本批阻断：

- **已确认**：Presentation window 进入了 IME target 链，副屏 RN `TextInput` 可以获焦并完成
  回写/提交；
- **已确认边界**：副屏系统 IME 不显示在 Presentation 上（`mCurTokenDisplayId=0`，副屏
  `Type.ime()` hidden）；这是当前产品预期，不是副屏虚拟键盘的失败；
- **实施门**：CP-0 改为证明主屏系统 IME inset，以及不依赖 input 包的副屏虚拟输入 probe。
  副屏年龄接入后仍按真实虚拟键盘路径复验，但不再要求 Presentation 的系统 IME visibility。

不把“副屏 RN TextInput 可获焦”升级成“副屏系统 IME 已支持”；当前副屏可用性只由虚拟键盘路径证明。

## 4. SurfaceRoot 形态裁定

### 4.1 采用一个 frame render prop，不采用两个独立 prop

当前 `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` 同时创建
`SurfaceContext.Provider`、内容树、`ScreenContainer` 和 `LayerStack`；它没有底部 sibling 接缝。
采用以下一个通用 prop（名称为详设契约，实施时以该锚点落地）：

```ts
export type SurfaceRootContentFrame = Readonly<{
  readonly content: ReactNode
}>

export type SurfaceRootProps = Readonly<{
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey
  readonly children?: ReactNode
  readonly renderContentFrame?: (frame: SurfaceRootContentFrame) => ReactNode
}>
```

SurfaceRoot 的固定树形为：

```text
SurfaceContext.Provider
└─ root View (flex:1, position:relative)
   └─ renderContentFrame({content}) 或默认 content
      └─ content View (flex:1)
         ├─ assembly children
         ├─ ScreenContainer
         └─ LayerStack (overlay inside the shrinkable content)
```

`content` 是已经含 `children + ScreenContainer + LayerStack` 的单一 ReactNode；callback 只被调用一次，
不得让调用方分别传 content wrapper 与 bottom sibling，避免两者落在不同 Provider 或不同
surface root。LayerStack 仍由 render owner 管理 overlay、guard、back 和 native focus 的捕获/恢复；
它必须在可收缩 content subtree 内，随 keyboard dock 出现而使用变矮后的可用区；不能留在 dock
外面的未收缩 root sibling。LayerStack 与 input 的焦点接缝由 §4.3 的窄协议定义，不靠双方
各自猜测 active field。

`ui/base/render` 只定义并调用这个通用 frame，不 import `ui/base/input`。装配方（当前
sample-console assembly）才 import input 并提供：

```text
InputSurfaceFrame
└─ InputProvider
   └─ frame View (flex:1)
      ├─ content View (flex:1)      ← children + ScreenContainer + LayerStack
      └─ KeyboardDock sibling       ← virtual keyboard，仅在 active field 时出现
```

这满足“Provider 包裹整个内容区子树”和“底部放兄弟节点”，且保留 render/input 单向依赖。
没有 `renderBottomSibling` 第二个 prop，因为它会允许调用方独立改变 sibling 所属 Provider、
高度策略和 testID 归属；也不把 `children` 改成函数，因为那会破坏当前 `SurfaceRoot` 的普通
children 用法，并让 render 组件承担输入形态知识。

### 4.2 surface 尺寸与固定逻辑画布边界

`InputSurfaceFrame` 不再接收装配方传入的 `surfaceSize`。它在自己的根 View 上通过
`onLayout` 记录当前实际逻辑 frame；`InputProvider` 与键盘高度计算只消费这份本地测量。
这条边界同时适用于 PRIMARY、SECONDARY、Web resize 与未来的 portrait surface。

`sample-console/src/application/terminalSurfaces.ts` 解析出的 `terminalSurfaces` 只由 host
选择当前 `displayMode` 的固定逻辑 canvas，并交给 `SurfaceRoot`/host controller；assembly
不得把 canvas declaration 作为 `InputSurfaceFrame` 的 prop。Android carrier/host 负责将
canvas 映射到目标 window，Web dev-host 负责自己的 preview policy；input 不读取
`displayMode`、`Dimensions`、window width、宿主 scale 或物理尺寸。

因此，跨端统一的是 host 的固定逻辑画布与 input 的本地逻辑坐标，不是把 Android density
或 Web viewport 尺寸伪装成 input 的第二个 surface-size 来源。

### 4.3 LayerStack 与 input 的焦点边界

这里采用**职责分离、单向通知**，不让 `ui/base/render` import `ui/base/input`：

- `ui/base/render`/`LayerStack` 是 layer 生命周期与 native focus 的 owner：它保存首层打开前的
  focused target，聚焦顶层 layer，关闭最后一层时恢复原 focus；
- `ui/base/input`/`InputProvider` 是 field registry、`activeFieldId` 与 keyboard owner 的 owner；
- render 提供一个业务无关的 `SurfaceFocusBoundaryContext` 协议，事件只有
  `suspend` 与 `restore` 两种 phase。InputProvider 在 frame 内提供 listener，LayerStack 只发事件，
  不知道 input、keyboard 或业务字段名。这个协议属于 render 的公共 seam，input 通过既有
  `input → render` 依赖消费，render 仍不反向依赖 input。

协议的最小形态是：

```ts
type SurfaceFocusBoundaryPhase = 'suspend' | 'restore'
type SurfaceFocusBoundaryListener = (phase: SurfaceFocusBoundaryPhase) => void
```

context 只传 listener，不传 `activeFieldId`、keyboard kind、业务 command 或 layer payload；
这样焦点边界的 owner 不会反向泄漏成 input 或业务依赖。

事件顺序固定为：

1. **首层打开**：LayerStack 先保存当前 native focus，再发 `suspend`，最后把 focus 移到顶层
   layer；InputProvider 在 `suspend` 中保存当前 field 的 registration token 供诊断，立即把
   `activeFieldId` 置为 `null`、将 keyboard owner 置为 `none`、卸载 virtual dock、调用
   `Keyboard.dismiss()`，并在 boundary 期间抑制 field focus 重新激活键盘。
2. **层仍存在且顶层变化**：不重复捕获或恢复 focus，键盘继续保持收起。
3. **最后一层关闭**：LayerStack 先发 `restore` 解除 InputProvider 的 focus 抑制，再调用已保存
   的 native focus。被恢复的字段只有在自身 registration token 仍有效并实际收到 focus 事件时，
   才重新成为 `activeFieldId`；于是 virtual dock 或 system IME 随实际焦点恢复。字段已卸载、
   token 已失效或没有 focus 事件时，不重开键盘，也不恢复陈旧字段。

这定义了明确的 winner：layer 打开期间 layer focus 胜过 field focus；layer 关闭后实际恢复的
field focus 才能重新取得 keyboard ownership。对账判据为：打开带 active field 的 layer 后，
`activeFieldId === null` 且 virtual dock 与 system IME 均不可见；关闭后若原 field 仍挂载并成功
恢复 focus，恰好恢复一个 keyboard owner；若原 field 在层内卸载，则不出现键盘。
红向量是省略 `suspend`、保留 active field，或在恢复后继续抑制 focus：前者出现 layer 与键盘
同时可见，后者出现焦点已恢复但键盘不回，均必须失败。

`Keyboard.dismiss()` 是 React Native 应用级调用，不按 React tree 或 display 隔离。本批的
安全前提是：除当前承载输入的 surface 外，没有其他 surface 持有 system-keyboard 字段；当前
副屏年龄路径使用 virtual keyboard，且副屏输入期间不会打开 alert layer，因此该全局调用不会
误收起另一棵 system IME。若将来副屏增加 system-keyboard 字段，该前提失效，必须另开 scoped
keyboard coordination 设计；本批不预建 scope 机制。

## 5. input public contract 与职责边界

### 5.1 `PrimitiveInput` 的五类能力（既有六个语义项 + 四个编辑/呈现 prop + 两个 focus seam）

当前 `PrimitiveInputProps` 的既有呈现/编辑项是 `testID`、`accessibilityLabel`、`editable`、
`onChangeText`、`secureTextEntry`、`value`。在不改动这六项含义的前提下新增：

```ts
readonly selection?: Readonly<{readonly start: number; readonly end?: number}>
readonly onSelectionChange?: (event: {nativeEvent: {selection: {start: number; end: number}}}) => void
readonly showSoftInputOnFocus?: boolean
readonly maxLength?: number
```

`PrimitiveInput` 仍是呈现控件：透传到 RNR/React Native `TextInput`，每次仍先通过
`assertTestID`，不理解年龄、姓名、键盘布局、command 或 screen。`maxLength` 是通用呈现/编辑
约束；年龄 feature 只传 `3`，input 不知道该数字的业务含义。虚拟编辑纯函数也必须使用同一
上限，防止 Web/自绘键盘绕过 native cap。

不暴露 `inputMode`。它会和 `showSoftInputOnFocus` 及 system/virtual keyboard 选择发生
竞争，且 RN 的 `inputMode` 语义会改变 native input 行为；当前需求已经确定 system IME 只
承担中文路径，其他布局由虚拟键盘 owner 控制。

### 5.1a focus/restore 接缝（实施期授权修正，2026-09-06）

CP-1/CP-2 对照当前源码后发现，已批准的四个编辑/呈现 prop 还不足以实现详设 §4.3、§5.3
与 §11 的真实焦点规则：`ui/base/input` 需要知道 native input 何时实际获焦/失焦，且
`complete` 的 `focus-next` 与 layer restore 需要一个能调用目标 `focus`/`blur` 的通用句柄。
此前若只把 `onSelectionChange` 当作焦点信号，无法证明 focus/blur 事件真的发生；若只保存
当前字段 id，又没有目标句柄可以把焦点交给下一个字段。这是源码接缝缺失，不是产品语义变更。

经 Dexter 2026-09-06 授权，本批补一个最小、呈现无关的公共接缝：

```ts
onFocus?: () => void
onBlur?: () => void
inputRef?: React.Ref<PrimitiveInputHandle>

type PrimitiveInputHandle = Readonly<{
  focus: () => void
  blur: () => void
}>
```

`PrimitiveInput` 只把 `onFocus`/`onBlur` 转发为真实 RN `TextInput` 的生命周期通知，并以
`inputRef` 暴露同一真实控件的 `focus`/`blur` 两个通用操作；primitives 不解释字段、键盘、屏数、
业务 command 或 store。`InputProvider` 是这些信号的 owner：它据实际 focus 决定 keyboard
ownership，并用句柄执行 `focus-next`；`ui/base/render` 仍只发 `suspend`/`restore`，不反向
依赖 input。副屏仍不请求系统 IME，只由 `showSoftInputOnFocus=false` 的字段接入 virtual
keyboard。这个加法不改既有六项或已批准四项的含义，也不引入 `inputMode` 或业务 props。

最低证明是 primitives 的真实 TextInput pass-through/ref contract test，以及 input 的 focus
transition、focus-next、layer suspend/restore focused tests；删除任一 focus callback、目标句柄
或 forward path 时，相应测试必须变红。该修正是为了让已冻结详设可实施，不能被用来扩大
primitives 的业务公共面。

### 5.1b scroll-into-view 的几何接缝（实施期授权修正，2026-09-06）

CP-2 对照真实 RN 类型与当前 RNR copy-in 后确认，§7.3 还缺一条可执行接缝：输入框必须能
提供自己的窗口矩形，唯一的 `PrimitiveScrollView` 必须能提供窗口矩形、接收滚动偏移，并让
input 层观察当前滚动偏移。仅有 `children`/`testID` 无法从输入层计算最小滚动量；仅调用 RN
默认的 keyboard scroll responder 也不能覆盖本批不依赖系统 IME 的 virtual keyboard。

经 Dexter 2026-09-06 授权，本批补的最小通用呈现接缝是：

```ts
type PrimitiveInputHandle = {
  focus(): void
  blur(): void
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void
}

type PrimitiveScrollViewHandle = {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void
  scrollTo(options: {y: number; animated?: boolean}): void
}

type PrimitiveScrollViewProps = {
  testID: string
  children?: ReactNode
  onScrollOffsetChange?: (offsetY: number) => void
}
```

`PrimitiveInput` 与 `PrimitiveScrollView` 只转发真实 RN 节点的方法，不知道 field、keyboard、
surface、业务命令或 screen count。`onScrollOffsetChange` 只让 input 的内部 `InputScrollArea`
保存当前垂直偏移；它不把业务字段或键盘算法下沉到 primitives。`InputScrollArea` 由 input 包
提供，业务 feature 只继续使用自己的 `ScrollArea` 名称，不能直接 import RN。

这是对已冻结 §7.3 的实现接缝，不是新增业务能力：焦点测量、键盘收缩后的可见 bottom、no-op
边界和双减保护仍由 input owner 实现并测试。公共面同步规则因此变为：既有 primitive props
含义不变；scroll view 仅增加通用 offset 观察，两个 handle 仅增加通用测量/滚动方法；新增
原因、使用方与反例必须在 primitives README、invariants 与 input focused test 中可寻址。

### 5.1c CP-2 性能与接缝证据修正（实施期授权修正，2026-09-06）

CP-2 的独立步骤审查发现，若所有 `useInputField` 直接订阅包含 `revision`、selection 和
virtual-keyboard 编辑状态的同一个 context，则每次虚拟按键都会让所有字段重新渲染。这与
§6.3 的局部重渲染边界冲突。实施修正保持 controller 与 snapshot 形态不变，只把观察面拆成：

- `InputKeyboardStateContext`：供 `InputSurfaceFrame`/keyboard dock 使用的完整状态，可随按键刷新；
- `InputFieldKeyboardStateContext`：字段只观察 `activeFieldId`、owner、键盘可见性/高度、
  `contentTooSmall` 与 `imeInset`，不含 revision、shift/caps 或字段值，因此普通字段不因另一字段
  的按键而重渲染。

这是性能边界的最小 owner 修正，不是把状态搬到业务 store，也不引入 selector 库。focused proof
用两个真实 `useInputField` 字段的 render counter：激活字段按键后，非激活字段计数必须不变；
按键仍只能更新 input registry 与当前字段的局部 state。

同一审查还要求把两个此前容易被“存在 ref”掩盖的边界变成行为证据：

1. `InputScrollArea` 组件实际接收 `PrimitiveInputHandle`/`PrimitiveScrollViewHandle` 的
   测量结果，并调用 `scrollTo` 将焦点字段带入已经收缩的 viewport；focused test 使用真实
   `InputSurfaceFrame + InputScrollArea + useInputField` 树和 host geometry mock，另有无祖先
   no-op 反例。纯 `calculateScrollOffset` 测试只能补充几何算术，不能替代这条组件证据。
2. system→virtual 与 virtual→system 都必须观察 `Keyboard.dismiss()`，并断言 dock 的可见性
   不重叠；这条 focused test 是 keyboard owner 互斥的双向证据，Android/Web 的真实 IME 证据仍
   按平台单独报告。

`contentTooSmall` 也作为 `InputKeyboardState` 与字段观察状态的 typed 结果落位：声明 surface
不足时不挂不可操作的 dock，字段仍保持原语义，决策控件继续可见可操作。该信号不等同于
“输入失败”或“系统 IME 已验”，而是容量边界结果；focused test 同时断言信号、无 dock 和
决策动作存在。上述修正均不改变副屏不承载系统 IME、但支持 virtual keyboard 的产品边界。

### 5.2 ui/base/input 的 public 面

设计预期公共面如下，具体 export 名在实施前不得扩张：

| export | 作用 | 禁止承载 |
|---|---|---|
| `InputSurfaceFrame` | SurfaceRoot 的 frame adapter，提供 Provider、content 和 keyboard dock sibling | 业务 command、screen mode 分支 |
| `InputProvider` | 当前 surface 的 field registry、focus、keyboard kind 和快照上下文 | runtime/store、业务 state |
| `useInputField` | 注册/更新/注销一个字段并返回 input props 与 focus actions | 业务字段名推断、提交 dispatch |
| `useInputSnapshot` | 从当前 Provider 同步取得注册字段的不可变快照；由 context API 提供 | 读取 React 闭包或远端 state |
| `captureInputSnapshot`（`useInputField` 返回值） | 字段消费者在提交动作时取得同一份快照 | 把快照提升为 runtime/store 事实 |
| `VirtualKeyboard` | 四种通用 layout 的按键编辑呈现 | 固定业务键、业务文案、业务 command |
| `KeyboardLayout` / `KeyboardKind` | `full`、`financial`、`numeric`、`alpha` 与 `virtual`/`system` 类型 | `age`、`memberName`、`memberPhone` 等业务词 |
| `InputSurfaceSize` | 逻辑 surface 尺寸类型 | window measurement、屏数判断 |

公共面以真实消费者为准；零消费者的 export 必须删掉，不用“未来可能复用”保留。

### 5.3 中文与四种布局

- 中文姓名：`keyboardKind='system'`，field 使用 `showSoftInputOnFocus=true`；系统 IME 由
  Android/web host 提供，input 不实现拼音、候选词或汉字引擎。
- 数字/金额/拉丁：`keyboardKind='virtual'`，使用 `financial`、`numeric`、`alpha` 或
  `full` layout；虚拟按键只产生编辑意图，不派业务 command。
- Kiosk 下中文系统输入仍列为产品欠账，不把“能显示键盘”说成“已有中文输入法”。
- 每个 surface 维护唯一 `keyboardOwner`：`none`、`system` 或 `virtual`；任意时刻最多一个
  owner 可见。切换不是一句结果声明，而是固定的两段式过渡：
  - **system → virtual**：先把 owner 置为 `none`、清 `activeFieldId` 并让 virtual dock
    卸载，再对原生输入执行 `blur`/`Keyboard.dismiss`；只有目标字段以
    `showSoftInputOnFocus=false` 获焦后，才把 owner 置为 `virtual` 并挂 dock。
  - **virtual → system**：先清 `activeFieldId` 并卸载 virtual dock，再对目标字段执行
    `showSoftInputOnFocus=true` 的 focus；只有该字段收到 focus 后才把 owner 置为 `system`，
    由系统 IME 接管。切换同一 owner 的字段只更新 active field，不关闭再重开键盘。
  - 两条路径都经过 `none`，所以不会在一个 surface 内同时保留自绘键盘和系统 IME；目标
    获焦失败时保持 `none`，不伪造已可输入状态。

实施期 Android 接缝修正（2026-09-06）：副屏虚拟字段明确拒绝系统 IME 时，真实 RN
`TextInput` 可能在获焦后发出一次 native `blur`。该事件只表示系统 IME 未承载，不表示
虚拟键盘 owner 应清理；因此 `InputProvider` 忽略当前 virtual 字段的这类 blur，owner 的
清理只由显式 `InputFieldResult.blur()`、字段注销、layer `suspend` 或后续字段获焦触发。
这保留了“副屏无系统 IME、但虚拟键盘可用”的边界；对照反例是把所有 `onBlur` 都当作
清理，会在 Android Presentation 上刚点年龄字段就卸载虚拟键盘。

互斥判据：分别从 system→virtual 与 virtual→system 变异掉其中一个“先清当前 owner”的步骤，
focused transition test 必须观察到两个 keyboard owner 同时可见并变红；生产树则必须始终满足
`systemVisible + virtualVisible <= 1`。

## 6. 原子暂存快照

### 6.1 注册表形态

`InputProvider` 内部维护两个 ref：

```text
fieldsById: Map<FieldId, FieldRecord>
activeFieldId: FieldId | null
```

`FieldRecord` 至少含：稳定 `fieldId`、一次注册唯一 `registrationToken`、当前文本 ref、当前
selection ref、`keyboardKind`、`layout`、`maxLength`、`mounted`。业务 required/optional
语义不由 input 推断，随 field 的 owner contract 作为 metadata 传入但不改变；空值仍由
submit/actor owner 判定。

`useInputField` 用 stable field id 在 `useLayoutEffect` 注册，在 cleanup 中按 token 注销：

1. 同一 provider 中相同 `fieldId` 且 token 仍 mounted 是实现错误，focused test 必须失败；
2. 旧实例 cleanup 不能删除同 id 的新实例；
3. 注销只删除本 field，不清其他 field 或 form 的全局状态；
4. field 的 `onChangeText` 先把新值写入 `editStateRef`，随后调度局部 React state 更新并同步
   写入 registry 的 value/selection refs；snapshot 只读这些同步 registry refs，因此 React
   batching 不会让 submit 读到旧值。代码不依赖 `setEditState` 与 registry 写入的调用先后，
   依赖的是 registry 写入在同一事件处理返回前完成。

### 6.2 快照与提交/卸载竞态

`captureInputSnapshot()` 在一个同步 JS 临界区内按稳定 field 顺序复制 `fieldsById`，复制
`value` 与 selection，并冻结结果。`registrationToken` 只留在 live registry，用于旧实例 cleanup
不误删新实例；它不是业务输入，也不进入提交 snapshot。snapshot 的顶层 `revision` 已经标识
捕获边界，actor 不需要字段级 token：

```text
InputSnapshot = {
  revision: number,
  fields: Readonly<Record<FieldId, Readonly<{
    value: string,
    selection: {start: number, end: number},
  }>>>,
}
```

实现不把 `Map` 本身交给 actor，也不把 React state setter/闭包交给 submit；snapshot 形成后
与 registry 脱离。提交/卸载胜者规则是 JS 事件顺序规则：

- capture 先开始：snapshot 包含该时刻仍 registered 的字段；随后卸载不能改写它；
- unregister 先完成：字段不进入 snapshot；不能用“最后一次 render 值”补回已注销字段；
- capture 不在复制中 `await`，所以同一 JS turn 内不存在半份 snapshot；
- 业务 actor 收到 snapshot 后，字段组件可卸载，actor 仍使用这一份不可变输入；
- submit 请求失败不清掉 draft；成功后由 feature owner 清理/导航，input 不派 command。

这把“提交值”和“当前可见树”拆开，解决 `submit` 与 screen/layer 卸载竞态，而没有把输入
草稿升级成 kernel/store 事实。

### 6.3 渲染性能边界

- 每字符只更新 active field 的局部 state/ref 和键盘按键状态；不 dispatch runtime command、
  不写 kernel slice、不让整个 screen 订阅字段值；
- form submit 只在按下提交动作时调用 `captureInputSnapshot()` 一次；
- virtual keyboard 的 layout 不因每个字符重建；`VirtualKeyboard` 以 memo 边界保持 key tree 稳定，
  `onKey` 与普通字符按键的 `onPress` identity 在父级更新时保持不变；只有 layout、height、shift、
  capsLock 或 owner/visibility 改变时才允许键盘树更新；
- `InputSurfaceFrame` 只订阅 active field、keyboard kind、keyboard visibility 和 inset，
  不订阅全部 field values；
- 不引入 debounce 伪装延迟，PF-7/PF-8 仍必须按需求的连续输入与无同步重活判据验证。

## 7. 键盘高度与内容区计算表

### 7.1 固定设计常量

| 常量 | 值 | 理由 |
|---|---:|---|
| `MIN_CONTENT_HEIGHT` | 208 logical px | 至少容纳当前字段 48、字段与 action 间距 16、决策 action 48、状态/错误/安全余量 96；该高度是内容可继续操作的下界，不是 window 高度 |
| `MIN_KEYBOARD_HEIGHT` | 250 logical px | 五行布局在最小 42 key + 4 gap + 24 vertical padding 下可完整点击 |
| `MAX_KEYBOARD_HEIGHT` | 320 logical px | 避免大 surface 上键盘吞掉操作区；超过部分留给内容 |
| `MAX_KEYBOARD_RATIO` | 0.5 | 键盘最多占声明 surface 高度一半 |

这些值属于 input package 的无业务视觉/可操作性契约；若将来有不同终端 profile，必须另开
需求/详设，不在 feature 内偷偷覆盖。

### 7.2 虚拟键盘公式

对当前 active surface 的 `InputSurfaceFrame` 本地测量高度 `H`：

```text
availableByContent = H - MIN_CONTENT_HEIGHT
ratioBound         = floor(H * MAX_KEYBOARD_RATIO)
candidate          = min(MAX_KEYBOARD_HEIGHT, ratioBound, availableByContent)
virtualKeyboardH   = max(0, candidate)
showVirtual        = virtualKeyboardH >= MIN_KEYBOARD_HEIGHT
```

当前 sample surface 的计算结果：

| surface | 声明尺寸 | `ratioBound` | `availableByContent` | 键盘高度 | 内容剩余 |
|---|---:|---:|---:|---:|---:|
| PRIMARY | 1280 × 800 | 400 | 592 | **320** | 480 |
| SECONDARY | 960 × 540 | 270 | 332 | **219** | 321 |

同一 surface 的 `full`、`financial`、`numeric`、`alpha` 四种 layout 共用同一个高度；layout
只改变按键网格，不改变 frame height。这样不会出现“同一屏切换 layout 导致确认按钮跳动”。

当 `candidate < MIN_KEYBOARD_HEIGHT` 时不弹 virtual keyboard，并保持字段原有 optional/required
语义；不会把输入改成隐藏、不会让决策动作失效，也不会制造“已获得焦点但无法输入也无法
继续”的死状态。`CAPACITY-DESIGN` 验证本地 frame 尺寸、有上限和同一 surface 一致高度；S-36
另按 §7.3 的真实布局与焦点可见性验证，S-37 验证确认/拒绝动作仍可见可操作。

实施期比例接缝修正（2026-09-06）：公式以 `InputSurfaceFrame` 本地测量的逻辑高度产出
`virtualKeyboardH`，dock 在 RN layout 边界按 `virtualKeyboardH / measuredSurfaceHeight`
的百分比渲染，而不是把 host 声明像素直接当作 Android density-normalized 的 dp 数值。
这样 Web/Android 都在各自固定逻辑 canvas 内得到同一套 keyboard height，承载层再按各自的
scaleX/scaleY 映射到实际窗口，避免密度归一化把副屏键盘放大到遮住年龄字段。滚动祖先同时
保持 `w-full`，保证收缩后的 content subtree 仍是可测量、可滚动的完整 surface 宽度；这两项
是布局单位接缝修正，不是新增产品尺寸或屏幕分支。

### 7.3 焦点滚入收缩后的可见区

这是 `ui/base/input` 的职责，不下沉给业务 feature。虚拟键盘只是 React sibling，不会触发
Android `requestRectangleOnScreen` 链；因此 input 必须在 keyboard 出现或 focus 切换时主动处理。

触发与边界：

1. `useInputField` 在字段首次 focus、active field 改变、keyboard dock 高度改变或 per-window
   IME inset 改变后，向最近的 `PrimitiveScrollView` 注册点请求一次可见性调整；逐字符输入不
   触发滚动。
2. `PrimitiveScrollView` 是 input feature 唯一允许的滚动祖先。它通过 input 的内部
   scroll-ancestor context 提供 scroll ref 与 viewport measurement；业务组件只使用已有的
   `ScrollArea`/`PrimitiveScrollView`，不读取 window 尺寸、不自行计算 keyboard 高度。
3. input 在 layout 已提交后测量 field rect 与 scroll viewport 的相对位置。若在 surface 坐标
   中测量，收缩后的可见 bottom 是 `surfaceTop + H - effectiveKeyboardHeight`；若已经在
   scroll viewport 坐标中测量，可见 bottom 直接使用 viewport rect 的 bottom，**不得再次扣除
   keyboard height**。若 field top 小于可见 top，向上滚到 top；若 field bottom 超过可见 bottom，
   向下滚到刚好完整可见；滚动量按当前 offset 夹到合法范围。virtual keyboard 使用 §7.2 的
   dock height，system IME 使用 §7.4 的 per-window inset，两者不读取 `Dimensions.get('window')`。
4. 没有可滚动祖先时安全 no-op；不能为了满足 S-36 临时包第二层 scroll view，也不能把
   no-op 伪报成已滚动。measure/scroll 只发生在 focus/layout transition，不进入按键热路径。

S-36 的最低证明不是纯公式：构造内容高度超过收缩后可用高度、底部存在真实 age input 的
   focused layout test，并在 Web 与 Android 真实树断言 age field 完整位于可见区；移除
   scroll-into-view 逻辑必红。另加反例：无 scroll ancestor 时保持 no-op 并通过，证明 owner
   没有偷偷要求业务页增加第二个祖先。该节是实施后 §12.3、计划 §9.1 input package 的
   owning design anchor。

### 7.4 系统 IME inset

系统 IME 不使用上面的虚拟键盘高度，而使用 CP-0 的**主 Activity**
`WindowInsetsCompat.Type.ime()` 实际 bottom inset；但内容仍以同一个 `MIN_CONTENT_HEIGHT` 做
下限判定。当前 SECONDARY 不承载系统 IME，副屏年龄只使用 §7.2 的虚拟键盘高度，不消费
Presentation 的 IME snapshot。adapter/assembly 协调器不得同时让 Android `adjustResize`、KBC
和自有 coordinator 各自修改同一 root 的尺寸。

若真实 IME inset 大于 `H - MIN_CONTENT_HEIGHT`，coordinator 必须向 owner 报告
`contentTooSmall`，由输入路径收起/不显示可控 keyboard，并保留决策动作；不得简单裁剪内容
或把“不够高”静默当作成功。这个边界必须有 focused red vector。

## 8. IME inset owner 详设（不属于 ui/base/input）

### 8.1 归属

owner 是 `apps/terminal/adapter/android/dual-screen` 的 window/surface adapter，当前只为主
Activity 的 system IME 提供有效 inset contract；必要的 assembly wiring 只负责把每个 surface
的 root/metrics 交给 input frame。`ui/base/render` 不 import input，`ui/base/input` 不 import
Android adapter；input 只消费 frame/inset contract。SECONDARY 的虚拟键盘不需要 native IME owner。

### 8.2 预定形态

对主 Activity window 安装一个生命周期绑定的 `ViewCompat.setOnApplyWindowInsetsListener`
（或等价 RN 0.86 可验证入口）：

1. 读取 `WindowInsetsCompat.Type.ime()` 的 bottom 与 visible；
2. 转换为该 surface 的逻辑单位，产生带 `displayIndex`/window identity 的 immutable inset snapshot；
3. 只向该 surface root 的 content frame 更新 inset，不写 runtime/store；
4. window destroy/detach 时移除 listener；
5. `applyImmersiveWindow` 只管理 system bars/edge-to-edge，不能清掉 listener 或覆盖 IME 值；
6. 当前不在 Presentation 安装或消费 system-IME listener；禁止把 display 0 的 inset 推断为
   display 2 的 IME 能力。若未来为副屏增加 system-keyboard 字段，必须另开 scoped design。

这是 CP-0 的 implementation contract，不在本详设阶段预写 Kotlin carrier。没有主屏这条接线，
交付报告只能说“副屏虚拟键盘已对齐”，不能说“主屏系统/虚拟两条路径一致”。

## 9. `noticeDismissedCommand` 裁定

删除 `member-desk` 中原来服务 `registry-notice :dismiss` 的 `noticeDismissedCommand`，不
把它复用给 system-notice。原因：

- registry-notice 已改为 retry/abandon 且 guard 为 decisive，旧 dismiss 没有触发点；
- 两个 feature 各有自己的 system-notice，复用一个 feature command 会违反 J-1 的 feature
  不互相 import 边界；
- “关闭 registry notice”和“确认某 feature 的基础设施故障已看见”不是同一 intent。

保留/使用：

- ui-state/render 的通用 layer close 行为仍是底层能力，不等于业务 `noticeDismissedCommand`；
- staff-auth 既有 `authNoticeDismissedCommand` 不改名；
- system failure 使用各 feature 自有 `systemFailureObservedCommand` 与
  `systemFailureDismissedCommand`；
- registry-notice 只由 `retry`、`abandon` 两个业务出口关闭。

## 10. sample 年龄链与输入 owner 对账

| 层 | 固定事实 | 输入侧职责 | 不得做 |
|---|---|---|---|
| member-form | 姓名、电话字段注册在承载表单的 surface | 维护局部草稿、selection；店员点击提交时 capture 姓名/电话 snapshot；重试时只读回填 `PendingMember` | 读取 age；按 screen 数分支；写 PendingMember；写 uiVariable |
| member-desk submit actor | 只接收姓名/电话 snapshot，派 `submitMemberCommand({name, phone})` | 组装 submit payload；保持 `PendingMember` 既有形状 | 读取/规范化 age；生成 age；把 age 写入 store |
| customer-member | age 字段注册在实际承载顾客确认的 surface；双屏是 SECONDARY，单屏是 `handheld-confirm` 的 PRIMARY | 顾客点击确认时 capture age snapshot，`maxLength=3`，把可选 age 送入 confirm 链 | 逐字写 store；按 screen 数分支；写 PendingMember |
| `PendingMember` / `confirmPending` reducer | **不改** | 继续承载既有 pending 事实 | 由输入层镜像一份 pending |
| `confirmMemberCommand` / confirm actor | payload 的 age 可选；actor 读取并规范化后写 `Member.age` | 接收已冻结 payload | 像 memberId/registeredAt 一样自行生成 age |
| customer-member（输入 owner） | 双屏/单屏均由承载该 mode 的 surface 提供 input provider | 通过 input API 获取 age snapshot；只在确认动作送出 | 复制另一份键盘或读 display count |

单双屏差异只能在 `sample-member-desk` actor/assembly 的 `hasSecondarySurface` 分支；
部件和 `ui/base/input` 不读屏数。键盘属于承载输入控件的 surface，单屏/双屏由同一个 frame
契约自然成立。

## 11. 详设级判据、红向量与证据档位

### 11.1 CP-3 实施期接线与授权修正记录（2026-09-06）

CP-3 对照当前 production source 后，主 agent 获授权在不改变冻结业务语义的前提下补齐三处
实现接缝；原因与 owner 固定如下，避免把实现选择误写成新的产品裁定：

1. `MemberForm` 与 `CustomerMember` 的编辑值改由 `ui/base/input` 的字段 registry 持有，
   不再使用 member-desk 的两个 `uiVariable`。这是已冻结的 D-7「编辑期不进 store」的直接落地：
   提交或确认时同步 capture snapshot，重试表单从 owner 的 `PendingMember` 只读回填；因此删除
   member-desk 的两个 transient variable 声明、清理命令调用与其 assembly 变量清单，不新增
   `set-age` 或逐字段命令。业务 actor 仍是唯一写入 kernel owner 的路径。
2. 年龄字段只由 `customer-member` 注册为 `virtual`/`numeric` 字段，并将空字符串转换为
   `undefined` 后搭载 `confirmMemberCommand`；`createConfirmMemberActor` 是唯一读取并规范化
   可选 age、构造 `Member.age` 的 owner。`PendingMember` 与 `confirmPending` reducer 保持
   不变，顾客侧撤回/拒绝不把年龄写入任何 runtime/store。
3. `sample-console` 作为 integration consumer 通过 `SurfaceRoot.renderContentFrame` 注入
   `InputSurfaceFrame`；它只接收一个可选的结构化 IME inset source contract。Android assembly
   以 primary/secondary display index 分别提供 adapter source，input frame 只消费当前 surface
   的 `visible` 与 `bottomLogical`；Web 不提供该 source 时使用零 inset。这样主屏系统 IME 的
   inset owner 仍是 dual-screen adapter，feature 不感知 Android，副屏也不因此宣称或请求系统
   IME。该 contract 是接线所需的最小传递，不把 WindowInsets、Presentation 或 display count
   下沉到 `ui/base/input`。
4. `ScrollArea` 继续是 feature-local 名称，但其唯一实现改为 `InputScrollArea`，使 member
form 与 customer age 的焦点滚动共享同一个 input owner；业务组件不直接 import React Native，
不自行计算 keyboard height，也不增加第二个 scroll ancestor。

5. **PendingMember 生命周期裁定（实施期根因修正）**：当前 sample 正本的旧 owner 表把
   `rejectMemberCommand` 写成“清 pending”，但同一正本的 S-8 与场景 8 又规定顾客拒绝后
   选择“修改后重试”必须从 `pending` 回填姓名电话；两条规定在既有实现中不可同时成立。
   本批按可见旅途与 S-8 的闭环取较小一致解：`rejectMemberCommand` 只派出
   `memberRejectedCommand`，保留 `PendingMember` 作为一次性重试来源；只有
   `memberRegistrationAbandonedCommand` 才通过既有 owner 的 `withdrawMemberCommand` 清除
   pending。`memberWithdrawnCommand` 在双屏 `withdraw-confirm` 层存在时关闭确认层与等待层、
   将 SECONDARY 回到 `customer-welcome` 并把 PRIMARY 回表单；单屏没有确认层时直接回
   `member-form`；registry-notice 的放弃路径在清理后自行回 member-list，避免两个 actor 争抢导航。
   这不是让编辑 draft 跨挂载存活：保存的是已提交、待顾客决策的业务事实，表单本地草稿仍在
   卸载时消失。该修正原因与反例必须随 CP-3 代码对账保留。
6. S-38 的 focused assembly 验证暴露了一个真实接缝：双屏撤回清掉 pending 后，展示层还必须
   由 `registryMemberWithdrawnCommand` 显式关闭 `withdraw-confirm`/`waiting-confirm` 并
   `showScreen(SECONDARY, 'main', 'sample.desk.customer-welcome')`；单屏的同一 owner event
   在没有确认层时只回 PRIMARY `member-form`，双屏无确认层的直接命令则保持 no-op。此修正把
   「撤回后副屏离开确认态」从静态意图落到 actor owner，并由 assembly focused test 固定。

这些变更不扩大 public business model：唯一新增业务字段仍是需求 §4.5.3 已冻结的
`Member.age?: number`；其余是已批准 input/frame 接缝的 consumer wiring。实施后必须按 §12.3
逐代码回读，并将该记录与 CP-3 focused evidence 一并对账。

下表 `S-30` 至 `S-39` 的“判据”单元逐字取自
`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` §9.2，
不在 input 详设中重述或改写业务语义；键盘公式与滚动机制另以 `CAPACITY-DESIGN` 和 §7.3
承载。这样实施后对账时，sample 判据仍以 sample 需求为唯一业务正本。

| 判据 | 失败形态 | 最低证明 | 模型红向量 | 真实树结论 |
|---|---|---|---|---|
| PF-1…PF-6 | 每键更新全局树、所有字段重渲染、键盘重建 | focused render counter | 给非 active field 订阅全局 value | 真实 Web + Android input path |
| PF-7 | 连打 20 字符出现丢字/顺序错/焦点丢失 | Web + 双屏 Android focused interaction | 逐字符 await/dispatch 或破坏 selection ref | 不以静态 PASS 代替 |
| PF-8 | 按键路径含同步重活 | 静态 call path + focused profiler/counter | 在 key handler 写 serialization/dispatch | 需运行结果 |
| S-30 | 【双屏】顾客点年龄框，**SECONDARY 上**弹出纯数字键盘（§4.5） | 副屏年龄框没有弹出纯数字键盘，必红 | 移除 SECONDARY 的键盘宿主 | 双屏 Android + Web focused |
| S-31 | 【单屏】`handheld-confirm` 下点年龄框，**PRIMARY 上**弹出纯数字键盘 | 单屏年龄框没有弹出纯数字键盘，必红 | 移除 handheld-confirm 的键盘宿主；若靠单/双屏复制两套部件才通过，同时违反 P-9 | 单屏 Web/Android focused |
| S-32 | **不填年龄**直接确认 ⇒ 登记成功，`members` 新增一条且其 `age` 为空 | 空年龄被拦下、被禁用确认按钮或弹校验，必红 | 把 optional age 错当 required，或确认 handler 无法提交空值 | sample focused actor/store |
| S-33 | **填了年龄**再确认 ⇒ 新增那条的 `age` 等于所填值 | 年龄丢失、被截断或串到别的字段，必红 | 去掉 age payload、让 actor 自行生成或改写 age | sample focused actor/store |
| S-34 | 顾客录入年龄期间，**PRIMARY 读不到该值**（双屏） | 出现逐字同步，必红 | 把编辑值写入 store 或让 PRIMARY 订阅 draft | 双屏 focused state/render |
| S-35 | 顾客**拒绝**时年龄被整体丢弃，不落任何 store | 拒绝后仍有年龄残留，必红 | 拒绝路径提交/持久化 age | 双屏/单屏 focused store |
| S-36 | 年龄键盘出现后，**年龄框仍完整可见**（内容区收缩＋焦点滚入可见区） | 年龄框被键盘盖住，必红 | 去掉 §7.3 scroll-into-view 或让 content 不收缩 | Web + Android layout render |
| S-37 | 年龄键盘升起时，`customer-member` 的**确认与拒绝仍可见可点**（单屏三个按钮同样成立） | 内容区收缩后按钮溢出可见区，或必须先收键盘才能点，必红 | 删除最小内容高度 guard 或让 dock 覆盖 action | 双屏真实副屏 + Web |
| S-38 | 【双屏】顾客正在输年龄时店员点「撤回」⇒ ① 副屏离开确认态回 `customer-welcome`；② 顾客随后点「确认」不产生任何登记；③ store 中无年龄残留 | 撤回后副屏停在无反应的确认态，或顾客那一下仍登记成功，必红 | 去掉撤回的 pending 清理/副屏回 welcome/先到者胜者规则 | 双屏 Android focused interaction + store |
| S-39 | 内容区不足以容纳键盘的窄 surface 上点年龄框 ⇒ **不出现「已获得焦点但无法输入、也无法继续」的死状态**；年龄仍可不填，确认／拒绝／交还仍可点 | 出现焦点已给、键盘没有、又无出路的状态，必红 | 让 focus 后直接隐藏键盘且禁用动作 | 窄 surface focused state |
| CAPACITY-DESIGN | 键盘高度由 `InputSurfaceFrame` 本地测量的 logical frame 高度计算，受 320 上限、0.5 比例与 208 内容下限约束；同一 surface 的四种 layout 高度一致 | 使用 window measurement、无上限、按 layout 分支或内容区低于 208，必红 | 改纯公式/输入尺寸或 layout 分支 | formula table + layout tree |
| INPUT-EDIT-MODEL | selection、backspace、shift/caps、complete 等编辑语义正确；complete 在非末字段推进焦点、末字段 close-only | pure edit model + focused field transition test | 只 append、忽略 selection 或把非末字段也 close-only | input focused |
| LAYER-FOCUS-BOUNDARY | layer 打开先清 active field/键盘，layer 关闭后仅随仍挂载且实际恢复的 field focus 重开 | layer transition focused test | 省略 suspend，或 restore 后继续抑制 focus | Web/Android layer transition |
| KEYBOARD-OWNER-EXCLUSION | system 与 virtual 在同一 surface 任一时刻最多一个 owner 可见 | 双向 transition focused test | 去掉任一方向经过 `none` 的清理 | Web/Android focused transition |
| snapshot atomicity | submit 读 stale React closure 或半份 Map | focused registration/unmount test | 在 capture 中 `await`、从 state closure 读值 | sample submit result |
| `PrimitiveInput` | 新 props 未透传、focus/blur 未到达真实控件、目标句柄不可用或 `inputMode` 出现 | type/focused primitive test | 删除 maxLength/selection/showSoftInput/focus/ref pass-through | native/web render |
| SurfaceRoot seam | Provider 不包 content 或 dock 不是 sibling | render tree focused test | 把 dock 放 overlay/独立 Provider | Web/Android tree |

### 11.2 staff-auth 登录字段接线（2026-09-06，增量实施记录）

源码复核发现 `sample-staff-auth` 的 `StaffLogin` 仍是本批 input 能力唯一未接线的凭据表单：
两个字段直接渲染 `PrimitiveInput`，没有 `showSoftInputOnFocus`、字段注册或虚拟键盘宿主。
这是当前体验中登录页看不到虚拟键盘的根因，不是 Web/Android 外壳差异。

按已冻结的输入边界，工号和密码都是拉丁/数字凭据，均接入 `useInputField`，采用
`keyboardKind: 'virtual'` 与 `layout: 'full'`；密码继续保留 `secureTextEntry`。登录按钮从
`useInputSnapshot` 在动作边界同步读取两个字段，仍只派一条 `loginCommand`，不把逐键编辑写入
runtime、uiVariable 或 request ledger。

`sample.login.operator-name` 仍保留 `owner-only` 变量，但只由 `loginSucceededCommand` 的
feature actor 在成功后写入，作为下次登录的初值；失败不写。密码变量删除，密码草稿只存在
input registry，业务失败后由 `StaffLogin` 重置密码字段，设施失败保留草稿。这个局部重置
采用 feature 内的 keyed field remount，避免为一次业务字段清理扩张 `ui/base/input` 公共面。

登录表单的 feature-local `ScrollArea` 改接 `InputScrollArea`，使焦点滚入可见区与其他输入
表单共用同一 input owner。为此 `sample-staff-auth` 新增对 `ui.base.input` 的运行时依赖；
kernel 命令、session owner、SurfaceRoot 与 adapter 均不改。

模型红向量只证明测试/门能抓到被故意破坏的形态；真实树 PASS 只证明当前树干净/行为通过，
两者在交付报告中分开列，不把夹具 FAIL 写成生产源码 FAIL。

本批不创建 §9 的比例静态门；该门仍需 Dexter 单独裁定。`L2_SCRIPT_ADMISSION=BLOCKED`，
本批不做浏览器自动化；focused test、Web export 和 Android 模拟器局部验证不被取消。

### 11.3 非输入点击与系统 selection 修复（2026-09-06，增量实施记录）

体验复核发现两个共同的 input-owner 缺口。第一，`InputSurfaceFrame` 的 content 原来只是
`View`，点击标题或内容空白不会触发 active field 清理，虚拟键盘因此继续显示。修复后由
`InputProvider` 持有 `dismissActiveField`，content 改为 frame 内部的 `Pressable`；该 press
只负责清理当前 input owner，虚拟 keyboard 仍是 content 下方的 sibling，不引入业务层分支或
新的 feature API。

第二，system field 原来和 virtual field 一样向原生 `TextInput` 传递受控 `selection`。在
React Native 的 `onChangeText` 先于下一次 selection event 到达时，旧 selection 会被回写到
原生控件，造成连续输入从光标前端反向插入。修复后 virtual field 继续由 input edit model
控制 selection；system field 不传受控 selection，把光标顺序交还给原生 TextInput，并仍通过
`onSelectionChange` 更新同步 registry 快照。这样不改变 virtual 的 selection-aware 编辑语义，
也不引入 `inputMode` 或逐键 command。

对应 focused regression tests 覆盖：内容区非输入点击收起 virtual keyboard；system field 连续
收到文本变更时不再传受控 selection，随后原生 selection event 能正确进入 snapshot。

随后在真实 Expo Web 交互中发现 RN Web 的额外接缝：Web `TextInput` 不会消费/转发
`onPressIn`，所以它不能阻断外层 `Pressable` 的 DOM click，输入框点击会被父层误判为
「非输入点击」并立即收键盘。修复不扩展业务层 API：`PrimitiveInput` 在检测到 Web DOM
时把同一 `onPressIn` 边界处理器透传为 `onClick`；native/Android 仍只使用 `onPressIn`，
不向原生 TextInput 传 Web-only 事件。该边界由 input focused test 在受控 Web-DOM 探针下
锁定，并由 Expo Web 实际点击输入框与标题分别验证「可获焦」和「收键盘」。

## 12. 依赖、日志与同步分母

### 12.1 依赖方向

```text
ui-base-input → ui-base-primitives
ui-base-input → ui-base-render（消费 SurfaceRoot/frame contract 与 SurfaceFocusBoundaryContext，按实际 import 声明）
sample-console assembly → ui-base-input
dual-screen adapter/assembly → WindowInsets coordinator
ui-base-render ↛ ui-base-input
ui-base-input ↛ kernel feature / sample feature / Android adapter
```

只有真实 import 才写 `dependencies.ts`/package.json；测试专属工具按仓内现有字段归类。
KBC 不进入任何 package manifest。

### 12.2 诊断

input 层只记录非敏感的 `surfaceKey`、`fieldKind`（不得是用户字段值）、keyboard kind、
layout、inset category、snapshot revision 和 failure category；不记录姓名、手机号、年龄原文、
token、raw payload。adapter 日志记录 window/display identity、IME visible、inset 数值和
生命周期事件，不记录输入文本。测试日志将 business result、model red vector 和 cleanup 分开。

### 12.3 实施前后同步分母

| 变更事实 | 声明/生成源 | 消费/传递 | focused/static | 结论 |
|---|---|---|---|---|
| SurfaceRoot 增加 frame seam | `ui-base-render` props/index/invariants/README | sample-console assembly → input frame | render tree + public set | 同批同步 |
| layer focus boundary | render 的 `SurfaceFocusBoundaryContext` 与 LayerStack 生命周期 | InputProvider 提供 `suspend`/`restore` listener；LayerStack 保留 native focus owner | layer transition focused test | 打开层先收键盘，关闭后随实际 focus 恢复 |
| PrimitiveInput 四个编辑/呈现 prop与两个 focus seam；PrimitiveScrollView 测量/滚动/offset seam | primitives props/index/invariants/README | input field adapter、InputScrollArea、age feature | primitive pass-through/ref + scroll geometry + input transition | 既有六项不改；不引入 inputMode；不下沉业务字段 |
| input snapshot/scroll public face | input index/invariants/README | feature submit/confirm 与 feature-local ScrollArea | snapshot/focus-scroll focused | `useInputSnapshot` 只读同步 registry；无祖先 no-op；不写 store |
| age 可选 payload | sample requirements §4.5.3 / kernel `confirmMemberCommand` | customer-member confirm handler → `confirmMemberCommand({age?: number})` → confirm actor → `Member.age` | customer age snapshot→confirm actor focused | submit actor、Pending、confirmPending reducer 不动 |
| IME inset | adapter window listener contract | Activity/Presentation → surface frame | Android local probe | 不属于 input 包 import |
| notice command | interaction/sample command table | feature actors/layers | command/public-surface test | 删除旧 member-desk dismiss |

## 13. 完成判定

```text
SURFACEROOT_SEAM=ONE_FRAME_RENDER_PROP
SNAPSHOT=SYNC_REF_REGISTRY + FROZEN_CAPTURE + TOKENED_UNREGISTER
VIRTUAL_KEYBOARD_HEIGHT=MIN(320, FLOOR(H*0.5), H-208); SHOW_ONLY_IF>=250
IME_OWNER=PRIMARY_ACTIVITY_ADAPTER_ONLY; SECONDARY=VIRTUAL_KEYBOARD_ONLY
KBC_ADOPTION=REJECTED_FOR_THIS_BATCH_WITH_RUNTIME_BOUNDARY
  PRESENTATION_IME_FOCUS=NOT_APPLICABLE_BY_PRODUCT_RULING_2026-09-06
  NOTICE_DISMISSED_COMMAND=DELETE_MEMBER_DESK_OLD_INTENT; DO_NOT_REUSE
  PRIMITIVE_INPUT_FOCUS_SEAM=ON_FOCUS_ON_BLUR_INPUT_REF
  PRIMITIVE_SCROLL_SEAM=MEASURE_SCROLL_TO_OFFSET_OBSERVATION
  INPUT_PUBLIC=USE_INPUT_SNAPSHOT_AND_INPUT_SCROLL_AREA
  INPUT_MODE=NOT_EXPOSED
L2_SCRIPT_ADMISSION=BLOCKED
IMPLEMENTATION_AUTHORITY=false
```

完成详设不等于 input 已实现。只有实施后 CP-0 至 CP-3 的 focused、Web、Android 与
cleanup 证据均闭合，才可交付“性能与用户体验达到判据”；PF-1…PF-6 全绿不能单独宣布性能达标。

### 13.1 实施期静态门同步记录

实施期首次重跑静态门暴露了两处 owner 不一致，均按实际生产源码与已批准边界修复，未通过
放宽门或增加伪依赖止血：

1. `apps/terminal/skeleton-graph.ts` 原先仍把 `ui.base.input` 按旧空壳预设声明为依赖
   `kernel.base.platform-ports`、`kernel.base.runtime` 与 `kernel.base.state`。当前 input
   的生产源码只通过 `ui-base-render` 消费 SurfaceRoot/focus protocol，并通过
   `ui-base-primitives` 消费控件接缝；它不导入 kernel、store、command 或 platform port。
   因而把 skeleton graph 收敛到实际依赖 `ui.base.render` 与 `ui.base.primitives`，与
   `package.json`、`src/dependencies.ts` 和实际 import 四方一致。保留 skeleton 的 exact-set
   与 source-import 判定，不以声明未使用的 runtime 依赖满足旧图。
2. `tools/terminal-ui-render/check-static.mjs` 的公共面数量仍冻结为历史 22，而当前
   `src/index.ts`、`terminal-invariants.json` 与 README 已共同收口为 27 项（含 focus
   boundary 与 SurfaceRoot frame seam）。将门的固定期望同步为 27；它仍先做 invariant
   exact-set 与 infrastructure/domain exact-set，再做数量断言，新增或删除公共导出仍会变红。
3. CP-3 把 `ui-base-input` 接入了 `sample-member-desk` 的字段/滚动实现、
   `sample-staff-auth` 的凭据字段/滚动实现与 `sample-console` 的 SurfaceFrame 组装；三者的
   `package.json`、`src/dependencies.ts` 与实际静态 import 已包含该边，故同步把
   `ui.base.input` 加入 skeleton graph 的三个消费节点。这不是为通过门增加未使用声明，而是
   补齐真实运行依赖的架构图边。

这两项只同步机器门与当前公共面事实，不改变 input/render 的运行时语义，也不引入新的能力。
