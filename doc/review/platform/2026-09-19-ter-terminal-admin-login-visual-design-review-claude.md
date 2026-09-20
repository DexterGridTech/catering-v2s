# TER terminal admin login 主题化视觉 · DESIGN review

- 评审人:Claude｜日期:2026-09-19
- REVIEW_TARGET=DESIGN(视觉 IA + implementation-facing 详设 + 实施计划)
- 方式:**先回源核"当前事实",再判设计**。§0.2 那张现状表我逐行验过,未采信。

## 0. 结论

```
VERDICT=NO-GO
M/S/N=1/0/2
```

**唯一的 Major 是:照稿执行会删掉一个承重的触摸冒泡守卫,而三份文档全文对它零提及。** 它会破坏本屏最主要的交互(点 PIN 区聚焦),而且结构性 focused test 抓不到。

方案方向(C)是对的,owner 边界清楚,证据分档诚实 —— 详见 §1 与 §2。

⚠️ `INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 是诚实披露,**本评审不关闭该项**;本文也**不得**被解释为 implementation、visual、Web、Android、release 或 acceptance PASS。本轮只读、零写入(本文件除外),未启动 Web、Metro、Android、设备或部署。

⚠️ 按 Dexter 2026-09-19 裁定:**TER 不需要关心无障碍**。本文因此不把无障碍缺口计为 finding。

## 1. 先答"方案合理不合理"(第 9 项)

用户目标是进入 admin console 后**一眼看出六位输入进度、当前焦点与错误态**,同时两个 integration 各自呈现自己的主题。

§1 的三方案比较是真比较,不是走过场:
- **A 在 `AdminLogin.tsx` 写死青色与尺寸** —— 拒绝理由是 shared base 会持有应用身份色,且再生一条绕过 primitives 的控件路径。**成立**:我核过 `ui/base/admin-shell/src` **当前没有任何硬编码颜色**,A 会把干净的边界弄脏。
- **B 每个 integration 各复制一份 AdminLogin** —— 拒绝理由是登录行为、testID、输入焦点与错误态会分叉。**成立**,且与仓内"不复制第二输入/认证 owner"的一贯取向一致。
- **C shared `PrimitivePinInput` + integration 只提供语义 token** —— **采用**。

⇒ **C 确实比 A 与 B 更小也更可维护**:结构与行为共用一处,应用身份色留在 integration,未来第三个 integration 复用 PIN 展示而不必复制 admin console。第 9 项答:**是**。

## 2. 逐项核验结果(我自己回源,不采信文档)

| 评审项 | 结论 | 亲验落点 |
|---|---|---|
| 1. 两个 Android App 与两个 Web 预览各自加载对应 theme | ✅ **是,且对称** | 两个 App **都**同时有 `App.tsx:1` 的 `import '…/theme/global.css'` 与 `metro.config.js:9` 的 `globalCssPath`,各自指向自己的 integration;两个 `test-expo/App.tsx` 各 `import '../theme/global.css'` |
| 2. admin-shell 保持 theme-agnostic | ✅ **当前就没有硬编码色** | `ui/base/admin-shell/src` 全量检索 `#hex`/`cyan`/`rgb(`/`rgba(` **零命中** ⇒ 要求是"防止引入"而非"清理存量",设计定性正确 |
| 3. owner 边界与依赖方向 | ✅ 清楚,无反转 | §0.3 的链路与仓内真实依赖一致;§6.3 明确"不让 admin-shell 依赖 integration、不把 theme 迁到 base" |
| 4. `PrimitivePinInput` 是否够小、无第二 owner | ✅ 够小 | props 仅呈现态;明写不持 state/store/command/认证/keyboard;`value` 超长只按前 `length` 位呈现且"不能把该 primitive 变成第二个校验器" |
| 5. 六格方形 / `*` / focus / error / disabled / 既有 testID | ⚠️ **testID 语义对,但见 M-1** | 现有 cell 为 `${adminTestIds.password}:digit:${index}`(`AdminLogin.tsx:113`),与设计所写完全一致;`aspectRatio: 1` + `flex`/`minWidth: 0` 保方形;**焦点行为见 M-1** |
| 6. 三个 token 由两个 integration 分别提供 | ✅ 契约正确 | 两个 `theme/global.css` **当前都只有** `--color-surface`/`--color-action`/`--color-action-foreground`,三个新 token **均不存在**,须本批各补一份;§2.3 明写同名 var + Tailwind mapping 两边都要有、建议 RGB 不得进入 base、**禁止两包复制同一个固定青色** |
| 7. 是否误改业务背景/已认证页/splash/图标/认证行为 | ✅ 未误改 | §6.3 逐条排除 Android `App.tsx`/Metro/splash/icon、业务 feature/wallpaper/member/topology/已认证 section、登录 backend/算法/store/command,以及 shared virtual keyboard 的布局与弹出位置 |
| 8. IA/详设/计划一致,且声明无实施授权 | ✅ | IA roster 的控件与 testID 与详设 §6.1 分母对得上;计划 `IMPLEMENTATION_AUTHORITY=false`、`IMPLEMENTATION=NOT_AUTHORIZED`;§7 全部目标标 `OPEN / NOT_RUN` 并明写"视觉好看、阴影栅格化、真实字体抗锯齿不由 focused structural test 宣称通过" |
| 9. 是否比固定青色或复制两套更小 | ✅ 是 | 见 §1 |

