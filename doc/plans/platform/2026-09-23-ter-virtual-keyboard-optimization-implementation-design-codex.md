# TER 程序虚拟键盘优化 implementation-facing 详设

> STATUS: REVISED_AFTER_CLAUDE_DESIGN_FOLLOWUP；`REVIEW_TARGET=DESIGN`；`REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23`；IMPLEMENTATION_AUTHORITY=true（来源：Dexter 在 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-followup-review-claude.md` 后的本轮会话授权）。  
> `SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`。  
> REQUIREMENTS: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`；INTERACTION: 同日 `-ui-interaction-design-codex.md`；IA: 同日 `-ia-design-codex.md`，`VK-IA-01..19`。  
> DEXTER_WIREFRAME_REVIEW=随实施结果一并审阅（未批准）；DEXTER_HIFI_REVIEW=随实施结果一并审阅（未批准）。  
> AUTHORITY_BOUNDARY: Dexter 已授权按本详设与实施计划完成源码/测试实施、静态与 focused 验证，并仅在单机双屏和 mobile 虚拟机做动态验证；不包括其他虚拟机、真机、Web viewport resize 或双机拓扑。

## 0. 正本优先级与当前源码基线

本批横切既有 TER 输入基础能力，不新增 Journey、字段、HTTP operation、feature command、系统 IME 策略或 Android adapter。现有生产分母为 9 个 virtual 输入注册点、5 类可视宿主、4 布局：staff-auth 工号/密码 2，member-form 姓名/电话/alpha sample probe/financial sample probe 4，customer-member 年龄 1，admin login PIN 1，topology 主机地址 1。wallpaper integration 仅有 staff-auth 与共享 admin；member-desk 只在 sample-console；mobile topology 无主机地址输入，SECONDARY admin PIN 没有自然入口。这些是只读源码静态盘点，不是动态可达结论。`field` placement 已裁定在实施中删除；本批 harness 仅测 surface placement。十项 full URL 符号只用受控 input harness，拓扑地址仍 financial。

优先级：本批正式需求 §8 → 本批交互与 IA（可见语义、形态）→ 本详设（机制）→ 2026-09-19 旧键盘视觉 IA/详设的未冲突部分 → 当前源码。旧 820/560/330、外 margin、20/17 外框圆角、CAPS、无空格与内容收缩/208 通过条件不得被旧图或旧测试反向恢复。Dexter 已裁定 full 为四行、URL 符号十项且无额外符号行、键帽列轨按最终外框填满；按 N-3 设计采用正式移除 `field` placement，实施中删除其 public type、状态透传、renderer 分支、测试和 README。2019/历史 POC `_old_`、`newPOSv1` 只读参考，不进依赖。通用 terminal 标准 `doc/platform/terminal-coding-standard.md`、`project-memory/operations/terminal-coding-standard.md` 的 base owner/part/主题边界不变；`ui/base/render` 不能反向 import `ui/base/input`，因 input 当前依赖 render。

当前具体断裂：`InputSurfaceFrame.tsx` 让键盘成为 flex 内容后面的正常流兄弟，内容随键盘缩高；`InputKeyboard.tsx` 与 `keyboardHeight.ts` 的外框仍有旧定宽容量分离；`PrimitiveKeyboardSurface` 的 token 与 `VirtualKeyboard` inline style 都写圆角；`keyboardLayout.ts` 尚有 CAPS 且无 space/URL 十字符；`editText.ts` 零插入也清 Shift；`InputScrollArea.tsx` 用 `viewportAlreadyShrunk:true`，只存宽高不存 surface 内视口位置；`SurfaceRoot.tsx` 将 `LayerStack` 放在内容树，直接平移整棵树会连遮罩也移走。不得只改某一文件就宣称完成。

## 1. 与 IA 逐字相同的正本契约

```text
K_RULE=稳定态 K 为当前键盘外框高度；异布局交接中 K 为当前帧实际可见的底部键盘遮挡高度。布局预检与外框实测相差超过 0.5 个逻辑单位，或虽在容差内却改变容量分类时，必须重新预检；|K_B−K_A|≤0.5 个逻辑单位按等高分支处理。
HANDOFF_RULE=新键盘先在旧键盘下层升起，旧键盘再向下退出；实际可见遮挡高度在 K_A 与 K_B 之间单调变化；内容路径连续、单调，且逐帧上移量不超过当帧实际可见遮挡高度。
OFFSET_RULE=|K_B−K_A|>0.5 个逻辑单位时 λ=clamp((K(t)−K_A)/(K_B−K_A),0,1)，offset(t)=offset_A+(offset_B−offset_A)×λ；|K_B−K_A|≤0.5 时 offset 先按同一 progress p 在两端线性插值，再逐帧 clamp 到 [−K(t),0]。
MEASURE_RULE=焦点框与 viewport 以 measureLayout 相对未平移 InputSurfaceFrame 根测量；InputScrollArea 子字段改相对 scroll content 测量，再与 viewport 根相对矩形及 onScroll 回读 offset 合成；不跨 ScrollView 边界测量，不从 layout 读数扣 presentation offset。只在计算当前可见矩形时把 presentation offset 加一次。PIN visible anchor 使用同一 measureLayout 坐标契约。
SCROLL_RULE=按中心规则平移（无论是否达到上限）后焦点框仍不完整可见时，在固定尺寸内部滚动区域补足；滚动只计算平移后真实可见交集，不重复计入平移。
SCROLL_SETTLE_RULE=滚动成功以 onScroll 回读在 0.5 个逻辑单位容差内证明焦点框完整落入可见交集为准；滚动终止以归一化 onMomentumScrollEnd，或无动量时的 onScrollEndDrag 为准，键盘 250ms 动画完成不是滚动终止信号。每个滚动请求另有一次 1500ms 有界 watchdog，终止信号或 watchdog 到达时用最后 offset 判定成功/失败并清除 pending；Web/Android 均不得因缺少 onScroll 永久 pending。
WIDTH_RULE=键盘外框宽度等于所属 surface 的实测可用宽度，四角半径为 0；键帽列轨按最终外框宽度、真实内边距、键间隙和布局列数填满并判容量。
VISIBLE_BAND_RULE=覆盖模型的可见带为所属 surface 的 [0,H-K] 与焦点所属固定尺寸内部视口经整体平移后的交集；旧 MIN_CONTENT_HEIGHT=208 不作为通过条件。
FOCUS_SESSION_RULE=keyboardState.activeFieldId 等于该字段且输入 owner 为 virtual 的区间；中间 native blur 未改变 owner 时不结束会话。
ANIMATION_RULE=每 surface 由 InputSurfaceFrame 几何 owner 持有独立键盘呈现状态（idle/measure/enter/display/handoff/exit），与 keyboardState.visible 的可编辑语义分离；呈现快照保存 outgoing 的键位、K、冻结键帽标签和 incoming 的键位、K、hasNextField，动画结束才卸载。唯一 Animated.Value progress 以 250ms、Easing.inOut(Easing.quad) 缓动，经预计算分段线性 interpolate 驱动键盘和内容平移；scroll host 在同一交接起点仅发起一次 scrollTo(animated=true)，不逐帧 JS scrollTo；键盘动画结束只把呈现标为 settled，不清除或强制结算滚动 readback。
```

