# TER Admin console 非登录区实施复盘与 Claude 诊断请求

```text
REVIEW_TARGET=IMPLEMENTATION_DIAGNOSTIC
STATUS=NO-GO_STAGE1_PARTIAL_STAGE2_BLOCKED
DESIGN_REVIEW=NO-GO_M/S/N=0/1/1
IMPLEMENTATION_REVIEW=NOT_YET_PERFORMED
IMPLEMENTATION_AUTHORITY=DEXTER_DIRECT_SESSION_AUTHORIZATION
DYNAMIC_VALIDATION=STAGE1_BUSINESS_PASS_CLEANUP_PASS_FRAME_COVERAGE_OPEN
VISUAL_VALIDATION=STAGE1_16_CAPTURED_3_OPEN;逐控件视觉对账未收口
CLEANUP=STAGE1_PASS;STAGE2_NOT_RUN
ADMISSION_BLOCKERS=DISPLAY_FACTS_OWNER;TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER;MASTER_UNPAIR_GUARD
SOURCE_OF_TRUTH=CURRENT_REPOSITORY_BYTES_AND_APPROVED_REQUIREMENTS_IA_DESIGN_PLAN
CURRENT_FOLLOW_UP=OWNER_FOCUSED_EVIDENCE_PRESENT_BLOCKERS_OPEN;R39_STAGE1_16_CAPTURED_3_PANEL_OPEN;STAGE2_DEVICE_SHAPES_NOT_VISIBLE
```

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

本文件前半记录此前错误实施的复盘与诊断请求，保持其历史 first failure、last known good 和当时的整体 `NO-GO` 结论不改写。后续实施已补齐 owner focused red mutation、30 帧 registry/root marker 绑定与静态对账；最新 r39 已完成第一批拓扑动态旅途，但第一批 19 帧只真实捕获 16 帧，IA-03/05/07 仍 `OPEN`，因此动态、逐控件真实视觉和整批交付仍不能升格为通过。

## 1. 直接结论

这次实施没有按详设真正完成。此前“源码实施主体已经改完”的表述不成立，实际状态是：

- 四处设计文档修订已经完成；
- 部分 owner、数据模型、拓扑、unpair guard、页面投影和 focused test 已完成；
- 高保真 UI 没有按 IA 落地；
- 动态验证在静态四维对账未关闭前提前开始；
- 30 帧没有全部有效跑通，逐控件视觉对账没有完成，cleanup 也没有关闭；
- 当前整体应保持 `NO-GO / 实施未就绪`。

这不是单个 CSS 漏写，而是实施顺序、验收含义、shared primitive 接入和证据措辞同时发生了偏差。

## 2. 实际实施经过

### 2.1 设计侧四处修订

已完成的四处文档修订：

1. 修正 IA frame inventory §5 的 current/non-current surface 字段；
2. 修正 requirements §5.4 的同一处对称字段残留；
3. 修正 design-review-response 中“frame inventory 已统一”的过度表述；
4. 在两份 IA 头部和 implementation plan reconciliation gate 增加 IA 正本优先级声明。

相关正本：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md`
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md`
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md`
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md`
- `doc/review/platform/2026-09-20-ter-admin-console-non-login-design-review-response-codex.md`

这些修订只代表设计文档口径收敛，不代表源码实现完成。

### 2.2 部分 owner 和基础能力实施

实际修改过的代码方向包括：

- display facts 读取模型、surface/current/readiness 事实传播；
- topology page availability、direct pair 和 typed failure；
- master unpair guard；
- runtime assembly/retry；
- admin page projection；
- ports、runtime、topology 三个 section；
- laptop/mobile shell；
- dropdown、ratio bar、disclosure、surface map 等 primitive；
- admin semantic tokens；
- Android 两个 app 的主题和 token 配置；
- 对应 focused tests 和部分 red mutation。

其中 master unpair 有一条真实 readback：

