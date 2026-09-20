# TER 虚拟键盘视觉与交互实现详设

> STATUS: PROPOSED_FOR_DESIGN_REVIEW
> IMPLEMENTATION_AUTHORITY: false
> REVIEW_TARGET: DESIGN
> REVIEW_CYCLE_ID: TER_TERMINAL_INPUT_KEYBOARD_VISUAL_DESIGN_2026-09-19
> REVIEW_ROUND: 1
> REVIEW_ROUND_LIMIT: 2
> REVIEWER_KIND: INDEPENDENT_SUBAGENT_REQUIRED
> IA_STATUS: ACCEPTED_STYLE_EXTENDED_COMPLETE_BY_DEXTER_REQUEST@2026-09-19
> PIXEL_GATE: VISUAL_ROI_98_PERCENT_BEFORE_IMPLEMENTATION_DELIVERY
> CLAUDE_REVIEW_INTAKE: ROUND_1_NO_GO_4M_2S_2N; ROUND_2_NO_GO_1M_2S_2N_INTAKE_REPAIRED; PALETTE_DECISION_CLOSED_BY_DEXTER; PIXEL_RECONCILIATION_98_PERCENT

## 0. 范围、正本与当前事实

本详设只覆盖 TER 的四种程序虚拟键盘 `full`、`alpha`、`numeric`、`financial` 的
视觉、布局、输入状态呈现和呈现效率。它不是新的 Journey，不改变 input edit model、
field registry、command、业务 slice、系统 IME、admin login、拓扑或已认证页面。

用户已确认的 IA 风格与本轮补全后的 laptop/mobile 全类型 IA 图已作为仓内设计输入保存为：

`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-complete.png`

其 SHA-256 为 `dab3ba5833ee86321bf9e4a31264057fe586c0e19341556c36d4ad29666b43ba`。
该图是基于已确认风格补全的八种形态视觉意图基线：laptop/mobile 各覆盖
`full`、`alpha`、`numeric`、`financial`，不是某一台设备的运行时截图。
因此实施交付前必须另产出与目标逻辑 surface 同尺寸的固定 ROI 视觉基线，不能
用整张复合板截图的相似度代替约 98% 的 ROI 对账；本批不追求跨平台逐像素完全相等。

历史四类复合板仍保留为来源参考：
`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-approved.png`。
它不再作为本批八种形态的唯一 IA 正本。

### 0.1 需求和既有详设

| 来源 | 用途 |
| --- | --- |
| `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md` | 四种布局、alpha CAPS、键语义、行数、高度和 sample-only 消费者正本 |
| `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md` | 既有 input surface、容量、焦点、滚动和性能边界；本详设只补视觉/token/alpha delta |
| `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` | 本地测量、surface 承载和不可行状态边界 |
| `doc/platform/terminal-coding-standard.md`、`project-memory/operations/terminal-coding-standard.md` | terminal primitive、依赖方向、测试和 README 约束 |

### 0.1a 最新 IA 优先级与历史文字的收口

本批视觉正本是补全后的 IA 资产
`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-complete.png`，而不是
旧需求稿中尚未吸收本轮视觉修订的单段文字。为避免实施方在两个来源之间猜测，以下两项是本轮
已确认的视觉 delta：

1. `numeric` 的当前目标是四行三列，最后一行固定为
   `BACKSPACE | 0 | COMPLETE`；`0`、退格和确认各占一列，退格在 `0` 左侧，确认在右侧。
   这与当前工作区的 `keyboardLayout.ts` 和既有 focused test 形状一致。旧需求中“0 跨两列、
   动作共享第三列”的文字只属于历史版本，不得在本批恢复。
2. `alpha` 的 canonical key definition 始终包含 `CAPS`。复合 IA 右侧的 `MOBILE (INSET)`
   只是紧凑承载比例与可达性示意，不是另一套 key inventory，也不能作为删除 CAPS 的依据。
   mobile 的实际运行 baseline 必须按下方完整 alpha definition 生成；不得把该 inset 的缩略
   省略当作移动端产品裁决。

3. mobile 形态只替换 modifier 的显示标签，不改变 key kind、testID、编辑语义或布局占位：
   `CAPS` 显示为 `⇪`，`SHIFT` 显示为 `⇧`；laptop 继续显示 `CAPS`、`SHIFT` 文案。
   这是移动端窄屏的符号化呈现，不能通过删除 modifier 或另建 mobile keyboard definition
   实现。financial 的 `−`、`·` 也只属于显示标签，编辑事件仍使用既有 ASCII `-`、`.`。

这两条是对既有文档冲突的显式收口，不是实施方自行改写 IA。若 review 认为最新 IA 与历史需求
不能同时成立，应指出冲突，不得自行选回历史布局。

### 0.2 当前源码核验结果

