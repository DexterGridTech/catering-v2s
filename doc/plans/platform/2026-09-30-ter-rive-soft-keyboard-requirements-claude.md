# TER 软键盘 Rive 化正式需求（草案）

```text
DOC_TYPE=正式需求（REVIEW_TARGET=DESIGN 的被审对象）
VERSION=草案（未经独立盲审；§5.2 列出的 DEXTER_DECISION 未裁决前不得进入详设定稿）
DATE=2026-09-30
AUTHOR=Claude 写需求；详设、实施计划与实施的归属由 Dexter 指派
INPUT=Dexter 2026-09-30 会话指派（§1.1）；TER 现行软键盘实现（§1.3）；
  doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md（下称 VK 需求）；
  rive/keyboard（Rive CLI 工程，当前只有脚手架）
BYTE_STATE=现状事实以 2026-09-30 的工作区字节为准；第三方版本以 2026-09-30 npm registry 实查为准。
  TER 有他人在并行修改，详设开工前须重核 §1.3 全部事实
AUTHORITY=本文只是需求。它不授权详设定稿、实施、新增依赖、改动原生工程或任何设备/数据操作
SESSION=续接会话（非 fresh v2s-rooted）；第三方事实为本会话内实查，代码事实为本会话内读源码与运行 tsx 取得
```

## 1. 用户任务、现状与选择

### 1.1 Dexter 原文（逐字）

**建工程：**

> 我希望你在本工程rive目录下新建一个名为keyboard的rive项目，后面我希望把TER的软键盘都用rive动画来实现

**对边界问题的答复：**

> 好，问题你都去查实。1，关于职责边界，你是对的，rive里不需要任何业务逻辑。2，本项目不需要”无障碍”。3，需要同时支持RN Android 和RN web。4，总共有几个键盘你要看下TER当前的实现，而且surface屏幕逻辑分辨率固定为1280*720（laptop）和360*640（mobile），所以你的rive画板要根据这个尺寸设计键盘。      你先写需求文档，先不直接实现

**命中方案：**

> 但是，我想要方案B，全部交给 Rive，Rive 命中并回传 trigger

**包结构方向：**

> input包未来应该和input-rive是两个并行包，二选一，业务需要用哪个，就在integration包里组装哪个。不管用哪个，对业务都应该是透明的无感的。按照这个方向一起优化一下input包

**资产要求：** `.riv` 随 `input-rive` 一起打包，不让 `assembly` 与 `integration` 对资产有感知。

### 1.2 真实目标

两件事一起交付：

1. **优化 `ui/base/input`**：拆成与渲染方式无关的**输入核心**，和可替换的**键盘渲染器**。输入核心承担全部输入语义和业务可见的 API；键盘渲染器只负责画键、接收点按并报告 keyId。现行 Pressable 键盘成为其中一个渲染器包，行为零变化。
2. **新建 `ui/base/input-rive`**：与 Pressable 渲染器并列的第二个渲染器包。键帽的视觉、按压动效与命中都交给 Rive，Rive 命中后逐键回传 trigger。

两个渲染器包二选一，由各 App 的 `ui/integration` 组装其一。业务包（`ui/feature/*`、`ui/base/admin-shell`）只依赖输入核心，不感知用的是哪个渲染器。键盘的输入语义保持不变。

- 业务透明：换用另一个渲染器时，业务包的源码、依赖声明与测试都不改。

- Rive 里零业务逻辑：trigger 只说明“哪个键被点了”，其余全部由 RN 决定。
- `.riv` 资产只在 `input-rive` 包内，assembly 与 integration 不感知资产。
- 同时跑在 RN Android 与 RN Web。
- 画板按两块固定 surface 逻辑分辨率设计。

对“为什么要用 Rive”的推断：Dexter 没有说明动机。如果目标只是更顺滑的按压反馈，RN 自身（Reanimated 已在仓内）也能做到。选择 Rive 的合理价值在于：视觉和动效成为可由设计侧独立迭代的资产，改动效不必改代码。本文按这个价值来界定范围，并在 §5 如实列出它的代价。“用 Rive”本身是 Dexter 的产品决定，本文不重新论证。

### 1.3 现状事实

以下事实均来自本会话读源码。`input/` 指 `apps/terminal/ui/base/input/`。

**键盘种类：4 种布局，1 个渲染器。** 布局定义在 `input/src/foundations/keyboardLayout.ts`，由 `getKeyboardLayout(layout)` 取得。下表的键序由本会话运行 tsx 实取：

| 布局 | 视觉行 × 最大列 | 键数 | 键序 |
|---|---|---|---|
| `full` | 4 × 10（dense） | 40 | `1–0` / `q–p` / `shift a–l` / `space z–m backspace complete` |
| `alpha` | 3 × 10（dense） | 30 | full 去掉数字行 |
| `numeric` | 4 × 3（standard） | 12 | `123 / 456 / 789`，末行 grid：`backspace` \| `0` \| `complete` |
| `financial` | 4 × 3（standard） | 14 | 前三行同 numeric，末行 grid：`- .` \| `0` \| `backspace complete`（grid 列 `direction:'row'`，成对键横排） |

- 四种布局合计 42 个不同的 keyId。
- 键的 kind：`text`（可带 `shiftedText`）、`shift`、`space`、`backspace`、`complete`。
- full 布局的数字键在 shift 态下输出 `: / . ? & = - _ % +`。

**几何全部由公式决定。** 公式在 `input/src/foundations/keyboardHeight.ts`。

- 宽度 ≤ 480 时为 compact。
- 键高 48，compact 为 38。
- 水平与垂直内边距 14，compact 为 10。边框 1。
- 行距 8，compact 为 5。
- 列距 standard 8，compact 4。dense 键最小宽度 30。
- dock 高度 = `min(min(320, floor(H×0.5)), 行数×键高 + (行数−1)×行距 + 2×垂直内边距 + 2)`
- 共享 cellWidth = `floor((W − 2×水平内边距 − (列数−1)×列距)/列数)`
- dock 宽 = frame 宽。
- 非 shared 行按本行键数自行等分（`VirtualKeyboard.tsx:108-125`）。

按公式算出两块 surface 上的尺寸：

| 布局 | laptop 1280×720 | mobile 360×640 |
|---|---|---|
| full | dock 1280×246，键宽 118，键高 48 | dock 360×189，键宽 30，键高 38，右侧余 4px |
| alpha | dock 1280×190 | dock 360×146 |
| numeric | dock 1280×246，键宽 412 | dock 360×189，键宽 110，余 2px |
| financial | dock 1280×246，成对键约 202（推算） | dock 360×189，成对键约 53（推算） |

“推算”指 grid 列内成对键靠 flex 等分，没有显式公式。详设须实测，或把它改成显式公式。

**渲染器与视觉。**

- `input/src/components/VirtualKeyboard.tsx` 用 `PrimitiveButton` 逐键渲染。
- 标签规则：
  - `-` 显示 `−`，`.` 显示 `·`。
  - 字母按 shift 显示大写或小写，有 `shiftedText` 时优先显示它。
  - shift 键显示 `⇧`（compact）或 `SHIFT`，space 键显示 `␣` 或 `SPACE`。
  - backspace 与 complete 只显示图标（`keyboard-backspace` 与 `keyboard-enter`），不显示文字。图标尺寸 26，compact 19。两者的 SVG path 在 `primitives/src/foundations/nativeSlots.tsx:142-144`。
- shift 开启时 shift 键为 selected。
- 按压反馈（`primitives/src/components/PrimitiveButton.tsx`）：
  - pressed 状态保存在组件本地，onPressIn 置真，onPressOut 置假。
  - 透明度 0.78，action 键 0.72。
  - 缩放 0.985。
  - pressed 或 selected 时，边框从 1px border 色改为 2px focus 色。
  - `onPress` 在松手时触发。
- tokens（`primitives/src/theme/tokens.ts:133-156`）：
  - 键在组内为 `flex-1`。
  - 圆角 9，compact 7。
  - 文字 21/25 semibold，compact 17/20。
  - action 文字 16/20，compact 12/14。
  - 键与 action 分用两套前景色。
- 颜色来自各 integration 的 `global.css`：keyboard surface、key 背景、action 背景、key 前景、action 前景、border、focus。focus 色随 integration 不同：sample-console 为蓝，sample-wallpaper-console 为红。
- 键帽不指定 fontFamily，用的是系统字体（本会话 grep 未发现任何 fontFamily）。

**surface。**

