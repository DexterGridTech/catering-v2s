# `@next/ui-base-input-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F7b** —— POS 输入原语，业务无关 |
| 路径 | `2-ui/2.1-base/input-runtime` |
| 规模 | src **1,154 行 / 27 文件**；test 504；test-expo 117 |
| 依赖 | `runtime-shell-v2` · `ui-runtime-v2` · `runtime-react` · react/rn |
| 被依赖 | 4（admin-console · terminal-console · catering-shell · host-runtime-rn84） |
| 状态 | 活跃；**POS 专有能力，第三方 UI 库不覆盖** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**受管输入 + 虚拟键盘。** POS 终端上系统键盘经常不可用或不合适
（触摸屏、固定支架、手套操作、无物理键盘），所以输入要自己控。

## 2 · 九种输入模式

```ts
type ManagedInputMode =
    | 'system-text' | 'system-password' | 'system-number'      // 走系统键盘
    | 'virtual-number' | 'virtual-pin' | 'virtual-amount'      // 走虚拟键盘
    | 'virtual-activation-code' | 'virtual-identifier' | 'virtual-json'
```

**系统输入与虚拟输入是同一套 `InputController` 的两种模式**，
业务组件不需要为两者写两套代码。

## 3 · 键盘布局按模式定制

`foundations/keyboardLayouts.ts` 为每种 virtual 模式给一套 `rows`：

| 模式 | 布局 |
|---|---|
| `virtual-number` | 3×3 数字 + `clear/0/backspace` |
| `virtual-amount` | 3×3 数字 + `0/./backspace`（**有小数点，无 clear**） |
| `virtual-activation-code` | A-Z 六列 + `-` + 数字（激活码含字母与连字符） |
| `virtual-identifier` | A-Z + 数字（识别码） |
| `virtual-json` | 另含 `{ } [ ] : , " /`（给运维面板贴 JSON） |

**每种布局是按真实录入内容裁的**，不是一套通用键盘配开关。
`VirtualKeyboardKey` 是**闭集联合类型**（约 50 个字面量），布局用 `satisfies` 校验。

## 4 · 输入持久化策略三档

```ts
type InputPersistencePolicy = 'transient' | 'recoverable' | 'secure-never-persist'
toPersistedInputValue(state) = canPersistInputValue(state.persistence) ? state.value : null
```

⇒ **"重启恢复原状"这条对输入框也成立**：
半输入的激活码属于 `recoverable`，重启后还在；
PIN / 密码属于 `secure-never-persist`，**永不落盘**。

这是"页面状态全走 store"这条 UI 灵魂里最容易被忽略、也最容易出事的一块 ——
把密码顺手存进可恢复状态是很常见的错误，这里在类型层就分开了。

## 5 · 优点

1. **系统/虚拟两类输入统一成一个 controller**（§2），业务不分叉。
2. **键盘布局按真实录入内容裁**（§3），不是一套通用键盘。
3. **持久化策略三档，密码类在类型层就禁止落盘**（§4）。
4. **`VirtualKeyboardKey` 是闭集 + `satisfies` 校验**，布局里写错一个键是编译错误。
5. **`PinInputField` / `NumberInputField` / `InputField` 三个成品组件**，业务直接用。
6. **`VirtualKeyboardOverlay` 走 `ui-runtime-v2` 的 overlay**，不是 ad hoc 全局弹层 ——
   符合 `2.1-base` README 的"overlay/alert 必须通过 ui-runtime-v2 state 渲染"。
7. **primitive 层做 automation 注册**（`semanticId`），键盘可被自动化逐键点击 ——
   方法论文档专门写了"虚拟键盘输入优先使用 `type-virtual` 或逐键点击，不要直接 `ui.setValue`"。

## 6 · 缺点 / 风险

1. **`InputPersistencePolicy` 与 `runtime-react` 的 `UiRuntimeVariable.persistence`
   是同一组字面量、两处定义**（`transient | recoverable | secure-never-persist`）。
   两个包各自声明，没有共享类型 —— "同一事实两个住址"的小型实例。
2. **`VirtualKeyboardKey` 是硬编码闭集**，加一个符号要改联合类型 + 布局 + 渲染。
   对当前 5 种布局够用；语言/符号扩展时会是改动点。
3. **无中文输入**。当前布局全是数字/字母/符号 —— 对 POS 的激活码/金额/识别码够用，
   但若将来要输入商品名、备注、会员姓名就不够。
   （`推论`：未见中文输入法相关代码；穷举范围限于本包 `src`。）