| 当前事实 | owning source | 本详设处置 |
| --- | --- | --- |
| `full` 已在 home row 起始位置声明 `caps`，`EditState` 已有持久 `capsLock` | `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`、`editText.ts` | 复用，不复制编辑语义 |
| `alpha` 当前只有 QWERTY、home letters、末行 actions，缺少 `caps` | `keyboardLayout.ts` 的 `alpha` definition | 在既有三行的第二行首位加入 `caps`，不增高 |
| `VirtualKeyboard` 已是 `memo`，layout definition/regions/handlers 有稳定边界 | `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx` | 保留既有 memo/useMemo 边界；不新增冷路径缓存、store 或逐字订阅 |
| `InputProvider` 只有 mode/focus/capacity 变化才主动刷新键盘，普通字符编辑不调用 `forceKeyboardUpdate` | `InputProvider.tsx`、`useInputKeyboardController.ts` | 保持该效率不变量，新增 focused proof |
| 普通键使用 `bg-action`，动作键使用 `bg-surface`，dock 背景直接写 `#FFFFFF` | `apps/terminal/ui/base/primitives/src/theme/tokens.ts`、`VirtualKeyboard.tsx` | 改为 keyboard 专用 semantic token；禁止 base 直接写颜色 |
| 两个 integration 有独立 `global.css` 与 Tailwind semantic mapping | `sample-console/theme/global.css`、`sample-wallpaper-console/theme/global.css` 及对应 `tailwind.config.cjs` | 两边各自声明同名 keyboard token；base 不 import integration |
| 两个 Android App 的 Tailwind 通过 assembly-base-android 继承 `sharedColors` | `apps/terminal/assembly/android/sample-terminal/tailwind.config.cjs`、`sample-wallpaper-terminal/tailwind.config.cjs`、`apps/terminal/assembly/base/android/config/index.cjs` | `sharedColors` 只补 CSS-variable mapping，不持有 RGB；四个 App 的生成面全部纳入 theme 分母 |
| alpha 已由 `MemberForm` 的 sample-only probe 消费，不进入会员 command/state | `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx` | 不新增 feature 消费者，不改业务 payload |

当前实现基线必须与完整 IA 的两套承载参数一致：laptop 使用 `KEY_CELL_HEIGHT=48`、
横纵 gap `8`、横纵 padding `14`、dock 圆角 `20`、key 圆角 `9`；mobile 使用
`COMPACT_KEY_CELL_HEIGHT=38`、纵向 gap `5`、横向 key gap `4`、横向/纵向 padding `10`、
dock 圆角 `17`、key 圆角 `7`。上面的数值是内容盒高度；dock 另有 1 logical-unit
边框，因此外框高度必须再加 `2*DOCK_BORDER_WIDTH`。因此 laptop 的 `alpha` 内容盒为
`3*48 + 2*8 + 28 = 188`，dock 外框为 `188 + 2*1 = 190`；`full`、`numeric`、
`financial` 的内容盒为 `4*48 + 3*8 + 28 = 244`，dock 外框为 `244 + 2*1 = 246`；
mobile 的 `alpha` 内容盒为 `3*38 + 2*5 + 20 = 144`，dock 外框为 `144 + 2*1 = 146`，
其余三种内容盒为 `4*38 + 3*5 + 20 = 187`，dock 外框为 `187 + 2*1 = 189` 个逻辑单位。
`DOCK_BORDER_WIDTH` 是 dock 的唯一边框预算来源；focused geometry test 必须证明内容盒
加上下两侧边框不超过外框高度。laptop dock 宽度按完整 IA 为
`full/alpha=820`、`numeric/financial=560`（仍受 host 可用宽度限制）；360 逻辑宽度的
mobile `full/alpha` 保持 host 宽度，`numeric/financial` 使用 330 逻辑单位并在两侧留出
15 单位边距，以对应 IA 的窄数字卡片并避免动作键贴边；mobile 保持完整 key inventory。
numeric 的三列底行是本轮已确认目标，不能被旧的跨列布局回滚。

## 1. 真实目标与方案取舍

真实问题不是“再画一套键盘”，而是已确认的 IA 与当前运行路径有三处断裂：alpha 的
CAPS 不在布局中，键盘 dock 绕过 theme 写死白色，键位使用通用 action/surface 使两个
integration 无法稳定复现 IA。若只补 alpha 数组，业务可用但视觉仍会漂移；若只改 CSS，
CAPS 仍不可操作。

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 只在 `keyboardLayout.ts` 加 CAPS，保留当前颜色 | 语义成立，但 IA 与两个 integration 的运行效果仍不一致，`#FFFFFF` 继续绕过 theme | 拒绝 |
| B. 在 input 包内按 layout 写颜色和完整样式 | 颜色事实下沉到 base，两个 integration 不能独立换主题；也容易把 layout 分支复制成四套 renderer | 拒绝 |
| C. primitives 提供 keyboard semantic recipe，integration 各自提供 token，input 只声明布局/状态；同时保留现有 edit/provider 边界 | 颜色、阴影和键位呈现有唯一 primitive owner，应用身份留在 integration，alpha 只改静态定义；改动面最小 | **采用** |

不新增第三方依赖，不新增键盘 owner、store、command、IME 或业务字段。

## 2. 视觉与交互契约

### 2.1 四种布局

布局定义唯一住址仍为 `keyboardLayout.ts`，键级 testID 仍由 `keyId` 生成：

```text
full:
  1 2 3 4 5 6 7 8 9 0
  Q W E R T Y U I O P
  CAPS A S D F G H J K L
  SHIFT Z X C V B N M BACKSPACE COMPLETE

alpha:
  Q W E R T Y U I O P
  CAPS A S D F G H J K L
  SHIFT Z X C V B N M BACKSPACE COMPLETE

numeric:
  1 2 3
  4 5 6
  7 8 9
  BACKSPACE | 0 | COMPLETE

financial:
  1 2 3
  4 5 6
  7 8 9
  - . | 0 | BACKSPACE COMPLETE
```