```text
start:
instanceMode=MASTER
displayRole=CHIEF
hasLocator=false
hasPeerIdentity=true
peerReachable=false

persistence-completed:
hasLocator=false
hasPeerIdentity=false
peerReachable=false

completed:
hasLocator=false
hasPeerIdentity=false
peerReachable=false
```

这证明 peerIdentity-only 清理场景可以成功，但不能因此把三条 admission blocker 整体写成 CLOSED。整体 owner reconciliation、独立审查和全范围行为证明仍未完成。

### 2.3 focused/static 测试

此前执行并报告通过的范围包括 runtime、console assembly、sample console、wallpaper、render、display、topology、admin shell、primitives、Android config 和 typecheck；也执行过以下红变异：

- 只清 `masterLocator`；
- 漏清 `peerIdentity`；
- 漏清 `peerReachable`；
- 丢失副屏；
- 删除 sharedColors admin token。

这些测试证明了部分类型、projection、testID、owner contract、token mapping 和失败路径，但没有证明：

- IA 的位置、尺寸、形状、间距；
- primitive 是否真正使用 admin token；
- disclosure 是否按 IA 规定的横向行展示；
- surface map 的比例是否作用于矩形本身；
- 页面是否严格只有三项；
- busy/error 帧是否真实可达；
- 设备上的字体、布局和状态表现是否正确。

因此，测试通过被错误扩大成了“详设实施完成”。

### 2.4 过早启动动态验证

随后启动了 Metro、adb reverse/forward、两台单机单屏 emulator、一台单机双屏 emulator 和一台 mobile emulator，并产生了一批截图、XML 和日志。过程中还出现过一次错误 bundle URL：

```text
Invalid URL port: "8081y1"
```

该错误后来通过清理和重新加载修复。

但是动态验证启动时，静态四维对账尚未全部 MATCHED，违反了计划中“任一 OPEN 先修再对，四维全 MATCHED 才进虚拟机”的硬门。

运行目录中存在 IA-09 到 IA-29 的部分产物，但文件存在不等于 frame 有效通过。例如：

- IA-19 的 busy 状态没有可靠证明；
- IA-29 的截图不是有效的 unpairing busy 证据，后续真实 unpair 也没有完整成功；
- IA-01、03、05、07 等 panel frame 没有完成有效的高保真验证；
- IA-14 的 mobile 多 surface error variant 没有真实证明；
- IA-32 不能用结构测试替代生产运行证据；
- 30 帧没有完成逐控件视觉对账；
- 第一批和第二批没有严格按授权顺序完成。

### 2.5 最新 r39 第一批动态结果（当前有效证据）

```text
RUN=.runtime/ter-dual-machine-topology/2026-09-20/non-login-stage1-r39/sample-terminal
DEVICE=master emulator-5554 + slave emulator-5556
SHAPE=laptop + single physical display on both devices
APK_SHA256=a1643e3c31c295a1f5b58765a004727c2360220183475713c1311e3230f35add
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null (topology journey)
LAST_KNOWN_GOOD=master-unpair-order-and-host-stop
BROKEN_BOUNDARY=null (topology journey); frame coverage boundary remains OPEN
FRAME_CAPTURED=16/19
FRAME_OPEN=IA-03,IA-05,IA-07
```

真实捕获的第一批 frame 是 `IA-01、IA-09、IA-11、IA-13、IA-18、IA-19、IA-20、IA-21、IA-22、IA-23、IA-24、IA-25、IA-26、IA-27、IA-28、IA-29`。三张缺失帧不是“截图文件漏复制”：r39 的 `captureVisiblePanelFrame()` 在 fresh UI hierarchy 中找不到对应 root 时直接返回 `false`，且调用方忽略返回值，所以结果文件没有显式记录这三张 `OPEN`。已在 runner 中改为把该情况写入 `frame-evidence.json`，后续运行不会再静默缩水；该修复目前只有 `node --check` 与 `git diff --check`，尚未以新动态 run 重新证明。

