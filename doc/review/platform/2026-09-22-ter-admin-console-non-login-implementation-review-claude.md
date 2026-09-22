# TER Admin console 非登录区 · IMPLEMENTATION 独立复核（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=1/2/2
EVIDENCE_TIER=STATIC_SOURCE_READBACK + 我独立解码的两张 raw 截图 + 我独立复算的 APK SHA；未运行构建/测试/设备/Metro
SESSION=CONTINUED_SESSION（不继承历史 verdict；全部断言按当前字节重取）
WRITES=仅本文件
```

## L1_ENGINEERING = PASS

我独立回源核过，以下都成立，不是自报：

- **MASTER_UNPAIR_GUARD 是 owner 侧真闭合**。`kernel/base/topology/src/features/actors/actors.ts:457`
  已改为 `if (currentFacts === undefined || !currentFacts.paired)`，用 typed `paired` 而不是
  `masterLocator`；`:475-476` 判 `shouldStopMasterHost`；`:494-496` 在停 host **之前**先发 peer
  unpair notice（注释解释了原因：停 host 会关闭 peer transport）；`:502-512` 经
  `reconcileTopologyHostCommand` 停 host 并校验 `hostActual === 'stopped'` 否则 throw；`:518`
  `clearMasterLocator()`，而 `features/slices/topology.ts:46` 该 reducer 同时清
  `masterLocator`、`peerIdentity`、`peerReachable` 三项；`:520-522` 持久化未完成即 throw；
  `:525-529` readback 三项事实；`:531-539` 失败路径保留 facts 供恢复。这是 owner 修复，
  不是 admin-shell 绕过。
- **两套 Laptop/Mobile production renderer 属实**。`admin-shell/src/components/` 下
  Login、ShellFrame、Shell、SectionContent、SectionNavigation、PanelStateCard、
  PowerRoleConfirmation 以及三个 section 全部成对存在。
- **shared hook 不承载布局 JSX**。五个 hook 全是 `.ts` 扩展名，JSX 标签计数为 0。
- **parts.ts 保持同语义 partKey 的 sibling 注册**。`parts/parts.ts:33-39` 由单一 spec 生成
  `rendererKey: ${partKey}.${surfaceForm}` 与 `surfaceForm: [surfaceForm]`，partKey 语义不变。
- **控件分母终于 materialized**。`foundations/adminFrameRegistry.ts:14-17` 是 IA-01..IA-29 加
  IA-32 的 typed union，无 IA-30/31；每个 `definition(...)` 带真实控件清单；`:471/:496/:504`
  是由 live facts 推导 frame 的 resolver。上一轮那个 `SHELL-L(IA-x)` 宏已经不存在。
- **IA 数字已变成会失败的断言**。`test/adminVisualGeometry.test.ts:13-23` 精确断言 header
  72/60、padding 24/16、nav `width:248 minWidth:248 padding:12`、navList `gap:6`、card
  `borderRadius:16 borderWidth:1 padding:20 minHeight:96`、disclosure `minHeight:52`、ratioBar
  `height:12 borderRadius:6`，`:63` 还断言 disclosure trigger 含 `min-h-[52px] flex-row`
  （正是上一轮堆叠缺陷的判据）。这是我上一轮开的方子，落地正确。
- **端口柱状图真实存在**。`sections/PlatformPortsSectionLaptop.tsx:47-51` 渲染
  `PrimitiveRatioBar` 并传 `segments`；`tokens.ts:61` `adminRatioBar` 为
  `h-3 ... rounded-[6px]`，与 IA 的 高 12/圆角 6 一致。
- **30 帧分母与批次算术自洽**。reconciliation 第 29-31 行：第一批 16/19、第二批 8/11，
  16+8=24 与 `mechanical union 24/30` 一致；19+11=30 未被合并或删减。
- **OPEN 写法合规**。reconciliation 第 66-72 行逐条给了 first failure、last known good、
  broken boundary、最小安全替代，并明确写“这些 OPEN 是实际条件缺失，不是可用但未测试”。
- **APK exact SHA 我独立复算，两个都完全一致**：sample-terminal `88923471` bytes /
  `98b83be6…a2508`；sample-wallpaper-terminal `89329763` bytes / `ed5d6275…90c9`。
- **cleanup 未越界**。只删除本次生成的 build 目录，两套 release APK 与 `output-metadata.json`
  保留，`.runtime` 历史 evidence 未删除。

## L2_USER_VISIBLE = 三条 finding

### M-1 · IA-13 的「逻辑长」在真实画面上不存在，而 fresh vision review 把该行判为 MATCHED · CONFIRMED

**仓内事实**：
- `admin-shell/src/foundations/runtimeDisplay.ts:96` 确实产出
  `logicWidthLabel: \`逻辑长：${logicalSize.width}\``；
