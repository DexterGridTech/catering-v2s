# TER 程序虚拟键盘优化实施计划

> STATUS: REVISED_AFTER_CLAUDE_DESIGN_FOLLOWUP；REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=`TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23`；IMPLEMENTATION_AUTHORITY=true（来源：Dexter 在 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-followup-review-claude.md` 后的本轮会话授权）。  
> `SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`。  
> INPUTS: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`、同日 `-ui-interaction-design-codex.md`、`-ia-design-codex.md`、`-implementation-design-codex.md`。  
> DEXTER_WIREFRAME_REVIEW=随实施结果一并审阅（未批准）；DEXTER_HIFI_REVIEW=随实施结果一并审阅（未批准）。
> 本计划按当前授权执行 CP-0 至 CP-4；动态验证仅限单机双屏与 mobile 虚拟机，不启动其它虚拟机或真机。

## 1. 分母与准入

设计 owner 锚点为详设 §3–§8；可见分母为 IA `VK-IA-01..19`，生产消费者静态基线为 9 个 virtual 字段（staff-auth 2，member-form 4，customer-member 1，admin PIN 1，topology IP 1），均为 `surface` placement。CP-0 从当前字节逐项重算 `part/displayModes/surfaceForm/fieldId/layout/placement/滚动宿主`；所有处于可滚动区域的 virtual field 必须处于 `InputScrollArea` 后代。按 N-3 设计移除零生产消费者的 `field` placement，不再建立窄字段 harness。两个 integration 与 sample-terminal/sample-wallpaper-terminal Android app 的可达入口分列，不用 harness 冒充生产。按 Dexter 的 S-3(a)/S-4 裁定，键帽列轨填满最终外框，full 四行且 URL 字符仅在数字行 Shift 层。IMPLEMENTATION_AUTHORITY 来源见本计划头部。

每 CP 写前重开正式需求、IA、命中的项目 memory 原文、详设和 owning source；写后以 focused proof 回读同组原文与源码。主 agent 唯一文件写入/运行/证据收集；fresh 子 agent 只读三维对账。旧需求/IA 与本稿冲突时按正式需求 §8 和 IA 优先级，不以历史绿测试回滚。

## 2. CP-0：冻结真实分母与前置反例

只读重算 9 个 virtual `useInputField` 注册、四布局 keyset、两 integration/Android 入口、LayerStack 遮罩、PIN 真锚点及现有测试 oracle；确认 `field` placement 删除范围。输出 exact 表：9 个生产输入点逐一所在 part/displayModes/surfaceForm/fieldId/layout/placement/是否处于 ScrollView/scroll host；证明所有处于可滚动区域的 virtual 字段均为 `InputScrollArea` 后代。无自然入口组合列受控 harness；19 个 IA frame 逐一标生产可达、受控 harness 可达或 `NOT_COVERED_BY_PRODUCT_CONSUMER`。重算键宽（1280 surface：full/alpha 118、numeric/financial 412；360 surface：30/110）、full 高度 246/189、360×360 的不支持条件以及 `246→190/190→246/246→246` 和 0.5 容差边界过渡几何。对焦点框、viewport、scroll content 与 PIN 分别确认测量 host 和 offset 合成，不能跨 ScrollView 测量。若 9 只是旧快照、源字节改变或需求/IA/详设冲突，先更新分母/设计并独立复核，不带歧义进入代码。保留 first failure 与上一个可信基线。

CP-0 状态：`MATCHED`（fresh read-only three-dimensional source reconciliation；static only），证据见 `doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp0-source-reconciliation-codex.md` §1.5。2026-09-24 fresh independent subagent independently recounted all 9 production fields and confirmed corrected provider ancestry for all 8 scroll-hosted fields, topology exclusions, PIN anchor, and retired placement inventory. No dynamic or device result is implied.

## 3. CP-1：键位、编辑模型、外框/容量