IA-03/05/07 的当前 `OPEN` 原因必须按真实条件表述：

- `IA-03`：release app 的 admin catalog 在本机配置下始终包含可见 section，未产生真实 `selection.sections.length === 0` 的 empty 条件；不能用结构测试或手工删 catalog 冒充设备帧。
- `IA-05`：`createSampleAssembly()` 在 `AndroidTerminalApp` 渲染 surface 前等待 initial runtime start，正常 release 启动未留下可观察的 admin `runtimeStatus=starting` 窗口；r39 只观察到正常 shell，未捕获真实 loading 帧。
- `IA-07`：r39 未产生真实 runtime-start-failed 或 catalog-context failure；不能通过修改判定逻辑或注入错误状态伪造 error 帧。

因此 r39 的 `BUSINESS=PASS` 只表示已执行的拓扑旅途与红变异业务结果通过；它不等于第一批 19 帧完成，也不等于视觉验收通过。

### 2.6 副机 IP 输入时连续退格的根因

副机画面上的退格来自受管 runner 的 `replaceHost()`，不是副机 Admin UI 或 topology actor 在循环删除 IP。当前实现先点击真实 `ui.base.input:virtual-keyboard:backspace` 16 次，清掉最长受支持 host alias 的旧值，再逐字符输入目标值并点击完成。由于 runner 的 `uiActionSettleDelayMs=1500`，每次按键后还要等待一次观察窗口；r39 三次替换分别用于直接配对失败、恢复有效地址和解绑后的重新配对，共记录 `48=3×16` 次退格，因此肉眼看起来像“一直按”。每次序列都有明确终点，r39 随后确实进入了错误配对、成功配对和重连/解绑旅途。

这是测试输入效率/可见性问题，不是产品业务失败；后续如需再次跑配对，可把每次退格的观察等待收窄，但仍必须通过真实 terminal-owned virtual keyboard，不得以 Android IME 文本注入替代。

## 3. 真实 UI 与 IA 的差距

真实设备截图位于：

`.runtime/ter-admin-console-non-login/20260920-device-run/emulator-5554-admin-shell-debug.png`

截图暴露了以下问题：

1. IA 要求居中的 shell card、圆角、边框和阴影，实际是全屏白色 canvas；
2. IA 要求明确的 header、品牌标识、status pill 和 close button 布局，实际仍是通用标题、badge 和 button；
3. IA 要求 laptop navigation 宽度约 248、图标、active focus bar 和 44 高度导航项，实际使用通用 option，宽度约 280，没有图标和 focus bar；
4. IA 明确只有三个页面，实际出现了第四项“示例诊断”；
5. IA 要求 card、compact spacing、status dot 和层级，实际主要是平铺分隔线和大块空白；
6. IA 要求 disclosure 是紧凑横向触发行，实际标签、摘要和箭头发生堆叠；
7. IA 要求 surface map 的宽高比作用于内部矩形，当前代码把 `aspectRatio` 施加在外部卡片上；
8. IA 要求 admin semantic tokens 驱动视觉，当前很多组件仍消费通用 `canvas/surface/border/action` token。

关键源码证据：

- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx` 使用 `layout="fill"` 和通用 `PrimitiveHeading`、`PrimitiveBadge`、`PrimitiveButton`；
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx` 的导航宽度是 280，不是 IA 规定的 248；
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx` 只是渲染通用 `PrimitivePressOption`，没有 IA 要求的图标、focus bar 和 admin navigation recipe；
- `apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts` 会把未知 entry 放进 `pageKey: undefined` 的 pages，导致“示例诊断”进入用户可见导航；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx` 的 disclosure trigger 没有完整布局样式，surface map 的比例也没有隔离到内部矩形；
- `apps/terminal/ui/base/primitives/src/theme/tokens.ts` 主要仍是通用 primitive token，admin token 没有完整接入实际组件。

因此，这不是“截图看起来不一样”，而是源码层面仍然是通用 primitive 拼装，没有完成 IA 要求的 admin-shell visual recipe。