4. **`InputController` 是命令式接口**（`setValue` / `applyVirtualKey` / `clear`），
   状态在 controller 内部而不是 store 里。
   与"页面状态全走 store"有张力 —— 半输入的值靠 `inputPersistence` 单独处理，
   而不是天然就在 `uiVariables` 里。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **整体继承**。这是 POS 专有能力，NativeWind / React Native Reusables **不覆盖** | §1；RNR 提供的是通用控件，不是 POS 虚拟键盘 |
| 2 | **持久化策略三档整体继承**，并与 kernel 的 `uiVariables` descriptor 合一（消掉两处定义） | §6.1 + `u-01` §6.4 |
| 3 | **输入值统一进 `uiVariables`**，controller 只做键位翻译，不持有状态 | §6.4；让"恢复原状"对输入框也走同一条机制 |
| 4 | **键盘布局改为数据驱动**（布局定义可扩展），`VirtualKeyboardKey` 从闭集改为受控字符串 | §6.2；为将来中文/符号扩展留位 |
| 5 | **中文输入是否需要，需 Dexter 裁决**：若需要备注/会员姓名等自由文本，虚拟键盘要重新设计 | §6.3 是产品判断 |
| 6 | ⚠️ **本行已被 §9.4 修正**：虚拟键盘**不是「换外观」**，而是**渲染与命中层整体重做**（单表面命中测试，`T-12`）；`keyboardLayouts` 与输入语义层（controller / 模式 / 持久化）继承 | 见 §9 |
| 7 | **primitive 层 automation 注册的做法保留并铺开** | §5.7；`FIX-08` 的正确形态 |

## 9 · 【设计承诺·勿忘】虚拟键盘按「单表面命中测试」实现（Dexter 2026-08-28）

> **状态**：已记录，**真正设计实现时必须采用此方案**，不得遗忘。
> **来源**：Dexter 咨询的专家意见。本节为**原样保留 + Claude 补充的三处接口影响**。

### 9.1 方案原文（保留）

> **单表面命中测试 —— "经济"的极致形态**
>
> 如果是全键盘、目标硬件很低端，或者你追求原生输入法级的手感，
> 可以换掉"N 个按钮"的模型：**整个键盘只有一个手势表面**。
>
> 结构分三层：
> - **最底下一层静态标签层**：一次性渲染所有键帽文字的普通 View/Text，**永不更新**，甚至可以是一张 SVG；
> - **中间一个全键盘手势层**：一个 `Pressable` 或 Gesture Handler 的 Tap 手势，
>   拿 `locationX/locationY` 除以格宽格高算出命中的是哪个键；
> - **最上面一个高亮浮层**：单个 `Animated.View`，按下时由 **Reanimated worklet** 把它瞬移到命中键的位置并显示。
>
> ```js
> // 命中测试:纯数学,没有 50 个组件的事件分发
> const onTouch = (e) => {
>   const { locationX, locationY } = e.nativeEvent;
>   const col = Math.floor(locationX / KEY_W);
>   const row = Math.floor(locationY / KEY_H);
>   const key = LAYOUT[row]?.[col];
>   if (key) emitKey(key);
> };
> ```
>
> **收益清单**：
> 1. 原生视图数量从 **300+ 降到个位数**（内存、挂载时间、布局计算全线下降）；
> 2. 按压高亮**跑在 UI 线程** —— 这一点对双屏架构格外有价值：
>    主屏 JS 线程再忙（比如副屏在同步购物车），**键盘的视觉反馈也零延迟**，"跟手感"不受影响；
> 3. 换布局（数字键盘 ↔ 全键盘 ↔ 符号页）**只是换一份 `LAYOUT` 数组和标签层**，不涉及组件增删。
>
> **系统输入法记得屏蔽**：
> - 金额显示**别用受控 `TextInput`**（每击键一次 setState 往返太浪费），直接用 `Text` 渲染 store 里的值；
> - 确实要 `TextInput` 的地方设 **`showSoftInputOnFocus={false}`**，防止系统键盘和虚拟键盘打架。

### 9.2 POC 现状对照（已亲验）