按详设 §3/§4.4/§5 修改 `apps/terminal/ui/base/input/src/foundations/{keyboardLayout,editText,keyboardHeight}.ts`、`components/{VirtualKeyboard,InputKeyboard}.tsx`、必要 state/type、`ui/base/primitives` 的 `keyboardDock`/surface 两处圆角。full 四行、alpha 三行无 CAPS，且 full/alpha 都使用第二行 `Shift a…l`、第三行 `Space z…m` 的动作位置；十项 URL 字符和空格都要以真实编辑 action 证明；Shift 十位字符映射标签和值同源，零插入不消耗。只一套 `VirtualKeyboard`，不复制 laptop/mobile 键盘逻辑。保留 integration 自己的 keyboard semantic 色值与 Android `sharedColors` mapping；主题继承逐项读回，不为全宽改写业务主题。

focused gate：`keyboardLayout.test.ts`、`virtualKeyboard.test.tsx`、`keyboardHeight.test.ts`、`editText` 同族测试逐键/形态/容量；有实际红变异：把 symbol 3 的 payload 改成旧数字、满 maxLength 时清 Shift、恢复 CAPS、把 dock radius 改回17、把 360 full 的计算宽误扣 16，两侧 test 必须红，恢复后同门绿。静态扫旧 `DOCK_MAX_WIDTH`、330、外 margin、`capsLock`、caps action/testID/不可见持久态在目标生产/测试分母无残留；历史 doc/evidence 不删除。若 public 类型/快照仍需 capsLock，必须给出真实编译消费者和设计裁决，不能留 fallback。

CP-1 出口由 fresh 只读子 agent 对需求、IA+详设、项目记忆三维逐项审查；任 OPEN 由主 agent 修复并请新的独立复查，再到 CP-2。

CP-1 状态：`MATCHED`。Focused/typecheck 与五项真实红变异恢复绿均已完成；Godel 初审的 `field` placement 残留 concern 经 fresh 只读 adjudicator Euclid 按 CP 边界复核为 `REJECTED_WITH_EVIDENCE`：移除该 placement 明确属于 CP-2（本节后文），故不阻断 CP-1。残留仍是 CP-2 必须完成的事项，不能视为已关闭；逐项报告见 `doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp1-codex.md`。本状态仅关闭 CP-1，不代表全批或动态验证完成。

## 4. CP-2：覆盖承载、焦点、遮罩与滚动

按详设 §3/§4.1/§4.3/§4.5/§4.6，`InputSurfaceFrame` 内容始终 W×H，键盘绝对叠于底部。唯一测量规则：普通字段与 viewport 相对未平移 surface root 用 `measureLayout`；scroll 子字段相对 scroll content 测量，再合成 viewport root rect 与 `onScroll` readback；PIN anchor 同样暴露相对 root 的 `measureLayout`；读数不扣 presentation offset，可见框只加一次。所有 scroll-hosted virtual field 的 `useInputField` 必须由实际渲染在其 `InputScrollArea` provider 下的 hook-bearing 组件注册；不能以最终 host JSX 视觉嵌套代替 hook 调用的 React 祖先关系。若 CP-0 发现 hook 在父 feature hook/provider 外，应把字段注册与输入呈现移至共享 scroll-content child，保留命令/snapshot owner、字段配置、现有布局次序与可见语义；CP-0 九字段矩阵与中文 README 必须确认此约束，禁止跨 ScrollView 边界或用 `measureInWindow`。预检与测量高度差超过 0.5 逻辑单位或改变容量分类时重预检；`|K_B−K_A|≤0.5` 走等高分支并逐帧检查 `|offset|≤K(t)`。render 新增唯一必要 public API `SurfacePresentationOffsetProvider`/`useSurfacePresentationOffset`，无 provider 时 offset 为 0；`InputSurfaceFrame` 创建 progress 并提供 offset。`SurfaceRootContentFrame` 与 `ConsoleSurfaceInputFrame` 不增加/透传 `presentationProgress`，assembly 只传 content；render 消费 provider 得到的 offset，使普通内容及每个 layer 的实际内容移动而 backdrop/focusable wrapper 固定。键盘呈现状态由 `InputSurfaceFrame` 几何 owner 独立持有，owner 为 none 时 handoff/exit 快照仍挂载到动画完成；measure 阶段已渲染画外以供真实测量，visible 只门控按键分发。滚动若需补足，仅在同一起点调用一次 `scrollTo({y:target, animated:true})`，readback 校验；成功以 0.5 个逻辑单位容差内的完整可见回读为准，中间回读不提前失败，终止由 onMomentumScrollEnd、无动量 onScrollEndDrag 或每请求一次的 1500ms watchdog 给出；不逐帧 JS 滚动，键盘动画完成不强制清除滚动 readback。验证用 viewport root-local y=100、content-local field y=500、scroll offset=80，须得到未平移 surface y=520；presentation=-100 后可见 y=420。另用普通字段 root-local y=400、presentation=-150，两个平台均须保持 measureLayout=400、可见 y=250。测试矩阵覆盖已/未平移×已/未滚动。交接/收起中键盘遮挡区始终吞点按；旧完全退出、目标预检提交后新才接键。验证 render 不 import input、不创建第二 clock、遮罩不露底、按键不冒泡。

