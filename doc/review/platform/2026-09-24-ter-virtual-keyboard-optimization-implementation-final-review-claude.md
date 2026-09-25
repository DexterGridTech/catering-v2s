# TER 虚拟键盘优化 · 实现终轮复核（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=0/1/2
```

```text
本 verdict 只针对下列当前字节，不沿用此前任何一轮的结论。
reviewedSha256（前 16 位，代码路径相对 apps/terminal/ui/base/）:
  input/src/components/InputScrollArea.tsx              2ff94c5454fa72f8
  input/src/components/InputSurfaceFrame.tsx            fe25e8b9b7b4df51
  input/src/contexts/InputSurfaceGeometryContext.tsx    ef1fc47af3efb9a2
  input/src/foundations/scrollIntoView.ts               28e03e14c8ac9ad0
  primitives/src/components/PrimitiveScrollView.tsx     6f6e451598e27c31
  primitives/src/types/types.ts                         19147cfc2494a9e4
  render/src/components/SurfaceRoot.tsx                 d21351ab0e10c3ba
  console-assembly/src/foundations/consoleAssembly.tsx  05f36a6b14ea2da1
  input/test/scrollArea.test.tsx                        c2a42ae34e868cab
  input/test/provider.test.tsx                          14a55af03c9da46c
  render/test/renderSurface.test.tsx                    7d5aa4488eac5730
  详设 doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md   5450e52bf735bfec
  计划 doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md     b5254cbc81528233
  对账 doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md   04530ea3e21d54af
  设备 run-manifest.json 2a1d673572fe7b2e；events.jsonl b21adc3858056856
    （doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-cp4-final01/）
EVIDENCE_TIER=仅静态：Claude 回读源码、测试、详设、计划、对账文件、设备 manifest 与 events，
  查看了 3 张当前字节的 Web 截图，并在 node_modules 中核了 react-native-web 的 ScrollView 源码；
  未运行任何测试、类型检查、构建、Web、设备或截图
FOCUSED / TYPECHECK / 红变异=作者报告，Claude 未复跑
WEB / ANDROID=按落盘产物核对，见第 1 条 S；VISUAL=OPEN（未做逐控件判定）；BUSINESS=顶层 NOT_RUN，URL 符号为 harness-only
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）；WRITES=仅本文件
AUTHORITY=只做静态复核；不授权改代码或测试、动态运行、设备操作，
  也不把截图存在性、focused、harness 或手工体验升级为视觉或业务验收