- 逻辑分辨率固定为 1280×720（laptop，横屏）与 360×640（mobile，竖屏），在各 App 的 `package.json` `terminalSurfaces` 中声明。
- 显示时 X、Y 两个方向分别缩放，不保持比例（`surfaceHost.ts:113-137`、`SurfaceHostController.tsx:134-145`）。
- 键盘读取 `InputSurfaceFrame` 测得的 frame 尺寸。

**留在 RN 的行为。** 编辑、选区、maxLength、一次性 shift、焦点、overlay（zIndex 1001）、避让、`canInteract`（为 false 时 `pointerEvents` 置 none）、`hasNextField` 都在 `ui/base/input` 中实现。两个键盘之间的交接动画为：

- 250 ms，`Easing.inOut(quad)`。
- 分两段：先新键盘升起，再旧键盘落下。
- 除 web 外走 native driver（`InputSurfaceFrame.tsx:858-862`，`keyboardPresentation.ts`）。
- 交接期间两个键盘实例同时渲染，testID 前缀分别为 `outgoing/` 与 `incoming/`。

**消费方。**

| 消费方 | 布局 | 备注 |
|---|---|---|
| 员工登录姓名 | full | |
| 员工登录口令 | full | secure |
| 会员表单姓名 | full | |
| 会员表单手机号 | numeric | |
| 会员表单探针 | alpha、financial | |
| 顾客年龄 | numeric | max 3 |
| 管理员登录 PIN | numeric | max 6，nativeLess |
| topology laptop | financial | mobile 视图无输入框 |
| dev harness | full | |

**包结构与消费方式。** 本会话读源码与 grep 所得：

- `@catering-v2s/ui-base-input` 只有一个出口 `".": "./src/index.ts"`。src 约 4,177 行，test 约 3,991 行。公开导出清单登记在 `input/terminal-invariants.json` 的 `publicExports`。
- 渲染链是 `InputSurfaceFrame`（1,184 行）→ `InputKeyboard` → `VirtualKeyboard`。`InputSurfaceFrame` 的 props 只有 `{onMeasuredFrame, children}`，内部直接 import `InputKeyboard`，并使用未导出的 `useInputPendingFocusCommit`（`contexts/context.ts`）与 `keyboardPresentation`。**`input` 目前没有任何替换键盘渲染器的注入口。**
- 键盘几何（`keyboardHeight.ts`）、布局（`keyboardLayout.ts`）、`labelOf`/`selectedOf`（`VirtualKeyboard.tsx` 内部函数）都没有导出。
- 消费方按包名 import，分两类：
  - 挂载 surface：`ui/base/integration-assembly/src/foundations/integrationAssembly.tsx`（渲染 `<InputSurfaceFrame>`），以及两个 Android App 的 `controlledKeyboardHarness.tsx`。
  - 注册输入框：`ui/feature/sample-member-desk`、`ui/feature/sample-staff-auth`、`ui/base/admin-shell` 使用 `useInputField`、`InputScrollArea`、`useInputSnapshot`、`useInputController`。
- 这两类通过同一个 React context 协作：feature 里的 `useInputField` 必须找到 `InputSurfaceFrame` 内 `InputProvider` 提供的 context。所以“挂载 surface 的包”和“注册输入框的 hook”必须来自同一份模块实例。
- 各包的 `src/dependencies.ts` 以 `moduleName` 声明模块依赖图（例如 `ui/integration/sample-console/src/dependencies.ts` 引入 input 的 `moduleName`），由 `tools/terminal-skeleton/check-static.mjs` 读取（`readDependencyArray`）。
- 包依赖方向由同一文件检查，规则都经 `sourceDependencyViolation`：
  - `runDependencyDirection` 检查全部模块的声明图。声明图正本是 `apps/terminal/skeleton-graph.ts`，并与各包 `dependencies.ts`、`package.json` 做等集校验。
  - `runBaseSourceDependencyBoundary` 额外扫描 package.json、tsconfig 与源码 import，但只扫 base 层与 application 层的包，不扫 `ui/feature/*`。
  - `check-static.mjs:676` 硬编码“29 个节点”。
  - `ui.base.input` 在图中是 `plannedKind: 'owner'`，依赖 `ui.base.render` 与 `ui.base.primitives`。`tools/terminal-shared/package-invariants.mjs` 只校验 `terminal-invariants.json` 的字段形状，不检查依赖方向。
- 包外实际只用到与渲染无关的符号（本会话 grep）：`InputSurfaceFrame`、`InputScrollArea`、`useInputField`、`useInputController`、`useInputKeyboardState`、`useInputSnapshot`、`BUSINESS_FOCUS_SCOPE_ID`、`moduleName` 与类型。
  - `input` 包外没有任何源码 import `VirtualKeyboard` 或 `InputKeyboard`。`admin-shell` 只有一个测试断言登录源码不含 `InputKeyboard` 字样。
  - 包外 33 个 TS 源码或测试文件 import 该包，其中 25 个在业务包（`ui/feature/*` 与 `ui/base/admin-shell`）。
- 真正与渲染器相关的代码很少。`VirtualKeyboard.tsx` 与 `InputKeyboard.tsx` 合计约 420 行：
  - `InputKeyboard` 主要是宿主逻辑：读取键盘状态、计算 compact、dock 宽度与 cellWidth、`canInteract` 时的 `pointerEvents`、`ui.base.input:keyboard-layer` 与 `:backdrop` 容器。
  - 只有 `<VirtualKeyboard>` 这一处是逐键渲染。键盘只在 `InputSurfaceFrame.tsx` 约 1108 行一处渲染，交接时 outgoing 与 incoming 各一个实例。
- `PrimitiveButton` 的 `key` 与 `key-action` variant 只被 `VirtualKeyboard` 使用。
- 每个 Android App 都对应一个 integration 包：sample-terminal 依赖 `@catering-v2s/ui-integration-sample-console`，sample-wallpaper-terminal 依赖 `@catering-v2s/ui-integration-sample-wallpaper-console`。两个 App 的 `controlledKeyboardHarness.tsx` 各自渲染 `<InputSurfaceFrame>`。

**自动化与测试对每个键的 testID 强依赖。** 本会话 grep 共找到 20 个文件：

- Android 设备自动化：`scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-sample2/run-sample{1,2}-frozen-journey.mjs`。它们用 uiautomator 读 `ui.base.input:virtual-keyboard:<keyId>` 的 resource-id 与 bounds，再点按其中心。
- 逐控件视觉审计 roster：`iaControlRoster` 按键逐一列出控件。
- Android 设备脚本还读取 marker 状态：`ter-virtual-keyboard-android.mjs` 的 inventory 解析 `selected`/`clickable`（791-792 行）并对 text 取 hash（796-797 行）；5060 行要求 shift 节点 `enabled` 且 `selected`。
- Web：`scripts/test/ter-admin-display-web.mjs` 用 Playwright `getByTestId(\`ui.base.input:virtual-keyboard:${keyId}${suffix}\`).click()`（367、435、538、656、1011 行），802 行用 `innerText` 读键帽标签，939/946 行用前缀定位。
- Jest：6 个测试文件。其中 `virtualKeyboard.test.tsx` 用 `getByText` 断言标签。

**Rive 运行时。** 2026-09-30 实查 npm 与包内源码：

- `@rive-app/react-native` 0.5.0
  - 基于 Nitro；peer 为 `react-native-nitro-modules >=0.35.10 <0.37`，最新 0.37.1 超出此范围。
  - 要求 RN ≥ 0.78、Expo ≥ 53；没有 config plugin，靠 autolinking 接入。
  - 包内没有 web 实现；`@rive-app/canvas` 这个 optional peer 只被类型生成 CLI 使用。
  - 已确认存在：`RiveView` 的 `artboardName`、`fit`、`layoutScaleFactor`、`dataBind` 属性；`useRiveBoolean`/`useRiveColor`/`useRiveString` 等 hook；以 `/` 访问嵌套 ViewModel；`RiveFonts` fallback font API；`rive-gen-types` 类型生成器。
- Android 默认的新 backend：
  - 不支持 events、state machine inputs 与 text-run API，只能用 data binding。
  - 只处理 pointer 0。
- Web：`@rive-app/react-webgl2` 与 `@rive-app/react-canvas` 均为 4.35.0，core 2.43.1。
  - WASM 默认从 unpkg CDN 加载，可用 `RuntimeLoader.setWasmUrl` 改为自托管。
  - canvas-lite 不支持文字，不可用。