| 维度 | POC 现状 | 方案要求 |
|---|---|---|
| 按键渲染 | **N 个 `Pressable`**：`ui/components/VirtualKeyboardOverlay.tsx:202-238` 是 `layout.rows.map(row => row.map(key => <Pressable onPress={…}>))` | 单一手势表面 |
| 布局数据 | `foundations/keyboardLayouts.ts`：`rows: readonly (readonly VirtualKeyboardKey[])[]`，已含 number / amount / activation 等多套 | ✅ **数据模型天然吻合**，`LAYOUT[row][col]` 直接可用 |
| 高亮反馈 | 依赖每个 `Pressable` 自身的按压态（JS 线程） | 单个 `Animated.View` + Reanimated worklet（UI 线程） |
| automation | **逐键注册节点**：第 97 行 `allKeys.map(key => automationBridge.registerNode(…))` | ⚠️ 见 9.3 |

⇒ **布局层可以直接继承，渲染与命中层整体重做。**

### 9.3 Claude 补充：三处必须一并设计的接口影响

这三条是 POC 现有机制与本方案的**真实冲突点**，实施时若漏掉会在联调期才发现。

#### ① automation 逐键点击会失效 —— 必须先定替代寻址方式

POC 的 automation 方法论明确要求：
> "如果是虚拟键盘输入，优先使用 `type-virtual` 或**逐键点击虚拟键盘**，不要直接 `ui.setValue`。"

而逐键点击依赖 **每个键有一个可寻址的节点**（POC 第 97 行逐键注册）。
单表面之后**这些节点不存在了**。

**两条可选替代（实施时二选一或并存）**：

| 方案 | 做法 | 代价 |
|---|---|---|
| **虚拟节点** | 键盘仍向 semantic registry 注册 N 个**逻辑节点**（只有 `nodeId` + `bounds`，无对应真实组件），automation 的 `performAction('press')` 转成一次坐标命中 | registry 已支持 `bounds` 字段，改动小；但"节点存在而组件不存在"要在 `TR-08` 的门里说清 |
| **专用命令** | 提供 `input.pressVirtualKey(key)` 一类的 public command，automation 直接 `command.dispatch` | 更符合 `TR-01`（写走 command）；但绕过了 UI 层，测不到"点这个坐标会命中哪个键"这件事本身 |

**Claude 倾向两者并存**：命令用于业务流程自动化（快），虚拟节点用于验证命中几何本身（准）。
**这是设计时必须回答的问题，不能留到实施。**

#### ② 它是 `ui.base.primitives` 的一处正当例外

`T-2` 定了 UI 统一使用 NativeWind + RNR，且 `ui.base.primitives` 承载统一语义注册。
但本方案的三层结构（静态标签层可能是 SVG、手势层是单一表面、高亮层是 Reanimated worklet）
**基本落在 RNR 组件模型之外**。

⇒ `ui.base.input` 的键盘部分是**"一切控件由 primitives 构建"这条规则的正当例外**，
需要在 TER 编码规范里**显式登记该例外与理由**（而不是让后人以为是没遵守）。

#### ③ Reanimated 随本裁定一并采纳（`T-12`）

本方案的高亮层要求 UI 线程 worklet，**Reanimated 因此是本裁定的组成部分**，
已记为 **`T-12`：Reanimated 进入 TER 既定依赖集**。

⚠️ **这里不是"新增依赖需要论证"** —— Dexter 已明确指出：
"不随意新增依赖"是**用户没提时**的要求；**用户提了，那就不是随意，那就要加**。
Claude 前一版把仓规当成对该裁定的准入条件，属误用，已改。

**实施时只需注意一件事实**（不是准入条件）：worklet 需要 babel plugin 配置，
建包时一并配好即可。

### 9.4 对建设批次的影响

| 项 | 影响 |
|---|---|
| **批次** | 不变，仍是 **F7c `ui.base.input`** |
| **前置** | 无新增前置。但 9.3① 的 automation 寻址方式**必须在 F7a（automation）设计时一并定**，否则 F7c 做完才发现测不了 |
| **继承范围调整** | 本文 §7 原写"整体继承 + 外观层用 NativeWind/RNR 重做"。**现修正为**：`keyboardLayouts` 与输入语义层（controller / 模式 / 持久化）继承；**渲染与命中层按本方案重做**，不是"换外观" |

## 8 · 证据档位

`已亲验`：`types/input.ts` 全文、`foundations/keyboardLayouts.ts` 前 40 行（五种布局）、
`supports/inputPersistence.ts` 全文、文件清单与行数、被依赖穷举。
`推论`：§6.3（无中文输入）—— 穷举范围限于本包 `src`，未扫宿主输入法层。
**未逐行读**：`VirtualKeyboardOverlay.tsx` 264 行、`InputField.tsx` 188 行、
`contexts/InputRuntimeContext.tsx` 130 行。