- `primitives/src/components/PrimitiveAdmin.tsx:135` 条件渲染它，className 取
  `baseTokens.adminSurfaceMapLogicWidth`；
- `primitives/src/theme/tokens.ts:83` 该 token 为 `absolute top-4 self-center`；同文件 `:75`
  的 wrap 是 `w-full relative px-4 py-4 pb-12`，`py-4` 即 16，因此 `top-4` 恰好落在矩形的上边缘；
  矩形（`:139` 起）是同一相对容器里的后续常规流兄弟，会覆盖该绝对标签。
- **我独立解码了 raw 截图**
  `.runtime/.../stage1-single-screen-all-r66/sample-terminal/master-display-0-frame-IA-13-runtime-single-surface-summary.png`：
  矩形上方只有「物理长：2560」，全图没有任何「逻辑长」。

**与正本的冲突**：high-fidelity IA §5.1 第 6 行要求「当前 surface：矩形内显示逻辑**宽**、高、
就绪/可用」。逻辑宽缺失是 IA 字段缺项，不是抗锯齿或栅格化差异。

**为什么 MATCHED 不成立**：`r66-ia13-visual-review-codex.md` 的逐控件表把「逻辑宽/高」合并为
一行判 MATCHED，而该行观察列只引用了「`逻辑高：800` 位于矩形内右侧」——逻辑宽从未被看过。
IA-13 是本批唯一被宣布视觉 MATCHED 的帧，也是 24/30 里唯一的视觉 close；该结论不成立，
visual 档位应回到全 OPEN。

**同族扫描（SAME_ROOT_SCAN）**：surface map 的四个绝对标签全部检查——
`adminSurfaceMapPhysicalWidth`（`tokens.ts:89`，`top-0`）= 矩形外上方，MATCHED；
`adminSurfaceMapLogicWidth`（`:83`，`top-4`）= 被矩形覆盖，**OPEN**；
`adminSurfaceMapLogicHeight`（`:88`，`-right-4`）= 截图中横跨右边框、部分在框外，与「逻辑标在
框内」不完全符合，**OPEN**；
`adminSurfaceMapPhysicalHeight`（`:90`，`-right-1 bottom-8`）= 渲染在卡片最右缘、与矩形明显
脱离，IA §5.1 第 9 行要求「保留外侧数字锚点、不移动布局」，**PARTIALLY_CONFIRMED**。
四个里只有一个确定正确。

**最小修复**：把 `adminSurfaceMapLogicWidth` 移到不被矩形覆盖的位置（与 inside labels 同层放进
矩形内部最直接），并顺带确定逻辑高应在框内、物理高应贴近框外；然后重跑 IA-13 并重做该帧逐控件
视觉复核。**不需要 Dexter 裁决**——IA 已经写死。

### S-1 · 矩形内多出 IA 未定义的「比例：8:5」· CONFIRMED

`runtimeDisplay.ts:92` 的 insideLabels 是
`[readiness.label, \`可用状态：…\`, \`比例：${ratioLabel}\`]`。而 IA §5.1 第 6 行的矩形内字段
集合只有「逻辑宽、高、就绪/可用」。截图中「比例：8:5」确实显示在矩形内。

这是 IA 字段分母之外新增的用户可见内容。按 high-fidelity §8.1 的语义对账硬规则，应先修 IA 再
实现，不能由实施侧添加。**最小修复**：二选一——从 insideLabels 移除，或在 IA §5.1 正式登记该
字段并说明它替代了什么。**需 Dexter 裁决**：仅当选择保留时（新增用户可见事实）。

### S-2 · IA 要求的 nav 16 圆角，代码没有、几何契约也没断言 · CONFIRMED

IA §3.2 `panel.nav.laptop` 仍写「16 圆角」。而 `tokens.ts:22`
`adminNav: 'w-full min-h-0 bg-admin-shell-surface'` 没有圆角；`adminVisualGeometry.test.ts:15`
只断言 `{width:248, minWidth:248, padding:12, borderRightWidth:1}`，没有 borderRadius，而
`borderRightWidth: 1` 本身就与「16 圆角的卡片」不相容。