- TER 栈：expo 57.0.18、RN 0.86.3、react-native-web 0.21.2、`newArchEnabled=true`。原生工程已入仓；没有 expo-dev-client 与 eas。
- Metro 不认 `.riv` 与 `.wasm`：本会话实跑 metro-config 0.84.5 与 @expo/metro-config 57.0.12 的默认配置，`assetExts` 均不含 `riv`、`wasm`。仓内三处 Metro 配置都没有改 `assetExts`：`application/base/android/config/index.cjs`（两个 Android App 共用），`ui/integration/sample-console/metro.config.js` 与 `ui/integration/sample-wallpaper-console/metro.config.js`（Expo Web）。因此用 `require('x.riv')` 加载资产，必然要改这三处配置。
- 资产加载入口（包内源码实查）：
  - RN：`useRiveFile` 接受 `number | {uri} | string | ArrayBuffer`；ArrayBuffer 走 `RiveFileFactory.fromBytes`。
  - Web：`RiveFileParameters` 接受 `buffer?: ArrayBuffer`，可替代 `src`。
  - Web WASM：`RuntimeLoader.setWasmUrl`、`setWasmFallbackUrl`、`setWasmBinary(ArrayBuffer)`。默认从 `https://unpkg.com/@rive-app/webgl2@<ver>/rive.wasm` 加载，失败回退 jsdelivr。`rive.wasm` 约 2.2 MB。
- 命中与多点触控（包内源码实查）：
  - trigger 回传：`useRiveTrigger(path, vmi, {onTrigger})`，两个 Android backend 都可用。
  - Android 新 backend（`RiveReactNativeView.kt`）只处理 DOWN、pointer 0 的 MOVE、UP、CANCEL，不处理 POINTER_DOWN/POINTER_UP，即不支持第二根手指。
  - Android legacy backend（`USE_RIVE_LEGACY=true`）的 `RiveAnimationView.multiTouchEnabled` 默认 false，RN 封装层从不设置它。
  - Web（`@rive-app/webgl2` 2.43.1）：`enableMultiTouch` 默认 false，可经 `useRive` 参数开启；关闭时只跟踪首个 touch id。
- RN 0.86.3 Fabric 下，带非空 testID 的 View 一定会生成原生视图（`ViewShadowNode.cpp:70-72`），所以不参与命中的逐键 marker View 仍能保留 resource-id 与 bounds。
- 颜色读取：原生端通过 `primitives/src/foundations/nativeVariable.native.ts` 调用 `react-native-css-interop` 的 `useUnstableNativeVariable` 读取 CSS 变量。web 端的 `nativeVariable.ts` 是一个桩，恒返回 `undefined`。
- Android 默认新 backend 的视图结构（包内 `android/src/new/java/com/rive/RiveReactNativeView.kt`）：
  - `RiveView` 内部是 `TextureView`，因此父级 transform 对它生效。
  - 源码注释说明，自 11.7.x 起 render target 保持创建时的尺寸，尺寸变化时只 resize artboard。
  - 视图在暂停时停止重绘。
  - legacy backend 则基于 `RiveAnimationView`。

## 2. 名词、范围与执行规则

### 2.1 名词

| 名词 | 含义 |
|---|---|
| 布局 | `full` / `alpha` / `numeric` / `financial` 四种之一 |
| surface | `laptop`（1280×720）或 `mobile`（360×640）逻辑画布 |
| 画板 | `.riv` 中的一个 artboard。本需求中一个画板对应一个“布局 × surface” |
| 键帽 | 单个键的视觉，包括底色、边框、圆角、标签或图标、按压与选中动效 |
| 命中 | 由 Rive 完成：Rive 接收触摸，判定落在哪个键上，播放按压视觉，并在该键被“按下后在键内松手”时触发这个键的 trigger |
| 回传 | Rive 通过每个键一个 ViewModel trigger 告诉 RN“哪个键被命中”。回传只携带 keyId，不携带任何业务含义 |
| 推送 | RN 单向写入 Rive ViewModel 的状态值（shift、selected、label、颜色、可交互） |
| marker | RN 侧不参与命中的逐键 View，只承载 testID、bounds 与 `selected`/`enabled` 状态，供自动化读取，不拦截触摸 |
| `input` | 现有包 `apps/terminal/ui/base/input`（`@catering-v2s/ui-base-input`），本需求把它拆成输入核心与 Pressable 渲染器，拆后各自的包名与目录见 D12 |
| 输入核心 | 与渲染方式无关的部分：Provider、字段注册、焦点、编辑、shift、布局目录与每键的标签、选中、图标，几何（含逐键矩形），snapshot，`InputScrollArea`，`InputSurfaceFrame`（呈现、交接与键盘宿主层），testID 构造，以及渲染器契约类型。业务包只依赖它 |
| 键盘渲染器 | 按渲染器契约画出一块键盘、接收点按并报告 keyId 的组件。不含输入语义，不读输入核心的 context |
| 渲染器契约 | 输入核心传给键盘渲染器的 props 类型，由输入核心定义与导出，见 R-18 |
| Pressable 渲染器 | 现行 `VirtualKeyboard`（`PrimitiveButton` 逐键渲染）改造成的渲染器包 |
| `input-rive` | 新建的并列渲染器包 `apps/terminal/ui/base/input-rive`，包内含 Rive 键盘渲染器、marker 与内嵌资产 |
| 内嵌资产模块 | `input-rive` 包内由构建脚本生成的源码模块，以字节形式携带 `.riv`（web 端视 D10 可能还携带 WASM），不经 Metro asset 管线 |
| 切换点 | 每个 `ui/integration/<app>` 包里选定渲染器的那一处代码，见 R-18。一个 App 只有一个切换点 |

### 2.2 范围

- 把 `input` 拆成输入核心与 Pressable 渲染器包，行为零变化（R-20）。
- 新建 `apps/terminal/ui/base/input-rive`。4 种布局 × 2 种 surface，共 8 个画板，放在同一个 `.riv` 中，随 `input-rive` 打包。
- `ui/base/integration-assembly` 增加一个必填的渲染器参数，只做转交，不选择渲染器，也不依赖任何渲染器包。
- 每个 `ui/integration/<app>` 选定一个渲染器，并传给 integration-assembly。
- 两个 Android App 的 `controlledKeyboardHarness` 复用各自 integration 包的选择，不另选。
- §1.3 消费方表中的全部业务消费方，在两种渲染器下都要能用；换渲染器时业务包源码、依赖与测试不改。`ui/base/integration-assembly` 与 `ui/integration/*` 不感知资产。
- 每个 App 只用两者之一，不会在同一个 App 里同时使用。
- 平台为 RN Android 与 RN Web（Expo）。
- `rive/keyboard` 作为唯一资产源工程。

### 2.3 执行规则

- 第三方 API、默认值与版本，按 `doc/platform/third-party-library-usage-standard.md` 以实际解析版本与官方一手资料核实。§1.3 中的第三方事实是 2026-09-30 的快照，详设时须重核。
- 验证顺序遵守 `doc/platform/terminal-coding-standard.md` 的 TR-16，见 §4。
- 批次划分是 DEXTER_DECISION（D13）：整体一批，或“拆分”与“Rive 渲染器”两批。无论哪种，每一批都是一次性完整交付单元：设计、实施、复核各做一次，覆盖该批全范围。不按布局、surface 或平台再拆。

## 3. 必须满足的要求

**R-01 职责边界。** Rive 资产里零业务逻辑。

- 不做编辑、shift 切换、keyId 到输入的映射、焦点与交接决策。
- Rive 负责：画键帽、按压动效、命中判定，以及命中后触发该键的 trigger（D1 = B）。
- 每个 keyId 一个 trigger，放在以 keyId 命名的嵌套 ViewModel 下（例如 `<keyId>/tap`，具体命名由详设定）。trigger 只表示“这个键被命中”。
- `input-rive` 只把命中的 keyId 通过渲染器契约报告给输入核心。输入核心把 keyId 映射回现行 `KeyboardKey`，再走与现状相同的按键处理（R-18）。键盘不可交互（`canInteract` 为 false）或属于交接中的 outgoing 实例时，输入核心忽略报告，Rive 侧也按 R-07 的可交互状态不播放按压视觉。
- 资产使用纯 RML，不含 Luau，因此 `.riv` 不需要签名。命中拟用 Rive state machine listener 的 viewModelChange 动作触发 trigger。`rive/keyboard` 的 RML 能否完整表达“按下在键内、松手在键内才触发、滑出取消”为 UNVERIFIED，由 spike S4 核实；若只能用 Luau 表达，则须同时处理签名，这一变化须报 Dexter。

