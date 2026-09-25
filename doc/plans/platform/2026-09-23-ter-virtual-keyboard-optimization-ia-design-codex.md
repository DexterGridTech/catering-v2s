# TER 程序虚拟键盘优化 IA

> STATUS: REVISED_AFTER_CLAUDE_DESIGN_FOLLOWUP；IMPLEMENTATION_AUTHORITY=true（来源：Dexter 在 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-followup-review-claude.md` 后的本轮会话授权）。  
> IA_SCOPE: `VK-IA-01` 至 `VK-IA-19`，19 个状态/形态 frame；不是新增业务 Journey。  
> BUSINESS_SOURCE: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`；UI_INTERACTION_REF: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md`。  
> IMPLEMENTATION_DESIGN_REF: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`；两份设计中重复的事实按下述「逐字契约」对齐。  
> DEXTER_WIREFRAME_REVIEW=随实施结果一并审阅（未批准）；DEXTER_HIFI_REVIEW=随实施结果一并审阅（未批准）。  
> PRECEDENCE: 本 IA 的新外框、键位和覆盖避让事实覆盖 2026-09-19 旧键盘 IA 的定宽、圆角、CAPS 和内容收缩；Dexter 已裁定 full 为四行、URL 十字符、键帽随最终宽度铺满；本设计按 N-3 移除 `field` placement。旧 IA 仅供未冲突的色彩语义、字体及图标参考，不可作冲突事实 oracle。

## 1. 与详设逐字相同的正本契约

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

这里 `K_A/K_B` 是两把键盘各自完整外框的实测逻辑高。对于底边锚定、下移 `d_i` 的外框，`v_i=clamp(K_i-d_i,0,K_i)`，新在旧下层时 `K=max(v_A,v_B)`。异布局切换时，新键盘先在旧键盘下层升起，旧键盘再向下退出；交接期间键盘区持续吞掉点按，旧键盘完全退出且必要滚动完成后新键盘才接键。待提交目标用 `blockedFieldId`/`preflightFocusTarget` 保存和复核；目标替换、取消、scope 改变或字段卸载时清理。此表达是可见遮挡的几何事实，不从动画进度或旧 height 估算。`full` 为 laptop 246、mobile 189；alpha 为 190/146，numeric/financial 为 246/189。运行时以实测外框为准，未测量不可进入 virtual owner。呈现快照与输入 owner 分离：owner 暂为 `none` 时，handoff/exit 仍保持画面挂载；只有动画完成才卸载。

## 2. 可见形态、控件与帧分母

所有键盘外框水平贴当前 surface 两侧、底边贴底，背景继续使用 integration 的 keyboard semantic token。外框四角直角、无左右浮卡 gutter；键帽保留原 keyboard-key/action token、键帽圆角 9/7、48/38 高、选中边框与 pressed 反馈。laptop 横向/纵向 padding 14、gap 8；mobile compact 横向/纵向 padding 10、列 gap 4、行 gap 5；最小 dense 键宽 30。四布局键帽按全宽列轨填满：`1280×800` 时 full/alpha 标准键宽 118、numeric/financial 每列 412；`360×640` 时分别为 30 与 110。计算式分别为 `floor((W−2p−9g)/10)` 与 `floor((W−2p−2g)/3)`。外框用 `keyboard-border` 分隔；顶部边缘可有原语 shadow，但不得形成四周浮卡空隙。字体沿既有 `keyboardButtonText`/`keyboardActionText` 及 compact 对应 token，backspace/complete 沿既有 icon；Shift selected 不只靠颜色，还要有可读标签/辅助技术状态。主题 RGB 不由 base 写死。此参数是后续逐控件视觉对账的几何基准，实施时仍按最终外框及真实 padding/gap 核验。