对照 `panel.shell` 那一行已被正式改写为「铺满、0 圆角、无外部 shadow」并与几何断言一致，说明
流程是会同步更新 IA 的；nav 这行是漏了。**最小修复**：确定方向后二选一改 IA 或改 token，
并且无论哪个方向，几何契约都必须断言 nav 的圆角值——否则同类漂移不会再被逮住。

## L3_UNVERIFIED

- `IA-03/04/05/06/07/08` 六个 panel empty/loading/error 帧：无真实生命周期输入，OPEN。
  reconciliation 第 68-69 行的 first failure / last known good / broken boundary / 最小替代
  写法准确，判定为**条件缺失**而非实现缺陷，我同意。
- `IA-14 display-facts-error` 变体：mobile owner 事实只有单物理屏，无法产生「事实声称多
  surface」输入，OPEN。同上，判定准确。
- **除 IA-13 外的其余 23 个已可达帧，从未做过逐控件视觉复核**。reconciliation 第 83 行自述
  「其余 30 帧仍未全量 MATCHED」，这一点披露是诚实的；但结合 M-1，唯一做过的那一帧也没做准，
  所以当前不存在任何可依赖的视觉 MATCHED。
- 我本轮只独立解码了两张截图（IA-13 summary 与早期 admin-shell-debug），未逐帧复核 r66/r64/r65
  的全部产物。

## DESIGN_GAPS

- **逐控件视觉复核表的行粒度没有被正本约束**。IA-13 复核把「逻辑宽/高」合并成一行就漏掉了宽。
  这与上一轮 `SHELL-L(IA-x)` 宏是同一失效模式，只是尺度更小。建议在 plan 的 reconciliation
  gate 写死：视觉复核表的行必须逐字取自 IA 的字段行，禁止合并同类项。
- **几何契约的覆盖面没有分母**。`adminVisualGeometry.test.ts` 断言了十余项，但没有任何判据要求
  它覆盖 IA §3.2/§3.3 的全部行——nav 圆角漏断言正是这个缺口的产物。建议补一条「IA 几何表每一行
  至少一条断言」的对账门。

## N-1 · 证据与评审文档含 12 处本机绝对路径 · CONFIRMED

reconciliation 第 41、42、89 行等共 12 处使用
`/Users/dexter/Documents/workspace/idea/catering-v2s/...`。该路径在本机不存在（仓库在别处），
APK 链接打不开。仓内约定是交接与评审文档只用仓库根相对路径。**最小修复**：全部改相对路径。

## N-2 · 四处设计文档修订已落实 · CONFIRMED

frame inventory §5 的 current/non-current 不对称字段、requirements §5.4 的同口径收敛、
design-review-response 对 frame inventory 的准确表述、两份 IA 头部与 plan reconciliation gate
的 IA 正本优先级声明（high-fidelity 第 21 行、第 42 行可见），均已按上一轮结论落实，不再有对称
残留。这一项关闭。

## 结论

`VERDICT=NO-GO`，`M/S/N=1/2/2`。

工程层（L1）这一轮质量很高：三条 admission blocker 里最难的 MASTER unpair 是 owner 侧真修并带
readback；Laptop/Mobile 双套 renderer、无 JSX 的 shared hook、partKey sibling 注册、30 帧 typed
registry、以及把 IA 数字变成会失败断言的几何契约，都是实打实的结构改进，APK SHA 与 cleanup
边界我独立复算也完全对得上。

挡住的是视觉层：**本批唯一被宣布 MATCHED 的视觉帧并没有 MATCHED**——IA §5.1 要求的「逻辑宽」
在真实画面上不存在，原因是它被矩形覆盖，而复核表把「逻辑宽/高」合并成一行只看了高。修掉标签
位置、重跑 IA-13、按 IA 字段行逐行重做该帧复核之后即可重新提交；六个 panel 帧与 IA-14 变体的
OPEN 判定准确，保持 OPEN 即可，不需要为它们做任何事。

本结论只覆盖本批已批准详设、源码实施、owner closeout、r66/r64/r65 动态 evidence、视觉对账与
构建清理；不授予任何新的产品/Journey 范围、登录区以外业务、DEV、Web/UAT、Git、部署、切流或
设备资源授权。