**R-02 画板集合与尺寸。**

- 8 个画板，命名为 `<layout>-<surface>`，例如 `full-laptop`、`numeric-mobile`。
- 每个画板的尺寸等于该布局在该 surface 上的 dock 尺寸，即 §1.3 的尺寸表。
- 画板内键帽的位置与大小逐一等于 RN 几何算出的键矩形，包括 mobile full 布局右侧余出的 4px。

**R-03 几何单一来源。**

- 键矩形只由输入核心中的一个纯函数给出，输入为布局与 frame 尺寸，输出为每个 keyId 的 `{x, y, w, h}`。它经渲染器契约传给渲染器；`input-rive` 的 marker 与画板生成都用它，不自算。
- financial 末行成对键的宽度在该函数里用显式公式表达，不依赖 flex 等分。
- Pressable 渲染器可以继续用 flex 摆放，但须有测试证明它渲染出的键 bounds 与该函数一致（容差同下文视觉对位）。
- 画板里键帽的摆放与命中区，推荐由该几何函数生成到 RML，防止手工漂移。键帽组件的美术与动效由人工在 `rive/keyboard` 编写。
- 须有一个零容差一致性测试，覆盖 8 个画板：逐键比对画板里的键矩形（含命中区）与几何函数。
- 须有一次视觉对位核对：在 Expo Web 上，同一布局与 surface 下，`input-rive` 的键矩形与 Pressable 渲染器测得的键 bounds 一致。容差由详设给出并说明理由（flex 等分可能带小数像素）。

**R-04 画板选择。**

- 按 frame 宽度精确选择：1280 选 laptop，360 选 mobile。
- 其他宽度如何处理是 DEXTER_DECISION（D4）。推荐：显式诊断，并且键盘不显示（capacity 视为 unsupported），不做静默缩放。
- 详设须核实所有消费方在两种 surface 上测得的 frame 宽度是否恰为 1280 与 360。当前为 UNVERIFIED，Jest 与 dev harness 可能使用其他宽度。

**R-05 marker 与 testID。**

- 每个键保留一个 marker，testID 仍为 `ui.base.input:virtual-keyboard:<keyId>`，含 `testIDSuffix` 与交接时的 `outgoing/`、`incoming/` 前缀。
- 所有键盘 testID 由输入核心的构造函数给出，经渲染器契约传给渲染器。两个渲染器输出同一套 testID，自动化不区分渲染器。
- `ui.base.input` 前缀是自动化 ABI，不随 D12 的包命名改变。
- marker 的 bounds 等于 R-03 的键矩形。
- marker 暴露与现状一致的可读状态：shift 键的 `selected`，所有键的 `enabled`（Android 脚本 5060 行依赖）。text 的取值须让 inventory hash（796-797 行）对当前布局仍有区分度，具体由详设核实。
- marker 不拦截触摸，触摸必须到达 `RiveView`。RN 的 `pointerEvents` 与 web 的 `pointer-events` 在两端的实际路由为 UNVERIFIED，由 spike S11 核实。
- 保留 `:content`、`:region:*`、`:segment:*` 这些容器节点。它们是否仍被自动化使用由详设核实；不被使用的可以不做。
- dock 上的 `stopPropagation`（防止点击键盘时 surface 收起键盘）在触摸改由 `RiveView` 接收之后是否仍成立，为 UNVERIFIED，由 spike S11 核实。
- 键盘不可交互或处于 outgoing 时，`RiveView` 不接收触摸（`pointerEvents` 置 none），与现状一致。
- 结果：自动化按 marker 中心点按，触摸落到 `RiveView`，由 Rive 命中后回传。自动化需要改写的范围见 R-17。

**R-06 v1 视觉基线。**

- v1 按 §1.3 的 token 1:1 复刻现状：
  - dock 背景与 1px 边框。
  - 键与 action 两种底色。
  - 两套前景色。
  - 圆角 9 与 7。
  - 1px border 色边框；pressed 或 selected 时换为 2px focus 色。
  - 文字字号与字重。
  - 图标 path 与尺寸 26 与 19。
- 按压动效复刻透明度与 0.985 缩放。v1 是否另外设计新的动效（例如按下回弹、shift 切换过渡）是 DEXTER_DECISION（D5）。
- 推荐 v1 只做复刻，先把渲染链路打通；新动效在资产侧迭代，不改代码。
- dock 阴影由 RN 容器保留还是画进 Rive，由详设决定，前提是视觉结果一致。

**R-07 ViewModel schema。** RN 写入以下状态，Rive 回传每键 trigger：

| 状态 | 类型 | 方向 | 来源 |
|---|---|---|---|
| `shift` | boolean | RN → Rive | 当前 shift 状态 |
| `interactive` | boolean | RN → Rive | `canInteract` 且非 outgoing；为 false 时不播放按压视觉 |
| 每个键的 `tap` | trigger | Rive → RN | Rive 命中 |
| 每个键的 `selected` | boolean | RN → Rive | 由输入核心算出，经渲染器契约传入（R-08） |
| 每个键的 `label` | string | RN → Rive | 由输入核心算出，经渲染器契约传入（R-08） |
| 颜色集合 | color | RN → Rive | 当前 integration 主题（见 R-09） |

- 不再有 RN 推送的 `pressed`：按压视觉完全由 Rive 本地处理。

- 每个键的状态放在以 keyId 命名的嵌套 ViewModel 下，用 `/` 路径访问。
- schema 的正本在 `rive/keyboard`。RN 侧的类型由 `rive-gen-types` 生成或由等价的机器检查保证一致，不能两边手写后靠人工对齐。

**R-08 标签。**

- 推荐：RN 计算标签字符串并推送给 Rive。备选：把标签烘焙进画板，再加一致性测试。这是 DEXTER_DECISION（D2）。
- 每个键的 label、selected、图标与 accessibilityLabel 只由输入核心算出（现行 `labelOf`、`selectedOf`、`iconOf`、`accessibilityLabelOf` 移入核心），经渲染器契约传给渲染器。两个渲染器都不自算，来源唯一。
- 须嵌入字体，并做子集化，覆盖全部标签字符：
  - `a–z`、`A–Z`、`0–9`
  - `: / . ? & = - _ % +`
  - `−`（U+2212）、`·`（U+00B7）、`⇧`（U+21E7）、`␣`（U+2423）
  - `SHIFT`、`SPACE`
- 字体选择是 DEXTER_DECISION（D3）。推荐 Roboto，与 Android 现状最接近。以下两点均为 UNVERIFIED，须在 spike 中用字体工具核实：
  - 许可证。
  - Roboto 是否含 ⇧ 与 ␣。现状下这两个字符可能由系统回退字体渲染。
- 现状 web 端使用 system-ui，嵌入字体后两端字形将统一。这是可见变化，需 Dexter 知悉。

**R-09 颜色。**

- 颜色取自当前 integration 主题，推送到 VM 的 color 属性。不在 Rive 里写死某一个主题的颜色。
- 原生端可复用现有 `useNativeVariable`。web 端现有实现是桩（恒返回 `undefined`），详设须给出 web 端读取 CSS 变量的方式。仓内是否已有可复用能力为 UNVERIFIED。
- 验收：sample-console（蓝 focus）与 sample-wallpaper-console（红 focus）两个主题下，颜色都与现状一致。

**R-10 反馈时延与命中语义。**

- 命中语义与现状一致：在键内按下、在键内松手才算一次输入；按下后滑出键外再松手不算。`onKey` 在松手时触发。
- 按压视觉由 Rive 本地播放，按下后不超过 2 帧出现（60 Hz 下约 33 ms）。
- 从松手到 RN 收到 trigger 并调用 `onKey` 的时延须在两端真机或浏览器上实测，并与现状 `onPress` 的时延对照，不得明显劣于现状。阈值由 spike S4 给出基线后在详设中写定。trigger 回调在哪个线程、经几次跨线程到达 JS，为 UNVERIFIED。
- 快速连续输入时不得丢键。trigger 是“触发一次即清零”的值，同一帧内同一个键被触发两次是否会合并为一次，为 UNVERIFIED，由 spike S10 核实；若会合并，详设须给出不丢键的办法（例如改用计数值）。

**R-11 交接动画不变。**