运行时标签按形态分化如下；键位数量与几何不分化：

```text
laptop full/alpha:   CAPS, SHIFT
mobile full/alpha:   ⇪, ⇧
numeric/financial:   无 CAPS/SHIFT；financial 显示 −、·
```

`alpha` 的第二行必须采用与 `full` 相同的 `compoundRow` 形态：首项为 `CAPS`，后跟
`A S D F G H J K L`。因此该行的 `region` 固定为 `actions`；第三行也为 `actions`，
渲染器会将两行合并到同一个 actions region。`text-a` 等原有 keyId 不变，但它们从
`letters` region 移入 `actions` region；region 级 testID 与断言必须按这个显式决定同步，
不得在实现时自行改成保持旧 region 的另一种读法。`CAPS` 必须是第二行第一个 action key，
和 full 共用 `KeyboardKey.kind='caps'`。
`CAPS` 按下后进入持久 `capsLock=true`，再次按下解除；`SHIFT` 仍是一次性状态，并在
CAPS action 后清除。字母渲染为 `shift || capsLock` 的大写，但编辑结果仍由
`applyKeyboardKey` 唯一决定。不得把 CAPS 实现为只改变 label 的视觉开关。

四种布局继续共用 `VirtualKeyboard` renderer、key-level testID、`PrimitiveButton` 和
同一套 pressed/disabled 行为。mobile inset 只是 host 的承载尺寸，不创建第二个 keyboard
layout，也不删除任何键。

### 2.2 Primitive semantic token 合同

当前通用 `action/surface` 不足以表达已确认的键盘 IA；本批在 primitives 增加以下
semantic 名称。名称是共享契约，RGB 值由两个 integration 的 theme 分别提供：

| token | owner/用途 | 初始关系 |
| --- | --- | --- |
| `keyboard-surface` | dock 间隙、外框背景 | 与 backdrop 分层，不能依赖宿主窗口背景 |
| `keyboard-key` | 普通数字/字母键背景 | graphite key recipe |
| `keyboard-key-foreground` | 普通键文字 | 与 `keyboard-key` 成对 |
| `keyboard-action` | CAPS、SHIFT、BACKSPACE、COMPLETE 的动作键背景 | 与 `keyboard-key` 使用同一中性色；不人为增加层级差异 |
| `keyboard-action-foreground` | 动作文字及 backspace/complete icon | 由 action recipe 统一使用 |
| `keyboard-border` | key/dock 边界 | 不从 app 通用 border 推导视觉意图 |
| `keyboard-focus` | selected modifier 的边界强调 | 由 integration 主题提供，不能写死蓝色 |

两个 integration 必须在自己的 `theme/global.css` 声明上述有色变量，并在自己的
`tailwind.config.cjs` 完成同名 RGB mapping；两个 Android App 的 `tailwind.config.cjs`
还必须通过 `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors` 获得
同名 mapping。为了让当前已确认的共享 IA 在两个 sample
中保持相同的几何、层级和间距，两边按同一份 recipe baseline 冻结；RGB 仍由各自 integration
theme 持有。这不取消 theme ownership——将来某个 integration 改值必须同步自己的视觉基线
和 review 记录，不能把值移到 primitives。

Dexter 已将 palette 裁定为 `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER`，原来的 PALETTE_A/B
仅保留为历史比较，不再是待选方案：

1. `keyboard-surface`、`keyboard-key`、`keyboard-action`、两个 foreground token 的
   中性色按 complete IA 复测并在两个 integration 取相同值；backdrop 固定透明；`keyboard-key` 与
   `keyboard-action` 必须相等，不人为制造动作键层级差异。
2. `keyboard-border` 与 `keyboard-focus` 仍由两个 integration 各自持有，允许不同；这是
   本批唯一保留的应用身份入口。两个 integration 的 `keyboard-focus` 必须不同，且
   `keyboard-border` 初值由各自 theme 提供，不上移到 primitives。
3. 下表是 CP-0 的复测参考，不是免测的最终 RGB 正本。CP-0 必须记录取样区域、避开字形的
   规则、均值/众数选择及面板渐变处理；复测结果才进入 theme readback 和视觉记录。

| token | sample-console RGB / hex | sample-wallpaper-console RGB / hex |
| --- | --- | --- |
| `keyboard-surface` | 参考 `#131719–#14181A`，CP-0 复测 | 同左，必须同值 |
| `keyboard-key` | 参考 `#282D31`，CP-0 复测 | 同左，必须同值 |
| `keyboard-key-foreground` | 参考白色，CP-0 复测 | 同左，必须同值 |
| `keyboard-action` | 与 `keyboard-key` 相同，CP-0 复测 | 与左侧相同 |
| `keyboard-action-foreground` | 与普通键文字相同，CP-0 复测 | 与左侧相同 |
| `keyboard-border` | integration theme owner，CP-0 记录 | integration theme owner，CP-0 记录 |
| `keyboard-focus` | integration theme owner，必须不同于右侧 | integration theme owner，必须不同于左侧 |

theme tests must parse computed CSS variable channels and assert the five neutral tokens are equal
across integrations, `keyboard-key === keyboard-action`, and `keyboard-focus` differs across
integrations. Checking only that a CSS variable or Tailwind string exists is insufficient. CP-0
records the measured RGB method and both theme readbacks before implementation continues.

