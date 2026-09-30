# TER 软键盘 Rive 化正式需求（v1 · 草案）

```text
DOC_TYPE=正式需求（REVIEW_TARGET=DESIGN 的被审对象）
VERSION=v1 草案（未经独立盲审；§5 列出的 DEXTER_DECISION 未裁决前不得进入详设定稿）
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

> 好，问题你都去查实。1，关于职责边界，你是对的，rive里不需要任何业务逻辑。2，本项目不需要"无障碍"。3，需要同时支持RN Android 和RN web。4，总共有几个键盘你要看下TER当前的实现，而且surface屏幕逻辑分辨率固定为1280*720（laptop）和360*640（mobile），所以你的rive画板要根据这个尺寸设计键盘。      你先写需求文档，先不直接实现

### 1.2 真实目标

把 TER 软键盘的视觉与按压动效改由 Rive 资产呈现。键盘的行为、输入语义和可自动化测试性保持不变。

- Rive 里零业务逻辑。
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

**自动化与测试对每个键的 testID 强依赖。** 本会话 grep 共找到 20 个文件：

- Android 设备自动化：`scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-sample2/run-sample{1,2}-frozen-journey.mjs`。它们用 uiautomator 读 `ui.base.input:virtual-keyboard:<keyId>` 的 resource-id 与 bounds，再点按其中心。
- 逐控件视觉审计 roster：`iaControlRoster` 按键逐一列出控件。
- Web：`scripts/test/ter-admin-display-web.mjs` 用 Playwright `getByTestId(...).click()`。
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
- Metro 目前不认 `.riv`。两处 Metro 配置都需要加 `assetExts`：`application/base/android/config/index.cjs` 与 `ui/integration/sample-console/metro.config.js`。
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
| 命中层 | RN 侧透明的逐键 Pressable，负责触摸、testID 与 `onKey` |
| 渲染层 | `RiveView`，只负责画 |
| 推送 | RN 单向写入 Rive ViewModel 的状态值 |

### 2.2 范围

- 4 种布局 × 2 种 surface，共 8 个画板，放在同一个 `.riv` 中。
- §1.3 消费方表中的全部消费方。它们只通过 `ui/base/input` 使用键盘，本需求不要求它们改代码。
- 平台为 RN Android 与 RN Web（Expo）。
- `rive/keyboard` 作为唯一资产源工程。

### 2.3 执行规则

- 第三方 API、默认值与版本，按 `doc/platform/third-party-library-usage-standard.md` 以实际解析版本与官方一手资料核实。§1.3 中的第三方事实是 2026-09-30 的快照，详设时须重核。
- 验证顺序遵守 `doc/platform/terminal-coding-standard.md` 的 TR-16，见 §4。
- 本批是一次性完整交付单元：设计、实施、复核各做一次，覆盖全范围。不按布局、surface 或平台拆成独立批次。

## 3. 必须满足的要求

**R-01 职责边界。** Rive 资产里零业务逻辑。

- 不做编辑、shift 切换、keyId 到输入的映射、焦点与交接决策。
- 只接收 RN 推送的状态并据此画出来。
- 推荐方案下，Rive 不向 RN 发出任何信号（无 event、无 trigger 回传）；若 D1 裁定为方案 B，则每个键回传一个 trigger。
- 资产使用纯 RML，不含 Luau，因此 `.riv` 不需要签名。

**R-02 画板集合与尺寸。**

- 8 个画板，命名为 `<layout>-<surface>`，例如 `full-laptop`、`numeric-mobile`。
- 每个画板的尺寸等于该布局在该 surface 上的 dock 尺寸，即 §1.3 的尺寸表。
- 画板内键帽的位置与大小逐一等于 RN 几何算出的键矩形，包括 mobile full 布局右侧余出的 4px。

**R-03 几何单一来源。**

- 键矩形只由 `ui/base/input` 中的一个纯函数给出，输入为布局与 frame 尺寸，输出为每个 keyId 的 `{x, y, w, h}`。命中层与画板共用这一个函数。
- financial 末行成对键的宽度须改成显式公式，不再依赖 flex 等分。
- 画板里键帽的摆放，推荐由 RN 几何生成到 RML，防止手工漂移。键帽组件的美术与动效由人工在 `rive/keyboard` 编写。
- 须有一个零容差一致性测试，覆盖 8 个画板：逐键比对画板里的键矩形与 RN 几何。

**R-04 画板选择。**

- 按 frame 宽度精确选择：1280 选 laptop，360 选 mobile。
- 其他宽度如何处理是 DEXTER_DECISION（D4）。推荐：显式诊断，并且键盘不显示（capacity 视为 unsupported），不做静默缩放。
- 详设须核实所有消费方在两种 surface 上测得的 frame 宽度是否恰为 1280 与 360。当前为 UNVERIFIED，Jest 与 dev harness 可能使用其他宽度。

**R-05 命中层与 testID 不变。**

- 保留逐键节点，testID 仍为 `ui.base.input:virtual-keyboard:<keyId>`，含 `testIDSuffix` 与交接时的 `outgoing/`、`incoming/` 前缀。
- 节点 bounds 等于 R-03 的键矩形。
- 保留 `:content`、`:region:*`、`:segment:*` 这些容器节点。它们是否仍被自动化使用由详设核实；不被使用的可以删除。
- 行为不变：`onPress` 在松手时触发；dock 上的 `stopPropagation` 保留；`canInteract` 为 false 时 `pointerEvents` 置 none。
- 结果：§1.3 列出的 Android、Web 自动化脚本不改点击逻辑也能继续工作。

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

**R-07 推送状态（ViewModel schema）。** RN 只单向写入以下状态：

| 状态 | 类型 | 来源 |
|---|---|---|
| `shift` | boolean | 当前 shift 状态 |
| 每个键的 `pressed` | boolean | 命中层 onPressIn / onPressOut |
| 每个键的 `selected` | boolean | 现行 `selectedOf` |
| 每个键的 `label` | string | 现行 `labelOf`（见 R-08） |
| 颜色集合 | color | 当前 integration 主题（见 R-09） |

- 每个键的状态放在以 keyId 命名的嵌套 ViewModel 下，用 `/` 路径访问。
- schema 的正本在 `rive/keyboard`。RN 侧的类型由 `rive-gen-types` 生成或由等价的机器检查保证一致，不能两边手写后靠人工对齐。

**R-08 标签。**

- 推荐：RN 计算 `labelOf` 并把字符串推送给 Rive，`labelOf` 仍是唯一来源。备选：把标签烘焙进画板，再加一致性测试。这是 DEXTER_DECISION（D2）。
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

**R-10 反馈时延与输入不被动画阻塞。**

- `onKey` 的触发时机与现状相同，任何动画都不得延迟它。
- 按压视觉在 onPressIn 之后不超过 2 帧出现（60 Hz 下约 33 ms），在真机上实测。VM 的值要等 state machine 推进后才生效，所以这一条必须实测，不能推断。
- 快速连续输入时不得丢键：命中层与现状一致，因此以现状为基线对照。

**R-11 交接动画不变。**

- 250 ms、`Easing.inOut(quad)`、两段式、native driver（web 除外）的交接逻辑保持在 RN。
- 交接期间两个 `RiveView` 实例同时存在，并随父级 translateY 移动，不得出现空白帧、闪烁或撕裂。
- 新 backend 基于 TextureView，父级 transform 理论上生效。native driver 下的实际表现须在 spike 中实测。

**R-12 多点触控。** 命中层仍由 RN 负责，多点触控表现不得劣于现状基线。推荐方案不依赖 Rive 的 pointer 处理，因此新 backend 只处理 pointer 0 的限制不影响本方案。