## 2. 真实目标、方案取舍与 CP 总览

目标是现有业务输入在键盘出现时仍看见完整焦点框、页面/弹窗布局盒绝不被压缩，且换框/换布局平滑、键帽可发现可编辑。方案比较：继续 flex 缩短各 feature 内容会反复改业务 UI 和弹窗遮罩，拒绝；在每个 feature 自写绝对键盘/避让会产生不同 owner 与双屏漂移，拒绝；**采用** InputSurfaceFrame 内唯一覆盖键盘与几何控制，render 只接受 presentation offset 的无输入依赖桥，字段/feature 保留原业务语义。无新依赖/全局 window 读数/第二键盘 owner。

| CP | 交付单位 | 退出条件 |
| --- | --- | --- |
| CP-0 | 重开本批需求、IA、memory、当前 owner/source/旧 oracle；冻结 9 生产字段+surface harness 分母 | exact source matrix、逐字段 part/display/surface/layout/placement 与滚动宿主关系、四布局键/容量、遮罩层级和测试分母已列；确认所有处于 ScrollView 的 virtual 字段都在 `InputScrollArea` 内；`field` public placement 移除清单穷尽；任何冲突先修设计 |
| CP-1 | 键位、一次性 Shift、全宽直角与容量 | 十符号逐键标签=输入、零插入不清 Shift；4 行 full 与其余布局宽/高真实测量；四主题消费面可解析 |
| CP-2 | 覆盖层、固定遮罩、统一测量契约、焦点框与滚动几何 | 普通页/弹窗/PIN 均不压缩布局；RN/RNW 已平移与已滚动坐标均单次合成；上/下裁切和屏外焦点走通 |
| CP-3 | 首开/关闭、同布局、异布局、快速中断的一条动画时钟与独立呈现生命周期 | `246→190 / 190→246 / 246→246` 及 0.5 容差边界逐帧 K 单调、offset 单调且限位；owner 变 none 时交接/退出覆盖不提前卸载；动画完成后才卸载 |
| CP-4 | 全量静态、focused、单机双屏与 mobile 虚拟机动态视觉、清理；独立三维及逐代码对账 | 两类获授权虚拟机内的证据分档；任何 OPEN 不升级为 PASS；未就绪则停于动态准入并报告缺失条件 |

每个 CP 结束到下一个 CP 前由 fresh 只读 agent 逐需求/IA/项目记忆三维对账，主 agent 逐项修复并接受新复查；全 CP 后、整体测试前再独立做全批三维对账。最终按 §13c 的逐代码与详设对账完成后才可向 Dexter/Claude 送实施 review。

## 3. 横切机制对照表（逐机制 exact owner）

| 机制 / 当前锚点 | 本批决定与复用 | 反例、失败形态与 focused 判据 |
| --- | --- | --- |
| `InputSurfaceFrame.tsx#InputSurfaceFrame/Contents` | 保留每 surface `onLayout` 唯一 W/H；内容满 W×H，键盘绝对覆盖底部，不再是 flex 兄弟；固定层与可移动层分开 | 弹起后 content 高变 H−K、两侧留白、跨屏读另一 W 任一红 |
| `keyboardHeight.ts#calculateVirtualKeyboardMetrics/calculateVirtualKeyboardDockWidth` | 用最终外框 `W_render=W_surface` 算密集行 10 列 `floor((W−2p−9g)/10)`；数字 3 列 `floor((W−2p−2g)/3)`；预检 320、50%、高度/键宽；真实高度以外框 onLayout 回读 | laptop W=1280 时密集列 118、数字列 412；mobile W=360 时分别 30、110；若实际 W 小于计算 W、cell<30/动作最小宽或 K>min(320,H/2) 即 unsupported；旧 208 不作 oracle |
| `keyboardLayout.ts#getKeyboardLayout` | full 四行数字/字母/home/末行；home 首项 Shift、末行首项 space；alpha 三行第二行首项 Shift（在 `a` 左侧）、第三行首项 space（在 `z` 左侧）；numeric/financial 原位不变 | 任意 CAPS key、alpha 空伪键、alpha 动作位置与 full 不一致、URL 十项少一项或出现额外符号行、旧字母顺序改动红 |
| `editText.ts#applyKeyboardKey/isUppercaseMode` | 移除 `caps` action、capsLock 状态/持久分支；space 插 U+0020；成功插入长度>0 才清 Shift；字符 key 实际 payload 与标签同源 | maxLength 满时点符号后 Shift 仍待生效；A-Shift→B→A 不复活；中间 native blur 不误清 |
| `VirtualKeyboard.tsx#VirtualKeyboard`、`InputKeyboard.tsx#InputKeyboard` | 普通/Shift 数字位一一映射；渲染宽 W、键列填满、外框 radius0，key 维持既有语义 token；保留同一按键 owner | `.` 在 full Shift 要显示/插入 `.`，financial 的 `·` 仍插入 `.`；不能套现有 labelOf 的 `·` 到 URL 键 |
| `ui/base/primitives/src/theme/tokens.ts#keyboardDock`、`PrimitiveKeyboardSurface.tsx` | token 和 inline 两处均设外框半径0；去外侧浮卡影/边距，保留键帽 radius、色彩语义与 icon；两个 integration CSS/mapping 以及 Android sharedColors 不换主题值 | 只改 input inline 而 primitive 恢复圆角为红；只改一个 integration 颜色为红 |
| `InputProvider.tsx#commitKeyboardState`、`useInputFocusController.ts#preflightFocusTarget/handleFocus/handleBlur/completeField`、`InputSurfaceFrame` presentation controller | 输入 owner 与键盘呈现状态分离；后者由每 surface 几何 owner 保存 idle/measure/enter/display/handoff/exit 与 outgoing/incoming 快照。保留唯一可编辑 owner 与原 capacity preflight；待提交目标用 `blockedFieldId` + null `blockedCapacity` 保存；动画完成且目标仍注册、可见、容量有效时再次 preflight 并提交。`keyboardState.visible` 只门控编辑与按键分发，不门控过渡画面挂载 | owner 在 handoff/exit 变 `none` 导致覆盖提前卸载、A→B→C 后仍提交 B、键盘区域点穿、容量错误提示混入 pending state、blur 误清为红 |
| `useInputField.ts#useLayoutEffect`、`InputScrollArea.tsx#ensureVisible`、`scrollIntoView.ts#calculateScrollOffset` | 普通字段和 viewport 用 `measureLayout` 相对未平移 surface root；scroll 子字段相对 content 测量，再合成 root-local viewport rect 与真实 `onScroll` offset；可见矩形仅加 presentation offset 一次。中心位移后若仍裁切，复用上下缘最小滚动并单次 animated `scrollTo` | 跨 scroll 边界测量、重复扣 offset、Web/Android 几何分歧、`viewportAlreadyShrunk:true` 在覆盖下漏裁切、scroll clamp 后假称可见为红 |
| `SurfaceRoot.tsx#renderContentFrame/ScreenContainer/LayerStack`、`LayerStack.tsx#backdrop/layer`、`consoleAssembly.tsx#ConsoleSurfaceInputFrame` | `InputSurfaceFrame` 创建并持有每 surface 唯一 progress；input 通过 render-owned presentation offset provider 向下提供派生 offset，render 的普通内容/每个 layer 的真实内容消费同一 offset，backdrop 固定；assembly 不透传 progress。键盘 root overlay 高于 layer 且过渡期间吞键盘区点按。详见 §4.5，render 不 import input | 平移整个 LayerStack 使 mask 露底、第二动画 clock、render/assembly progress 透传、改业务 part 注册或引入反向依赖为红 |
| `PrimitivePinInput.tsx#PrimitivePinInput`、`vendor/slots.tsx#RnrPressable`、admin-shell `useAdminLogin` | `RnrPressable` 转发真实 Pressable ref；`PrimitivePinInputProps.measureRef` 仅透传 ref；`useInputField` 的 `visibleAnchorRef` 经 field registration 到输入几何 owner；PIN 无 scroll area 时若几何不可达显示容量不足并可退出/改尺寸。详见 §4.6 | 假 ref、测 card 而非 PIN pressable、固定 POC 坐标、缩短 PIN 弹窗为红 |
| `InputKeyboardProps/Placement`、`provider.test.tsx`、README/invariant | 实施中删除 `field` placement type/prop/field config 注册和状态分支、对应窄宿主渲染分支、唯一 field-placement fixture/test、README 用法与相关 public invariant；键盘只由 surface 唯一 overlay slot 呈现 | 搜索目标生产/测试/README/invariant 仍有 `placement="field"`、`keyboardPlacement='field'` 或导出 placement type 即红；不为移除而扩大其它 public 面 |