`baseTokens` 只保存 class recipe，不保存 RGB：

```text
keyboardBackdrop   -> bg-transparent（不读取 integration theme）
keyboardDock       -> bg-keyboard-surface + border/rounded recipe；PrimitiveKeyboardSurface 统一提供
                       黑色 0.28 opacity、8px y-offset、9px blur 的 panel shadow，不读取平台身份色
keyboardKey        -> bg-keyboard-key + border-keyboard-border（不带 key-level shadow）
keyboardAction     -> bg-keyboard-action + border-keyboard-border（不带 key-level shadow）
keyboardButtonText -> text-keyboard-key-foreground
keyboardActionText -> text-keyboard-action-foreground
iconKeyboardAction -> text-keyboard-action-foreground
```

`keyboard-focus` has two presentation consumers: `PrimitiveButton` receives an optional
presentational `selected` prop, valid for `variant='key'|'key-action'`, for persistent modifier
selection, and its local `pressed` state uses the same keyboard-focus border recipe while a key is
being pressed. `VirtualKeyboard` passes `selected={capsLock}` for `CAPS` and
`selected={shift}` for `SHIFT`; no business or input state is added for ordinary keys. Neither
path carries store, input controller, or business semantics. The focused red mutations remove the
modifier `selected` prop and remove the pressed-state focus recipe separately; each corresponding
render contract must then fail or remain `OPEN`, not pass because the token merely exists.

呈现状态也在本批冻结：idle 的 `key/key-action` 使用一像素 `keyboard-border`；CAPS/SHIFT 的
selected 锁定态，以及任意 key/key-action 的 pressed 瞬时态，都保持外框尺寸不变并使用现有
`pinCellFocused` 同形的 `border-2 border-keyboard-focus` recipe。该 recipe 会让内容盒相对
idle 内缩 1px，这是已批准 IA 的按下反馈成本，不得把它误写成完全不参与布局。pressed 同时
继续使用 `PrimitiveButton` 当前 `key` 的 `opacity:0.78 / scale:0.985` 与 `key-action` 的
`opacity:0.72 / scale:0.985` 局部状态；释放后必须恢复 idle 边框。baseline/动态对账至少
覆盖 idle、caps locked、shift armed、普通 key pressed、action pressed 五态；不得用“有
selected prop”替代实际 selected/pressed 呈现断言。

当前 `VirtualKeyboard.styles.dock.backgroundColor='#FFFFFF'` 必须移除。dock 背景通过
新增的 `PrimitiveKeyboardSurface` primitive 呈现；该 primitive 只接收 `testID`、children、
尺寸/style、结构化 `onTouchEnd`/`onClick` stopPropagation 事件，不理解 input、surface-dismiss、
store 或业务。`VirtualKeyboard` 不得在模块顶层以一次性的 `typeof document` 结果选择事件；
必须在 render 期通过纯函数重新求取 interaction props，使 Node focused test 能在同一进程
分别 stub/清除 `globalThis.document` 验证两条分支。该方案不新增 jsdom/happy-dom 依赖。
Native 与 Web 两个事件入口都必须由 composed `VirtualKeyboard` focused test 覆盖；只测
native touch 不能关闭这条边界。
这样既保留 Web/native 的触摸冒泡守卫，也不让 input 直接写 primitive class 或颜色。

键面不使用额外 shadow，避免与完整 IA 的平面 key recipe 不一致；panel shadow 由
`PrimitiveKeyboardSurface` 统一提供，颜色固定为中性的黑色而非宿主 `colorPrimary`，所以不会把
应用身份色带入 shared primitive。Android 的 elevation 与 Web/native 的 shadow rasterization
允许存在平台差异，但 shadow owner、offset、blur 与 opacity 必须一致，并在平台 baseline 中记录，
不能把阴影差异掩盖成“差不多”或升级成 pixel PASS。

### 2.3 输入边界与文案

键盘不改变既有用户可见业务文案、field ID、focus scope、complete 语义和 surface-dismiss
规则。`CAPS`、`SHIFT`、删除和回车的 label/icon 继续由 `VirtualKeyboard` 统一派生；
不增加 space、语言切换、IME 候选栏或第二个输入路径。

## 3. 性能与稳定性设计

### 3.1 必须保留的现有边界

1. `InputProvider` 不订阅业务 store；普通字符插入只更新当前 field 的局部 edit state，
   不触发 `forceKeyboardUpdate`，所以键盘不因每个字符重渲染。
2. `VirtualKeyboard` 保持 `memo`；`getKeyboardLayout` 返回模块级冻结 definition，不能
   在 render 中复制完整布局对象。
3. 普通字符输入不触发键盘整体 render；若因 layout/owner/capacity 变化发生 render，
   `regions` 与 handlers 仍只能依赖既有 definition/frameWidth/cellWidth/hasNextField/stable
   onKey 边界，不得把 keyGroups/geometry 另建跨包缓存或把业务状态引入 renderer。
4. 不增加每键 `onLayout`、深比较、日志 IO、持久化、业务 command 或 render-count 生产
   instrumentation。

### 3.2 本批 renderer 效率边界