```

## 1. 结论

代码侧没有阻断问题：
- 上一轮 S-1（滚动回读）、S-2（重复 key）都已修对，测试正好对上当时写的验收判据；
- 输入框架在画布内。

挡住 GO 的是证据：
- **S-1：** TR-16 的两端证据没有完成，对账文件却写成“TR-16 Web→设备动态运行已完成”；
- 本轮两个修复对应的场景，Web 和设备都没有动态观察。

另有两条 N：
- **N-1：** 画布嵌套的红测试只覆盖了 SurfaceRoot，没有覆盖上一轮真正回退过的 consoleAssembly；
- **N-2：** Android 与 cleanup 的分档有三处失真。

TR-16 是 Dexter 定的硬规则，本功能正是它举的仓内实例，所以默认判 NO-GO。如果 Dexter 决定把 TR-16 缺口作为 OPEN 证据挂账收口，可改判 GO_WITH_OPEN_EVIDENCE（DEXTER_DECISION）；前提是对账文件先改成如实状态。

## 2. 五项核验

### 第 1 项 · S-1 的终止信号、0.5 容差与 watchdog 是否避免提前失败 — 成立

**动画完成不再结算滚动**
- `InputSurfaceFrame.tsx:696-705` 只置 settled，并尝试提交；提交仍要求焦点已就绪；
- 回读登记与强制 settle 的接口已删除（input 源码中已无 `registerScrollReadback`、`settleScrollReadback`）。

**中间回读保持 pending**
- `InputScrollArea.tsx:70`：既不可见、也未到目标、又没有失败原因时，直接返回，不作结论。

**容差一致**
- `scrollIntoView.ts:28`：常量为 0.5；
- 第 63-66 行：可见判定带容差；
- 第 91-95 行：delta 判定用同一容差；
- `InputScrollArea.tsx:69, 236`：“到达目标”也用同一容差。

**终止信号**
- `InputScrollArea.tsx:241-252`：onScrollEndDrag（速度在容差内）和 onMomentumScrollEnd，都先用事件自带的 offset 回读一次，再结算；
- `PrimitiveScrollView.tsx:80-92` 负责归一化。

**watchdog**
- `InputScrollArea.tsx:185-188`：每个请求一个 1500ms 定时器；
- 以下情况都会清掉它：
  - 成功或结论：第 71 行；
  - 新请求：第 108 行；
  - 卸载：第 254-256 行；
  - 这三处都经过 `clearReadback`（第 48-54 行）。
- 结算时先 `cancelScheduledScroll`（第 79 行），不会留下迟到的滚动。

**测试**
- `scrollArea.test.tsx:200-228`：中间 onScroll，动画完成后仍 pending、没有错误提示，到达目标后才提交。这正是上一轮写的验收判据。
- 第 230-255 行：拖动结束；
- 第 257-278 行：用 fake timers 测 watchdog；
- 第 280-302 行：半单位差。

**外部事实**
- react-native-web 0.21.2 的 ScrollView 只把 drag/momentum 回调挂在 responder 处理器上，程序化平滑滚动在 Web 上不会产生这两个事件。Web 的终止只能靠 onScroll 到达目标，或 watchdog。
- Android 程序化平滑滚动是否发 momentum end，UNVERIFIED；即使不发，也有 watchdog 兜底。

**残余风险**：超过 1.5 秒的滚动，会按当时的 offset 判定。这是详设第 103、125 行明确接受的上界，不列 finding。

### 第 2 项 · S-2 的 A→B→A→C 是否始终保持 layer key 唯一 — 成立

**key 的来源**
- 冻结层携带自己的 `layerKey`：`InputSurfaceFrame.tsx:66-71`；采样处在第 157-209 行。
- incoming 被冻结时，key 为 `incoming:${serial}:${fieldId}:${layout}`（第 154-155 行），serial 每次过渡递增（第 277-280 行）。
- 正在渲染的 incoming，key 为 `incoming:${fieldId}:${layout}`（第 763、772、779 行）。它和冻结 key 的段数不同，不会互撞。
- active 只有一层（第 151-152、604、616 行）。

**序列推演**：按 A→B→A→C 逐步推，每个阶段的 key 都两两不同。

**测试**
- `provider.test.tsx:581-633`：每次在交接早期中断，逐步断言 `nativeID`（第 876 行）两两不同，最终只剩一层，且控制台没有重复 key 错误。这正是上一轮写的判据。

**附带观察（不计 finding）**
- incoming 被冻结的那一刻，key 从 `incoming:${fieldId}:${layout}` 变为带 serial 的形式，所以每次中断会重挂一次该层。
- 这与详设第 123 行给出的两种格式一致，但同一句里“保留创建时的 immutable layerKey”这个说法，对 incoming 层并不精确。

### 第 3 项 · N-1 的输入框架是否位于 hosted canvas 子树 — 代码成立，红测试只覆盖一半，见 N-1

- 代码：`consoleAssembly.tsx:757-758` 仍在 `renderContentFrame` 里渲染 `ConsoleSurfaceInputFrame`，文件哈希与上一轮相同；`SurfaceRoot.tsx:114-118` 把它放进 `SurfaceHostController`。
- 恒真断言已删除。

### 第 4 项 · TR-16 是否确实 Web 先于双屏/mobile — 只有登录页全键盘这一个场景成立，见 S-1

**时间顺序**（本机时区 +0900）：
- 最后一次源码修改：20:18:31；apps/terminal 下 20:19 以后没有源码改动；
- 当前字节的 Web 截图：20:27–20:33；
- 设备 run PREPARE：20:33:46（11:33:46Z）；
- 两个 APK 构建完成：11:35:57Z、11:37:52Z。

所以登录页全键盘这一场景 Web 在先，两端是同一份源码字节（按 mtime；对账文件给的源码摘要未复算）。其余场景见 S-1。

### 第 5 项 · Android 首败、恢复、harness-only、生产入口缺口、visual OPEN、cleanup PASS 的分档是否诚实 — 部分诚实，见 N-2

以下与 manifest 一致：
- 首败字段；
- URL 符号标为 `HARNESS_ONLY_NOT_PRODUCT`，`submitted:false`；
- 顶层 business 为 `NOT_RUN`；
- visual 为 OPEN：19 帧中 10 帧 `AWAITING_PER_CONTROL_VISUAL_JUDGMENT`，9 帧 `NOT_OBSERVED`，分母没有缩水。

生产入口缺口、复发失败和 cleanup 三处失真，见 N-2。

## 3. Findings

### S-1 · TR-16 的两端证据没有完成，却被报告为“已完成” · CONFIRMED（证据核对）· DEXTER_DECISION：是否接受把缺口挂作 OPEN 证据收口

**仓内事实：**

1. **当前字节的 Web 记录只有 5 张截图**，在 `web/static-rereview-20260924/`。它们证明不了对账文件 §8 的说法：
   - sample-console laptop `login-url-symbols`：键盘可见，但工号字段在画面外、密码为空，看不到十个符号的插入结果；
   - wallpaper mobile `login-alpha` 与 `login-full` 两张字节完全相同（前 16 位 b4824f4527192d89），都看不到键盘；`login-keyboard-final` 也看不到键盘；
   - wallpaper laptop `login-keyboard` 只露出键盘第一行；
   - 会员表单 alpha/numeric/financial 的 Web 截图和 `web-validation.json` 生成于 19:25（10:25:31Z），早于本轮源码修改（20:09–20:18），不是当前字节；
   - §8 说“member form 的 alpha/numeric/financial 入口均观察到”“十符号结果为 `:/.?&=-_%+`”，当前字节下没有落盘证据（UNVERIFIED）；服务启动输出也没有落盘。
2. **设备端在没有当前字节 Web 记录的场景上先跑了：**
   - VK-IA-11（普通页，属 VK-WEB-02）在双屏和 mobile 各采集多次；
   - member form 的 alpha/financial 异布局切换（属 VK-WEB-04）在两台设备上执行。
   - TR-16 与计划 §6.1 要求，该场景在 Web 端完成后，设备阶段才可重跑。
3. **本轮两个修复对应的场景，两端都没有动态观察：**
   - S-1 对应 VK-WEB-03 / IA-18：Web 标 `NOT_COVERED_BY_PRODUCT_CONSUMER`，设备 `NOT_OBSERVED`；
   - S-2 对应 VK-WEB-05，交接对应 VK-WEB-04 / IA-14..17：两端都没有。
   - 仓内有 8 个生产 `InputScrollArea` 消费者：member-desk 的 MemberForm、MemberList、CustomerMember（两种形态），staff-auth 的 StaffLogin（两种形态），admin-shell 的 TopologySection（两种形态）。
   - 对账文件没有给出逐消费者的可达性推导或尝试记录。“不可达”应标 OPEN（未尝试），不应标 `NOT_COVERED_BY_PRODUCT_CONSUMER`。
4. **没有逐场景对照表**：计划 §6.1 要求的 “Web result → device result” 并列表不存在，全仓只在对账文件里列了场景 ID。
5. **IA-19 归错了组**：计划 §6.1 把 IA-19 归入 VK-WEB-03（滚动），但 IA 文档中 VK-IA-19 是“双屏各自 surface 独立几何”，属于 TR-16 允许直接上设备的双屏专属场景。

**性质：** 问题不在代码。TR-16 这条硬规则没有满足，而对账文件抬头写“TR-16 Web→设备动态运行已完成”，§5 写“动态按以下顺序完成”，都与落盘证据不符。

**first failure / LKG / broken boundary：**
- first failure：Web 阶段只落盘了登录页截图，就进入了设备阶段（PREPARE 11:33:46Z）；
- LKG：登录页全键盘这一场景 Web 在先，且两端同一源码字节；
- broken boundary：Web 阶段的逐场景完成判定，与设备阶段准入之间。

**验收判据：**
- 对账文件的抬头、§5、§8 改为如实状态，逐场景写 Web 结果、设备结果，或 OPEN 及缺项。
- VK-WEB-01 的十符号插入，以及 VK-WEB-02..05，在当前字节下先用生产消费者在 Expo Web 上操作并落盘。截图必须看得到被判定的对象，例如符号所在字段的值、交接中的两层、滚动后的字段；同名不同场景的截图不得字节相同。
- 之后在双屏、mobile 上用同一清单重跑，逐场景并列两端结果。
- 生产消费者确实触发不了的场景，先给出逐消费者的尺寸推导或尝试记录，再标 `NOT_COVERED_BY_PRODUCT_CONSUMER`。
- IA-19 移到设备专属场景。

### N-1 · 画布嵌套的红测试仍未覆盖 consoleAssembly 的回退 · CONFIRMED

- 新增的 `renderSurface.test.tsx:400-426` 用一个 testID 为 `ui.base.input:surface-frame` 的替身 View，验证 SurfaceRoot 会把 `renderContentFrame` 的产出放进画布。作者的红变异改的是 SurfaceRoot 本身（第 395、424 行变红）。
- 上一轮 N-1 点名的回退，是把 `ConsoleSurfaceInputFrame` 从 `consoleAssembly.tsx` 第 757-758 行的 `renderContentFrame` 挪回 SurfaceRoot 外。这个回退至今没有任何测试会红：
  - `console-assembly/test/` 六个文件本轮未改（最后修改在 09-16 至 09-23）；
  - 两个 integration 的 assembly 测试只用画布算坐标和尺寸。
- **验收判据：** 保留新测试；上一轮 S-1 的原样回退（consoleAssembly 把输入框架移到 SurfaceRoot 外）应让某个 focused 用例变红。

### N-2 · Android 与 cleanup 的分档有三处失真 · CONFIRMED

**wallpaper 设备登录**
- 首败（11:39:23Z，双屏，`VK_ANDROID_RESOURCE_NODE_NOT_ACTIONABLE`）的原因是设备已处于登录态，属于前置条件不满足。
- 登录页这个生产消费者是存在的，应标 OPEN（前置条件缺失）并写缺项，而不是 `NOT_COVERED_BY_PRODUCT_CONSUMER`。

**重复登录输入复发未披露**
- 对账文件只写了 mobile 那一次（11:44:41Z 起四次 NOT_ACTIONABLE）。
- 同一问题在双屏上又发生了：11:50:33Z 起四次，11:51:22Z 点掉 notice、退格四次后重新提交才恢复。这一次没有披露。
- 按 events 推断，原因是工号字段留有上次的 `A001`，runner 又输入一遍，推论档。
- 两次失败后，runner 都继续采集了失败态画面：mobile 的 IA-11/04/08/06，双屏的 IA-11/03/07/05。这与计划“首次失败先读落盘产物、禁止循环截图重试”不符。
- frame matrix 的 `lastCaptureAt` 指向恢复后的画面，所以不影响分母，但过程没有披露。

**cleanup 中间失败未披露**
- 时间线：
  1. 11:56:10Z 第一次 cleanup PASS；
  2. 11:56:36Z 第二次调用以 `MANAGED_PROCESS_TREE_TABLE_UNAVAILABLE` 进入 `CLEANUP_FAILED`；
  3. 11:59:54Z 第三次才回到 CLEANED/PASS。
- manifest 的 `cleanupFailures` 为空。
- 对账文件最后写入于 20:57:37（11:57:37Z），当时 run 状态是 `CLEANUP_FAILED`，文件却已写“最终 `status=CLEANED`、`cleanup=PASS`”。
- 最终状态确实是 PASS，但中间失败没有披露，写入时这句话也不成立。

**验收判据：**
- 对账文件补上三项：双屏复发、失败后继续采集、cleanup 中间失败；
- wallpaper 登录改标 OPEN 并写缺项；
- 最终汇总里能看到 cleanup 的中间失败。

## 4. 方案合理性

- **问题对不对：** 本轮只修上一轮的四项并补 TR-16，没有扩大范围，对。
- **S-1 的方案：** 滚动判定与键盘时钟分离，终止事件加一个请求级 watchdog，比非动画滚动更保留详设第 102 行的视觉语义。比起按帧检测“滚动已静止”，它更简单，有明确上界，代价合适。
- **S-2 的方案：** 冻结时把 serial 写进 key，是保住唯一性的最小改动。代价是每次中断时 incoming 重挂一次，中断本身罕见，可以接受。
- **证据的取舍：** TR-16 要的是“先在 Web 上把功能行为做对”。本轮 Web 只看了登录页，而交接、滚动、快速切换这三项正是本功能的核心价值。缺的是方向上的证据，不是细节。

**UI 自问：** NOT_APPLICABLE。本轮没有新增或改动用户操作、控件、文案或 Journey。
- 唯一新增的可感知行为是：滚动未结束时，键盘已升起但暂不可按，最长 1.5 秒。
- 这来自详设明确接受的滚动收敛上界，不是新的交互路径。

## 5. SAME_ROOT_SCAN

- S-1：五组场景的 Web 阶段全部受影响，两个 integration 都有；另有 IA-19 分组错误 1 处。
- N-1：1 处。
- N-2：3 处（wallpaper 标签、双屏复发、cleanup 中间失败）。

## 6. DESIGN_GAPS

- 计划 §6.1 把 IA-19 归入滚动组（见 S-1 第 5 点）。
- 详设第 103 行的“速度在容差内”没有写单位；实现复用 0.5 个逻辑单位的长度容差作速度阈值（`InputScrollArea.tsx:243`）。行为上没有后果，只记 note。
- 详设第 123 行“保留创建时的 immutable layerKey”，与它自己给出的 incoming 冻结格式不完全一致（见第 2 项附带观察）。

## 7. 按评审标准收口

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=代码侧无阻断：S-1 滚动终止信号、0.5 容差与 watchdog，S-2 冻结层 key 唯一，输入框架位于画布内，均核实成立；
  N-1 consoleAssembly 回退仍无红测试。
L2_USER_VISIBLE=本轮两个修复（滚动收敛、快速切换）以及交接、滚动场景，Web 和设备都没有动态观察；visual OPEN。
L3_UNVERIFIED=Android 程序化平滑滚动是否发 momentum end；对账文件的源码摘要；
  §8 中未落盘的 Web 观察；19 帧逐控件视觉；业务提交。
EVIDENCE=S-1 TR-16 两端证据未完成且报告为已完成；N-2 分档三处失真。
SAME_ROOT_SCAN=见 §5
DESIGN_GAPS=见 §6
EVIDENCE_TIER=static=Claude 回读；focused/typecheck/红变异=作者报告，未复跑；Web=落盘截图核对，1 个场景成立；
  Android=manifest/events 核对；visual=OPEN；business=NOT_RUN（harness-only 另记）；cleanup=最终 PASS，中间失败 1 次
DEXTER_DECISION=是否接受把 TR-16 缺口作为 OPEN 证据挂账收口（接受则改判 GO_WITH_OPEN_EVIDENCE，前提是对账文件先改成如实状态）
SESSION=CONTINUED_SESSION，v2s 仓根，不是 fresh acceptance
```

本结论只评审当前字节的静态实现与落盘证据，不授权后续 Roadmap step、动态运行、设备操作或数据操作；也不把截图存在性、focused、harness 或手工体验升级为视觉或业务验收。