PIN exact API：`ui/base/input/src/types/types.ts` 增独立可见测量句柄/`visibleAnchorRef`（不把 nativeLess 当普通 input）；`ui/base/primitives/src/vendor/slots.tsx#RnrPressable` 转发 ref，`PrimitivePinInputProps.measureRef` 透传至真实六格 Pressable，admin-shell 的 `useAdminLogin` 只传 `field.visibleAnchorRef`。同 generation 用 PIN Pressable 相对 frame root 的 `measureLayout` 得 surface-local 未平移框，不扣 presentation offset；无真实滚动范围就给容量不足与退出/改尺寸，保留草稿和 scope。`InputScrollArea` 以 surface-local 视口、content-local 字段和实际 scroll offset 求交，先平移后滚动；上缘/未饱和下缘/屏外 focus-next/字段过高四类分别验；原 `viewportAlreadyShrunk:true` 旧假设不得留作覆盖模型路径。

focused gate：移除唯一 `field` placement fixture/test，并断言 public invariant/README/生产分支无残留；`scrollIntoView.test.ts`、`scrollArea.test.tsx`、`InputSurfaceFrame.measurement.dev.test.tsx` 与 render/LayerStack/PIN 新反例：内容高度减 K、mask 随内容上移、zIndex 掉至 999、render 反向 import input、创建第二 progress clock、owner none 导致 handoff/exit 覆盖提前卸载、上缘裁切不滚、未饱和下缘不滚、scroll clamp 后仍假绿、PIN ref 不转发、测 card 而非 Pressable、对 root-relative `measureLayout` 重扣 offset、PIN 固定坐标、跨屏 W 泄漏均红/恢复绿。input README 增 scroll-hosted field 必须置于 `InputScrollArea` 的规则，并人工以 CP-0 九字段表逐一对照。保留原外点关闭的 focus-scope 差异和真实触控传播测试。随后 fresh 步骤三维对账。

本 CP 还必须以 focused 断言钉住装配单位：`ConsoleSurfaceInputFrame` 在 `SurfaceHostController` canvas 子树内，`SurfaceRootContent` 在 input presentation provider 下消费 offset；宿主尺寸不等于 canvas 时，frame/字段/viewport/K/offset 仍为同一 canvas logical unit，不能出现 input 外置后再手工缩放的分支。完成时键盘动画回调只能把呈现置为 settled；滚动 readback 必须等待可见回读、primitive 终止信号或每请求一次的 1500ms watchdog，三者之一到达后明确成功或恢复失败，不能留下 pending 输入状态。