本批不新增 `keyGroups`/geometry cache。源码核验表明普通字符编辑不会调用
`forceKeyboardUpdate`，而 `VirtualKeyboard` 已由 `memo`、静态 layout definition、regions
`useMemo` 与 handlers `useMemo` 形成边界；把冷路径再缓存一层会增加 identity 约束而不解决
实际热路径问题。实现只保留并验证这些已有边界：不得在普通字符输入时重建整个键盘，不得把
状态推入 store，不得引入 layout registry、virtualized list、第三方 memoizer 或跨包 selector。

`PrimitiveButton` 的 pressed state 仍是键自身的局部 state；普通键按下不得让表单业务组件
重新渲染。focused test 只证明订阅/渲染边界和引用稳定，不宣称 FPS、帧率或性能改善。

## 4. 精确实现落点

| 文件/owner | 动作 | 不得做 |
| --- | --- | --- |
| `apps/terminal/ui/base/primitives/src/theme/tokens.ts` | 增加 keyboard semantic class recipe，替换 keyboard key/action/text/icon 的通用颜色引用 | 写入 RGB、复制 integration palette |
| `apps/terminal/ui/base/primitives/src/components/PrimitiveKeyboardBackdrop.tsx` | 新增全宽透明 keyboard backdrop，显示宿主 surface | 读取 input context、消费应用身份色或自行 dismiss |
| `apps/terminal/ui/base/primitives/src/components/PrimitiveKeyboardSurface.tsx` | 新增 dock primitive，呈现卡片背景/边界并透传结构化 touch/click stopPropagation | 读取 input context 或自行 dismiss |
| `apps/terminal/ui/base/primitives/src/types/types.ts`、`src/index.ts` | 增加最小 public props/event/export，含 keyboard `selected` 与 dock 的 Web/native event shape | 暴露 store、keyboard state 或 layout definition |
| `apps/terminal/ui/base/primitives/test/primitives.test.tsx` | 验证 recipe、dock event 透传和不带硬编码色 | 以字符串存在代替实际 render proof |
| `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts` | alpha 第二行加入 `actionKey('caps')`，保持 3 rows/10 columns | 新增 alpha layout、第四行或新业务 key |
| `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx` | 使用 dock primitive；保留 key renderer/testID；保留现有 memo/useMemo 边界，不新增冷路径 cache；在 render 期求取 Web/native interaction props | 直接 import integration/theme；重建第二套 keyboard；把环境选择留在模块级常量 |
| `apps/terminal/ui/base/input/test/keyboardLayout.test.ts` | alpha 行序、CAPS、3 行/10 列和 numeric 三列底部形态 | 改回旧的跨列 numeric 语义 |
| `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx` | alpha CAPS testID/label/icon/handler、主题 recipe 入口、handler 稳定性 | 以 testID 存在代替 action 语义 |
| `apps/terminal/ui/base/input/test/editText.test.ts` | CAPS 持久锁、再次点击解除、与 SHIFT 的交互 | 在 renderer 中复制 caps 算法 |
| `apps/terminal/ui/base/input/test/provider.test.tsx` | 普通字符不触发键盘整体刷新；mode/owner 变化允许刷新 | 用 FPS 或固定 render count 推导性能改善 |
| 两个 integration `theme/global.css` 与 `tailwind.config.cjs`、两个 Android App 的 `tailwind.config.cjs`、`apps/terminal/assembly/base/android/config/index.cjs` | integration 各自声明/映射七个有色 keyboard token，backdrop 固定透明；Android sharedColors 提供同名 mapping | 在 base 或 input 写 RGB，或漏掉 Android sharedColors |
| `apps/terminal/assembly/base/android/config/index.cjs` 与其 owned test | `sharedColors` 保持七个有色 `rgb(var(--color-keyboard-*) / <alpha-value>)` mapping；测试同时读取两个 App config 的继承结果 | 为透明 backdrop 重新增加黑色 mapping，或在 Android App 中复制另一份颜色表 |
| 两个 integration `test/theme.test.ts` | token 完整性、mapping、两套主题可读且初始 canonical 值一致 | 只检查 CSS 字符串存在 |
| CP-0 fixed-ROI manifest、`tools/terminal-image-compare/compare.mjs` README/tests | 记录并校验 baseline/source/hash/ROI/mask 字段；复用既有 `legacy-threshold` ROI diff 作为量化参考，以几何/token readback 形成机器门 | 直接用 runtime 截图自证、把平台 rasterizer 的 raw equality 当硬门、为 98% 另造高成本图片比较器或悄悄改变旧 comparator 语义 |
| `apps/terminal/ui/base/primitives/README.md`、`apps/terminal/ui/base/input/README.md`、两个 integration README | 同步 primitive owner、theme owner、alpha CAPS 和效率边界 | 把未运行的动态结果写成完成 |

`MemberForm` 不需要生产修改：当前 alpha probe 已是唯一受控消费者。若实施前源码重扫
发现它不再存在，必须停在 CP-0，不能偷偷把 alpha 变成业务字段。

## 5. 验收执行体与反例矩阵