- 250 ms、`Easing.inOut(quad)`、两段式、native driver（web 除外）的交接逻辑保持在 RN，由输入核心的 `InputSurfaceFrame` 驱动，与用哪个渲染器无关。
- 交接期间两个 `RiveView` 实例同时存在，并随父级 translateY 移动，不得出现空白帧、闪烁或撕裂。outgoing 实例不接收触摸，也不回传有效输入（R-01）。
- 新 backend 基于 TextureView，父级 transform 理论上生效。native driver 下的实际表现须在 spike 中实测。

**R-12 多点触控。** 触摸改由 Rive 接收后，多点触控表现不得劣于现状基线，除非 Dexter 在 D9 中接受单指。已核实的事实（§1.3）：

- Android 新 backend 只处理 pointer 0，不支持第二根手指。
- Android legacy backend 的 `multiTouchEnabled` 默认 false，RN 封装层不设置它。
- Web 的 `enableMultiTouch` 默认 false，可经 `useRive` 参数开启。本需求要求 web 端开启。
- 现状 RN Pressable 下两指交替快速输入的实际表现（基线）为 UNVERIFIED，须先在真机上测（spike S9），再由 Dexter 在 D9 中裁定 Android 的处理方式。

**R-13 平台与依赖。**

- Android 使用 `@rive-app/react-native`。其 peer 依赖为 `react-native-nitro-modules >=0.35.10 <0.37`，本需求取 0.36.5。两者都精确锁定版本。
- Android backend 的选择与 D9 绑定：若 D9 选 legacy 路线，则启用 `USE_RIVE_LEGACY` 并说明由谁设置 `multiTouchEnabled`；否则使用默认新 backend，且须满足 R-10、R-11、R-15。
- 依赖声明：
  - `input-rive` 把 Rive 与 Nitro 声明为 peer，沿用仓内 `react-native-svg` 的现行模式。
  - 选用 `input-rive` 的 Android App 把它们声明为 dependency，使原生 autolinking 生效。选用 Pressable 渲染器的 App 不引入 Rive 原生依赖。
  - web 所需的包由选用 `input-rive` 的 `ui/integration/*` 声明为 dependency，这是包管理层面的声明，不涉及资产。
- 详设须核实 yarn workspace 下 Nitro 与 Rive 的 autolinking 实际生效。现为 UNVERIFIED。
- Web 通过 `.web.tsx` 平台分离，使用 `@rive-app/react-webgl2` 或 `@rive-app/react-canvas`，版本精确锁定。两者之间由 spike 按 R-15 的清晰度与 R-10 的时延决定。不可使用 canvas-lite，因为它不支持文字。
- Web 的 WASM 按 D10 处理。无论选哪种，运行时都不得访问 unpkg、jsdelivr 或其他 CDN：不依赖默认 URL，并调用 `setWasmFallbackUrl` 关闭回退（其是否接受空值为 UNVERIFIED，详设核实）。
- 不得修改三处 Metro 配置的 `assetExts`（§1.3）。资产以字节形式内嵌（R-14），不走 Metro asset 管线。
- Android 与 Web 两端共享同一份 `.riv` 字节、同一套几何（来自输入核心）、marker 与 trigger 映射逻辑。平台差异只允许出现在渲染适配器文件里。

**R-14 资产源、构建、内嵌与加载。**

- `rive/keyboard` 是唯一资产源。`.riv` 用 Rive CLI 可复现地构建出来，再由生成脚本转成 `input-rive` 包内的内嵌资产模块。禁止手工替换二进制或手改生成文件。
- 须有一个新鲜度门：重新从 `rive/keyboard` 构建并生成，结果与仓内内嵌模块逐字节一致，否则失败。这是真实重算，不是台账比对。
- RN 端以 `useRiveFile(ArrayBuffer)` 加载，web 端以 `buffer` 参数加载。字节解码方式（例如 base64）在 Hermes 与浏览器上的可用性与耗时为 UNVERIFIED，由 spike S12 核实。
- 键盘 `.riv` 全局只加载一次，所有键盘实例共享。首次弹出键盘之前须已完成加载或预热，首次弹出不得出现空白 dock。须在真机上实测首次加载与首帧耗时，以及内嵌资产使 JS bundle 增大的字节数，并写入证据。
- 加载失败时的表现（诊断方式、键盘如何呈现）由详设给出。不得在 `input-rive` 内回退到 Pressable 渲染器（R-16）。

**R-15 清晰度。**

- surface 显示时 X、Y 方向分别拉伸（§1.3），`TextureView` 的 render target 按创建时的尺寸生成，所以放大后存在模糊风险。
- 验收：在双屏真机（laptop surface）与 mobile 虚拟机上截图，标签与边缘的清晰度不低于现状 RN 截图。
- 如果不达标，详设须给出放大渲染分辨率的办法（例如 `layoutScaleFactor`，或按实际像素尺寸渲染），并在 spike 中证明有效。

**R-16 两个并列渲染器，每个 App 只用一个。**

- Pressable 渲染器与 `input-rive` 是两个并列的渲染器包，地位相同，不是“旧方案与新方案”。两者都长期保留，按 App 需要二选一。
- 每个 App 在切换点选定其一。同一 App 内不得同时依赖两个渲染器包。
- 两个渲染器包内部都不保留运行时开关、fallback，也不回退到另一个渲染器。
- 不删除 `PrimitiveButton` 的 `key` 与 `key-action` variant、token 与键盘图标 path，Pressable 渲染器仍在使用它们。

**R-17 测试与自动化。**

- Jest 中 mock Rive 渲染适配器，不在 Jest 里跑 Rive。trigger 回传以 mock 触发的方式测试 keyId → `KeyboardKey` 映射、不可交互与 outgoing 时忽略。
- `input` 的现有测试随代码迁到输入核心或 Pressable 渲染器包：
  - 只允许改 import 路径与渲染器注入方式，断言不改。
  - 迁移后必须全部通过（R-20）。
  - 依赖渲染的核心测试（例如 `provider.test.tsx` 直接渲染 `InputKeyboard`）改为注入 Pressable 渲染器或测试渲染器，二者择一由详设说明。
- 输入核心有一个渲染器契约测试。它用一个测试渲染器，断言：
  - 契约传入的键集合、矩形、label、selected、icon 与 testID 正确；
  - 报告 keyId 后产生正确的 `KeyboardKey` 与编辑结果；
  - 不可交互与 outgoing 时报告被忽略。
- `input-rive` 有自己的测试，覆盖现有键盘测试的全部语义：大小写、shift 字符、`−`、`·`、compact 标签、selected、icon 键。标签断言改为断言推送给适配器的 label 与 VM 值。
- Android 设备脚本（`ter-virtual-keyboard-android.mjs` 等）：按 bounds 中心坐标点按，触摸落到 `RiveView`，点击逻辑预计不需改。须核实 inventory 对 `selected`/`clickable`/text hash 的依赖（§1.3）在 marker 上仍成立，不成立处改写。
- Web 脚本（`ter-admin-display-web.mjs`）：
  - `getByTestId(...).click()` 在 marker 不接收指针事件时，会被 Playwright 的可操作性检查判为“被其他元素遮挡”。须改为按 marker bounds 中心做坐标点击，或经核实可行的等价办法。Playwright 在此情形下的确切行为为 UNVERIFIED，详设按所用版本的官方文档核实。
  - 802 行用 `innerText` 读键帽标签，Rive 画在 canvas 里读不到。marker 须以 data 属性等方式暴露当前标签，脚本相应改写。
  - 939/946 行的前缀定位保持可用。
- `iaControlRoster` 与逐控件视觉审计：详设须核实它们对 PrimitiveButton 内部结构的依赖，改写后仍须覆盖逐键视觉。
- 用 Pressable 渲染器的 App 的现有自动化不改，并须继续通过（R-20）。
- 自动化的改写只作用于用 `input-rive` 的 App 的运行。

**R-18 包结构、渲染器契约与组装。**

- 渲染器契约：
  - 由输入核心定义并导出。草案形态为 `{layout, width, height, compact, keys: [{keyId, rect, label, icon?, selected?, kind, testID}], interactive, onKeyPress(keyId)}`，确切形态由详设定。
  - 渲染器只报告 keyId。keyId → `KeyboardKey` 的映射与按键处理都在核心。
  - 渲染器是纯组件：不读输入核心的 context 或 hook，只消费契约 props。这样契约之外没有隐藏耦合，两个渲染器可以互换。
- 键盘宿主层留在核心：
  - 由核心负责的部分：键盘状态读取、dock 宽度与 cellWidth、compact、`canInteract` 时的 `pointerEvents`、`ui.base.input:keyboard-layer` 容器。
  - 默认也由核心负责：`:backdrop` 容器与 dock 背景。详设可以论证把 dock 背景画进 Rive（R-06），前提是 testID 与视觉结果不变。