| IA-ID | 用户任务/入口与可见控件 roster | 位置、状态、禁止项 | 最低反证档 |
| --- | --- | --- | --- |
| VK-IA-01 | laptop full 普通态；数字 1–0、26 字母、Shift、空格、退格、完成 | 四行，全宽直角；键帽列宽按 S-3 基准为 118；Shift 在 home 行旧 CAPS 位、空格在末行旧 Shift 位；无 CAPS | focused 键集合 + 运行画面 |
| VK-IA-02 | mobile full 普通态；同一键集合 | 四行 compact，`⇧` 与 `␣` 短标签；标准键宽 30，不裁切 | focused + Android/Web 画面 |
| VK-IA-03 | laptop alpha；26 字母、Shift、空格、退格、完成 | 三行；第二行 `SHIFT a…l`，第三行 `空格 z…m ⌫ 完成`，无 CAPS/空动作伪键 | focused + 画面 |
| VK-IA-04 | mobile alpha；与 03 同一集合 | 三行 compact；`⇧` 在 `a` 左侧、`␣` 在 `z` 左侧，无 CAPS | focused + 画面 |
| VK-IA-05 | laptop numeric；数字 1–9、底行退格/0/完成 | 四行三列，全宽，每列键宽 412，不越界 | focused + 画面 |
| VK-IA-06 | mobile numeric；与 05 同一集合 | 四行 compact，全宽，每列键宽 110 | focused + 画面 |
| VK-IA-07 | laptop financial；数字 1–9、底行 `−`、`·`、0、退格、完成 | 四行三列复合底行；每列键宽 412；显示 `−/·`，实际插入 `-/.` | focused + 画面 |
| VK-IA-08 | mobile financial；与 07 同一集合 | 四行 compact，全宽，每列键宽 110 | focused + 画面 |
| VK-IA-09 | laptop full Shift 态；十个数字位变十符号、字母大写、空格/退格/完成仍在 | `SHIFT` 选中、无 CAPS；十项标签与实际插入一致，键宽 118 | focused + 画面 |
| VK-IA-10 | mobile full Shift 态；同 09 | `⇧` 选中，键帽宽 30，外框仍四行 | focused + 画面 |
| VK-IA-11 | 普通页面焦点字段和原提交/取消；键盘覆盖 | 内容框 W×H 与控件布局不变；只整体上移，焦点全框在可见带 | 几何 focused + 运行画面 |
| VK-IA-12 | 弹窗焦点字段、原动作、遮罩；键盘覆盖 | 弹窗内容整体平移，遮罩始终满屏不露背景；按钮不单独上跑 | 结构 + 画面 |
| VK-IA-13 | nativeLess 管理员 PIN；可见 PIN 框、键盘、原动作 | PIN 实际可见框为锚点，无假 ref；无滚动空间时容量提示而非裁切假绿 | 结构 + 画面 |
| VK-IA-14 | A→B 同布局、同 surface | 已显示键盘不动；焦点/内容在同段改变；Shift 不带到 B | focused + 逐帧画面 |
| VK-IA-15 | numeric/financial 246→alpha 190 | B 在 A 下层先升，再 A 下退；K 246→190 单调；内容单调连续且 `|offset|≤K` | 逐帧几何 + 画面 |
| VK-IA-16 | alpha 190→numeric/financial 246 | K 190→246 单调；同样的层次/位移限位 | 逐帧几何 + 画面 |
| VK-IA-17 | numeric↔financial 246→246 | K 恒 246，无遮挡凹陷；两把只一把能输入 | 逐帧几何 + 画面 |
| VK-IA-18 | 滚动视口上/下裁切、focus-next 屏外、字段高于带 | 平移后才判断交集，上/下均可滚；高于可见带显示容量不足 | focused + 画面 |
| VK-IA-19 | 双屏各自 surface 独立几何；未测量、过窄、过矮或按最终宽度撞键 | 各屏独立 W/H、键宽与可见带；unsupported 不显示半截键盘、不跨屏借尺寸；尺寸恢复可重试 | focused + 结构 + 双屏/受控 harness 画面 |

`VK-IA-01/02/09/10` 的 URL 分母逐项为：

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

Shift 字符键因 `maxLength` 零插入不改变待生效态/标签；`space` 成功插入 U+0020 才清 Shift。full 四行高度 laptop 246、mobile 189；360×360 的 mobile full 高度 189 大于 180 的 H/2 上限，属于不受支持容量。其他合成 frame 在 CP-0 按 `min(320,H/2)` 单独重算。键帽宽度按 §2 基准逐控件核验。本 IA 的视觉审阅状态为“随实施结果一并审阅（未批准）”。

## 3. 逐 IA-ID 的不可见观察与失效边界