`ui/base/input/README.md` 与 `terminal-invariants.json` 的 public 面应随上述 contract 改字；两 integration 与两 Android app 不必改业务主题值或平台策略。具体新增内部文件名可在实施时以本表 owning path 定名，不得另建第二 owner/package/全局测量适配器。

## 3a. UI/testID 与视觉前置复核

本批不开发后台浏览器 L2 脚本，模板 L2 专项 `N/A_WITH_REASON=TER Web/Android 本地画面`；但键盘的 `ui.base.input:virtual-keyboard:{keyId}` 必须挂真实 `PrimitiveButton`，不是 segment wrapper。新增 space 与 Shift 符号态有稳定 keyId 与 accessibilityLabel；旧 CAPS testID 全面消失。PIN 真锚点用当前 `PrimitivePinInput` 节点的业务 testID；不能因按键 testID 存在就宣布位置、大小、状态或命中对账通过。具体视觉分母为 IA 19 帧 × 每个可见控件，按 screen/field/key/遮罩/原业务动作逐项判断；无自然生产入口的组合只以受控 harness 证明公共能力，标注 `NOT_COVERED_BY_PRODUCT_CONSUMER`。

## 4. 几何、动画、滚动与容量的决定性算法

### 4.1 输入、测量与坐标

每 surface 一份几何状态：frame 的实测 `W,H`、未平移 `InputSurfaceFrame` root host；普通焦点框与固定滚动视口的 root-local 矩形；scroll content-local 字段框、`onScroll` 回读的实际 offset；当前 presentation offset、外框 `K_i`、相对底边的 translate `d_i`。安装版测量事实：RN 0.86.3 Fabric `measureLayout` 不含 transform，且 ScrollView 内容偏移不进入不含 transform 的读数（`apps/terminal/node_modules/react-native/ReactCommon/react/renderer/dom/DOM.cpp:554-574`、`ReactCommon/react/renderer/core/LayoutableShadowNode.cpp:176-181`）；RNW 0.21.2 的 `measureLayout` 不含 CSS transform，但相对坐标实现会含祖先滚动偏移（`apps/terminal/node_modules/react-native-web/dist/exports/UIManager/index.js:12-48,90-92`）。因此普通字段与 viewport 一律 `measureLayout(surfaceRootHost)`；`InputScrollArea` 子字段只 `measureLayout(scrollContentHost)`，再按 `viewportRootRect + contentLocalRect − onScrollOffset` 合成 surface-local 未平移字段框。相对 content 节点测量时两端坐标同处 scroll content 子树；绝不跨 ScrollView 边界直接测到 surface root。**所有处于可滚动区域内的 virtual 字段必须是 `InputScrollArea` 的后代**；不能跨过 ScrollView 测量，否则 Web 与 Android 的滚动坐标行为不同。PIN 的真实可见 Pressable 同样使用相对 surface root 的 `measureLayout`。任何 `measureLayout` 读数都不扣 presentation offset；只在求当前可见框时对未平移几何加一次 presentation offset。禁止用 `measureInWindow`：它含 transform，且外层 `SurfaceHostController` 对 canvas 的 scale 会使窗口单位与逻辑单位混用（`ui/base/render/src/components/SurfaceHostController.tsx:124-139`）。所有读数在同一 generation 获取；字段切换、resize、keyboard layout/外框变化、scroll settle、层开闭时使旧测量失效。预检尺寸与外框实际 onLayout 高度差 `≤0.5` 个逻辑单位且容量分类相同才沿用预检；差值 `>0.5` 或容量分类变化时必须重新预检并重测，绝不在错误尺寸下闪显。未得到有效 frame/焦点/外框，不提交 virtual 可输入状态；不可用时保留草稿并走 visible diagnostic/恢复。不得依赖 `Dimensions`、`PixelRatio`、静态逻辑 canvas 或旧 POC。