## 4. 主要根因

### 4.1 违反实施顺序

正确顺序应为：

```text
冻结 30 帧控件分母
→ 逐控件做语义/视觉/实现/业务四维对账
→ 所有 OPEN 修完
→ 再进入第一批虚拟机
→ 第一批完成后视觉对账并停机
→ Dexter 更换机器
→ 第二批动态验证
```

实际顺序却是：

```text
部分源码修改
→ focused tests 通过
→ 误认为实现主体完成
→ 启动虚拟机
→ 大量截图
→ 才发现 shell 与 IA 基本不一致
```

收到“迅速完成”的要求后，把速度错误地置于计划硬门之上，是这次最核心的过程失误。

### 4.2 把控件存在当成控件形态正确

静态记录中的 `V=MATCHED` 实际只证明结构、primitive、token 名称、布局方向和字段形态大致存在，没有证明宽度、高度、颜色层级、border、shadow、radius、icon、focus bar、状态点、disclosure 横向排列或 surface map 标注位置。

### 4.3 token 做了配置对称，没有完成渲染接入

sharedColors、CSS、Tailwind、Android theme mapping 和 config test 可以通过，但实际 UI 仍消费通用 token，形成：

```text
token mapping PASS
实际 UI 仍然是 generic primitive
```

这是 configuration green、rendering red 的假绿。

### 4.4 页面 registry 边界没有守住

详设要求 feature part 可以继续内部注册，但不能自动变成用户可见页面。当前 fallback 逻辑追加未知 entry，导致“示例诊断”成为第四个 tab。这是业务边界错误，不只是视觉错误。

### 4.5 没有完成步骤级独立三维复核

没有在每个实施步骤结束后由 fresh 独立 agent 对需求、详设/IA 和 project memory 逐项证伪，也没有在整体测试前完成真正的全量三维对账，因此偏移一直累积到设备截图阶段才暴露。

### 4.6 证据状态和措辞过度乐观

不应把以下表述当作事实：

- “源码实施主体已经改完”；
- “视觉已经对上”；
- “所有 frame 已完成”；
- “动态验证通过”。

当前正确表述应是：部分基础能力和 focused proof 已完成；Admin shell 高保真视觉仍 OPEN；30 帧动态可达性未完成；逐控件视觉对账未完成；cleanup 未关闭；整体 NO-GO。

## 5. 当前结果矩阵

| 范围 | 当前结果 | 说明 |
| --- | --- | --- |
| 四处设计文档修订 | 完成 | 文档口径已修订并回读 |
| display facts owner | 部分实现，未整体关闭 | 有数据链路，但未完成完整 owner/reconciliation proof |
| topology availability/direct pair | 部分实现，未整体关闭 | 有 API/consumer 方向，但未完成完整 owner proof |
| master unpair guard | 有 focused/readback 证据，整体仍不能宣布关闭 | peerIdentity-only 清理路径曾成功 |
| 页面投影和数据语义 | 部分完成 | 端口/runtime/topology 语义链路存在 |
| Admin shell 高保真 | NO-GO | 实际截图与 IA 有结构性差距 |
| 页面数量边界 | FAIL | 出现“示例诊断”第四页 |
| 30 帧动态可达性 | OPEN | 只有部分产物，不能按文件名计 PASS |
| 逐控件视觉对账 | 未完成 | 没有按批次交付 |
| Web/Android/native/device 全量验证 | 未完成 | 不能合并成一个动态 PASS |
| cleanup | OPEN | 运行进程和转发状态未完成正式收口 |
| implementation review | 尚未进行 | 不应把设计 review 结果当 implementation review |

## 6. 后续防再犯措施