CP-2 状态：`MATCHED`（fresh read-only three-dimensional reconciliation；static/focused evidence recorded separately）。前一 fresh 复核发现 6 个 feature 字段的 hook 实际在 `InputScrollArea` provider 外，遂重开 CP-0/CP-2；现已将注册组件移到滚动区后代并添加逐字段真实内容节点测量断言，两 feature test/typecheck 与四个 base test/typecheck 均通过。2026-09-24 fresh independent subagent independently confirmed corrected ancestry, exact measurement hosts, stable field configuration/owners, measurement contract, render bridge and package surface；reviewer 未运行测试或动态验证。详见 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp2-codex.md`。

## 5. CP-3：共钟动画与异布局交接

按详设 §4.2 由 `InputSurfaceFrame` presentation state machine 持有唯一 progress，duration 固定 250ms、easing 为 `Easing.inOut(Easing.quad)`。measure/enter/display/handoff/exit 与输入 owner 分离：先画外渲染 incoming 测真实 K，再进入；异布局新先在旧下层升起、旧再下降；收起保留 outgoing 快照至 exit 完成。owner 可变 none，但呈现覆盖不得因此卸载；`keyboardState.visible` 只门控编辑/按键分发。`K(t)=max(v旧,v新)` 由当前实测外框高度与位移得出；`|K_B−K_A|>0.5` 时 offset 按 K 参数化，`≤0.5` 时按共享 progress 线性插值并逐帧 clamp 到 `[-K(t),0]`。滚动目标可在 measure 阶段计算，但必须由 `InputSurfaceFrame` 在真实 K 测量完成、共享动画即将启动时执行唯一 animated `scrollTo`；字段或几何代际变化会取消旧回调；中间 onScroll 只保留 pending，完整可见回读才成功，终止由 onMomentumScrollEnd、无动量 onScrollEndDrag 或每请求一次的 1500ms watchdog 给出，键盘动画完成不强制结算滚动。首开、收起、同布局保持原位、Shift modifier 不重弹、resize、A→B→C、中途关闭分别作有限反例。pending target 用 `blockedFieldId`/`preflightFocusTarget` 保存并复核；只有过渡结束、字段完整可见且仍有效才提交 owner；取消路径逐个验证。

focused gate：逐帧数学采样至少 0、1/4、1/2、3/4、1，并在 K 平台转折处及邻近逐帧密集采样；`246→190`、`190→246`、`246→246` 及 `ΔK=±0.5` 边界分别断言 K 单调/无凹陷、offset 连续/单调、每帧 `−K(t)≤offset≤0`。高低交接均加入 `|offset_A|=K_A` 与 `|offset_B|=K_B` 饱和端点样本，含近等高分支；把新旧层顺序交换、按时间而非 K 插值、owner 变 none 时卸载覆盖、Phase1 提前撤旧、用目标 K 限位、超过容差仍走等高分支、只改终态不改中途任一红。真实动画测试中 owner 在 handoff 与 exit 中途转 none，须仍可见 outgoing/incoming 快照，动作拦截有效，动画结束才卸载；反向变异提前卸载必须首次红，恢复后同门绿。另验证遮罩固定、键盘区吞点、无双输入 owner、滚动中间回读不误失败、终止事件/无事件 watchdog 均能收敛、滚动单次启动。随后 fresh 步骤三维对账。

动画稳定性 focused gate：在同一 presentation serial 内改变 owner/blocked 状态，`progress.setValue(0)` 不得重复；将 layer key 改回 fieldId/index 组合必须首次红，快速 A(l1)→B(l2)→A(l1)→C 序列中每个阶段的 `nativeID` layer identity 必须两两不同且最终只剩一层；模块级 noop 改回 render 内联函数也必须首次红；恢复后同门绿。逐代码对账要把这些项与详设 §4.5.1 绑定。

CP-3 状态：`MATCHED`。证据见 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp3-codex.md`。2026-09-24 fresh read-only reviewer Leibniz（`01a0cf6f-1e0d-79a1-bb5d-523672464d30`）对照正式需求、IA、详设、项目记忆及当前源码/测试逐项复核；结论无 OPEN。其审查只读，未运行测试或动态验证。主 agent 实跑 input package 95 tests 与根 Yarn TypeScript 检查均 PASS。动态/视觉仍未做，须留待 CP-4。