稳定目标：`line=(H−K_B)/2`，`offsetTarget=−min(K_B,max(0,centerY_untranslated−line))`。只允许 `−K≤offset≤0`。`centerY_untranslated` 直接取 surface-root-local `measureLayout` 几何；不再从读数扣 presentation translation。普通焦点 visible rect=`focusRect_untranslated + presentationOffsetY`；scroll 子字段未平移 surface rect=`viewportRect_root + contentLocalRect − scrollOffset`，当前 visible rect 再加 presentation offset 一次。输入框完整可见优先于中心线；若中心目标平移后框不在可见交集内，先按 §4.3 求最小内部滚动，不盲目加大整体平移。

### 4.2 方案 (b) 的一条 presentation clock

新旧外框先在不可见底侧完成 onLayout 回读，键高预检来自 `calculateVirtualKeyboardMetrics`，但 **`K_i` 真相是本地实际外框测量**，不以公式/动画目标值代替。实测与预检高度差超过 `0.5` 个逻辑单位，或虽未超过但容量分类改变，必须重新容量预检并回读，不能闪一帧错误宽高。每 surface 的键盘呈现状态由 `InputSurfaceFrame` 几何 owner 持有，和输入 owner/`keyboardState.visible` 严格分离：

| phase | 呈现快照与挂载行为 | 输入/命中行为 |
| --- | --- | --- |
| `idle` | 没有键盘呈现快照，覆盖卸载 | 无 virtual 编辑 |
| `measure` | incoming 键盘已渲染在底侧画外，完成真实外框 `onLayout`；视觉不可见、不可聚焦、不可命中 | 仍未提交 virtual owner |
| `enter` | incoming 从底部进入；保留键位、K、标签和 `hasNextField` 快照 | hit shield 覆盖当前键盘遮挡区，不能提前按键 |
| `display` | 当前键盘快照稳定显示 | 仅此阶段且 virtual owner/activeFieldId 有效时可编辑和分发按键 |
| `handoff` | outgoing/incoming 同时保留完整快照，先新在旧下升起，再旧下退；旧标签冻结到卸载 | owner 可为 `none`；hit shield 全程捕获键盘区点按，屏幕阅读器不把退出键帽暴露为可操作控件 |
| `exit` | outgoing 的键位、K 与冻结标签继续渲染并向下退出；动画完成后才卸载并回到 `idle` | owner 可为 `none`；命中层随可见遮挡退出，不能穿透到下层内容 |

快照最少保存 outgoing 的布局/键集合、实测 K、逐键冻结的可见标签与动作状态，以及 incoming 的布局/键集合、实测 K、逐键标签/动作状态和 `hasNextField`。不能在过渡中从已变化/已卸载的 `keyboardState` 重建旧键帽。`keyboardState.visible` 保持“当前可编辑”的原语义，只门控按键分发，绝不用于决定呈现层是否挂载。首次打开为 `idle→measure→enter→display`；异布局为 `display→handoff→display`；收起为 `display/handoff→exit→idle`。owner 在 `handoff/exit` 变为 `none` 不得卸载覆盖。取消、scope 变化、字段卸载或目标被替换时，以当前可见几何重定向呈现轨迹，并按既有规则清理 pending；过渡完成且目标可见/仍有效才提交新 owner。

唯一 monotone progress clock 是 `InputSurfaceFrame` 每 surface 创建的 `Animated.Value`，使用 `Animated.timing(..., {duration:250, easing:Easing.inOut(Easing.quad), useNativeDriver:true})`。incoming/outgoing 键盘、普通内容和弹窗内容的 transform 均从同一 progress 的预计算分段线性 `interpolate` 派生。内部滚动不伪装成 native-driver transform：满足 §4.3 时，`InputScrollArea` 可在 `measure` 阶段算好最终滚动目标，但只把带字段 ID 与 request generation 的单次启动回调交给 `InputSurfaceFrame`；surface 在真实 K 已测量且 `enter/handoff/reposition` 的共享时钟即将启动时执行一次 `scrollTo({y:target, animated:true})`，不逐帧 JS `scrollTo`。若无需滚动则取消待启动回调；字段、视口、内容或几何代际变化后，旧回调不可执行。scroll readback 在同一过渡段核验实际 offset。稳定显示态中不伴随键盘/内容位移动画的独立滚动，在该次焦点布局事务内执行。中断时从当前 progress、实测 K/offset 与滚动 readback 建新轨迹，不叠加旧动画。

两个底对齐外框各自 `v_i(t)=clamp(K_i−d_i(t),0,K_i)`；交接中实际遮挡 `K(t)=max(v_A(t),v_B(t))`。Phase 1 保持旧外框全显，新外框在旧下层升到满高；Phase 2 保持新外框全显，旧外框向下退至不可见。因此 `246→190` 为 246 平台后降至 190，`190→246` 为 190 平台后升至 246，`246→246` 全程 246。交接总时长 `250ms`，`Easing.inOut(Easing.quad)` 仅改变共享进度随时间的速度，不改变分段几何关系。两个阶段均由覆盖在 `H−K(t)..H` 的透明命中层吞掉键盘区所有点按；旧键盘完全退出后、pending 目标复核成功并提交 owner 后，才撤命中层并允许新键盘接键。辅助技术不把退出键帽暴露为可操作项。

内容平移从当前可见 `offset_A` 而非旧 target 起步。若 `|K_B−K_A|>0.5` 个逻辑单位，按实际遮挡高度参数化：`λ(t)=clamp((K(t)−K_A)/(K_B−K_A),0,1)`，`offset(t)=offset_A+(offset_B−offset_A)×λ(t)`；K 处于平台时内容保持不动，K 开始变化后内容才随 K 变化。K 的变化段与 λ 同比例，因此 offset 与 K 都是端点的凸组合，由端点均满足 `−K_i≤offset_i≤0` 可证逐帧限位。若 `|K_B−K_A|≤0.5`，按等高分支以共享 progress p 对端点 offset 线性插值，再逐帧 clamp 到真实 `[-K(t),0]`；该投影保持路径单调连续且不越过当帧遮挡上限。饱和端点 `−190→−246`、`−246→−190` 分别随 K 精确贴边；`−246→−246` 等高时始终限于 K。首次弹出/退出将可见 K 与 offset 同钟从 0 进退；同布局切框保持键盘不动，只在固定 K 下插值内容；Shift 只改标签不重弹。动画中 resize、A→B→C、收起，从当前 progress、真实 K/offset 及滚动 readback 建新轨迹，不先卸载/跳目标。