- 注入：
  - `InputSurfaceFrame` 与 `createIntegrationAssembly` 各增加一个必填的 `keyboardRenderer` 参数，不设默认值。
  - integration-assembly 只转交，不依赖任何渲染器包。
  - 输入核心不 import 任何渲染器包。
- 切换点：
  - 每个 `ui/integration/<app>` 在一处代码选定渲染器，传给 `createIntegrationAssembly`，并导出这个选择。
  - 两个 Android App 的 `controlledKeyboardHarness` 用各自 integration 包导出的选择，不另选。
  - 改这一处即可让该 App 换用另一个渲染器。
- 依赖方向门：
  - 扩展 `tools/terminal-skeleton/check-static.mjs` 的依赖方向规则：只有 `ui.integration.*` 与非 base 的 `application.*` 可以依赖渲染器包。业务包（`ui.feature.*`、`ui.base.admin-shell`）、`ui.base.integration-assembly` 与输入核心依赖渲染器包即失败。
  - 源码 import 扫描目前不覆盖 `ui/feature/*`（§1.3），须扩到业务包，否则 feature 源码直接 import 渲染器不会被发现。
  - 新包登记进 `apps/terminal/skeleton-graph.ts`，并同步更新 `check-static.mjs` 的节点数硬编码。
  - 须用一次变异验证该门：在 scratch 拷贝中让一个 feature 包 import 渲染器包，门必须失败。
- 每个新包都有自己的 `package.json`、`terminal-invariants.json`、`src/dependencies.ts` 与 `moduleName`，通过 `check-static.mjs` 与 `package-invariants.mjs`。
- 公开面：
  - 输入核心的 `publicExports` 去掉 `VirtualKeyboard` 与 `InputKeyboard`，加入契约类型。
  - 渲染器包只导出各自的渲染器与 `moduleName` 等包元数据。

**R-19 资产不外泄。**

- `.riv` 字节（以及 D10 选内嵌时的 WASM）只存在于 `input-rive` 包内。
- `ui/base/integration-assembly`、`ui/integration/*` 与 Android App 不 import、不声明、不配置任何键盘资产，不感知资产的格式、位置与加载方式。它们在切换点看到的只是一个渲染器组件。
- 预热（R-14）由 `input-rive` 自己完成，不要求上层调用预热 API。若详设认为必须由上层触发，须报 Dexter。

**R-20 拆分零行为变化。**

- 拆分只允许三类改动：
  - 搬移代码；
  - 改 import；
  - 增加渲染器参数与契约。
- 不改键位、编辑、shift、焦点、交接、测量与视觉。
- 证据：
  - 迁移后的原有测试不改断言且全部通过；
  - 两个 App 的现有 Web 与 Android 自动化在 Pressable 渲染器下不改且通过；
  - Pressable 渲染器下 8 个“布局 × surface”截图与拆分前逐像素一致，不一致处须逐项解释并由评审接受。
- 不保留兼容别名或临时 re-export（例如核心继续导出 `VirtualKeyboard`）。消费方的 import 一次改到位。

**R-21 TR-17 同步修订。**

`doc/platform/terminal-coding-standard.md` 的 TR-17 以单包 `input` 为前提写成，须随本需求同步修订：

- 第 1 条：input owner 改指输入核心。业务不得 import 或渲染任何键盘渲染器。在 `ui/integration` 选定渲染器属于组装，不算“各自实现键盘”。
- 第 5 条：布局目录正本路径改为核心的新路径（随 D12）。
- 第 7 条：Rive 渲染器内部的渲染循环与键帽按压动效，不算“每个键另建动画时钟”；presentation progress 仍只有一个，在核心。
- 第 9 条：公共面同步的范围扩到渲染器契约与两个渲染器包。

修订稿由实施方起草，随同批次一起评审；评审通过前，TR-17 原文照常生效。

## 4. 验证与交付

### 4.1 spike 先行

详设冻结之前先做一次 spike，只在 dev harness 或独立的 scratch 目录中进行，不接入消费方。spike 必须回答下列问题，每项给出新鲜运行的证据：

| # | 问题 | 通过标准 |
|---|---|---|
| S1 | Android 新 backend 的 `RiveView` 在 surface 的非等比拉伸 transform 下，叠加 native driver 的 translateY，能否正常显示 | 双屏真机与 mobile 虚拟机上无空白、无错位，交接无闪烁 |
| S2 | 交接期间两个实例同时渲染 | 同 S1；帧率不低于现状 |
| S3 | web 端渲染器选型（webgl2 与 canvas），以及 D10 的 WASM 供给方式 | Expo Web 离线状态下能加载；网络面板无 CDN 请求；给出 WASM 使 web bundle 增大的字节数 |
| S4 | RML 能否表达 R-01/R-10 的命中语义（键内按下、键内松手、滑出取消）；按压视觉时延；松手到 `onKey` 的时延 | 语义三种情形各有实测；按压视觉满足 2 帧；给出 trigger 时延与现状 `onPress` 的对照数据，两端各给实测方法 |
| S5 | 字体字形与许可证 | 用字体工具列出 R-08 字符集的覆盖情况；许可证原文 |
| S6 | 清晰度 | 满足 R-15 |
| S7 | yarn workspace 下 Nitro 与 Rive 的 autolinking | 两个 Android 应用都能构建并运行 |
| S8 | web 端读取主题颜色 | 两个 integration 主题下都能取到 R-09 所需颜色 |
| S9 | Android 多点触控：现状 RN 基线；新 backend 与 legacy backend（开启 `multiTouchEnabled`）在两指交替快速输入下的表现 | 三者同一场景的实测对照，供 D9 裁定 |
| S10 | web 开启 `enableMultiTouch` 后的表现；同一帧内同一键被触发两次是否合并 | 两端实测；若合并，给出不丢键方案并实测 |
| S11 | marker 不拦截触摸、触摸到达 `RiveView` 的路由；dock `stopPropagation` 是否仍防止 surface 收起键盘 | 两端实测点按 marker 中心（web 端用 Playwright 坐标点击），Rive 收到触摸并回传 trigger，surface 不收起键盘 |
| S12 | 内嵌字节的加载路径：RN `useRiveFile(ArrayBuffer)` 与 web `buffer`；Hermes 与浏览器上的字节解码 | 两端都能从内嵌模块加载；给出解码耗时与 bundle 增量 |
| S13 | uiautomator 能否读到 marker 的 resource-id、bounds、`selected`、`enabled` | 在真机 dump 中逐项可见，且 bounds 与 R-03 几何一致 |

任何一项不通过，都停下来报告，由 Dexter 决定是否继续使用 Rive 或调整方案。不得用降级方案绕过。

spike 在拆分之前进行，不改 `input`。它在 scratch 目录或 dev harness 里用一个按 R-18 草案手写的契约桩喂数据，不依赖拆分后的核心。这样 spike 失败时，拆分可以不做（D13）。

### 4.2 TR-16 两端顺序与场景清单

按 `doc/platform/terminal-coding-standard.md` 的 TR-16 执行：

1. 先在 `ui/integration` 的 Expo Web 上跑通全部场景。
2. 再在 `application` 的真机上跑同一份场景清单。
3. 两端结果逐项对照。

web 端与 Android 端是不同的渲染引擎，所以 web 通过不代表 Android 通过，两端都必须有新鲜证据。

场景清单覆盖 4 种布局 × 2 种 surface（topology mobile 视 D6 而定），在两种渲染器下各跑一遍：用 `input-rive` 的 App 跑 Rive 渲染器；为对照，同一清单也在 Pressable 渲染器下跑（可在 dev harness 中临时换用，不改 App 的切换点）。两种渲染器的结果须逐项一致：

- 键盘弹出，首帧即完整，无空白 dock。
- 逐键点按：输出字符正确，按压视觉出现后消失。
- 按下后滑出键外再松手：不输出。
- shift：一次性 shift 的切换与自动复位，标签随之变化。
- backspace。
- complete：有下一个输入框时跳到下一框，没有时收起。
- 布局交接：例如会员表单从 full 到 numeric，250 ms 两段式。
- `canInteract` 为 false 时点按无效。
- 快速连续输入无丢键。
- 多点触控按 D9 的裁定对照。
- 两个主题的颜色对照。

### 4.3 机器门