| ID | 必须成立 | 执行体 | production red mutation |
| --- | --- | --- | --- |
| V-1 | complete IA asset、固定 ROI baseline 与目标尺寸有唯一住址 | static manifest/readback | 删除 baseline hash 或换错尺寸，preflight 必红 |
| V-2 | alpha 为三行且 CAPS 在第二行首位 | `keyboardLayout.test.ts` | 删除 CAPS、移到第四行或增加第四行，测试必红 |
| V-3 | CAPS 是持久 `capsLock` 而非 label 假象 | `editText.test.ts` + `virtualKeyboard.test.tsx` | 将 caps 改成 shift/one-shot，序列断言必红 |
| V-4 | full/numeric/financial 的 key set、testID、numeric 三列底行和行高不漂移 | layout/height focused tests | 把 numeric 改回跨列 0 或改变动作列，既有断言必红 |
| V-5 | 所有键颜色/边框/icon、modifier selected 和普通 key/action pressed 使用 primitive keyboard token | primitive render test + source check | 在 input 写 `#FFFFFF`、恢复 `bg-action`、删除 `selected` 消费或删除 pressed focus recipe，token/render 断言必红 |
| V-6 | 两个 integration 与两个 Android App 的 keyboard token 分母完整：CSS 变量、integration Tailwind mapping、Android `sharedColors` mapping 同名且 computed RGB 可读 | 两个 integration `theme.test.ts` + `assembly/base/android/config` owned config test；测试同时读取两个 App Tailwind config 的继承结果 | 删除任一 CSS 变量、integration mapping、Android sharedColors mapping 或改错 RGB，所属测试必红 |
| V-7 | Dexter 选定的混合 palette 与 IA/主题决策一致；中性色跨主题相等、focus 跨主题不等 | palette decision readback + token geometry machine gate + 人工 IA 视觉对账 | 只改一侧中性色、让 key/action 分层或把 focus 改成相同值，theme 对称性断言必红 |
| V-8 | surface-dismiss 的 native touch 与 Web click 两条入口都透传且不反向依赖 input；测试中的 document stub 每例恢复 | composed primitive/input focused tests；Node 中 render 期 stub `document` 分别覆盖两个入口，`afterEach` 校验原值/缺失状态；真实设备/Web 仍单独记档 | 删除任一事件透传或删除 stub 恢复守卫，对应 focused test 必红；若真实冒泡只能由设备证明则设备档位保持 OPEN |
| V-9 | 普通字符热路径不触发键盘整体刷新；mode 变化仍刷新 | provider/renderer focused test | 对 text key 也调用 `forceKeyboardUpdate`，render-boundary 必红 |
| V-10 | Web 在固定 logical viewport 的 keyboard ROI 完成 geometry/token 硬门，并由视觉复核确认约 98% 一致 | existing managed Web runner + DOM geometry/token readback + legacy ROI diff + lightweight visual record | 改 key gap/行高/token 会使 geometry/token gate 红；`changedFraction` 仅作量化参考，超过 0.02 或明显结构/颜色错位由视觉记录判 OPEN |
| V-11 | Android 在固定 logical viewport/target surface 完成 geometry/token 硬门，并由视觉复核确认约 98% 一致 | existing managed Android runner + UI XML/timeline/PNG + geometry/token readback + legacy ROI diff + lightweight visual record | 去掉 dock token、改 scale 或移 key 会使 geometry/token gate 红；`changedFraction` 仅作量化参考，超过 0.02 或明显结构/颜色错位由视觉记录判 OPEN |
| V-12 | fixed-ROI manifest、运行结果与本详设、IA、theme 和 input contract 逐行对账 | manifest validator + 主 agent reconciliation table + fresh review | 遗漏文件、额外 consumer、未声明 token 或 self-baseline，状态只能 OPEN |
| V-13 | dock 外框高度包含上下两侧边框，laptop/mobile 的内容盒加边框不超过固定高度 | `keyboardHeight.test.ts` geometry proof + source readback of `DOCK_BORDER_WIDTH` | 删除 `DOCK_BORDER_WIDTH * 2` 或只更新常量而不更新公式，四种布局的 content-plus-border 断言必红 |

V-10/V-11 的 raw pixel 结果必须按平台分别记录：Web 与 Android 不共享字体栅格化结果。
如果当前受管 runner 不能在固定逻辑尺寸输出可重现截图，不能用结构测试代替，必须保持
`PIXEL_RECONCILIATION=OPEN`，并在交付中说明缺失的执行体。

## 6. IA↔runtime 固定 ROI 视觉对账设计

本节保留用户要求的区域级视觉对账，但按 Dexter 最新裁定采用“视觉约 98% 一致”而非
跨平台 raw PNG 逐字节相等。已有 `tools/terminal-image-compare/compare.mjs` 直接提供
ROI 差异指标；本批把 `changedFraction <= 0.02` 作为人工复核的量化参考，不把 comparator
输出改造成新的失败退出码，不建设 exact-rgba 或字体/抗锯齿跨平台归一化机制。

### 6.1 Baseline 形成

实施 CP-0 先把复合 IA 图作为人工视觉基线，再按最终批准的行/间距/token 表确定目标
逻辑尺寸的 ROI。不能把运行后的实现截图直接倒推成未审查 baseline。manifest 固定如下：

- 规范输入：`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-complete.png`
  （SHA-256 `dab3ba5833ee86321bf9e4a31264057fe586c0e19341556c36d4ad29666b43ba`）与最终
  palette decision、`keyboardHeight.ts` 常量；mobile inset 不参与 key inventory 解析。