异布局待提交目标状态：无论请求来自字段 `onFocus`、`focusField` 还是 `completeField`，B 必须先经 `preflightFocusTarget(B)`；通过后令当前输入 owner 为 `none`、清除 A 的本焦点会话 Shift，并以现有键盘状态字段记录 `blockedFieldId=B, blockedCapacity=null`；null capacity 在这里明确表示 pending，不触发 unsupported 提示。过渡期 `handleFocus(B)` 不得绕过 pending 直接提交 virtual owner。A→B→C 时，C 通过自己的 preflight 后替换 B 并从当前动画采样重定向；C 预检失败则清除 B pending，并保留 C 的原始预检失败分类及其事实，不将其一概改写成容量失败。仅当旧键盘层完全退出、必要滚动已结束且 readback 证明 B 全框可见、B 仍注册并属于活动 scope、frame/容量 generation 未变化时，再执行 `preflightFocusTarget(B)`，成功后提交 B 的 virtual owner 并清除 pending。同布局切框不做键盘层交接，沿同布局 owner 路径处理。新目标、显式关闭/失焦、focus scope suspend/切换、目标卸载或几何失效均清除或替换 pending；unmount 时停止旧轨迹。该 pending 复用 `blockedFieldId`/`preflightFocusTarget` 现有 owner 边界，不创建第二套焦点 owner。

过渡中不能仅凭整体平移保证所有几何下新焦点每帧可见：若 B 在旧较高键盘下面、又无足够内部滚动空间，数学上无法同时维持 B 全框可见、内容单调和 `|offset|≤K`。因此 B 的输入 owner 不得在它仍被遮挡的帧提前提交；必要时经过上述 `none` 交接态，仅保留禁输入的视觉过渡，并在可见/可操作时提交 B。若终态也不可达，走容量不足/可恢复路径，而不是使一个被遮挡字段取得 virtual owner。实施必须用单字段无 scroll 的极限反例核验这条边界；不得在文档中宣称不可能的“B 全程已聚焦且可见”。

### 4.3 内部滚动的合法时机

屏幕可见带 `B=[0,H−K(t)]`；滚动视口原边界 `[viewportTop,viewportBottom]` 加**一次**内容 presentation offset 后为 `V(t)`；真实可用区 `I=B∩V(t)`。焦点可见边界框（含现有 scroll offset 的实际值）在 `0.5` 个逻辑单位容差内全部在 I 中才无需 scroll。否则不问整体位移是否饱和，按最小 delta 移动**既有固定尺寸**内部视口的内容；上缘裁切 delta 为负，下缘裁切 delta 为正，目标 offset clamp 在 `[0,maxScroll]`，并由 `onScroll` readback 验证；单次回读达到目标且仍不完整可见时立即判定 clamp 失败，非目标中间回读必须保留 pending。对非滚动宿主 delta 不可达即容量状态。`scrollIntoView.ts` 原上下缘二支保留，但把 `viewportAlreadyShrunk:true` 的旧收缩假设替换为 surface 交集；`InputScrollArea` 不改变自己或父容器尺寸，不加第二 scroll ancestor。滚动只在内容位移起始时发出一次 `scrollTo({y:target, animated:true})`，与唯一 progress clock 同时开始；不逐帧写滚动值、不执行第二段追赶动画。滚动“已结束”只由 primitive 归一化的 `onMomentumScrollEnd`，或速度在容差内的 `onScrollEndDrag` 给出；平台没有终止事件时由该请求唯一的 `1500ms` watchdog 以最后 offset 收敛。键盘 250ms 动画完成只把呈现置为 settled，不强制清除 readback；终止信号/有界 watchdog 才核对最终焦点框，成功才提交，未达到可见条件按容量/滚动失败恢复，不能假称成功。

三类有效滚动/容量样本：内部视口上缘/未饱和下缘裁切；focus-next/程序化聚焦到屏外或裁切字段；字段高度大于 `H−K`（物理上无法全显，直接容量不足而非假称滚动成功）。若字段键盘前全显且高≤`H−K`，中心规则与 K 上限已保全框，不应以 `centerY=700` 的饱和例伪造滚动场景。`InputScrollArea` 只可改善其真实子字段；PIN 当前无 scroll area 时保留明确反例。焦点进入滚动区域后，对 Web 与 Android 分别用同一坐标样本核对：viewport root-local `y=100`、content-local field `y=500`、`onScroll=80`，组合后的未平移字段 surface `y=520`；若整体 presentation offset 为 `−100`，可见 `y=420`。另给普通字段 root-local `y=400`、presentation `−150`，两平台 `measureLayout` 都仍为 400，可见坐标为 250，不再重复扣 150。测试矩阵要覆盖未平移/已平移 × 未滚动/已滚动；不得对 ScrollView 子字段直接 relative-measure 到 surface root。

### 4.4 最终渲染宽度与覆盖容量

四布局 `W_render=W_surface`，不扣外 margin；`field` placement 在本设计中删除，容量不再按窄字段父宽测算。laptop full/alpha 10 列 `p=14,g=8,hKey=48`，compact `p=10,g=4,hKey=38`，numeric/financial 用 3 列和原底行 grid；所有 inner row/compound group 以 `W_render−2p` 为预算，宽度不足时不能覆盖到其它列。高度配方：full 四行 `4*48+3*8+2*14+2*1=246`（compact `4*38+3*5+2*10+2=189`）；alpha 190/146；numeric/financial 246/189。`K≤320` 且 `K≤H/2`，W 至少 360，键宽按最终外框与实际 width 计算，过小转 `unsupported-width/horizontal/height`；覆盖下旧 `MIN_CONTENT_HEIGHT=208` 退出容量式，真实可见带 `H−K` 与焦点框/视口交集才是 usability 门。示例 360×640 full：`K=189≤320`；360×360 full：`189>180`，明确 unsupported，不压键。若相同 W 在一个平台上因真实 padding/gap 或 border 测量不同导致撞键，先修实际 geometry 与判据，不以改变阈值、裁键或缩触区掩盖。

### 4.5 跨 input/render/assembly 的 exact presentation bridge（处置独立审查 M-1）