## 6. CP-4：全批对账、测试与双屏/mobile 动态视觉

全部 CP 的代码完成后、整体测试之前，新 fresh 只读审查者对全批需求、IA/详设和项目记忆做**新的**三维对账，不是三张步骤报告的拼接；任 OPEN 修复后重新独立复查。其后 static/typecheck/focused 与所有红变异首次红/恢复绿全部闭合，才准进入动态准入。受管入口启动前核所属 process/resource identity 与预算；任何设备进程/文件读回原语首次用于动态动作前，必须在同一授权设备上先以必然存在的 `system_server` 做非空正向自检，再读取本批获批 Android app 的包名基线。当前 runner 固定清单实际只有两个唯一 app package（`com.anonymous.sampleterminal`、`com.catering.v2s.terminal.samplewallpaper`；历史有重复启动记录，有限的唯一 shape/app 组合为双屏 sample-terminal、双屏 wallpaper、mobile sample-terminal），故 prepare 必须在两台获批 VM 上各先读 system_server，再分别读这两个包名，共六条有序观察；不得臆造第三个包名。正向自检空、命令失败或设备/boot 绑定不符时，在启动 app 前 fail closed；`pidof` 的 exit 1 与目标 `/proc` `cat` 的缺失按 ABSENT 处理，但必须保留对应 stderr 与 exit code 到受管 command evidence，不得用重定向或 `|| true` 吞错。旧 manifest 的错误 `PROCESS_ABSENT` 不得直接改写成当前事实：仅当精确 historical launch intent 指向固定 app/package、VM serial 与 boot ID 仍匹配且该 intent 有 runner 记录的 Activity 启动 breadcrumb 时，才可通过 runner 的显式 `cleanup --run-id <历史run> --recover-invalidated-launches yes` 做只读 ownership recovery；若历史 startup PID 或进程表候选存在，当前完整 PID/startTicks 集还必须与之相符。runner 将恢复结果单独写入 `historicalRemoteLaunchRecoveries`，再进入既有受管 cleanup：只在 host/boot/PID/startTicks 与记录身份相符时 `am force-stop` 固定 app package，并以新的 pidof/stat 读回确认无进程；禁止手工 adb stop、扩大到未登记包名或重写旧 `PROCESS_ABSENT`。历史 `tervk-20260924-064800` 也有一次双屏 sample-terminal 启动记录，但没有 Activity breadcrumb，不具备单独 ownership-recovery 准入；其包名目标只随 `recovery02` 中具有 runner breadcrumb 的同设备双屏 sample-terminal 当前进程一起清理，并用清后 absent readback 关闭当前包级状态，不伪称修复/改写 064800 的历史 `PROCESS_ABSENT`。全部六个历史/当前 run manifest 的启动 intent 分母、cleanup 语义与重复 package 处置逐项记录在 CP-4 evidence §20；未建立 breadcrumb 的 `064800` 不独立恢复。`recovery02` 与 `mobile-diagnostic01` 的历史恢复后，还要用各自 `run-id` 以受管 `cleanup` 关闭新 `recovery03` prepare run 的本地作用域。首败读取落盘日志定位，cleanup 与 business 分报；不得启动 Web viewport resize、Web L2、双机拓扑或授权以外虚拟机。动态前若单机双屏或 mobile 虚拟机未就绪，停在 CP-4 动态准入，列明缺项并通知 Dexter，不用模拟/截图代替。