- 机器清单：`doc/evidence/platform/terminal-input-keyboard-visual/cp0/baseline-manifest.json`。
  每个 entry 必须有 `platform`、`integration`、`logicalViewport`、`layout`、`state`、
  `canvasRect`、`roiRect`、`maskRects`、`minUnmaskedFraction`、`png`、`sha256`、
  `tokenSnapshot`、`sourceInputs`、`measurementMethod` 和 `comparisonMode`。其中
  `minUnmaskedFraction` 必须为现有 comparator 要求的 `0.25`，`measurementMethod` 只能是
  `REFERENCE_RENDER` 或 `APPROVED_CAPTURE`，不得写 `RUNTIME_SELF_BASELINE`。
- `measurementMethod` 按 entry 选择而不是由实施者任意填写：`REFERENCE_RENDER` 只用于
  几何和键面/底色区域，文字盒、图标盒、阴影带全部进入 mask 并由人工复核；
  `APPROVED_CAPTURE` 用于首次经 IA 人工确认的同平台/同主题/同状态捕获，后续同条件运行只
  与该批准捕获比对。首次批准捕获不得由运行结果自己无审查地升格为 baseline。
- `maskRects` 只允许三类：文字包围盒、图标包围盒、阴影带；它们不遮盖键面、间距、边框、
  dock 几何或 selected 边界。沿用 `compare.mjs` 的 canvas/mask 面积上限和
  `minUnmaskedFraction=0.25`，超过上限即 `OPEN`，不为凑 98% 扩大 mask。
- 不新增第二个图片比较器。必要的字段、hash、ROI/mask 和 sourceInputs 由 CP-0 的
  manifest validator 校验；它不消费比较结果、不宣称 `changedFraction` 失败退出，参考图
  也不得读取未审查的实现运行截图。
- `tools/terminal-image-compare/compare.mjs` 保持既有 `legacy-threshold` 语义，输出每像素
  delta、changed fraction、P95、meanAbsDiff、changedCellFraction 与 geometry readback；
  本批记录 `changedFraction <= 0.02` 作为约 98% ROI 的量化参考，不新增 `exact-rgba`
  模式，不改旧调用方；是否为 `OPEN` 由人类视觉复核结合 geometry/token 结果决定。
- 产物目录仍为
  `doc/evidence/platform/terminal-input-keyboard-visual/cp0/baselines/<platform>/<integration>/`。
  每个 PNG 旁有同名 metadata JSON；缺字段、错 hash、错尺寸、mask 超过既有上限或
  `RUNTIME_SELF_BASELINE` 均使机器 baseline gate 为 `OPEN`。

### 6.2 Runtime capture 与两层判定

在 focused/static、逐代码与详设对账都 `MATCHED`，且 CP-0 的 token/geometry manifest
machine gate 关闭后，才允许动态捕获：

1. Web：在两个 integration 各自既有 `test-expo` 入口，以固定 logical viewport 进入
   `MemberForm` alpha probe，记录 DOM bounding rect、computed token readback 与 keyboard ROI PNG。
2. Android：在已授权的 sample App 入口，以固定 logical surface 进入同一 alpha probe，
   记录 UI XML、timeline、display identity、computed token readback 和 display-scoped PNG；
   不得拿主屏截图代替副屏或 mobile 截图。
3. 机器门只判定 manifest/hash、逻辑尺寸、ROI geometry、key cell/row geometry、token
   readback 和 source boundary；不消费 `changedFraction`，不要求 raw byte equality。
4. 视觉对账逐平台、逐 integration、逐 surface、逐 layout、逐 state 进行：保存 ROI diff
   与轻量 overlay，人工检查平面填充、边框、间距、CAPS/SHIFT selected、pressed/action、
   回车/退格图标、字体、阴影和真实 surface 位置；允许字体抗锯齿等不影响用户任务的细微
   差异，但不能接受明显布局、颜色层级、文案、状态或图标错误。判定人、设备/逻辑尺寸、
   对账清单、原始 PNG 和结论写入
   `doc/evidence/platform/terminal-input-keyboard-visual/<run>/visual-reconciliation.md`。
   将 `changedFraction <= 0.02` 作为约 98% 的量化参考；超过该值或存在明显结构/颜色错位
   均由视觉记录判为 `OPEN`，不使用整屏均值、resize 或 focused mock 代替固定 ROI 证据。

### 6.3 不得混淆的结论

focused render tree 只证明 key 集合、token 入口、状态和事件边界；它不证明阴影、字体、
抗锯齿、真实 surface 位置或 pixel equality。动态截图只证明对应 platform/integration/
surface/state，不可外推另一平台或另一主题。性能测试只证明订阅/重渲染边界，不给出“更快”
或 FPS 改善结论。

## 7. Claude review intake（历史第一轮，仅保留审计记录）

本轮 Claude DESIGN review 为 `NO-GO, M/S/N=4/2/2`。以下是主 agent 对 findings 的逐条
处置；未裁决项保持 `OPEN`，不能被下文的修订措辞伪装成已关闭：

> 本节只记录第一轮当时的事实与状态。第一轮的 `DEXTER_DECISION_OPEN` 不代表当前状态；
> 当前 palette 裁决与第二轮处置以 §7.1 为准。