1. 建立 30 帧完整控件清单，不能只用 `SHELL-L(IA-x)` 宏；每个控件必须有 IA-ID、用户语义、状态、视觉规格、owning source、数据来源、四维状态、focused proof 和动态截图。
2. 把 visual contract 写入 focused tests，覆盖 shell geometry、header、navigation、mobile selector、card、disclosure、ratio bar、surface map、current/non-current 字段和三页 registry。
3. 先做 IA-01 pilot frame。pilot 任一共享控件不匹配，先修 primitive，不继续拍剩余 frame。
4. 收紧 `V=MATCHED` 含义：必须有源码几何或可重复视觉证据，不得只代表 component 存在。
5. 所有 OPEN 在进入虚拟机前关闭；动态阶段只验证真实状态，不以 testID、XML 节点、截图文件名替代行为证据。
6. 每批动态验证结束后立即做逐控件视觉对账，第一批完成后停机等待第二批机器。
7. 实施完成前必须有 fresh 独立 implementation review，并把 static、focused、Web、Android/native/device、visual、cleanup 分开报告。
8. 增加防假绿门禁：删除 disclosure layout、改变 surface map 比例位置、加入未知导航项、断开 admin token 消费链路时，测试必须变红。

## 7. 可直接交给 Claude 的诊断 brief