键盘呈现时钟与偏移由 `InputSurfaceFrame` 几何 owner 创建和持有，不从 `SurfaceRoot` 的 render callback 向上游透传。`render/src/types/props.ts#SurfaceRootContentFrame` 保持 `{content: ReactNode}`，`ConsoleSurfaceInputFrame`/`SurfaceRootContentFrame` 不增加 progress prop，assembly 只把既有 `content` 交给 `InputSurfaceFrame`。不得为了动画改变 render→input 的桥形或让 assembly 同时承担键盘时钟所有权。

`InputSurfaceFrame` 是 progress 的唯一 writer/动画时钟 owner，按每次 transition 的 K/offset 轨迹预计算分段线性输入/输出区间并创建 `presentationOffsetY` Animated interpolation。由 `ui/base/render` 声明并公开 `SurfacePresentationOffsetProvider` 与 `useSurfacePresentationOffset`：provider 接受 `Animated.Value | Animated.AnimatedInterpolation<number>`，hook 在无 provider 时返回 `0`；该 context 只承载派生 offset node，不创建第二时钟。Input 在既有 input→render 依赖方向内提供该 context，render 的普通内容平移 wrapper 与 `LayerStack` 消费同一 node。`SurfaceRoot` 将 `{children, ScreenContainer}` 放在满 W×H 的 presentation wrapper 中；`LayerStack` 仍是并列、固定铺满的 absolute stack，其 backdrop Pressable 与全屏 focusable wrapper 保持固定，只对 `resolvePart(...)` 所在内层满尺寸 Animated.View 应用相同 translateY。不能把 transform 写在 surface/frame 根、LayerStack 根、backdrop 或弹窗内单个按钮上；`LayerStack` 的既有 layer ordering、tier/guard、back dismissal 和焦点恢复不变。

`InputSurfaceFrame` 将 AdminLauncher/render 内容和键盘 overlay 分为 sibling：内容始终 W×H，不消耗 K 的 flex 高度；键盘 overlay `position:absolute,left:0,right:0,bottom:0,zIndex/elevation > LayerStack 的 1000`，不会参与内容布局。overlay 按独立 presentation phase 挂载，不由 `keyboardState.visible` 决定。measure 阶段先渲染 incoming 但放在底侧画外、视觉不可见、不可访问且不可命中，以便真实 `onLayout`；enter/display/handoff/exit 由快照维持 outgoing/incoming 键帽，owner 变 `none` 不卸载，只有 exit 动画完成才清快照卸载。handoff 中新键盘位于旧键盘下层。enter/handoff/exit 在 `H−K(t)..H` 设置透明 hit shield，吞掉键盘区域所有点按；只有显示稳定且当前 virtual owner 有效时按键事件才分发。异布局时旧键盘完全退出、目标复核成功并提交 owner 后撤 shield，再允许新键盘响应。surface 其它区域仍保留原 focus-scope 点击关闭语义；键盘面原 `stopPropagation` 保留，按键不得落到 backdrop 或 surface dismiss。双屏各有自己的 presentation state/progress/overlay，不共享实例。frame/unmount 时停止所拥有动画并把 progress 重置 0，不能留下半截位移。

装配与单位的硬门：`ConsoleSurfaceInputFrame` 必须由 `SurfaceRoot` 的 `renderContentFrame` 包住 `AdminLauncher`/`content`，并位于 `SurfaceHostController` 的 canvas 子树内；`SurfaceRootContent` 只能在该 input provider 下读取 `useSurfacePresentationOffset`。因此 frame `onLayout`、字段/viewport `measureLayout`、键盘外框 `K`、presentation offset、overlay 与 hit shield 均使用同一 canvas logical unit，host→canvas scale 只作为共同祖先 transform；禁止把 input frame 放回 canvas 外，或在 input 内按 host scale 手工换算。`SurfaceRoot` 函数体不得越过 `renderContentFrame` 读取 input presentation context。

### 4.5.1 性能与渲染稳定性契约

键盘层 React key 只由稳定呈现角色与不可变层身份组成：当前 incoming 使用 `incoming:${fieldId}:${layout}`，当前 active 使用 `active:${fieldId}:${layout}`；被中断或冻结的层保留创建时的 immutable `layerKey`（包括原 active/incoming 身份与 transition serial），不得重新按 fieldId 合成，也不得把数组 index、动画帧或 phase 后缀拼进 key。这样 A(l1)→B(l2)→A(l1)→C 的快速中断即使出现两个同 fieldId 的冻结层，也不会发生 key 覆盖；非交互键盘传给 `VirtualKeyboard` 的 `onKey` 必须使用模块级稳定 noop，不得在 render 中创建内联空函数。

动画仍只有每 surface 一个 native-driver `Animated.Value`，无动画计时器、逐帧 JS 回调或新增 listener；滚动仅允许每个 pending request 一个 `1500ms` 有界 watchdog，并在 success、terminal event、cancel、unmount 后清理，不驱动动画或逐帧更新。高度缓存随 frame geometry/宽高变化清空且有界。focused 必须覆盖 phase/owner 变化时同 serial 不重复 `progress.setValue(0)`、冻结层 immutable key/noop、scroll intermediate readback 不误失败、terminal event/无 event watchdog 能收敛以及 unmount/redirect 停止动画；破坏任一约束都必须先红后绿。

上游 exact API 变更表：

| 声明/调用点 | 输入→输出 | 不变量 |
| --- | --- | --- |
| `render/src/types/props.ts#SurfaceRootContentFrame` | `{content: ReactNode}`，签名保持不变 | render callback 不承载 input presentation state/progress |
| `render/src/contexts/SurfacePresentationOffsetContext.tsx` 与 `render/src/index.ts` | 新增并公开 `SurfacePresentationOffsetProvider`、`useSurfacePresentationOffset`；hook 无 provider 时返回 `0` | provider 只传一个 Animated offset node；这是本批唯一必要新增 render public API，context 不持有时钟 |
| `render/src/components/SurfaceRoot.tsx#SurfaceRoot` | 从 hook 读取 offset；普通内容 wrapper 消费同一 offset | `children+ScreenContainer` 移，LayerStack 根/backdrop/focusable 外壳不移；默认 offset=0 保持无键盘行为 |
| `render/src/components/LayerStack.tsx#LayerStack` | 从 render-owned hook 读 `presentationOffsetY` → 各 layer 内层 translateY | backdrop 和 focusable 外壳保持原位、layer 内真实内容移动 |
| `console-assembly/src/foundations/consoleAssembly.tsx#ConsoleSurfaceInputFrame` | 原样传递 `content`，不接收、不透传 progress | 不创建时钟、不修改 callback props 或 part/业务 props |
| `input/src/types/types.ts#InputSurfaceFrameProps` / `InputSurfaceFrame.tsx` | props 不含 progress；InputSurfaceFrame 创建唯一 progress 和 offset interpolation，并包 render provider | 同一 progress 驱动键盘/内容 transform；滚动仅单次 animated `scrollTo`；overlay 高于 1000 且交接时捕获键盘区域触摸 |