| finding | 状态 | 处置与落点 |
| --- | --- | --- |
| M-1 Android `sharedColors` 不在 theme 分母 | `CONFIRMED_REPAIRED` | §0.2、§2.2、§4 与 V-6 纳入 assembly-base-android `sharedColors`、两个 Android App config 和 owned config test；base 只存 CSS-variable mapping，不存 RGB。 |
| M-2 approved IA 与 proposed palette/key-action 分层冲突 | `DEXTER_DECISION_OPEN` | §2.2 将表改名为 `PALETTE_PROPOSAL`，列出 IA 同色与保留层级两案；未选定前不生成 canonical baseline、不宣称 V-7 PASS。 |
| M-3 exact-rgba/metadata/comparator 与跨平台 rasterizer 不可执行 | `CONFIRMED_REPAIRED_BY_DEXTER_98_PERCENT` | §6 改为固定 ROI 的 98% 视觉一致门、geometry/token 硬门和既有 legacy ROI diff；不改 comparator 旧语义，不以 raw byte equality 或逐像素完全相等作为机器/人工门。 |
| M-4 Web `onClick` 分支在 Node 测试中不可达 | `CONFIRMED_REPAIRED` | §2.2、§4 改为 render-time 环境选择；focused test 通过 stub/clear `globalThis.document` 分别验证 Web/native 分支，不新增 jsdom。 |
| S-1 alpha region 归属有两种读法 | `CONFIRMED_REPAIRED` | §2.1、§4、V-2/V-8 明确 alpha 第二行使用 `compoundRow`、归入 actions region，并同步 region testID 断言。 |
| S-2 历史 numeric 正本仍写跨列 0 | `CONFIRMED_REPAIRED_IN_CP0` | 实施计划 CP-0 第 3 项明确在历史需求 §5.2 按 `USER_VISUAL_REVISION` 登记 superseded；当前设计不静默改写历史文件。 |
| N-1 selected/pressed recipe 未冻结 | `CONFIRMED_REPAIRED` | §2.2 冻结 idle/selected/pressed 形态、边框宽度、opacity/scale 与四态 baseline 覆盖。 |
| N-2 renderer cache 证明对象不在热路径 | `CONFIRMED_REPAIRED` | §3.2、CP-2 删除新增 cold-path cache 要求，只保留并验证既有 memo/provider 边界，不作性能改善结论。 |

### 7.1 Claude 复评 intake（当前）

本轮复评结论为 `NO-GO, M/S/N=1/2/2`。M-1 的 palette 冲突已由 Dexter 裁定关闭；S-1、S-2、
N-1、N-2 由本次修订分别落在 §2.2、§6、V-8、CP-0 和粒度 manifest。复评文件为
`doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-review-round2-claude.md`。

| finding | 状态 | 处置与落点 |
| --- | --- | --- |
| M-1 palette 方案未收口 | `DEXTER_DECISION_CLOSED` | §2.2 记录 `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER`：五个中性 token 两主题同值且 key/action 相等；border/focus 留在各 integration theme。 |
| S-1 measurementMethod 与 mask 策略未定 | `CONFIRMED_REPAIRED` | §6.1 按 entry 规定 `REFERENCE_RENDER`/`APPROVED_CAPTURE` 用途；mask 只允许文字盒、图标盒、阴影带，沿用既有面积上限。 |
| S-2 ROI 指标没有机器失败执行体 | `CONFIRMED_REPAIRED_BY_SIMPLIFICATION` | §6、V-10/V-11 将 `changedFraction <= 0.02` 降为量化参考；机器门只判 manifest/geometry/token，最终由轻量视觉记录判 OPEN 或关闭。 |
| N-1 document stub 可能污染后续用例 | `CONFIRMED_REPAIRED` | V-8 与 CP-1/CP-2 要求每例保存并恢复 document 的存在性和值，`afterEach` 守卫对未恢复变异置红。 |
| N-2 旧 canonical/gate 名称残留 | `CONFIRMED_REPAIRED` | V-1 改为 fixed-ROI baseline；粒度 gate 改为 98% visual reconciliation；palette 状态同步为已裁决。 |

上述修订完成后，按 Dexter 授权可进入实施；本详设本身仍不虚报源码、focused、Web、Android、
visual、release、cleanup 或 acceptance 结果。

## 8. 设计阶段完成门

本文件目前只表示设计准备评审，不能写成 implementation ready：

```text
IMPLEMENTATION_AUTHORITY=false
SOURCE_RECONCILIATION=OPEN_UNTIL_IMPLEMENTATION
PIXEL_BASELINE=IA_REFERENCE_PLUS_PLATFORM_CAPTURE; MACHINE_GATE=GEOMETRY_TOKENS; VISUAL_RECONCILIATION_98_PERCENT_REQUIRED
WEB=NOT_RUN
ANDROID=NOT_RUN
VISUAL=NOT_RUN
PERFORMANCE=NO_PERFORMANCE_CLAIM
INDEPENDENT_DESIGN_REVIEW=ROUND_2_NO_GO_REPAIRED; CLAUDE_REVIEW=NO_GO_1M_2S_2N_INTAKE_REPAIRED; PALETTE_DECISION=CLOSED_BY_DEXTER_A_NEUTRAL_PLUS_THEME_FOCUS_BORDER
```

若 review 发现用户产品语义、键位集合或 integration 主题值与已确认 IA 不一致，必须停在
设计层指出冲突，不能在实施计划里悄悄改 IA。