- 几何一致性测试（R-03），覆盖 8 个画板。
- VM schema 一致性检查（R-07）。
- 输入核心、Pressable 渲染器包、`input-rive` 与受影响包的 Jest 全部通过；迁移来的原有测试断言不改（R-17、R-20）。
- 渲染器契约测试（R-17）。
- 依赖方向门扩展后通过，且经一次 scratch 变异证明能拦住业务包依赖渲染器包（R-18）。
- 拆分零行为变化的证据（R-20）。
- 内嵌资产新鲜度门（R-14）。
- `rive/keyboard` 上 `rive . --verify` 通过，CLI 构建可复现。
- §1.3 列出的 Android 与 Web 自动化脚本全部通过：用 Pressable 渲染器的 App 跑原脚本，用 `input-rive` 的 App 跑按 R-17 改写后的脚本。

### 4.4 视觉对照

- 基线图取自拆分前 `input` 的现状渲染：两端、两个 surface、4 种布局、两个主题，包括常态、按压态与 shift 态。
- 拆分后，Pressable 渲染器在相同条件下的截图须与基线一致（R-20）。之后 Pressable 渲染器长期保留，基线可随时重取。
- 实施后在相同条件下截图，逐张对照。v1 的目标是 1:1（R-06）。差异逐项列出，由 Dexter 裁定是否接受。

### 4.5 评审

- 本需求、详设与实施完成后的整批，都须由 fresh 独立子 agent 盲审，遵循 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。
- 按批次原子交付规则，每个批次（D13）是一个完整单元，不按布局、平台或文件再拆开评审。

## 5. 决策与方案合理性

### 5.1 Dexter 已裁定（2026-09-30 会话）

- Rive 里不放任何业务逻辑（R-01）。
- 本项目不需要无障碍。
- 同时支持 RN Android 与 RN Web。
- surface 逻辑分辨率固定为 1280×720（laptop）与 360×640（mobile），画板按这两个尺寸设计。
- D1 = 方案 B：全部交给 Rive，Rive 命中并回传 trigger。
- 新建并列的 `ui/base/input-rive`；用哪个在代码里切换；一个 App 只用其一。
- 包结构方向：`input` 与 `input-rive` 是两个并行包，二选一；业务需要哪个，就在 `ui/integration` 包里组装哪个；无论用哪个，对业务透明无感。据此优化 `input`。
- `.riv` 资产随 `input-rive` 打包，`integration-assembly` 与 `integration` 不感知资产。

### 5.2 待 Dexter 裁定（DEXTER_DECISION）

| # | 问题 | 选项 | 推荐 | 理由 |
|---|---|---|---|---|
| D2 | 标签来源 | RN 推送字符串；烘焙进画板 | RN 推送 | shift 与 compact 规则只在输入核心维护，来源唯一（R-08） |
| D3 | 字体 | Roboto；其他 | Roboto | 最接近 Android 现状；许可证与 ⇧、␣ 覆盖待 spike 核实 |
| D4 | frame 宽度不是 1280 或 360 时 | 显式诊断且不显示；按最近画板缩放 | 显式诊断 | Dexter 已固定两种分辨率，静默缩放会掩盖配置错误 |
| D5 | v1 动效范围 | 1:1 复刻；同时设计新动效 | 1:1 复刻 | 先打通链路；新动效只改资产，不改代码 |
| D6 | topology mobile | 确认无输入框、不在范围内；另行纳入 | 确认不在范围 | §1.3 现状：mobile 视图无输入框 |
| D8 | 首个启用 `input-rive` 的 App | sample-console（sample-terminal）；sample-wallpaper-console（sample-wallpaper-terminal）；两者同时 | 由 Dexter 指定 | 切换点见 R-18，各 App 在 `ui/integration` 选定渲染器；本项只需先决定哪个 App 先启用 |
| D9 | Android 多点触控 | 接受单指（若 S9 证明现状基线实际也是单指）；legacy backend 并由 `input-rive` 设法开启 `multiTouchEnabled`（可能需要 patch 第三方包）；等上游支持 | 先跑 S9 再裁 | 现状基线未测；patch 第三方包有升级维护成本 |
| D10 | web WASM 供给 | 内嵌：`.web.ts` 模块携带 WASM 字节，经 `setWasmBinary` 注入；自托管 URL：需要 Metro 或静态资源配置 | 内嵌 | 满足”资产随包”，不改 Metro 配置；代价是 web bundle 增加约 2–3 MB（UNVERIFIED，S3/S12 实测） |
| D12 | 拆分后的包命名 | N1：核心迁到新包（例如 `ui/base/input-core`），`ui/base/input` 成为 Pressable 渲染器包，与 `input-rive` 并列；N2：`ui/base/input` 留作核心，Pressable 渲染器迁到新包（例如 `ui/base/input-pressable`） | N1 | 见下方说明 |
| D13 | 批次划分 | 整体一批；spike 通过后分两批（先拆分，再 Rive 渲染器） | spike 先行，通过后分两批 | 见下方说明 |

**D12 说明。** Dexter 的原话是“input 包和 input-rive 是两个并行包”。

- N1 让 `input` 与 `input-rive` 字面上就是两个并列的渲染器包，名字与职责一致。代价是业务包的 import 要改到核心的新包名：包外 33 个文件，其中 25 个在业务包（§1.3）。这是一次性的机械替换，由类型检查兜底。
- N2 不动业务 import，但 `input` 会是“核心”而不是与 `input-rive` 并列的包，名字与 Dexter 的说法相反，以后读代码的人容易误解。
- 两者的 testID 前缀都保持 `ui.base.input`（R-05）。

推荐 N1。若 Dexter 更在意少改业务文件，选 N2 也不影响其他需求。

**D13 说明。**

- 拆分本身不依赖 Rive。它有现成的测试、自动化与截图做零行为变化的证据（R-20），适合单独成批，评审也能在一次会话内核完。
- 但如果 Rive spike 失败，拆出来的契约只有 Pressable 一个实现，属于项目 CLAUDE.md 所说的“未经验证的抽象”。所以推荐先做 spike（它不依赖拆分，§4.1）：
  - spike 通过，再按“拆分”“Rive 渲染器”两批推进；
  - spike 失败，由 Dexter 决定是否仍要拆分。
- 整体一批也可行，但单批范围大，评审难以在半小时内核完。

### 5.3 由 spike 定的技术选择（不需 Dexter 裁定）

- web 端渲染器：`react-webgl2` 或 `react-canvas`（S3、S4、S6）。
- Android backend：新 backend 或 legacy，受 D9 约束（S1、S9）。
- 字节解码方式与预热时机（S12）。
- 同帧重复触发的处理（S10）。
- dock 阴影放在 RN 容器还是画进 Rive（R-06）。
- 清晰度不足时的放大渲染方式（R-15）。

### 5.4 方案合理性

**问题对不对。** Dexter 要的是键盘整体由 Rive 资产描述：外观、动效与命中都在资产侧，改键盘视觉不必改代码；同时保留现有 `input` 可随时切回。Dexter 没有要求改变键盘行为、布局或交接。所以本需求替换的是键的绘制与命中，编辑、焦点、shift 语义与交接仍由 RN 负责。如果 Dexter 的真实意图还包括新的交互（例如长按、滑动输入），那属于新范围，需另行提出。

**方案优不优。** B 与并列包是 Dexter 的裁定，这里只记录被放弃的替代及其理由，供 Dexter 知悉代价：

| 方案 | 做法 | 相对 B 的得失 | 状态 |
|---|---|---|---|
| A | 不用 Rive，保持 RN 键，用 Reanimated 做动效 | 零新依赖、零多点触控与自动化风险；但动效仍要改代码，不满足指派 | 不选；若 spike 失败，是回退候选 |
| H | RN 透明命中层 + Rive 只渲染，单向 VM 推送 | 行为与自动化基本不变，多点触控沿用 RN；但命中不在 Rive，与 Dexter 要的”全部交给 Rive”不符 | 不选 |
| C | RN 键保持现状，Rive 只叠一层按压反馈 | 改动最小；但键帽外观仍在 RN，达不到资产侧迭代 | 不选 |
| 在 `input` 内加开关 | 不新建包，`input` 内部二选一 | 少一个包；但资产与 Rive 依赖会进入 `input`，所有 App 都被迫带上 | 与 Dexter 的”并列包、资产随包”冲突，不选 |
| 构建期模块别名 | 不拆 `input`；`input-rive` 复制 `input` 全部公开 API，按 App 把包名别名到 `input-rive` | 业务与 integration 零改动；但要复制约 4.2k 行源码与约 4k 行测试并长期漂移，还要按 App 同步改 Metro `resolveRequest`、tsconfig paths 与 Jest 映射三套配置 | 不选：违反 DRY，切换也不在 `ui/integration` 代码里 |
| 可选渲染器接缝 | 不拆 `input`，只给 `InputSurfaceFrame` 加一个可选的渲染器 prop，默认用 Pressable | 改动最小；但 Pressable 会是默认值而不是并列选项，业务包间接依赖它，`input-rive` 也要依赖 `input` | 不选：不满足”两个并行包、二选一” |