验证要故意把 transform 放到 `LayerStack` 根、把 `zIndex/elevation` 降至 999、让 render import input、让 assembly 新建第二 value，各自 focused/结构断言都应红；另将 transition/exit 中的 input owner 置为 `none`，若呈现覆盖因此提前卸载或退出无动画，CP-3 门必须红。真实画面仍必须核遮罩不露底和键盘命中。不能仅断言 context provider/hook 存在。

### 4.6 `nativeLess` PIN 的最小可见测量接口（处置独立审查 S-1）

当前 `useInputField.ts` 把 nativeLess `inputRef` 置 null，`InputFieldRegistration` 只携普通 `PrimitiveInputHandle`；不把它伪装成普通 input。增独立 `InputVisibleAnchorHandle` 与 `visibleAnchorRef`，接口暴露相对指定 host view 的 `measureLayout`：`useInputField` 对每个字段返回稳定 `visibleAnchorRef` 并在 registration/`MutableFieldController` 原样携带；普通字段继续使用相对 surface root 的 `inputRef.measureLayout`，nativeLess 才消费 `visibleAnchorRef`。`ui/base/primitives/src/vendor/slots.tsx#RnrPressable` 做标准 `forwardRef`，`PrimitivePinInputProps` 增**仅 presentation** 的 `measureRef`，`PrimitivePinInput` 把它透传到真正承载六格的可按 Pressable，而不是卡片或外层假 View；`ui/base/admin-shell/src/hooks/useAdminLogin.ts` 只把 `field.visibleAnchorRef` 传给 `passwordInput.measureRef`，不在 admin-shell 自算坐标。

每次 PIN 焦点/布局/动画目标前，同一 generation 对真实 Pressable 执行相对未平移 `InputSurfaceFrame` root 的 `measureLayout`，直接得到 surface-local 未平移 x/y/w/h；不扣 presentation offset，不读窗口坐标。失效/非有限/零宽高时不承诺焦点完整可见，保持原草稿并显式容量/测量不可用，等下一次本地 layout 重测。PIN 当前无 `InputScrollArea`，故平移后若全框仍不在 `[0,H−K]`，不调用伪 scrollTo；拒绝将被遮挡 PIN 提交为可编辑 owner，显示“焦点框无法完整显示，请调整窗口尺寸或退出输入”并给原有关闭/调整尺寸路径。无需为此给 PIN 增滚动宿主或改六位口令语义。

focused 反例：给 PIN Pressable 与卡片不同测量矩形，断言相对 surface root 使用前者；移除 ref forwarding、返回无效尺寸、对 `measureLayout` 结果扣 offset、无 scroll 仍标 complete 均红；`AdminLoginLaptop/Mobile` 的实际现有按钮/文案/focus scope 保持。Web/Android 视觉仍要逐控件检查 PIN 六格真实边界与 keyboard top，结构测试不升级为视觉通过。

## 5. 逐控件键值与 owner 状态闭环

| 原数字位 | Shift 标签＝真实插入值 | 访问与返回 |
| --- | --- | --- |
| 1 | `:` | 点 Shift→1；成功插入返回数字态 |
| 2 | `/` | 点 Shift→2；成功插入返回数字态 |
| 3 | `.` | 点 Shift→3；成功插入返回数字态 |
| 4 | `?` | 点 Shift→4；成功插入返回数字态 |
| 5 | `&` | 点 Shift→5；成功插入返回数字态 |
| 6 | `=` | 点 Shift→6；成功插入返回数字态 |
| 7 | `-` | 点 Shift→7；成功插入返回数字态 |
| 8 | `_` | 点 Shift→8；成功插入返回数字态 |
| 9 | `%` | 点 Shift→9；成功插入返回数字态 |
| 0 | `+` | 点 Shift→0；成功插入返回数字态 |

这张表与 IA §2 逐字相同。Shift 数字标签和 `KeyboardKey` 实际 payload 必须由**同一个**映射取得，字母继续由 `editText` 一次性大写。`space` action 明确编辑 U+0020，keyId 与键帽/accessibility 独立；full 与 alpha 的空格都位于各自三行字母布局的 `z` 左侧；alpha 的 Shift 位于 `a` 左侧。不能用 `isUppercaseMode(capsLock,shift)` 的旧 XOR 复活持久大小写。字段 editState 若仍保有 `capsLock` 兼容位，实施须明确**同批删除其公共/测试/快照残留**或给出真实不可删的编译证据；不得留不可见持久大写状态。任何成功插入后 Shift 清；零插入、退格、预检失败不冒充成功输入；scope/owner/activeFieldId 改变清旧 Shift，但 native blur 被忽略时保留。值/selection/maxLength/业务 dirty 不由键盘重定义。

## 6. 声明—传递—消费矩阵与全链变更清单

| 事实/机制 | 声明 owner | 传递/实现位置 | 消费与必须失败的反例 |
| --- | --- | --- | --- |
| W/H 与容量 | `InputSurfaceFrame` 本地 `onLayout` | `InputProvider`→`keyboardHeight`→`InputKeyboard` | `VirtualKeyboard` 外框与键帽；把 W 改成全局 window/窄父宽就红 |
| 全宽直角/主题 | 正式需求+IA | `keyboardHeight`、`VirtualKeyboard`、`PrimitiveKeyboardSurface`/tokens | 两 integration CSS/tailwind、Android sharedColors 沿原 token 映射；漏任一外框 radius=0 就红 |
| 唯一输入 owner 与 Shift | field registry + focus controller | `useInputField`→`editText`→`InputProvider`→键帽 | A→B→A、owner system、scope 变更、零插入与中间 blur；状态潜伏/误清就红 |
| 实测 K 与逐帧可见遮挡 | keyboard outer `onLayout` | `InputSurfaceFrame` presentation clock→render bridge | 内容/弹窗 offset、scroll 交集、visual layer；用目标 K 一步代替或 `max` 不单调就红 |
| 普通/弹窗位移与固定遮罩 | input 几何 owner | `SurfaceRoot` presentation-only bridge→`ScreenContainer`、`LayerStack` 的**layer 内容而非 backdrop** | 两 integration 同一 assembly；遮罩露底或按钮独立位移就红 |
| 字段可见框与滚动 | PrimitiveInput/Pin visible node | `InputScrollArea` 当前 viewport/offset→scrollIntoView | IA-11/12/13/18；只看中心、不看上缘裁切、二次减 K 就红 |
| retired field placement | input public type | 删除 type/prop、registration/render 分支、唯一 fixture/test、README 与 invariant 残留 | 静态 exact-set 搜索仍有生产或测试 field placement 即红；不建立窄字段宿主 harness |