```text
Claude，请对仓库根目录当前字节做一次 REVIEW_TARGET=IMPLEMENTATION 的独立、证伪式、只读诊断。本 brief 中所有源码与文档路径均相对仓库根目录。

本次目标不是继续实现，也不是根据作者自述给出认可，而是诊断：为什么本次实现声称“源码主体已完成”，但真实设备画面与已批准 IA 差距很大；请确定第一个错误边界、根因、证据分类错误，以及后续如何建立防再犯门禁。

背景：

1. 本任务是 TER Admin console 非登录区。
2. 设计复评此前为 REVIEW_TARGET=DESIGN、VERDICT=NO-GO、M/S/N=0/1/1。
3. Dexter 授权先修四处文档问题，修完立即进入实施，不再重新进行设计评审。
4. 四处文档问题已经修订：IA frame inventory §5、requirements §5.4、design-review-response 的过度表述、两份 IA 和 implementation plan 的 IA 正本优先级声明。
5. 三条 admission blocker 在实施开始时仍为 OPEN：DISPLAY_FACTS_OWNER、TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER、MASTER_UNPAIR_GUARD。
6. 实际实施中完成了部分 display facts、topology、unpair guard、runtime assembly、admin page projection、ports/runtime/topology section、primitive、theme 和 Android mapping，但没有完成全量三维对账，也没有完成高保真 IA 实施。
7. 动态设备验证在静态四维对账完成前提前开始，产生了部分截图和日志；30 帧没有全部有效跑通，逐控件视觉对账没有完成，cleanup 没有关闭。
8. 当前整体应先按 NO-GO / 实施未就绪处理。请不要把设计复评的 M/S/N=0/1/1 直接当成 implementation verdict，请独立给出新的 M/S/N。

请优先读取：

设计与正本：

- doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md
- doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md
- doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md
- doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md
- doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md

审查和证据：

- doc/review/platform/2026-09-20-ter-admin-console-non-login-implementation-design-review-round2-claude.md
- doc/review/platform/2026-09-20-ter-admin-console-non-login-design-review-response-codex.md
- doc/evidence/platform/2026-09-20-ter-admin-console-non-login-static-control-reconciliation-codex.md
- .runtime/ter-admin-console-non-login/20260920-device-run/

重点源码：

- apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx
- apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx
- apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx
- apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts
- apps/terminal/ui/base/admin-shell/src/sections/PlatformPortsSection.tsx
- apps/terminal/ui/base/admin-shell/src/sections/RuntimeSection.tsx
- apps/terminal/ui/base/admin-shell/src/sections/TopologySection.tsx
- apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx
- apps/terminal/ui/base/primitives/src/components/PrimitiveFeedback.tsx
- apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx
- apps/terminal/ui/base/primitives/src/theme/tokens.ts
- 对应 integration 的 CSS、Tailwind、sharedColors、Android config 和 keyboardThemeConfig.test.ts

请重点核验：

A. 真实高保真 UI 是否实现

不要以 testID、节点存在、文案存在或结构测试通过作为视觉通过条件。逐控件检查 centered shell card、header、品牌标识、status pill、navigation 宽度/icon/focus bar、mobile selector、content/card、disclosure、ratio bar、surface map、current/non-current 字段和 busy/error 形态。

B. 页面边界是否正确

核验 selectAdminPageProjections：用户导航是否严格只有平台端口、运行状态、双机拓扑；feature part 是否仍保留内部注册但不会被追加成第四个用户 tab；pageKey: undefined 的 fallback 是否违反 IA 和详设；实际截图出现“示例诊断”是否属于 confirmed implementation defect。

C. token 是否真的接入渲染链路

区分 sharedColors/CSS/Tailwind/Android token mapping 存在，和 AdminShell/primitives 实际消费 admin token。若只是 config test 通过但 UI 仍使用 generic canvas/surface/border/action，请明确标为 configuration green、rendering red。

D. owner 和 admission blocker

分别判断 DISPLAY_FACTS_OWNER、TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER、MASTER_UNPAIR_GUARD。已有 peerIdentity-only readback 只能证明该清理场景，不得因此把三个 blocker 整体写成 CLOSED。

E. 动态证据分类

核验截图文件存在、XML 有节点、frame 文件名是否被错误当成 PASS；核验 IA-19、IA-29、IA-14、IA-32；核验 30 帧分母、第一批 19 帧、第二批 11 帧、cleanup，以及 plan header 的 DYNAMIC_NOT_STARTED 与实际动态产物是否矛盾。

F. 直接视觉证据

请查看：

.runtime/ter-admin-console-non-login/20260920-device-run/emulator-5554-admin-shell-debug.png

这张实际画面已经显示：没有 centered shell card、出现第四项“示例诊断”、没有 IA 要求的 icon/focus bar、内容是通用平铺分隔线、disclosure 行出现堆叠，视觉层级、spacing、card 形状与 high-fidelity IA 明显不一致。请逐控件对照，不要只给主观“差不多”。

请输出：

1. 独立 verdict：GO 或 NO-GO；
2. 独立 M/S/N；
3. 按 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 分类的 findings；
4. 第一个失败边界、last known good、broken boundary；
5. 哪些 static/focused evidence 属于 false green 或证据层级误用；
6. 哪些问题是 shared primitive/admin-shell 根因，哪些是 page projection/owner 根因；
7. 最小修复路径，以及哪些动态帧必须重新跑；
8. 如何增加机器门或 focused contract，防止 testID 存在但控件形态错误再次通过；
9. 分开报告 static、focused、Web、Android/native/device、visual、cleanup；
10. 不要修改源码，不要把已有截图数量、测试通过数量或 token mapping 通过改写成整体实现通过。

最终请明确回答：之前“源码实施主体已经改完”的说法为什么不成立；本次主要是实现缺口、验收方法缺口，还是两者叠加；下一次如何确保进入任何虚拟机前，30 帧四维控件对账确实全 MATCHED。
```

### 7.1 当前 r39 结果增补 brief

以下增补覆盖旧 brief 之后的当前字节与真实运行结果。Claude 请以当前仓库源码、以下运行目录和正本文档为准，不以旧截图或旧复盘中的动态未启动表述为准：

```text
REVIEW_TARGET=IMPLEMENTATION
EXPECTED_VERDICT=独立给出 GO/NO-GO 与 M/S/N；当前作者预判仍为 NO-GO
REVIEWER=Claude（只读、独立、证伪式）
RUN=.runtime/ter-dual-machine-topology/2026-09-20/non-login-stage1-r39/sample-terminal
APK_SHA256=a1643e3c31c295a1f5b58765a004727c2360220183475713c1311e3230f35add
DEVICES=emulator-5554(master), emulator-5556(slave), both laptop single-screen
BUSINESS=PASS
CLEANUP=PASS
TOPOLOGY_FIRST_FAILURE=null
TOPOLOGY_LAST_KNOWN_GOOD=master-unpair-order-and-host-stop
FRAME_DENOMINATOR=19 for Batch 1
FRAME_CAPTURED=16
FRAME_OPEN=IA-03,IA-05,IA-07
STAGE2=NOT_RUN; current adb inventory only showed emulator-5554 and emulator-5556
```

