# TER terminal admin login 主题化视觉 · DESIGN 复评(第二轮)

- 评审人:Claude｜日期:2026-09-19
- REVIEW_TARGET=DESIGN
- 上轮:`doc/review/platform/2026-09-19-ter-terminal-admin-login-visual-design-review-claude.md`(NO-GO,1/0/2)

## 0. 结论

```
VERDICT=GO
M/S/N=0/1/1
```

**上轮 1M/0S/2N 全部实质闭合**,且实施方在闭合过程中**订正了我自己的一处归因错误**(见 §3 N-1)。

新增 1 条 Significant:`elevated` card recipe 的接入方式在文档内**自相矛盾**,且没有判据保护既有 8 个 `layout="card"` 消费方。⚠️ **该条须在 CP-1(primitives)开工前定死**,但不阻塞整份设计进入 Dexter 的实施决策 —— 故给 GO 而非 NO-GO。

⚠️ `INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 仍为 OPEN,**本评审不关闭该项**。本文**不得**被解释为 implementation、visual、Web、Android、release 或 acceptance PASS;任何此类结论都不得从文档状态推导。本轮只读、零写入(本文件除外),未启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署。

## 1. 上轮 M-1 的闭合(逐条回源)

### 1.1 先确认实施方对我的订正 —— **他们是对的**

我上轮把 surface dismiss 的 owner 归到 `VirtualKeyboard`,并只点了 `onTouchEnd`。回源后:

- 真正的 owner 是 **`ui/base/input/src/components/InputSurfaceFrame.tsx`**:`:76` `dismissFromSurfaceTouchEnd`、`:87` `dismissFromSurfaceClick`,分别挂在 `:94` `onTouchEnd` 与 `:97` `onClick`;
- 两条路径**行为不同**:native 路径在 `:79-84` 先读 `pageX/pageY` 再 `if (shouldDismiss)` 做命中判断;**browser 路径 `:87-88` 无条件 `controller.dismissActiveField()`**;
- ⇒ **browser 侧更脆**:没有坐标保护,阻止冒泡是唯一防线。我上轮只点 native 入口,**是不完整的**。

`VirtualKeyboard.tsx:26-33` 是同一保护模式的**另一个使用者**而非 owner,且它用 `typeof document === 'undefined'` 在两个入口间二选一 ⇒ 我顺带怀疑的"键盘在 browser 侧未设防"**不成立**(已查证,未据猜测下结论)。

### 1.2 修订逐条核过

| 复核项 | 结论 | 亲验落点 |
|---|---|---|
| 1. 事件透传是否保留既有行为 | ✅ | 详设 `:143-144` props 新增 `onTouchEnd?` 与 `onClick?`;`:156-158` 要求 root 透传 owner 守卫、`AdminLogin` **保留现有 `event.stopPropagation()` 语义** |
| 2. native 与 browser 是否都覆盖 | ✅ | `:149-150` 明写 "`onTouchEnd` 用于 native,`onClick` 用于 browser";`:157` 要求**沿用 `VirtualKeyboard` 的事件选择**(即复用既有平台判别,不另造一套) |
| 3. primitive 是否仍只是 presentation | ✅ | `:149-150` "不把 surface-dismiss、input controller 或 `ui.base.input` 语义带进 primitive";`:158` "primitive 不知道该守卫为何存在";事件类型定为结构化的 `stopPropagation(): void`,**不 import RN 或 input 的事件类型**,与 `VirtualKeyboard` 的 `SurfaceInteractionEvent` 同形 ⇒ 依赖方向未反转 |
| 4. 删除透传能否变红 | ✅ | `:222-223` 红变异含"删除 `onTouchEnd`/`onClick` 事件透传";§7 新增判据行:执行体为 "AdminLogin/InputSurfaceFrame focused interaction test;native `onTouchEnd` 与 browser `onClick` **两个入口**",红变异为"删除 PIN root 的事件透传后,点击 PIN 区导致 active field/keyboard 被 surface dismiss" |
| 5. focus 可读差异是否诚实降级 | ✅ | `:126-127` "focus 与其 surface/border 的可读差异属于 visual/Claude review 观察,**不由 focused 结构测试以'token 不相等'冒充证明**,也不在本批冻结统一 RGB、色差或对比度阈值" —— 正是我 N-1 给的两个选项之一,且**点名拒绝了那个空判据** |
| 6. 两个 integration 是否仍各自拥有 token | ✅ | `:119-121` 逐 integration 列值;`:228` 可证伪失败含"任一 integration 缺少 `surface-inset`/`surface-elevated`/`focus` 的 CSS var 或 Tailwind mapping";`:230` 红变异含"**把两个 theme 的 `focus` 强制成同一固定青色**" |
| 7. 范围是否仍只覆盖 admin login | ✅ | `:286-291` 六条排除完整:Android `App.tsx`/Metro/splash/icon、业务 feature/wallpaper/member/topology/已认证 section、theme 不迁 base、无 backend/算法/store/command、**不改 shared virtual keyboard 的布局与输入焦点机制**、不把视觉图伪装成 acceptance 证据 |

⚠️ **⑤ 的档位口径我认可**:`:302` 那行还写了"**若测试环境不能证明真实冒泡则转设备观察并保持 OPEN**" —— 这是诚实的降级路径,而不是用一个跑得过的结构断言充数。

### 1.3 上轮两条 Note

- **N-1(focus 可读差异无口径)—— CLOSED**,见上表第 5 行。
- **N-2(独立设计评审 OPEN)—— 保持 OPEN**,披露正确;本文同样不关闭它。
- 另:`:271` 明写"**不把无障碍作为本批验收维度**",与 Dexter 2026-09-19 的裁定一致。残留的 `accessibilityLabel` prop 与 `accessibilityRole="button"` 只是 RN 组件属性,不构成验收义务,无需处置。

## 2. Significant

### S-1 `elevated` card recipe 的接入方式自相矛盾,且无判据保护既有 8 个 `card` 消费方

```
严重度=S
状态=CONFIRMED(文档内互证 + 仓内消费方计数)
owning source=详设 §2.1(`:92-93`)、§6.1(`:269`)、§7 判据表;IA `:41`/`:57`/`:123`
需 Dexter 裁决=否(属设计口径补齐)
```

**文档事实(三处互相矛盾)**

1. 详设 `:92-93`:"卡片**仍是** `PrimitiveContainer testID="terminal.admin:login:card" layout="card" bounded`;本批给 shared primitive 一个 `elevated` 呈现选择,**用于 card** 的层级、圆角、边框与跨平台 shadow recipe。"
2. 详设 `:269`:改动分母含 `PrimitiveContainer.tsx`、`types.ts`、`theme/tokens.ts`,"增加只表达呈现层级的 elevated card recipe;**不改变默认 card**"。
3. IA `:41`/`:57`/`:123` 三处一致写登录卡为 `PrimitiveContainer layout="card" bounded`,**未出现任何 elevated 属性或新 layout 值**。

**三种读法互斥,文档一种都没定**:

- (a) `elevated` 是**新 prop** ⇒ 登录卡的调用**必须改**(要多传一个属性),与 `:92` 的"仍是 …`layout="card" bounded`"及 IA roster 的写法冲突;
- (b) `elevated` 是**新 layout 值** ⇒ 同样要改调用,同上冲突;
- (c) 就地升级 `card` 的 recipe ⇒ 与 `:269` 的"**不改变默认 card**"直接冲突。

**仓内事实与影响面**:`apps/terminal/ui` 下 production(排除测试)的 `layout="card"` 调用点共 **8 处**。若实施方按 (c) 解读,**这 8 个卡片会一起静默改样式**。

**为什么没有判据兜住**:§7 的十行判据表**没有任何一行**针对 elevated card recipe,也没有一行断言"其余 `card` 消费方渲染不变"。唯一沾边的 `no business background scope drift` 行,红变异是"修改 wallpaper/business parts 或 authenticated shell" —— 而 recipe 改动**不修改那些文件**,该行不会触发。⇒ 按 (c) 走可以全绿交付。

**最小反例**:实施方把 `card` 的 token recipe 直接加上阴影与圆角。登录卡视觉达标,§7 全部判据通过;而 admin 其它 section 与业务里另外 7 个 card 同时变了样子,无人发现。

**最小修复(两句话 + 一行判据)**:

1. 在 §2.1 明确写死接入方式(建议 (a):新增**可选 prop**,由 `AdminLogin` 显式传入),并同步修正 IA `:41`/`:57`/`:123` 三处的 roster 写法,使调用形态与详设一致;
2. §7 增一行判据:**登录卡渲染出 elevated recipe** 且 **其余 `layout="card"` 消费方的渲染输出不变**;红变异为"把 elevated 施加到默认 `card`"。

**为什么不是更大的方案**:不需要新机制,也不需要重新设计 card;只需把已隐含的选择写明,并给那 8 个消费方一条保护判据。⚠️ 此条应在 **CP-1(primitives 与 token recipe)开工前**定死 —— 一旦按 (c) 实现,回退成本远高于现在改两句话。

## 3. Notes

### N-1 我上轮的归因错误已由实施方订正,备案以免误导后来者

我上轮的评审文件已在仓内,其中把 surface dismiss 的 owner 写成 `VirtualKeyboard`,且只点了 `onTouchEnd` 一个入口。**正确事实见本文 §1.1**:owner 是 `InputSurfaceFrame`,且 native/browser 是两条行为不同的路径,browser 侧无坐标保护、更脆。

⇒ 结论(守卫承重、照原稿会被删除)成立,但**机制描述不完整**。实施方在闭合时主动订正并覆盖了两个入口,这比我提的要求更完整。若后续有人引用我上轮那份文件,请以本文 §1.1 为准。

## 4. 证据分档结论

- `static` = **已完成**,本文全部结论均为当前源码、组件签名、消费方计数与文档全文检索可证;
- `focused` = **本轮未运行**;设计自陈全部目标 `OPEN / NOT_RUN`,我同意该档位;
- `Web`、`Metro`、`Android`、`device`、`visual/release`、`cleanup` = **本轮不涉及,一律未升格**;
- **L2_USER_VISIBLE**:本批是 UI-bearing 设计。上轮的 `L2_UNVERIFIED` 成因(surface-dismiss 守卫缺口)已消除,但其真实表现仍未取证,且 §7 已诚实写明"若测试环境不能证明真实冒泡则转设备观察并保持 OPEN" ⇒ 结论仍为 **`L2_UNVERIFIED`**,不得记为 visual PASS;S-1 的卡片视觉同样未取证。

## 5. 授权边界

本轮只做 DESIGN 复评。未修改源码、测试、依赖、脚本或构建产物;未启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署;未开始实施。**GO 只表示设计与计划可交 Dexter 决定是否进入实施**,不表示任何 implementation、visual、Web、Android、release 或 acceptance 结论。S-1 须在 CP-1 开工前关闭。