同步修改分母（实施时，非本轮已改）：`ui/base/input` 的 layout/edit/height/provider/frame/keyboard/scroll/context/types、README、terminal-invariants、对应 10 个既有测试及必要 focused 新测试；`ui/base/primitives` 的 dock token/primitive；`ui/base/render` 的 SurfaceRoot/LayerStack presentation-only channel；`ui/base/console-assembly` 的 renderContentFrame 连接；两个 integration 的 theme consumer 和两 Android app 的实际 mapping 只复核不无谓改值；`sample-staff-auth`、`sample-member-desk`、`admin-shell` 业务源码只在确需暴露真实 PIN 锚点时作最小接口接线，不重写页面/part/command；两 integration 与现有 Web/Android 回归入口。每个触及的 `README/index/exports/invariants/test` 依当前 terminal 标准同步，**不因本设计预先扩大 public export**。

## 7. 模板 N/A 项与业务边界

`operation/path/face/集合形态`：无新 HTTP operation；键集为源码固定 Bounded，本地输入不实现 Page/Cursor。`跨 owner 写矩阵`：N/A，无跨业务 owner 写；输入只编辑本地字段，提交由原 feature。`owner API`：沿 `ui/base/input` public API，不新增 backend/readback。`数据迁移/seed`：N/A，无数据库、持久化 schema、seed；URL 字符只在受控 harness 输入，不新增会员/拓扑字段。`后台权限/审计/幂等`：N/A，原业务命令未变；唯一 owner 是输入焦点所有权，不是 HTTP 权限。系统 IME 继续原本 inset/owner 路径，不沿程序键盘覆盖改造。`admin-ui-foundation` 是两 Web 管理后台能力，与 TER RN 输入包无适配关系，不能为了模板填项引入。

## 8. 可证伪验收矩阵（设计未来执行，不是本轮结果）

| 对应需求 / IA | focused 红反例 | 运行观察分档 |
| --- | --- | --- |
| AC-01/02 · IA-01..10 | 外框 radius 回 17、任一 layout 宽回 330/820、CAPS 残留、full 行数/键位集合错误 | Web 与 Android 分别看真实边界、键帽大小/图标/状态；两 integration 不互相冒充 |
| AC-03/08 · IA-09/10 | 十符号每个 label/payload 单独变异；maxLength 零插入错误清 Shift；A→B→A 潜伏 | 两种形态实点 URL/harness；真实 consumer 的业务 payload/dirty 不变 |
| AC-04 · IA-11..13 | 模拟 content 高变 H−K、只移提交、遮罩随内容偏移、PIN 假锚点 | 普通页、弹窗、PIN 分别记录未弹/弹出/收回的外框与操作区矩形 |
| AC-05 · IA-18/19 | 上缘裁切、未饱和下缘裁切、focus-next 屏外、h>H−K、scroll clamp 无 readback | 画面焦点框完整可见/容量明确，不以中心点为 oracle |
| AC-06 · IA-14..17 | 逐帧 `246→190/190→246/246→246` 修改层序或 old/new 一项导致 K 凹陷；offset 超 K/跳变 | 逐帧截图或录帧核几何、命中、内容/scroll 同段；平台栅格差不作唯一 oracle |
| AC-07 · IA-19 | 双屏 W 互换、跨 surface 尺寸借用、未测量先显示 | 双屏两 surface 实画面独立核验；无自然生产入口注明受控 harness |

测试层顺序：static/source 与 focused 红变异先闭合，fresh 步骤/整体三维对账后才动态；Web、Android/native/device、visual 和 cleanup 分档，不以静态/typecheck/键级 testID 存在升级画面 PASS。运行前记录可到达生产消费者与 harness，未达到条件显式 OPEN。任何动态 run 需受管入口、PID/日志/cleanup 分开记录，首败先定位。当前设计批不执行。

## 9. 停机、未决与交付审查

若真实 final keyboard K 无法同时满足高度 320/50%、最小键帽或 full 四行在获支持设备上的要求，若无遮罩移动的 presentation bridge 会造成 render→input 反向依赖，或者某焦点在要求的单调路径中无法完整可见且无合法滚动/容量恢复，则停在对应 CP，呈现首个反例、最小替代和需 Dexter 裁决的产品取舍，不能通过改大上界、改业务页面或谎报视觉通过绕过。full 键位与高度按当前需求、IA 和 S-4 裁定逐控件核验，不把旧图当作已批准产品事实。

### 9a. 实施节奏与逐代码—详设对账

每实际修改点写前双读需求/IA、项目 memory 原文、现有 owning source，focused 后同组回读；每 CP 结束 fresh 只读三维对账，全部 CP 后全批新三维对账。交付前对**所有新增/修改的生产代码、测试、README、index、exports、invariants**按本详设 §3–§8 一行一行登记：详设条目、code path+symbol/行、测试或画面证据路径、判定人、`MATCHED/OPEN` 与差异；旧 oracle 删除/替换也逐项记。只要有 OPEN、缺证据或未经新的独立复查，不交实施 review。子 agent 只读报告，主 agent 独自改文件/运行。最终 `REVIEW_TARGET=IMPLEMENTATION` 由 fresh 独立审查，重开真实源码与操作证据。

### 9b. 交付前自查

需求 A–D/Q1–Q6 与 S-1/S-2/S-3(a)/S-4/N-1/N-2/N-3/N-4 已逐行对 IA 19 帧和 §3–§8；十项 URL 字符与非 CAPS 位置明确；`K`/交接/offset/测量/滚动/宽度/可见带/焦点会话/动画九条契约与 IA §1 逐字一致；9 个生产消费者与 harness 边界不混；视觉审阅状态为“随实施结果一并审阅（未批准）”。Dexter 已授权按本详设和实施计划进入 CP-0 至 CP-4；动态范围仅单机双屏与 mobile 虚拟机。