请重点复核：

1. r39 的真实截图只覆盖 `IA-01、IA-09、IA-11、IA-13、IA-18、IA-19、IA-20、IA-21、IA-22、IA-23、IA-24、IA-25、IA-26、IA-27、IA-28、IA-29`，不能把第一批写成 19/19；IA-03/05/07 的缺失条件写在 `doc/evidence/platform/2026-09-20-ter-admin-console-non-login-static-control-reconciliation-codex.md` §3。
2. 当前 runner 已改成在 frame root 不存在时显式写 `OPEN`，并按 IA-ID upsert evidence；这只是静态 runner 修复，尚未被新动态 run 重新证明。请区分“旧 r39 结果缺行”与“新 runner 代码已修复”。
3. IA-03/05/07 不允许用 testID、focused fixture、结构测试、手工删 catalog 或注入错误状态冒充真实 Android frame。请判断当前 release assembly 是否存在合法可观察的 empty/loading/error 产生条件；不存在时保留 OPEN，并给出最小 owner/fixture/运行条件建议，不要求为了拍图修改生产判定逻辑。
4. 三条 admission blocker 只能分别写为 owner/focused gate 已有 readback/red mutation 证据；不要把它们改写成整体动态 acceptance CLOSED，也不要在 admin-shell 绕过 owner。
5. 副机输入 IP 时的退格是 `tools/terminal-topology/run-dual-device.mjs` 的 `replaceHost()`：每次替换固定 16 次真实 terminal-owned virtual keyboard backspace，r39 三次替换共 48 次；`uiActionSettleDelayMs=1500` 使其看起来持续。它不是产品 actor 的无限循环，但请指出 runner 输入效率问题是否应作为独立 finding。
6. 请把 static、focused、Web、Android/native/device、visual、cleanup 分档；逐控件检查 16 张真实截图与 high-fidelity IA，不以 root testID 或 screenshot file name 作视觉 PASS；确认第二批 dual/mobile 未运行，不把第一批形态外推到 IA-14/15/16/17/32。

请最终输出：独立 verdict、M/S/N、CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE findings、第一失败边界/last known good/broken boundary、最小修复和下一批必须重跑的 frame；并回答“为什么源码实施已完成”的旧表述仍不成立，以及如何在下一轮以 30 帧显式控件分母和全四维 MATCHED 作为进入虚拟机的硬门。
```

## 8. 当前交付状态

```text
文档修订：完成
部分基础实现：完成
部分 focused proof：完成；三条 admission blocker 仍 OPEN，只能附带报告各自已有的 focused owner/readback/red-mutation 证据
第一批动态拓扑旅途：BUSINESS=PASS；CLEANUP=PASS
第一批 frame 捕获：16/19 CAPTURED；IA-03/05/07 OPEN；逐控件视觉判定仍 OPEN
第一批逐控件视觉对账：未完成
第二批动态：未运行；当前 adb 只见 emulator-5554、emulator-5556
高保真 IA 实现：OPEN
30 帧动态验证：OPEN（第一批 16/19，第二批 0/11）
逐控件视觉对账：未完成
cleanup：第一批 PASS；整体未完成
整体实施：NO-GO
```

本记录记录复盘、诊断请求和当前动态证据；它不把第一批业务 PASS 或 runner 的 frame locator 结果扩大成整体完成，也不授权伪造 IA-03/05/07、IA-14、IA-16 或 IA-32。后续实施授权来自 Dexter 的直接会话指令，不来自本记录。