动态视觉仅使用 Dexter 启动的单机双屏与 mobile 两类虚拟机，不额外启动其它虚拟机；在两台/类实际设备形态与两个获批 integration 的真实生产入口分别核验。总分母固定为 IA `VK-IA-01..19`，双屏 PRIMARY 与 SECONDARY 分开记录；逐 frame 截图/录帧逐控件核对外框左右贴边与直角、键帽尺寸/形状/图标/标签、Shift 状态、十项符号真实插入、普通页/弹窗布局盒与按钮位置、遮罩固定、PIN 焦点框、上下缘滚动、同/异布局与中途遮挡/位移。不能由真实生产入口到达的标 `NOT_COVERED_BY_PRODUCT_CONSUMER`；条件不具备则 OPEN 并写缺项。像素差分只作辅助，不以 testID/截图存在或 focused PASS 冒充视觉 PASS。Web viewport resize/双机拓扑=`NOT_RUN`；按 static、focused、Android/native/device、visual、business、cleanup 分档。运行使用受管入口，首次失败先读已落盘日志/产物，禁止循环截图重试；cleanup 与业务结果分别记录。

### 6.1 TR-16 共享场景顺序（Web 先、设备后）

CP-4 动态验证严格分为两个阶段，使用同一份源码字节与同一份场景清单；vitest/jsdom 不计作 Web。阶段一先在承载生产输入的 `apps/terminal/ui/integration/sample-console` 与 `apps/terminal/ui/integration/sample-wallpaper-console` 的受管 Expo Web 入口逐场景验证并落盘 first failure/last known good；只有该场景在 Web 端完成后，阶段二才可在已授权的单机双屏和 mobile 虚拟机重跑。无法由某 integration 的生产消费者到达的场景标 `NOT_COVERED_BY_PRODUCT_CONSUMER`，不能用 harness 或结构测试冒充 Web PASS；只有双屏两 surface 独立承载这一类形态依赖场景可直接进入设备阶段，但仍须在设备清单中逐场景列出。

共享清单固定为：

| 场景 ID | IA/AC 对应 | Web 阶段 | 设备阶段 |
| --- | --- | --- | --- |
| `VK-WEB-01` | IA-01..10 / AC-01..03 | 两 integration 的 full/alpha/numeric/financial 外框宽度、直角、键帽标签与十项符号插入 | 双屏 PRIMARY、SECONDARY 与 mobile 按可达性逐项重跑 |
| `VK-WEB-02` | IA-11..13 / AC-04 | 普通页、弹窗、PIN 的固定布局盒、遮罩与焦点框 | 双屏两 surface、mobile 按可达性逐项重跑 |
| `VK-WEB-03` | IA-18 / AC-05 | 上缘裁切、未饱和下缘裁切、focus-next 屏外、字段过高/容量失败；滚动中间回读不误失败、终止事件和无事件 watchdog 收敛（S-1） | 同一清单在双屏 PRIMARY、双屏 SECONDARY 与 mobile 重跑；仅 IA-18 属于本共享滚动场景 |
| `VK-WEB-04` | IA-14..17 / AC-06 | 首开、收起、同布局、246→190、190→246、246→246 及 owner none 过渡 | 同一清单在双屏两 surface 与 mobile 重跑 |
| `VK-WEB-05` | IA-14..17 / AC-06 | 快速 A(l1)→B(l2)→A(l1)→C，中途冻结层 key 唯一、无残留键盘（S-2） | 同一清单在双屏与 mobile 重跑；记录可观察的层数/命中与最终 display |
| `VK-DEVICE-19` | IA-19 / AC-05 | 不进入 Web 共享清单；该帧要求单机双屏两块 surface 各自独立承载，属于设备专属几何场景 | 仅在单机双屏 PRIMARY 与 SECONDARY 逐控件观察并分别记录；不得在单屏或 mobile 伪造 |