**代价配不配。** B 与“核心 + 两个并列渲染器”需要承担以下成本，应在裁定 D8–D13 前知悉：

- 自动化须改造：Web 脚本从按 testID 点击改为按坐标点击；Android 巡检须能从 marker 读到 `selected`、`enabled`（R-05、R-17、S11、S13）。
- 多点触控：Android 新 backend 只处理 pointer 0，legacy backend 默认也不开多点，可能退化为单指（D9、S9）。
- 42 个 keyId 各自一个 trigger，资产与 RN 映射须由测试保持一致（R-07、R-14）。
- 拆分：约 420 行渲染器代码与 5 个每键函数（`keyboardKeyOf`、`labelOf`、`selectedOf`、`iconOf`、`accessibilityLabelOf`）迁移；两个必填参数；N1 下约 33 个文件改 import（D12）；依赖方向门扩展与节点数更新；TR-17 修订一次（R-21）。
- 内嵌资产：`.riv` 以生成模块形式进入 bundle；web 再内嵌约 2–3 MB WASM（UNVERIFIED，D10、S3、S12）。
- 若纯 RML 的 listener 表达不了“按下并在键内抬起才触发”，需要 Luau，随之带来签名与构建链成本（S4），届时须告知 Dexter。
- 新增原生依赖 `@rive-app/react-native` 与 `react-native-nitro-modules`，Nitro 的 peer 窗口窄（`<0.37`）。
- 须嵌入并子集化字体；TextureView 在 surface 拉伸下有模糊风险（R-15）。

这些成本对“键盘整体资产化、按 App 二选一且对业务透明”这一目标来说配得上，前提是 spike 通过。拆分的收益不只服务 Rive：渲染与输入语义分开后，业务包不再能碰到键盘渲染，依赖门可以机器拦住。spike 在多点触控或命中语义上失败时，推荐先回到 Dexter 裁定：接受限制、改为 H，或回到 A。

### 5.5 UI 与交互自问

- **操作是否来自用户要求或已批准的 Journey：** 是。本需求不新增或删除任何操作，所有键与交接都来自现行 VK 需求与现有消费方。
- **用户此时这样操作是否合逻辑：** 行为不变，沿用现行 VK 需求的结论。唯一可见的语义差异是“按下后滑出键外即取消”（R-10），须与现状核对；若现状不是这样，按现状对齐或由 Dexter 裁定。
- **是否有更短、更自然的路径：** 本需求只换绘制与命中，不改路径。
- **不合理之处来自哪里：** 新增约束都来自方案 B 与并列包的技术选择，不是产品语义：marker 须与画板几何一致、自动化改为坐标点击、`input` 拆成核心与渲染器并由 integration 注入（R-18）、多点触控可能受限（D9）。financial 成对键宽度改为显式公式，也是出于几何一致的原因，视觉结果不变。

## 6. 非目标与授权边界

**非目标：**

- 无障碍（Dexter 已裁定不需要）。
- Electron 或其他宿主。
- 系统 IME、emoji、语音输入。
- 长按 CAPS 锁定等新交互。
- 修改布局、键序、键的行为或交接逻辑。
- 在拆分之外改变 `input` 的任何行为（R-20）；删除 Pressable 渲染器。
- 运行时在两个渲染器之间切换，或一个 App 同时使用两者。
- 让业务包感知或选择渲染器。
- 让 `integration-assembly`、`integration` 或 Android App 感知 `.riv` 或 WASM 资产。
- 修改三处 Metro 配置的 `assetExts`。
- topology mobile（视 D6）。

**授权边界：** 本文只是需求。它不授权详设定稿、实施、新增依赖、修改原生工程、patch 第三方包、设备操作或数据操作。D2–D6、D8–D10、D12、D13 裁定、独立盲审通过后，才能进入详设。

## 7. 与现行正本、既有裁定的关系

- VK 需求仍是键盘行为的正本：编辑、选择、shift、焦点、overlay、避让与交接。本文只替换键的绘制与命中，不改变 VK 需求的任何行为结论。如有冲突，以 VK 需求为准，并回来修订本文。
- 输入核心是键盘输入行为的实现正本。两个渲染器只通过渲染器契约与它交互，语义上须等价（R-16、R-17、R-18）。
- `doc/platform/terminal-coding-standard.md` 的 TR-17 须按 R-21 同步修订，修订前原文照常生效。
- `doc/platform/terminal-coding-standard.md` 的 TR-16 约束验证顺序（§4.2）。
- `doc/platform/third-party-library-usage-standard.md` 约束 Rive 与 Nitro 的版本核实。§1.3 的第三方事实是 2026-09-30 的实查结果，详设开工前须按该标准重核实际解析版本。
- `rive/keyboard` 是资产、VM schema 与 trigger 命名的正本（R-07、R-14）；进入 bundle 的是 `input-rive` 内由它生成的内嵌模块。

## 8. 风险与未决

| # | 风险或未决 | 状态 | 处置 |
|---|---|---|---|
| K1 | TextureView 的 render target 保持创建尺寸，surface 拉伸下可能模糊 | 源码注释为证，实际效果 UNVERIFIED | S6、R-15 |
| K2 | 按压视觉与 trigger 回传的时延；trigger 回调所在线程 | UNVERIFIED | S4、R-10 |
| K3 | 交接时两个实例同时渲染的性能与闪烁 | UNVERIFIED | S1、S2 |
| K4 | web 端没有现成的主题颜色读取方式 | 已确认 `nativeVariable.ts` 是桩 | S8、R-09 |
| K5 | yarn workspace 下 Nitro 与 Rive 的 autolinking | UNVERIFIED | S7、R-13 |
| K6 | Nitro 的 peer 窗口窄（`>=0.35.10 <0.37`），最新版 0.37.1 已超出 | 已确认 | 精确锁定 0.36.5；升级 RN 时同步核对 |
| K7 | web WASM 内嵌后的 bundle 体积与首次加载耗时 | 体积为估计值，UNVERIFIED | S3、S12、D10 |
| K8 | 消费方在两种 surface 上的 frame 宽度是否恰为 1280 与 360 | UNVERIFIED | R-04、D4 |
| K9 | Roboto 是否含 ⇧、␣ 及其许可证 | UNVERIFIED | S5、D3 |
| K10 | TER 有他人并行修改，§1.3 事实可能漂移 | 已知 | 详设开工前重核 |
| K11 | Android 多点触控：新 backend 只处理 pointer 0，legacy 默认不开多点 | 源码已确认；现状基线 UNVERIFIED | S9、D9 |
| K12 | 同帧两个 trigger 是否合并、丢失 | UNVERIFIED | S10、R-10 |
| K13 | 纯 RML listener 能否表达“键内按下并抬起”；不能则需 Luau 与签名 | UNVERIFIED | S4、R-01 |
| K14 | marker 是否拦截触摸、`stopPropagation` 是否仍有效、uiautomator 能否读到 marker 属性 | UNVERIFIED | S11、S13、R-05 |
| K15 | Playwright 坐标点击能否命中 Rive canvas 并触发 listener | UNVERIFIED | S11、R-17 |
| K16 | Hermes 下 base64 内嵌字节的解码开销与 `useRiveFile(ArrayBuffer)` 路径 | UNVERIFIED | S12、R-14 |
| K17 | 内嵌模块与 `rive/keyboard` 源不一致 | 由字节级新鲜度门兜住 | R-14、§4.3 |
| K18 | 渲染器契约漂移，或输入逻辑漏进渲染器、两个渲染器各算一套 | 结构上由“渲染器是纯组件”约束 | 契约测试（R-17）、依赖方向门（R-18）、R-20 |
| K19 | 依赖门目前不扫 `ui/feature/*` 源码；`check-static.mjs` 硬编码节点数 | 已确认（§1.3） | R-18 扩展扫描并更新节点数，变异验证 |

## 9. 评审记录

尚无。本文须由 fresh 独立子 agent 盲审（REVIEW_TARGET=DESIGN，两轮上限），遵循 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。作者会话不得自审替代。