| IA-ID 集合 | stateAndPermission / navigationAndRefresh（能做的观察） | collectionShapeAndScale / dataSourceAndCascade / forbiddenUI（能做的观察） |
| --- | --- | --- |
| 01–10 | [focused] 当前 `activeFieldId` 且 owner=virtual 才能编辑；切字段/owner 后旧 Shift 清，RN 中间 blur 不清；完整逐键插入/退格/完成观察 | [静态+focused] keyset 是源码固定 Bounded（full 10 数字+26 字母+4 动作；alpha 26+4 动作；numeric 10+2；financial 10+2 符号+2 动作），不做 HTTP 请求；搜索不到 CAPS 键/持久 capsLock/隐形可输入键 |
| 11–13 | [focused+画面] 焦点框未平移坐标、本地 H/K 与内容偏移可回读；字段值不因避让刷新；PIN 以真实六格 Pressable 的测量 ref 取框，而不是卡片/testID 猜位置 | [结构+画面] 不改业务 command/权限；普通内容与每个弹窗内容读同一个每 surface presentation offset，遮罩固定；PIN 的 nativeLess 可见测量句柄由 input field registration 持有，测量丢失不能假绿；搜索不到内容高度减 K、提交按钮独立位移或 PIN 假 ref |
| 14–17 | [focused+逐帧画面] 只有目标字段为编辑 owner，旧键盘只是退出画面；旧会话 Shift 不迁移；新目标取消/resize 从当前几何接续 | [逐帧] K 由两外框实际可见高度取 max；高度不同时 offset 随 K 的归一化进度变化，高度相同时随共享 progress 变化；每帧 `−K≤offsetY≤0`；搜索不到两个并发可输入键盘、动画断层/过冲 |
| 18 | [focused+画面] 视口上/下裁切和屏外 B 均触发滚动；字段高于可见带回容量不足；失败保留草稿/可退出 | [focused] fixed-size viewport 的 surface 实际矩形与 `[0,H−K]` 求交，scroll offset 只算一次；不得把 208 作为通过条件 |
| 19 | [focused+双屏画面] 两个 surface 分别独立读本地测量，切屏不搬迁同一个键盘实例；未测量/容量不足不取得 virtual 死 owner，尺寸恢复可重试 | [focused+结构+画面] 按各 surface 最终实渲染 W、内 padding/gap、键宽/高度边界判断；没有全局宽度、跨屏尺寸泄漏、两侧旧 margin 或已退役 placement 残留 |

局部输入不读 server，故 IA 模板的 typed HTTP problem、Page/Cursor、owner grant、backend acceptance 全部 `N/A_WITH_REASON=本地键盘输入机制，不新增网络业务操作`。失败文案沿现有 `unsupported-size` 语义；新“焦点框无法完整显示，请调整窗口尺寸或退出输入”的具体用户文案由本 IA 冻结，真实渲染须在 input 可见状态呈现，不得只打日志。字段自己产生的校验错误不由键盘翻译。

## 4. 交叉对账与交付状态

| 事实 | 正式需求 | 交互 | 本 IA | 详设必须逐字一致的桥 |
| --- | --- | --- | --- | --- |
| K 与方案 (b) | §2、VK-R06/R07、AC-06 | VK-04 | §1 + IA-15–17 | §1「逐字契约」、逐帧测量/动画 |
| 平移/内部滚动 | VK-R06、AC-05 | VK-01/02 | §1 + IA-18 | 平移后视口交集、上/下裁切、不重复计入 |
| 全宽/容量 | VK-R01/R02/R08 | VK-03 | §1 + IA-01–10/19 | 最终外框 W、实际键宽、真实 padding/gap、可见带替代 208 |
| URL/Shift | VK-R03/R04、AC-03/08 | VK-03 | 本 §2 逐符号表 | 十个 keyId/标签/插入/返回、焦点会话 |

本 IA 是设计稿，不是已运行画面。最低证据档是实施计划的证明路线；针对跨包 presentation context 和 PIN 可见测量接口的 exact API，以详设 §4.5/§4.6 为唯一机制正本；本 IA 只规定上表的可见/不可见结果，不能用低保真图替代签名设计。实施授权来源为 Dexter 在本轮 Claude follow-up 复评后的会话授权，范围限于详设/计划所列实施与单机双屏、mobile 虚拟机动态验证；视觉审阅状态为“随实施结果一并审阅（未批准）”。