每个共享场景的交付表必须并列记录 `Web result → device result`、源码字节标识、虚拟机标识/逻辑分辨率、截图或日志路径、business 与 cleanup；`VK-DEVICE-19` 明确记录为无 Web 阶段的设备专属场景。设备阶段不得以 Web PASS 替代画面观察，也不得先跑设备再补 Web。

## 7. 逐代码与详设对账（强制交付门）

在任何实施结果交 Dexter/Claude review 前，对**全部**新增/修改的生产代码、测试、README、index、package exports、terminal-invariants 和必要的 integration/Android 配置（未改亦读回）逐条与详设 §3–§8 对账；不能抽样或仅写“完成对账”。记录格式固定为：`designRef | codePath:line/symbol | evidencePath+result | reviewer | MATCHED/OPEN | difference+next`。旧 oracle 的删除/替换逐行入表；一个设计条目涉及多层时各层一行。特别逐字核 IA/详设的九条契约、十项 URL 符号、presentation 生命周期/owner-none 过渡、PIN 真锚点、遮罩固定和两 integration 的主题继承。README 为人工逐条核对，不能用机器门声称覆盖。任何 OPEN、缺路径、缺 red mutation 或未完成新独立复查只能报实施未就绪，不能交实施后 review。

全批 code reconciliation 之后再由 fresh 独立子 agent 做 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查，逐 finding 绑定详设条目和真实代码/画面；设计未覆盖的问题记 DESIGN_GAP，不由实现自行造产品语义。主 agent 修复并新 fresh 复查直到可交。Dexter 对仓库控制自决，agent 不设这类完成门。

## 8. 交付物、停机与授权边界

交付须有：CP-0 至 CP-4 五门逐项状态、9 字段/19 IA 帧分母、十项 URL 字符键/值逐行证据、所有红变异首次红/恢复绿、CP-0 至 CP-3 步骤对账与全批三维对账、逐代码—详设对账、单机双屏与 mobile 两类虚拟机的动态/视觉证据、`NOT_RUN`/`NOT_COVERED_BY_PRODUCT_CONSUMER` 清单、static/focused/Android/native/device/visual/business/cleanup 分档、任何 OPEN 的 first failure/last known good/broken boundary/下一步。若发现 full 四行无法在关键受支持 frame 内满足触控/高度、无滚动 PIN 不能完整露出、动画单调/逐帧可见无法同时成立，暂停实施并给出精确反例和最小替代由 Dexter 定，不能为过门改判据或业务 UI。

当前 `IMPLEMENTATION_AUTHORITY=true`，来源为本计划头部所列 Dexter 会话授权。CP-0 至 CP-3 为 `MATCHED`；CP-4 的当前动态与证据分档见 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/cp4-recovery-run-summary.md`。runner/test 的最新 hash、`70/70` focused proof、exit-one fail-closed mutation 与步骤收口以该摘要 §16 和 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp4-reconciliation-codex.md` §40 为准；§6/§8/§9/§10/§30/§33/§34/§35/§36/§37/§38/§39 的较早 hash、结论与动态历史保持不可变。§40 明确记录了 repeated fresh reviewer failure 后的 `REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`，不得把它误读为独立子 agent verdict。dynamic26 的精确首败仍 `UNVERIFIED`，不改写历史。dynamic23/25/26/27/28 已分别保留 product、harness、首败、NativeWind、截图/录帧与 cleanup 证据；所有这些 run 最终 `CLEANED/cleanup=PASS`。当前仍不得把 product business、19 帧逐控件 visual 或整体验收升级为 PASS：IA-14 等无生产 consumer 的组合标 `NOT_COVERED_BY_PRODUCT_CONSUMER`，其它未完成人工逐控件/逐帧项标 `OPEN`，并按其 first failure/LKG/broken boundary 交付。动态范围严格限于单机双屏与 mobile；Web viewport resize、双机拓扑、其它虚拟机及真机不在范围。