⚠️ 一处我特意核过的**未踩坑**:IA roster 写 `PrimitiveContainer layout="card" bounded`。`PrimitiveContainer.tsx:8` 的签名确为 `{testID, children, layout = 'fill', bounded = false, style}`,`card` 是合法 layout 值 ⇒ **设计没有混用 layout 取值与 token 名**。

## 3. Major

### M-1 照稿执行会删掉承重的触摸冒泡守卫,三份文档对它零提及

```
严重度=M
状态=CONFIRMED(静态源码 + 文档全文检索可证)
owning source=ui/base/admin-shell/src/components/AdminLogin.tsx:101-108;详设 §2.4、§6.1
需 Dexter 裁决=否(属实现契约补齐)
```

**仓内事实**

1. `AdminLogin.tsx:101-108` 的 `Pressable` 除 `onPress={focusPassword}` 外,还带 **`onTouchEnd={event => event.stopPropagation()}`**。
2. 该守卫是承重的:`ui/base/input/src/components/VirtualKeyboard.tsx:25-32` 定义了 `SurfaceInteractionEvent` 与 **`stopSurfaceDismiss`**,并以 `{onTouchEnd: stopSurfaceDismiss}` 挂在键盘上 —— 其存在本身证明**触摸 surface 会 dismiss 当前 field**,不想被 dismiss 的节点必须阻止冒泡。`InputProvider.tsx:113-114` 亦有 `blurField` / `dismissActiveField`。
3. 详设 §6.1(`:262`)明写 `AdminLogin` 要**"移除手工 `Pressable`/`PrimitiveGrid`/字符 cell,接 `PrimitivePinInput`"**;§2.4(`:149`)说 primitive 的 public root 是**它自己的真实 `Pressable`**。
4. `PrimitivePinInputProps`(`:131-141`)**只有 `onPress`**,**没有 `onTouchEnd`,也没有任何阻止冒泡的入口**。
5. 三份设计稿全文检索 `stopPropagation` / `onTouchEnd` / 冒泡 / dismiss / 收起 —— **零命中**。

**推论**:按设计执行后,`:106` 的守卫被删除而无人接替。

**最小反例(复现方式)**:在 Web 预览或设备上打开 admin login,点 PIN 区。期望:聚焦 field、虚拟键盘保持。实际(照稿实现后):该触摸冒泡到 surface dismiss 路径,**刚被点开的键盘/焦点可能当场被收起**,用户表现为"点了没反应"或"键盘一闪而过"。

**影响面**:破坏的是**本屏唯一的主交互**。而且详设 §0.2 承诺"保留全部输入、focus、layer、认证和 testID 行为",§6.3 承诺"不改 shared virtual keyboard 的…输入焦点机制" —— 本缺口**静默违反它自己的两条不变量**。

⚠️ **结构性 focused test 抓不到**:§7 的红变异表有"六格与 mask""focus/invalid/disabled""单一输入 owner"三行,但**没有一行覆盖"点击后 field 是否仍保持聚焦"**。一个断言六格与 testID 的 render test 会全绿。

**最小修复**:给 `PrimitivePinInputProps` 增加触摸事件透传(如 `onTouchEnd?: (event) => void`),由 `AdminLogin` 继续持有 dismiss 守卫并传入。**为什么不是更小/更大的方案**:让 primitive 自己知道 "surface dismiss" 会使 `ui/base/primitives` 依赖 `ui/base/input` 的语义,**方向反转**;而只在文档补一句"保留 stopPropagation"不够 —— §6.1 已经明写要移除那个 `Pressable`,不给 props 入口就没有落点。同时请在 §7 增一行红变异:**删除该透传后,"点击 PIN 区后 field 仍聚焦"的判据必须变红**;若 focused 层无法证明,须显式降级为设备观察项,不得静默略过。

## 4. Notes

### N-1 "focus 与其 surface/border 有可读差异"缺少可机械判定的口径

§2.3 要求主题 test 验证"token 存在、映射完整、两个 integration 允许不同值,以及 **focus 与其 surface/border 有可读差异**"。前三项都可机械判定,**第四项没有给判据口径**:若实现为"不相等",两个几乎相同的颜色也能通过,该断言形同虚设。

建议给出具体口径(如最小对比度阈值或最小色差),或明确写成"**本项不由 focused test 判定,转设备/人工观察**",二选一。⚠️ 仓内既有取向是"视觉证据只能当辅助不能当通过条件",后者同样可接受,但要写明。

### N-2 独立设计评审仍为 OPEN,本文不关闭

`INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 的披露正确且须保留。**本评审是对该设计的独立外部评审,不是治理条款所指的 fresh independent design review 产物**;NO-GO 也不关闭该项。

## 5. 证据分档结论

- `static` = **已完成**(本文全部结论均为当前源码、组件签名、theme 文件与文档全文检索可证);
- `focused` = **本轮未运行**,设计自陈全部目标 `OPEN / NOT_RUN`,我同意该档位;
- `Web`、`Metro`、`Android`、`device`、`visual/release`、`cleanup` = **本轮不涉及,一律未升格**;
- **L2_USER_VISIBLE**:本批是 UI-bearing 设计。M-1 指向一条**用户可直接感知的交互回归**(点 PIN 区可能收起键盘),其真实表现**未经证明** ⇒ 结论为 **L2_UNVERIFIED**,在 M-1 关闭并补上对应判据前不得记为 `GO_WITH_UNVERIFIED_UI`。

## 6. 授权边界

本轮只做 DESIGN review。未修改源码、测试、依赖、脚本或构建产物;未启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署。**NO-GO 指 M-1 关闭前不宜进入实施**;是否进入实施由 Dexter 裁定。
