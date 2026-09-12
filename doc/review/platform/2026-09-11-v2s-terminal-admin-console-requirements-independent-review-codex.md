# TER admin console 与 primitives 需求正本独立评审（Codex）

评审日期：2026-09-11  
评审对象：doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md  
上游材料：doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md  
评审范围：只评需求正本；不评详设、实施计划、源码改动或运行结果。

## 0. 结论摘要

### Verdict

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B  
VERDICT=NO-GO  
M/S/N=10/16/4  
L1_ENGINEERING=NO-GO：至少存在一个会改变入口、契约、生命周期、焦点或实施顺序的事实/语义矛盾。  
L2_USER_VISIBLE=NO-GO：Journey、shell 导航、移动形态、文案和失败恢复没有足够的已批准来源，不能证明路径自然且符合 Dexter 已裁定的任务。  
L3_UNVERIFIED=NO-GO：缺少 Android、Web、release/DCE 等动态证据；更重要的是多个需求本身没有可执行 oracle。  
SAME_ROOT_SCAN=完成：对 admin-shell、display-context、ui-state、render、primitives、sample-console、sample-terminal、platform-ports、adapter/android、dev-host、旧 POC 等同根相关路径做过同根搜索和 owning source 重开。  
DESIGN_GAPS=存在：主显示语义、DevicePort async/sync、layer-only catalog 选择、嵌套焦点、debug precedence、移动 IA、数字尺寸、part admission、criteria oracle。  
EVIDENCE_TIER=本轮仅 static；没有本轮 focused、Web、Android、native/device、release 或 UAT 证据。

这里的 10/16/4 是按问题族分组的 M/S/N 数，不是把 53 行判据或 94 条名义条款逐行计成 finding。53 行判据的反例见第 4 节；94 条条款的重新枚举与第 9.2 节审计见第 5 节。

### 需求文档的来历与可信度边界

需求作者说明：文档先由两版 POC 逐行分析形成讨论稿，再经 Dexter 九轮、32 条裁定成文；之后作者自行组织两轮 fresh 子 agent 盲审，五个 agent 合计报告 8M、32S、21N，两轮均 NO-GO；作者逐条处置并两次重写，又自审发现六类问题。这个过程可以作为作者声称已经检查过的清单来源，但不能作为本次评审的独立质量证明：盲审由作者组织，评审者对作者不独立。

本评审重新打开当前仓库字节、owning source、上游讨论稿和旧 POC source。目标文档中的事实表、版本沿革和既有盲审处置均不具有高于当前源码的权威性；上游讨论稿中的 Dexter 裁定也只在对应原文明确支持时作为产品输入，不能替代当前 source evidence。

### 当前恢复、授权与证据状态

- /tmp/ter-handoff-20260910.md 已完整读取。它是 TER 逻辑画布任务的导航 handoff，不是当前源码、授权或本需求评审的事实源；其中的画布运行证据不能升级为 admin console 的视觉验收。
- 当前任务的直接授权只覆盖本次独立评审结果落档和 Claude handoff 话术；没有授权修改需求正本、详设、实施、源码、测试、依赖或启动运行环境。
- Roadmap 的职责是授权记录，不能推断当前任务；本次评审没有使用旧的 implementation 状态字段作为授权。
- 恢复阶段首个失败是 memory route 使用了无效的 domain=terminal，得到 PROJECT_MEMORY=FAIL / unknown or non-specific route；随后改用有效的 admin-ui/platform 路由并完成所需材料读取。这是恢复工具路由问题，不是产品事实。
- 本次评审的 review-level first failure 是 M-01：需求入口把 displayMode 当作主显示门，而上游讨论稿明确把它排除为不可靠标准并决定引入 isHostPrimaryDisplay。该矛盾在任何实现或视觉验收之前就会改变 admin 是否出现。
- 本次评审的 last known good 是：需求正本、上游讨论稿、相关当前 owning source、旧 POC source、项目约束和 evidence 边界均已静态重开；没有启动 Web、Android、DEV、seed、UAT、部署，也没有产生源码或测试改动。

## 1. Findings：M（10）

### M-01：入口主显示判据与上游裁定及当前实现语义冲突

- 状态：REJECTED_WITH_EVIDENCE（针对目标文档当前说法）；需要 Dexter 决策。
- 位置：目标文档 188-200；上游讨论稿 247-275、330-338；apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:5-9、57-61，符号 resolveSurfaceDisplayMode、resolvePowerRoleTarget。
- 仓内事实：当前 displayMode 会把 displayIndex 1 或 VICE+SLAVE 映射为 SECONDARY；power role 还可能在 VICE/CHIEF 之间切换。上游讨论稿的 Q-8 已指出 displayMode 不能区分同机副屏与 VICE/CHIEF，并选择 isHostPrimaryDisplay。
- 失败场景：单显示器上以 SLAVE+VICE 启动，或运行时发生 power role 变化；按目标文档的 displayMode===PRIMARY 门，合法 admin 会消失或被错误放行。
- 影响面：AC-1、D-5、admin root entry、单显示器兼容性以及后续焦点和导航都被错误 gate 绑定。
- 最小修复方向：只保留一个主显示语义 owner；优先重新采用上游已经裁定的 isHostPrimaryDisplay，或由 Dexter 明确重裁 displayMode 的新语义，并同步修订 entry gate、A-2、D-5 和故障日志要求。不要引入第二套显示判定系统。
- Dexter 决策：需要，且在详设前完成。

### M-02：DeviceInfo.deviceId 被要求同步读取，但 DevicePort 是全 Promise 契约

- 状态：CONFIRMED；需要 Dexter 决策。
- 位置：目标文档 300-312，ID-1.1、ID-2.1；apps/terminal/kernel/base/platform-ports/src/types/device.ts:54-60，符号 DevicePort。
- 仓内事实：DeviceInfo.deviceId 槽位是 string，但 DevicePort 的六个方法（包括 getDeviceInfo）都返回 Promise<PortResult<...>>。
- 失败场景：启动认证路径不能同步得到 deviceId。实现只能偷偷使用 stale/default façade、阻塞等待，或未经批准地改动端口契约；三者都与当前需求的“已有 DevicePort、同步可读”不一致。
- 影响面：稳定设备标识、6 位 anti-mistake code、启动组装时机、Web fallback 和端口 owner。
- 最小修复方向：较小方案是在 assembly/startup 阶段一次性 await 现有 getDeviceInfo，再把已解析的 capability/value 传给同步的认证纯函数；只有 Dexter 明确需要同步端口 API 时才改 DevicePort，并列出全部 adapter 和调用方 blast radius。不要复制一个旁路设备 API。
- Dexter 决策：需要。

### M-03：layer-only admin catalog 与 selectAvailableParts 的同一路径要求互相矛盾

- 状态：CONFIRMED；不一定需要产品裁决，但必须补语义。
- 位置：目标文档 220-223、272-273；apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:124-138，符号 selectAvailableParts；apps/terminal/ui/base/render/src/components/LayerStack.tsx:95-110、definePart。
- 仓内事实：selectAvailableParts 以 entry.containerKeys.includes(containerKey) 过滤；当前 layer part 的 containerKeys 是空数组；LayerStack 的 selectLayers 只按 displayMode 选择，忽略 containerKey。
- 失败场景：若 admin layer 继续使用空 containerKeys，它不会被 selectAvailableParts 枚举；若为了显示 admin 另建一份 layer list，就违反“同一 UiCatalog/同一生产 selector/第一生产消费者”的闭环。
- 影响面：AC-0.1、CT-4、A-18、A-20、A-43、catalog owner。
- 最小修复方向：明确 layer entry 的选择维度，例如由显式 layer selector 选择，或定义 canonical admin layer container 语义；仍只保留一个 catalog，不要把 catalog 过滤器复制到 LayerStack 和 admin shell。
- Dexter 决策：若存在两种同样合理的 layer 语义，需要 Dexter 选择；否则由详设补精确定义。

### M-04：全量 part shape 过滤没有真正的强制 owner

- 状态：CONFIRMED。
- 位置：目标文档 176、CT-4（约 451-457）、A-20、A-43；apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts、apps/terminal/kernel/base/ui-state/src/features/resolvePart.ts:71-111、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:166-218；符号 selectAvailableParts、resolvePart、showScreen/openLayer actors。
- 仓内事实：当前 selectAvailableParts 没有 shape 维度；resolvePart 只做 catalog lookup/renderer/props，不比较 dimension；showScreen/openLayer actor 不做 catalog/partKey admission；production 中 selectAvailableParts 当前零调用，definePart 只有 12 处旧业务调用。
- 失败场景：新 admin/layer/direct actor path 绕过 filter；只要 part renderer 能被 resolve，就可以在不匹配的 canvas 上打开。即使把 selectAvailableParts 作为新首个消费者，也不能保护绕过它的路径。
- 影响面：dual-screen 形态、portrait/landscape、所有新 admin part、运行时错误隔离。
- 最小修复方向：指定单一强制 admission owner，并枚举现有和本批新增的全部 production part/caller；为 direct render/show/open 绕过路径增加红 fixture。不要把同一 shape check 散落到每个 actor。
- Dexter 决策：否，除非 Dexter 要改变“所有 part 必须按 declaration admission”的产品语义。

### M-05：需求要求嵌套 focus boundary，但现有 LayerStack 只有 surface 级转场广播

- 状态：CONFIRMED；焦点范围需要 Dexter 决策。
- 位置：目标文档 262-265、A-15（约 493）、实施顺序 606-607；apps/terminal/ui/base/render/src/components/LayerStack.tsx:136-158，符号 notifyFocusBoundary、LayerStack。
- 仓内事实：当前只在层数从 0 变为非 0 时 suspend，在层数回到 0 时 restore。它没有为第二个嵌套 layer 或 layer owner 建立独立 focus scope。
- 失败场景：已有业务 layer 打开时再打开 admin，0→非 0 不发生，admin field 可能未获得焦点所有权；反向也可能业务输入仍可操作。若只补“空栈”广播，A-15 的 nested 要求仍失败。
- 影响面：AC-4.3、A-15、系统键盘退役后的输入交互、backdrop/close 恢复。
- 最小修复方向：定义一个现有 focus system 内的 nested layer ownership/scope，并在该 scope 上验证；把 A-15 proof 放到 admin shell/focus scope 已存在之后。不要添加第二套 keyboard 或 layer registry。
- Dexter 决策：需要明确 nested scope 的用户语义。

### M-06：94 条“已覆盖”不能成立；9.2 把可证伪行为放入不需要判据

- 状态：CONFIRMED。
- 位置：目标文档 538-548 的 9.2 表、各 AC/ID/DBG/IN/PR/CT 条款和 A 表。
- 仓内事实：9.2 表将 descriptor 来源、ID 放置/持久化、Web fallback、debug precedence/可读性、系统键盘迁移、owner placement、canvas callable/layout 等行为性义务登记为“不需要单独判据”。这些义务可以被错误实现而不触发当前 A 行。
- 失败场景：实现者满足所有 A 行的字面形式，却从错误 source 读 descriptor、把 device ID 存在错误层、Web 仍显示可用能力、debug pack-time 和 startup-time 冲突时选错值、只删除文件而保留系统 IME 行为，文档仍可宣称 94/94。
- 影响面：追踪闭环、实现期设计 oracle、独立审查的可证伪性；会把实现问题推迟到无法归因的后验验收。
- 最小修复方向：只把纯 scope/threat boundary 留在 9.2；把数据来源、生命周期、优先级、owner、行为结果、失败恢复和完整 denominator 变成具体 gate/criterion。不要恢复已退役的 compliance-control 台账、manifest 或旧门禁。
- Dexter 决策：不需要产品裁决；具体产品歧义另列为 Dexter decision。

### M-07：360×800 portrait 目标被错误陈述为 Dexter 已裁定

- 状态：DEXTER_DECISION。
- 位置：目标文档 170-172、O-6（约 587）；上游讨论稿 457-465；apps/terminal/ui/integration/sample-console/package.json:11-24。
- 仓内事实：上游只决定 shape 随 canvas declaration，未决定 360×800 这一数字；当前 sample-console 只列 landscape 1280×800/960×540，未发现该 portrait profile。
- 失败场景：详设按未裁定的 360×800 设计布局、scroll 和 A-41，最后真实设备/产品目标并非该尺寸。
- 影响面：形态维度、portrait secondary 禁止规则、移动 shell、截图/设备证据。
- 最小修复方向：记录真实 Dexter 决策及来源，或明确标为 provisional 并指定校准/owner；不要把讨论中的抽象 shape 决定扩写成数字 ruling。
- Dexter 决策：需要。

### M-08：debug source 和 precedence 未定义，却称“已有完整决策”

- 状态：DEXTER_DECISION。
- 位置：目标文档 341-344、11.1。
- 仓内事实：文档要求 pack-time 与 startup-time injection、priority/default off，却没有定义二者冲突时谁胜、startup input 的合法来源、assembly owner 或不可变 read path；11.1 又声称没有待 Dexter 决策项。
- 失败场景：包内 off、启动参数 on，或者包内 on、启动参数 off；两种实现均能声称符合“有 priority”，但有效 debug 状态和 debug password prompt 不同。
- 影响面：DBG-1..DBG-6、生产安全边界、日志脱敏、DCE 证明。
- 最小修复方向：由 Dexter 指定 precedence、默认值、允许的 startup source、assembly owner 和一次解析后的 immutable read path；最小方案是只解析一个 effective value，不引入通用配置框架。
- Dexter 决策：需要。

### M-09：UI 动作没有已批准 Journey/IA provenance，无法判定自然性

- 状态：UNVERIFIED_REQUIRES_EVIDENCE；需要 Dexter 决策。
- 位置：目标文档 AC-3、A-46、USER_VISIBLE_COPY 缺失处；上游讨论稿 427-431。
- 仓内事实：隐藏角手势、密码登录、shell 导航、close/back-to-login、移动端 tab/section 形式在目标文档中被写成要求，但没有 Journey ID、已批准 IA、操作顺序、可见文案或错误恢复 artifact；上游明确把 sidebar/tab rail 和 mobile form 留为开放问题。
- 失败场景：实现一个长按/角落点击/横向 tab + overflow 的路径，字面上满足入口和成员可达，但用户任务需要更短的 section selector 或明确的 back recovery；没有已批准 Journey，不能区分实现偏离还是需求缺口。
- 影响面：L2 user-visible、无障碍、可发现性、错误恢复和形态适配。
- 最小修复方向：补充已接受 Journey/IA 和 USER_VISIBLE_COPY；详细设计不能自行填补这些产品语义。若 Dexter 仍要隐藏入口，至少给出可验证的 gesture target、失败文案、回退路径和移动 IA。
- Dexter 决策：需要。

### M-10：step 1 与 step 2 并不独立，且“只删除 system keyboard”会破坏现有字段

- 状态：CONFIRMED。
- 位置：目标文档 593-595；apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx:30-43、apps/terminal/ui/base/input/src/hooks/useInputField.ts:54-71、154-156、apps/terminal/ui/base/primitives/src/types/types.ts:44-59。
- 仓内事实：当前 MemberForm 仍声明 keyboardKind=system；useInputField 传递 system keyboard 相关行为；PrimitiveInput 的 showSoftInputOnFocus 是可选 prop。step 1 说“只删除”，step 2 又修改 render/input/shape contract，两个步骤实际重叠同一 source graph。
- 失败场景：先删 system contract，现有 MemberForm 仍传入或依赖它，编译/行为破坏；或按“无 dependency，可 parallel”由两个实施者同时改同一字段/consumer。
- 影响面：现有 member desk、PrimitiveInput API、IME 退役、后续 admin input。
- 最小修复方向：把 step 1 改为 atomic contract deletion + 现有字段全部迁移 + focused proof，再进入 shape/consumer 变更；或者明确串行顺序。不要让两个步骤各自拥有同一 contract 的写入权。
- Dexter 决策：否。

## 2. Findings：S（16）

### S-01：switchInstanceMode “production zero dispatcher”字面不成立

- 状态：REJECTED_WITH_EVIDENCE。
- 位置：目标文档 48、F17（约 100）、D-5；apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts:31-37、features/actors/switchInstanceModeActor.ts:15-16、74-83；apps/terminal/kernel/base/runtime/src/createRuntime.ts:322-324、dispatcher 661-664。
- 事实：command/actor 被 production 注册，actor 会 dispatch child setRuntimeInstanceMode，runtime 存在 installPeerDispatchGateway 实现。当前能支持的较窄结论是“无外部生产 caller/peer gateway install”，不是“production zero dispatcher”。
- 失败/影响：把内部 dispatch 当成零 dispatcher，会误导 D-5 的安全边界和同根扫描。
- 最小修复：改成精确的 caller/peer install 断言，分别列 command registration、internal child dispatch、external production caller、peer gateway install。
- Dexter 决策：否。

### S-02：getDeviceInfo “所有平台不可用”只能部分确认

- 状态：PARTIALLY_CONFIRMED。
- 位置：目标文档 315-318、F22；apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts:6-12、apps/terminal/adapter/android/device/src/implementations/androidDevice.ts:53-83、apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts:29-59。
- 事实：当前检查到的 default、Android、Web adapter 对 getDeviceInfo 均未提供可用实现；“所有平台”是未来/完整 adapter universe 的全称判断，静态同根扫描不能证明。
- 最小修复：列出有限的当前 adapter inventory，或将措辞改为“当前已实现且已检查的 adapter”。
- Dexter 决策：否。

### S-03：POC-A 的 device ID 算法被扩写为完整生命周期保证

- 状态：PARTIALLY_CONFIRMED。
- 位置：目标文档 F27、ID-1.3；newPOSv1/3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/device/DeviceManager.kt:218-246。
- 事实：source 支持 SharedPreferences cache、ANDROID_ID 和 SHA-256 截断十字符的算法；source 本身不能证明 clear-data、uninstall/reinstall、平台稳定性和无权限运行时事实。POC manifest 的权限结论还需精确扫描。
- 最小修复：拆分“source algorithm”与“runtime lifecycle/no-permission evidence”，给后者标动态证据。
- Dexter 决策：否，除非产品要改变生命周期语义。

### S-04：POC-B SVG “已运行并渲染”无本轮证据

- 状态：UNVERIFIED_REQUIRES_EVIDENCE。
- 位置：目标文档 F43/§2.6；newPOSv1/package.json:120-122 只能证明依赖声明。
- 失败/影响：依赖存在不等于 Web/Android 两端 SVG 真实渲染，不能作为 PR-6 的运行依据。
- 最小修复：改成“source dependency confirmed”，或补独立的 Web/Android render evidence；本轮不启动运行环境。
- Dexter 决策：否。

### S-05：launcher defaults 没有四个具体值，A-3 只覆盖三个 override

- 状态：CONFIRMED。
- 位置：目标文档 227-231、A-3（约 481）；newPOSv1/2-ui/2.1-base/admin-console/src/foundations/launcherDefaults.ts:1-5、supports/adminLauncherTracker.ts:3-7。
- 事实：目标称四个 defaults，但没有给值、单位、边界或 clock；POC 默认值是 5 presses / 1800ms / 96，tracker 只有三个 override 字段。
- 失败场景：实现使用任意第四默认或不同的三值，单测仍覆盖“存在四项”或只测 override。
- 最小修复：列出四个值、单位、inclusive/exclusive boundary、timestamp clock、override semantics，并对四项分别测试。
- Dexter 决策：否。

### S-06：A-7 password oracle 可被常量/自洽测试通过

- 状态：UNVERIFIED_REQUIRES_EVIDENCE。
- 位置：目标文档 A-7（约 487-488）；DeviceInfo/deviceId 和密码派生相关要求。
- 失败场景：用固定六位码或由实现自身导出的 expected 做比较；当前/±1/nonadjacent hour 都能被错误实现通过。
- 最小修复：提供独立固定 vectors（稳定 ID + 当前、±1、非相邻小时），不记录密码。
- Dexter 决策：否。

### S-07：IME 退役判据只检查文件/字符串，行为与 denominator 不足

- 状态：CONFIRMED。
- 位置：目标文档 A-27、A-28、A-29（约 505-509）。
- 失败场景：rename/inline IME coordinator，或保留 native default 导致系统 IME 仍弹出；“any field”只测一个字段；before/after 用同一个改后函数作为 oracle。
- 最小修复：冻结改前 truth table，枚举全部 InputField，验证 focus/IME 行为和 source path；不需要旧 compliance-control。
- Dexter 决策：否；现有中文姓名场景的产品文案另需 Dexter。

### S-08：primitive、color、icon 判据大多只查存在

- 状态：CONFIRMED。
- 位置：目标文档 A-34、A-35、A-36、A-40（约 513-515）；apps/terminal/ui/base/primitives/src/components/PrimitiveButton.tsx:9-49、global.css:7-13。
- 失败场景：token 字符串彼此不同但所有 tone 映射相同；tone 参数被忽略；只对已列组件取样；用任意非空 SVG rectangle 通过 icon 检查。
- 最小修复：给出组件、token、icon 的完整 denominator，比较 tone 结果、状态和 a11y 语义；icon 规定实际语义 path/label，而不是引入更大 UI 框架。
- Dexter 决策：否。

### S-09：A-37 virtualization bound 没有固定上界和 adversarial dataset

- 状态：CONFIRMED。
- 位置：目标文档 A-37（约 514）。
- 失败场景：实现设置极大 bound，在 ScrollView 中一次性渲染全部行；测试数据小于 bound 且最后一行可见，判据通过。
- 最小修复：固定可审计上界、long fixture、实际 recycle/scroll 证据；不要只查组件名称。
- Dexter 决策：否。

### S-10：A-41/A-42/A-43 没有证明动态 shape caller 和全量 part inventory

- 状态：CONFIRMED。
- 位置：目标文档 A-41..A-43（约 518-523）；catalog/resolvePart/contentActors 当前符号同 M-04。
- 失败场景：类型增加 orientation/form 但 App 永远传 landscape；只更新当前 12 个旧 parts 和一个差异化 fixture，新 admin parts 全部 open；shape source 被忽略。
- 最小修复：枚举所有 production parts/callers，检查 declaration source 到 actor/render 的实际值流，并要求至少一组不匹配 red fixture。
- Dexter 决策：否。

### S-11：A-45 的“consistent”没有 comparator

- 状态：CONFIRMED。
- 位置：目标文档 A-45（约 522）；dependency graph、invariants、exports 相关段落。
- 失败场景：JSON、invariant 和 exports 一致地描述错误 subset、反向边或 cyclic graph；“彼此一致”仍通过。
- 最小修复：规定 exact set equality、edge direction、acyclicity 和实际 export resolution 的独立 comparator。
- Dexter 决策：否。

### S-12：A-46/A-47 的证据层级不能替代 mobile/release 证据

- 状态：UNVERIFIED_REQUIRES_EVIDENCE。
- 位置：目标文档 A-46、A-47（约 524-525）；/tmp/ter-handoff-20260910.md 中的 TER 画布 evidence 仅为另一任务的历史 evidence。
- 事实：focused 或 Web 不能证明 Android/mobile layout；source fixture 不能证明 release bundle DCE；当前没有干净的 admin UI screenshot。
- 最小修复：分行列 static、focused、Web、Android、release/DCE；任何 welcome 文本完整、focused test 或 review GO 都不能升级为完整视觉 PASS。
- Dexter 决策：否。

### S-13：A-48..A-53 的 debug 判据可用 dummy/constant/always-true 实现通过

- 状态：CONFIRMED。
- 位置：目标文档 A-48..A-53（约 524-525 及后续）；DBG-1..DBG-6。
- 失败场景：测试支持目录放一个非 admin reader；远程/业务 mutation 被隐藏在 indirect adapter；diagnostic 是常量；prompt 显示 hardcoded password；state/context 同步但都取错 source；gate 永远 true 但输出 generic reason。
- 最小修复：source inventory、独立 debug vectors、effective password comparator、gate assertion 和 reason/log 的对应关系必须分别可验证。
- Dexter 决策：否；debug precedence 本身见 M-08。

### S-14：A-1..A-6、A-10..A-14 的单场景/存在性 proof 不足

- 状态：CONFIRMED。
- 位置：目标文档 A-1..A-6、A-10..A-14（约 479-493）。
- 失败场景：testID 绑定到永远存在的 inert View 而非真实 gesture；只测一个 dismissible layer；dispatch 全部 reject；onLayout 报假尺寸；Promise 在实际业务 tree unmount/paused 时仍 resolve。
- 最小修复：对真实 interaction、完整 layer/section denominator、实际 event path、实际 layout owner、mount/lifecycle 状态加独立 oracle。
- Dexter 决策：否。

### S-15：版本沿革引用不存在的 A-5a

- 状态：CONFIRMED。
- 位置：目标文档 §0:27 引用 A-5a；当前 §9 判据表没有 A-5a，console root measurement 是 A-13。
- 失败/影响：审阅者无法按文档复现处置链，容易把历史条目误当当前 gate。
- 最小修复：改为当前编号，或保留历史编号时明确映射。
- Dexter 决策：否。

### S-16：mobile shell/navigation 是产品决定，不应由详设自行补齐

- 状态：DEXTER_DECISION。
- 位置：目标文档 AC-3、A-46；上游讨论稿 427-431。
- 事实：目标只要求同一成员集合和 scroll reachability，没有决定 sidebar/tab rail、compact selector、顺序、文案和 back behavior；在 360×800 这类形态，compact selector 可能比横向 tab + scroll 更短，但这只是产品推论。
- 失败场景：实现合法地做出长横向 tab，用户仍需额外滚动；或实现 selector，作者却认为违反“same members”。
- 最小修复：由 Dexter 选定 mobile IA/Journey；需求列出 source、顺序、visible copy、focus/back/recovery，不把选择下放给实现。
- Dexter 决策：需要。

## 3. Findings：N（4）

### N-01：§2.6 “do not inherit”是规范判断，不是仓内事实

- 状态：PARTIALLY_CONFIRMED。
- 位置：目标文档 §2.6；旧 POC source：_old_/2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx:1-21、27-39、355-374；newPOSv1/2-ui/2.1-base/admin-console/src/supports/adminSectionRegistry.tsx:17-112。
- POC 的“有/无”观察可由 source 支持；“因此本轮不继承”是产品/设计判断，需要按 Dexter 裁定表达，不应写成事实表结论。
- 最小修复：分栏写 source observation 与 normative decision。
- Dexter 决策：仅当要改变继承范围时需要。

### N-02：D-1/D-2 标为 static inference 是正确方向，但不能当 runtime proof

- 状态：PARTIALLY_CONFIRMED。
- 位置：目标文档 D-1、D-2 及 evidence tier 定义。
- 文档已经把它们标作静态推论，问题在后续叙述偶尔把静态推论当成“可直接验收”的行为。应保持 static hypothesis，直到获得对应 focused/Android/Web evidence。
- 最小修复：统一证据标签；不要因为 gate 已有 static 条目就报动态 PASS。
- Dexter 决策：否。

### N-03：TER handoff 的历史画布证据不能支持本需求的 admin UI visual PASS

- 状态：UNVERIFIED_REQUIRES_EVIDENCE。
- 位置：目标文档的证据引用处；/tmp/ter-handoff-20260910.md。
- 事实：handoff 中的 Android/Web 证据针对 logical canvas alignment；截图带 persistence/port overlay，且没有 admin shell 的 clean visual evidence。
- 最小修复：在本需求下另建对应平台 evidence rows；本轮不补运行。
- Dexter 决策：否。

### N-04：PR-7 exclusion 可能合理，但需要按前三个真实 admin section 反查

- 状态：DEXTER_DECISION。
- 位置：目标文档 PR-7、§2.5；apps/terminal/ui/base/primitives 当前组件集。
- 事实：POC 非使用可以支持暂不继承，但如果首批三个 section 实际需要被排除的组件，当前 exclusion 会变成范围缺口。
- 最小修复：要求 section→primitive/token/icon consumer matrix；若确实无消费者，保持 exclusion；若有消费者，由 Dexter 选择纳入或改需求。
- Dexter 决策：需要确认一次。

## 4. 当前仓内事实逐条复核（F1-F47）

以下结论来自当前 source 的静态重开，不采信目标文档事实表的结论表述。除特别标注外，确认范围是 static，不是 runtime。

### 4.1 admin shell、layer、canvas（F1-F8）

| 编号 | 复核结论 | owning source |
|---|---|---|
| F1 | CONFIRMED static：admin-shell 只有约 13 行空壳和六个依赖，当前 skeleton 没有 display-context/input 业务接线。 | apps/terminal/ui/base/admin-shell/src/dependencies.ts；apps/terminal/skeleton-graph.ts:94-105 |
| F2 | CONFIRMED static：存在 LayerTier、LayerGuard、Pressable/backdrop dismissible 机制。 | apps/terminal/ui/base/render/src/components/LayerStack.tsx |
| F3 | CONFIRMED static：layer/backdrop 为 absolute fill，inner 使用居中与 padding 24。 | apps/terminal/ui/base/render/src/components/LayerStack.tsx:29-56 |
| F4 | CONFIRMED static：focus suspend 仅发生于层数 0→非 0，restore 发生于非 0→0。 | apps/terminal/ui/base/render/src/components/LayerStack.tsx:136-158；同文件 focus controller |
| F5 | CONFIRMED static：layer part 的 containerKeys 为空；LayerStack 的 selectLayers 按 displayMode 而非 containerKey 选 layer。 | apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts 中 definePart；apps/terminal/ui/base/render/src/components/LayerStack.tsx:107-110 |
| F6 | CONFIRMED static：ScreenContainer 无 containerKey prop；SurfaceContext 有 containerKey；provider 只装配一次，assembly 是 main owner。 | apps/terminal/ui/base/render/src/components/ScreenContainer.tsx；SurfaceRoot；assembly |
| F7 | CONFIRMED static：layer 在 canvas transform 内部。 | apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:61-73；SurfaceHostController |
| F8 | CONFIRMED static：content 持久化，layer 不持久化，content sync 与 layer 结构隔离。 | apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:217-222、270-287 |

### 4.2 catalog、shape、display、adapter（F9-F21）

| 编号 | 复核结论 | owning source |
|---|---|---|
| F9 | CONFIRMED static：UiCatalogEntry 有 8 个字段，当前过滤维度为 3 个，未含 shape。 | apps/terminal/kernel/base/ui-state/src/types；foundations/catalog.ts |
| F10 | CONFIRMED static：同根 production source 对 selectAvailableParts 为零调用；这不等于未来首个 consumer 已经能保护所有路径。 | apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts；同根 rg |
| F11 | CONFIRMED static：resolvePart 只做 catalog lookup、renderer、props 解析，不做 dimension compare。 | apps/terminal/kernel/base/ui-state/src/features/resolvePart.ts:71-111 |
| F12 | CONFIRMED static：showScreen/openLayer actors 没有 catalog/partKey admission。 | apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:166-218 |
| F13 | CONFIRMED static：当前 production definePart 正好 12 处，来自 staff auth 3 与 member desk 9。 | 同根 rg definePart |
| F14 | CONFIRMED static：assertEntryKeys 检查精确 approved own keys，assertClosedArray 检查非空。 | apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:61-94 |
| F15 | CONFIRMED static：SurfaceContext 只有 displayMode/containerKey；UiCatalogContext 没有 shape。 | apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts:4-7；apps/terminal/kernel/base/ui-state/src/types/catalog.ts:24-28 |
| F16 | CONFIRMED static：getSwitchInstanceModeEligibility 仅在 displayCount===1 时放行 SLAVE。 | apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:38-55 |
| F17 | REJECTED_WITH_EVIDENCE（按字面）：switchInstanceMode command/actor 已注册，actor 有 child dispatch；没有外部 production caller/peer gateway install 的较窄说法成立。 | apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts:31-37；features/actors/switchInstanceModeActor.ts:15-16、74-83；apps/terminal/kernel/base/runtime/src/createRuntime.ts:322-324、dispatcher:661-664 |
| F18 | CONFIRMED static：orientation-grouped canvas parser 拒绝 portrait SECONDARY。 | apps/terminal/kernel/base/display-context/src/foundations/terminalSurfaces.ts:42-50 |
| F19 | CONFIRMED static：sample-console package 只声明 landscape profile，未见 portrait profile。 | apps/terminal/ui/integration/sample-console/package.json:11-24 |
| F20 | CONFIRMED static：sample-terminal App 当前只使用 displayIndex。 | apps/terminal/assembly/android/sample-terminal/App.tsx:7、16 |
| F21 | CONFIRMED static：Android adapter 现有五个 package 为 app-control、device、dual-screen、logger、persist-kv。 | apps/terminal/adapter/android 目录 inventory |

### 4.3 device identity（F22-F27）

| 编号 | 复核结论 | owning source |
|---|---|---|
| F22 | PARTIALLY_CONFIRMED：当前 default、Android、Web adapter 的 getDeviceInfo 都不可用；“所有平台”全称未被有限 inventory 证明。 | apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts:6-12；apps/terminal/adapter/android/device/src/implementations/androidDevice.ts:53-83；apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts:29-59 |
| F23 | CONFIRMED static：DeviceInfo.deviceId 槽位存在且为 string。 | apps/terminal/kernel/base/platform-ports/src/types/device.ts:4-11 |
| F24 | CONFIRMED static：DevicePort 六个方法全部 Promise。 | apps/terminal/kernel/base/platform-ports/src/types/device.ts:54-60 |
| F25 | CONFIRMED static：check-static 预期 getDeviceInfo unavailable。 | tools/terminal-readability/check-static.mjs:66-79 |
| F26 | CONFIRMED static：createNodeId 每次启动使用 random/time，不是设备身份。 | apps/terminal/kernel/base/runtime/src/foundations/runtimeId.ts:38-55 |
| F27 | PARTIALLY_CONFIRMED：旧 POC source 支持 SharedPreferences + ANDROID_ID + SHA-256/10 字符算法/cache；clear-data、重装稳定性、无权限 runtime 仍未由 source 证明。 | newPOSv1/3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/device/DeviceManager.kt:218-246 |

### 4.4 system keyboard / input（F28-F34）

| 编号 | 复核结论 | owning source |
|---|---|---|
| F28 | CONFIRMED static：applyKeyboardKey 接受 maxLength，max 插入空值也会经过该路径。 | apps/terminal/ui/base/input/src/foundations/editText.ts:45-85 |
| F29 | CONFIRMED static：四种 virtual layout 为 full、financial、numeric、alpha，没有 Chinese layout。 | apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts:1 |
| F30 | CONFIRMED static：当前全仓 system field 只有 MemberForm name。 | apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx:35；同根 rg |
| F31 | CONFIRMED static：virtual keyboard visible 条件为 owner virtual 且 activeFieldId 非空且 surfaceMetrics.visible。 | apps/terminal/ui/base/input/src/components/InputProvider.tsx:177-180 |
| F32 | CONFIRMED static：InputFieldRegistration.inputRef 必填且 focus 时使用。 | apps/terminal/ui/base/input/src/hooks/useInputField.ts:54-65；types |
| F33 | CONFIRMED static：useInputField 总是显式传 showSoftInputOnFocus；PrimitiveInputProps 的该 prop 可选。 | apps/terminal/ui/base/input/src/hooks/useInputField.ts:154-157；apps/terminal/ui/base/primitives/src/types/types.ts:44-59 |
| F34 | CONFIRMED（窄范围 static）：dual-screen Kotlin 的两处行为 gate 只在 imeVisible=true 时改变 stable reuse/snapshot publication；不能扩写为“所有 IME 字段都无影响”。 | apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt:141、263 |

### 4.5 primitives、styles、POC（F35-F47）

| 编号 | 复核结论 | owning source |
|---|---|---|
| F35 | CONFIRMED static：有九个 primitive component；vendor 包装五个 RN component。 | apps/terminal/ui/base/primitives 目录；vendor/slots.tsx |
| F36 | CONFIRMED static：global.css 有七个颜色 token，未见 semantic status colors。 | apps/terminal/ui/integration/sample-console/theme/global.css:7-13 |
| F37 | CONFIRMED static：PrimitiveButton 有三个 variant；两个键盘相关；无 tone/busy，仍有 inline style。 | apps/terminal/ui/base/primitives/src/components/PrimitiveButton.tsx:9-49 |
| F38 | CONFIRMED static：两个 feature controls.tsx 字节相同；DialogSurface/EmptyState 为 composite，DialogActions/ScrollArea 为 alias。 | apps/terminal/ui/feature/*/components/controls.tsx；primitives composites |
| F39 | CONFIRMED static：这四个 symbol 合计 10 个 business refs，DialogActions 6、ScrollArea 4。 | 同根 rg DialogActions、ScrollArea、DialogSurface、EmptyState |
| F40 | CONFIRMED static：当前 15 个 business component files 无 react-native import；分母是当前文件集合，不是未来全集。 | 同根 rg |
| F41 | CONFIRMED static：primitives RN imports 共 3 个，其中 2 个是 type-only 且在 vendor 外。 | 同根 rg |
| F42 | CONFIRMED static：PrimitiveInput 有一个 typeof document 的 RNW branch。 | apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx:63 |
| F43 | CONFIRMED static only：当前没有 SVG/icon dependency；NativeWind optional react-native-svg 也未安装。POC-B 真实运行渲染未证实。 | apps/terminal/ui/base/primitives/package.json、依赖 inventory；newPOSv1/package.json:120-122 |
| F44 | CONFIRMED static：POC-A 没有 registration；有七个 literal element/ternary、两个 empty hooks、hardcoded password 123。 | _old_/2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx:1-21、27-39、355-374 |
| F45 | CONFIRMED static：POC-B 是 replace-only module singleton，默认九 section，约 3709 行，tab union closed。 | newPOSv1/2-ui/2.1-base/admin-console/src/supports/adminSectionRegistry.tsx:17-112 及相关 types/count |
| F46 | CONFIRMED static：POC-B screenMode 被消费，但没有 writer 把它设成 MOBILE。 | newPOSv1 等价 source；同根 rg |
| F47 | PARTIALLY_CONFIRMED：POC observations 可证实；“do not inherit”是本需求的规范判断，不是 source fact。 | 目标文档 §2.6 与 F44-F46 source |

## 5. 53 条判据的恶意但合规反例

本节按目标文档的字面判据构造“明显违背需求意图、仍能通过该行”的实现。它不是实施建议，也不是说当前实现已经如此；它证明判据的 oracle 或 denominator 不足。以下反例会归并到第 1、2 节的 M/S findings，不额外增加 M/S/N 计数。

| 判据 | 恶意但合规的通过实现 |
|---|---|
| A-1 | 把真实 tracker 挂在永远存在但不参与手势的 View 上，再放一个条件 testID；树存在而真实入口不可用。 |
| A-2 | 只用 MASTER fixture 测 displayMode；单显示 VICE+SLAVE 或 power 变化时真实 entry 消失。 |
| A-3 | 测试 fixture 写四个 defaults，但 runtime 使用另一组值；只覆盖三个 override。 |
| A-4 | helper 做了坐标转换，真实 gesture 仍把 page 坐标直接传给 actor；focused test 直接调用 helper。 |
| A-5 | 单个 dismissible layer 正常，多个/决定性 layer 场景关闭和焦点恢复错误。 |
| A-6 | native input/state 字符串能变，但 key handler 更新了未显示的 buffer，真实显示滞后。 |
| A-7 | 使用固定六位码；测试 expected 从实现导出，没有独立 ID/hour vectors。 |
| A-8 | result object/log marker 存在但都映射到同一错误文案，diagnostic 是 dummy。 |
| A-9 | 用 String.fromCharCode 或 native logger 动态构造 password，绕过直接变量流扫描。 |
| A-10 | 只有 full remount 才 reset；另一条 close/reentry 路径复用 module auth。 |
| A-11 | 直接 members 正好五个，但 section 容器内藏一个未登记 widget。 |
| A-12 | 拒绝所有 section dispatch；导航虽不越界，但有效 close/read action 也坏。 |
| A-13 | onLayout 报目标尺寸，实际 root flex/transform 另有尺寸；external close handler 是 no-op。 |
| A-14 | 保留一个 dummy Promise 让测试 resolve，同时实际 business tree 已 unmount/paused。 |
| A-15 | business input 没有真实 ref，admin key handler 直接改 state；值通过但 focus ownership 错。或只修空 layer 栈，不修 nested layer。 |
| A-16 | 只持久化 unselected section；被测 selected section 通过。 |
| A-17 | 用 dynamic import/re-export 字符串绕过 ui/feature literal scan。 |
| A-18 | 只有被测试的 section 访问 catalog，其他 section hardcode。 |
| A-19 | registration immutable，但 render 忽略 order/owner；只检查 registration 存在。 |
| A-20 | 只过滤 mobile section；新 admin/all 其他 parts 绕过 filter。 |
| A-21 | hardcode 三个 fixture readout 值；kernel facts 变化时 UI 仍旧值。 |
| A-22 | 一个 unavailable injection 改变一行，其余五个方法仍 hardcode/wrong。 |
| A-23 | render tree 没有写 command，但 adapter callback/effect 暗中 dispatch store write。 |
| A-24 | reboot/clear-data 稳定，但 uninstall/reinstall 改 ID；判据未覆盖重装。 |
| A-25 | synchronous stale/default façade 先返回 string，真实 async 值后来才到。 |
| A-26 | 只拒绝一个 123456，其他可用 ID 仍接受；没有完整 available-ID oracle。 |
| A-27 | rename/inline IME coordinator，行为保留；file absence 通过。 |
| A-28 | 改后函数同时充当 before/after oracle，没有冻结基线。 |
| A-29 | public prop 删除，但 vendor spread 或 native default 仍显示 IME；只测一个 field。 |
| A-30 | 选择 0 或极大阈值；需求没有 exact threshold，仍可通过。 |
| A-31 | 在 admin-shell/helper 另写一套 keyboard，换名称即可绕过 import scan。 |
| A-32 | vendor export FlatList/ActivityIndicator/SVG，但实际 List 使用 ScrollView；只查 export。 |
| A-33 | README 放四个空 boilerplate heading；存在性通过，纪律不成立。 |
| A-34 | 十二个不同 token 字符串都映射同一 tone。 |
| A-35 | 不使用 literal/whitelist class，但 tone 被忽略且所有 class 样式相同。 |
| A-36 | 从测试 denominator 中删掉新 interactive component；已知清单通过。 |
| A-37 | bound 设很大，所有行在 ScrollView 中渲染；小 dataset 下最后一行可见。 |
| A-38 | 删除 alias，但以新名字写等价 inline wrapper；旧引用扫描通过。 |
| A-39 | component 没有直接 global read，vendor helper/context 暗中注入 host measurement。 |
| A-40 | 非空 SVG rectangle 在两端渲染；没有语义 path/label，也没有 overlay。 |
| A-41 | groups 能解析，但所有 part 同时声明两种 shape；shape source 被忽略。 |
| A-42 | 类型增加 orientation/form，App 始终传固定 landscape。 |
| A-43 | 只更新旧 12 parts 和一个差异化测试 part，新 admin parts 全部 all-open。 |
| A-44 | MASTER assertion 放在 dead/unreachable helper，active gate 没有它。 |
| A-45 | JSON/invariant/export 一致描述错误 subset、反向边或 cyclic graph；consistent 无 comparator。 |
| A-46 | mobile horizontal overflow 包在 scroll 中，成员都可达但体验明显不合意；无 Android evidence。 |
| A-47 | source fixture 模拟 PROD/non-dev，但 release bundle DCE 掉 flag；无 release launch。 |
| A-48 | 测试支持目录有 dummy non-admin reader，合法 runtime consumer 不存在。 |
| A-49 | 没有 UI/persistence write path，但 indirect adapter 可改变 remote/business state。 |
| A-50 | startup diagnostic 永远记录常量 debug value，不是 effective runtime state。 |
| A-51 | prompt 显示 hardcoded 123456；没有日志且存在 prompt，但有效密码错误。 |
| A-52 | 一个错误 default 同时喂给 state/context；两者相等所以通过。 |
| A-53 | gate 永远 true，遇到 non-MASTER 仍输出 generic diagnostic；没有显式 assertion/reason。 |

结论：A 行目前多处验证“有节点/有字符串/有导出/有一次通过”，没有验证“正确来源、正确值流、完整集合、错误分支、真实用户行为和独立 oracle”。作者声称已经修过一轮 anti-green 问题，但上述反例仍可构造，因此该声称不能直接接受。

## 6. 94 条条款覆盖重新枚举与 9.2 审计

### 6.1 重新枚举结果

目标文档没有给出可机械复算的唯一 denominator。按条款语义重新规范化，可以得到同样的 94，但其中 IN-2、PR-3 等必须拆成多个独立义务；因此“94/94”最多说明 label index 对齐，不说明 substantive closure。

| 家族 | 重新枚举 | 小计 |
|---|---|---:|
| AC | AC-0(3)+AC-1(6)+AC-2(7)+AC-3(4)+AC-4(5)+AC-5(6)+AC-6(6) | 37 |
| ID | ID-1(4)+ID-2(5) | 9 |
| DBG | DBG-1(3)+DBG-2(2)+DBG-3(2)+DBG-4(3)+DBG-5(1)+DBG-6(4) | 15 |
| IN | IN-1(3)+IN-2（delete scope、geometry invariant、frozen truth-table comparison 三项）+IN-3(2)+IN-4(1) | 9 |
| PR | PR-1(3)+PR-2(2)+PR-3（list、per-component state/a11y 两项）+PR-4(4)+PR-5(1)+PR-6(3)+PR-7(2) | 17 |
| CT | CT-1、CT-3、CT-4、CT-5、CT-6、CT-7、CT-8 | 7 |
| **总计** | 37+9+15+9+17+7 | **94** |

该总数是本评审的规范化复算，不是对目标文档已有机械 denominator 的确认。目标文档 §3 还包含 13 项未充分编号的 section-level obligations：§3.1 八项、§3.2 两项、§3.3 三项。它们与 A/9.2 有重复、分散或错配，不能靠 94 个 label 自动吸收。

### 6.2 §9.2 “不需要判据”逐项复核

目标文档 §9.2 的 22 个条目是：

AC-0.1、AC-6.5、AC-6.6、ID-1.1、ID-1.2、ID-1.3、ID-2.2、ID-2.5、IN-1.1、IN-1.2、PR-4.1、PR-6.1、PR-6.3、§3.1.3、§3.1.8、§3.3、AC-2.1、DBG-1.1、DBG-1.2、DBG-4.1、DBG-6.3、§3.1.7。

逐项判断：

- 可以不另设 runtime criterion 的只有 AC-6.6（明确 scope exclusion）；AC-2.1 属于 threat-model/product boundary，但应显式保留为 Dexter decision，不能把它说成 security proof。
- AC-0.1 不是纯范围：layer vs screen 的真实 selector/placement 可以错误，A-13/A-16 不足以证明。
- AC-6.5 需要验证 descriptor 的 source、非 DEV 行为和 read-only semantics。
- ID-1.1、ID-1.2、ID-1.3 包含 port owner、算法、无权限、生命周期/稳定性，不是单纯背景。
- ID-2.2 涉及 device ID placement、state、persistence，属于设计验收义务。
- ID-2.5 涉及 Web unavailable fallback，必须有 Web/static contract proof。
- IN-1.1、IN-1.2 需要完整 field inventory 和 migration behavior。
- PR-4.1 的 classification 没有列出完整 component set。
- PR-6.1、PR-6.3 涉及 dependency compatibility、icon scope 和跨端 render。
- §3.1.3 已被 A-41 指向，不能同时宣称不需要判据。
- §3.1.7 文档自身声称由 A-20/A-43 覆盖，却又列入 no-criterion，形成内部矛盾。
- §3.1.8 是 owner placement 行为。
- §3.3 是 callable canvas/layout 行为。
- DBG-1.1、DBG-1.2 包含 uniqueness/readability，不是 A-48 一个 dummy reader 能证明的。
- DBG-4.1 是 source/precedence，直接受 M-08 影响。
- DBG-6.3 要求 visible effective fallback/value，不能只检查存在 prompt。

因此，9.2 至少漏登记上述行为判据；“94 条均有判据或已登记不需要”不能作为有效闭环。最小修复是重写 9.2 的分类和 denominator，不是恢复旧 compliance-control 控制面。

## 7. 范围、依赖顺序与是否应切批

### 7.1 范围判断

四个合并主题是：admin console、设备形态维度、primitives 补齐、系统键盘退役；另有设备标识和调试态两项 runtime capability。它们不是完全无关：admin 需要 canvas/shape、输入和 primitives，debug/read-only readout 需要 device identity。但当前需求把六个不同 owner、不同 evidence tier、不同产品决定绑在同一个“已闭环”叙事中，导致：

- catalog/shape admission 是 kernel contract；
- system keyboard migration 是现有业务 consumer 的 destructive contract change；
- device ID 是 platform-port lifecycle/async contract；
- debug injection 是 assembly/config precedence；
- primitives/SVG 是 UI foundation；
- hidden entry、password、shell/mobile nav 是 user-visible Journey。

因此我的判断是：范围 envelope 可以作为一个产品批次保留，但不能按现在的未分层方式进入 implementation-facing 详设。最小切法是 proof/decision slices，而不是复制六套架构或新建通用框架。至少先锁定语义，再把 keyboard migration、shape/catalog、device identity、foundation、admin shell/sections 各自有明确 owner 和 oracle；未消费的 primitives 只有在 Dexter 保持 Q17 全量决定时才随批，否则应显式延期。

### 7.2 八步批内顺序的主要问题

- “system keyboard 只删除”与后续 CT-3 render/input 变更共享 MemberForm、useInputField、PrimitiveInput source graph，不能 parallel。必须把现有 system field 的迁移纳入同一 atomic step，或改串行。
- shape declaration 应先于 part catalog/admission 的最终闭环；否则 A-20/A-43 没有稳定的 shape source。
- selectAvailableParts 的新增首个 consumer 不能先于 layer-only selection semantics；否则 M-03 先天无法闭环。
- DevicePort async/sync 语义必须先于 ID auth implementation；device ID 实际解析可与 UI primitives 并行，但不能以同步假设先写 gate。
- colors/vendor/SVG 作为 primitive consumer 的 substrate 先于 admin shell 是合理的；但 PR-3 全量 component list 需要 consumer matrix，不应只以 POC 曾经出现过作为充分理由。
- focus A-15 不能在 admin shell 尚不存在时完成；当前计划“step 7 前验证”是时间顺序错误。必须等最小 shell/focus scope 建立后验证。
- Web/Android/release proof 只能在对应实现存在后分别进行，不能以 static/focused/welcome text 替代。

### 7.3 较小替代方案

可以保留同一产品目标而减少当前未必要的复杂度：先确定单一主显示 gate、canvas shape declaration、异步 device ID resolve、debug effective-value precedence 和最小 Journey；然后用一个共享 catalog/admission owner、现有 focus/layer owner、现有 primitives owner 做首批真实 admin section。只有实际 section consumer 证明需要的 primitive/token/icon 才进入第一轮 proof；全量 PR-3 若仍是 Dexter Q17 的硬决定，则保留但必须逐项列 consumer/behavior/a11y denominator。这个替代不引入新 registry、新 keyboard、新 transport、新 compliance 台账，只把已有边界写清并避免空泛的全量闭环。

## 8. 方案合理性与 UI/Journey 判断

### 8.1 方案是否解决真实问题

方向上，真实问题是：在固定 logical canvas 上提供一个只读的 admin diagnostics/control entry；按 canvas declaration 约束可用 part；让 admin 能显示 kernel/display/device/input/debug facts；避免错误显示在 secondary/形态不匹配的 surface；并退役 system IME 以保持 terminal 自有虚拟键盘。当前 source 中的空 admin-shell、无 shape filter、不可用 device identity、稀疏 primitives，支持这些缺口确实存在。

合理的保留项是：shape 随显式 canvas declaration 而非宽度 breakpoint；复用一个 UiCatalog、一个 LayerStack、一个 DevicePort owner；不引入第二套 input/layer registry；不因为 POC 有历史实现就整体继承。上游 Q-17、Q-28、Q-29 等也表明全量 primitives、无 Chinese layout、键盘退役是 Dexter 明确考虑过的方向，不应误报成作者擅自扩大。

问题在于：实现闭环的外形目前超过了可证明的产品闭环。尤其是把未裁定的数字尺寸、未定的 debug precedence、未定的 mobile IA、async port 强写成完成事实，会使一个复杂方案“看起来完整”但实际不能唯一实现。

### 8.2 UI 操作逐项判断

| 操作 | 来源/合理性 | 更短路径与缺口 | 根因归类 |
|---|---|---|---|
| 隐藏角手势进入 admin | 可追溯到 POC-B tracker/defaults；防误触有合理性，但没有已批准 Journey/IA。 | 若用户是维护人员，明确角落 gesture + 可见提示或物理上下文可能比密码前再猜 gesture 更自然；当前无 owner/copy。 | 旧 POC 继承 + 产品语义未裁决 |
| 六位密码登录 | 作为误操作防护是合理的；device ID/hour 派生可减少共享固定密码。 | 需要错误密码、时钟异常、重试/回退/close 的明确 copy 和 recovery；当前不能判断自然性。 | platform API 限制 + 产品未裁决 |
| shell title、section nav、close/back-to-login | 结构上符合 console；但上游没有批准的 tab/sidebar/selector IA。 | 移动形态下 compact section selector 可能短于横向 tab + scroll；不能由详设自行选择。 | 历史文档模糊 + 产品未裁决 |
| 三个 read-only kernel section | 与“先做一部分”和只读边界一致；但 descriptor/source/非 DEV 行为未闭合。 | 先做真正被业务使用的三项是小方案；section labels 不应暗示 write control。 | owner/source 尚不完整 |
| admin layer 打开后锁业务输入 | 用户意图合理；当前 LayerStack 只处理 0→非 0，nested 语义未定。 | 沿用一个已有 focus scope 并定义 owner 比第二套 lock 更短；需要明确已有 business layer 场景。 | owner 边界 + 产品焦点语义 |
| system keyboard 退役 | 是 Dexter 明确的产品方向；但现有 MemberForm name 的中文数据/错误提示/输入迁移未回答。 | 只迁移现有字段到 virtual layout 的最小方案即可；不应顺带扩展新的 keyboard family。 | 产品决定已存在，迁移交互未回答 |

## 9. 被推翻或必须收窄的作者结论

以下清单特意列出我没有照单全收的结论：

1. §0/AC-1 将 displayMode 直接作为 admin gate，并声称已有 assertion：不成立；上游 Q-8 选择 isHostPrimaryDisplay，当前 displayMode 也混合了 secondary 与 VICE/CHIEF。
2. §11.1 声称没有 Dexter decisions：不成立；至少主显示语义、360×800、DevicePort sync/async、debug precedence、Journey/mobile IA 仍需决策。
3. F17/§1.2 的“switchInstanceMode production zero dispatcher”：按字面不成立；command/actor 注册和内部 child dispatch 都存在。
4. “94 条全部有判据或登记不需判据”：只能作为名义 label 对齐，不能作为实质覆盖；9.2 至少漏掉多项行为义务。
5. A-3 已 hardened：不成立；四个 default 没有具体值，POC tracker 只有三个 override 字段。
6. A-15/AC-4.3 已由措辞解决：不成立；当前 LayerStack 仍是 surface-level、0→非 0 广播，nested focus 未解决。
7. “getDeviceInfo 所有平台不可用”：只能对当前已检查的 default/Android/Web adapter 确认，不能证明所有未来平台。
8. POC device ID 已证明稳定、重装行为和无权限：不成立；source 只证明算法/cache，生命周期与 runtime 权限仍缺证据。
9. POC-B SVG 已运行并渲染：不成立；现有可复核材料只证明 package dependency。
10. A-27/A-28 已挡住 IME 回归：不成立；文件 rename/inline 可绕过，且没有冻结改前 truth table；A-29 也没有完整 field denominator。
11. A-40/A-46/A-47 可以由现有 static/focused/welcome/review evidence 关闭：不成立；这些最多分别支持 source/focused 局部结论，不能替代 SVG 双端、mobile、release/DCE 或 clean visual proof。
12. A-16 已覆盖 console state persistence：不成立；它只测 selected section 或一个场景，不能覆盖所有 console state，也不能推出 layer structural non-persistence。
13. §0 版本沿革中的 A-5a 是当前判据：不成立；当前对应的 console root measurement 是 A-13。

## 10. 文档漏掉但本轮范围内必须回答的问题

1. admin entry 的唯一主显示语义到底是 isHostPrimaryDisplay 还是 displayMode；fail-open/fail-closed、日志 reason 和 power-role 变化如何处理。
2. 四个 launcher defaults 的精确值、单位、边界、clock、override 规则，以及错误/超时恢复。
3. portrait 数字尺寸的真实来源、是否就是 360×800、如何校准；不得把抽象 shape ruling 当数字 ruling。
4. layer-only admin entry 如何使用同一 UiCatalog 并被同一生产 selector 枚举；空 containerKeys 的语义是什么。
5. business layer 已存在时 admin nested focus scope 的 owner、suspend/restore、backdrop/back 行为。
6. DevicePort 的 async/sync 选择；device ID resolve 时机、未知/错误 fallback、存放位置、持久化和跨 clear-data/reinstall 生命周期。
7. 当前平台 descriptor source 在 __DEV__ 之外、Web unavailable、release bundle/DCE 下的真实行为。
8. debug pack-time/startup-time 的 precedence、默认值、合法 startup input、assembly owner、immutable read path 以及 effective password comparator。
9. 全量 production part inventory、所有 direct render/show/open caller、shape admission 的唯一强制 owner 和绕过路径。
10. primitives、tokens、icons、states、a11y 的完整 denominator；每个本批实际 section 的 consumer；SVG 的语义 path 和 Web/Android proof。
11. virtualization 的固定上界、adversarial 长列表、recycle 与 scroll proof。
12. MemberForm 现有中文姓名字段迁移到 virtual keyboard 后的 user-visible copy、数据兼容和错误恢复。
13. static、focused、Web、Android、release/DCE 的独立 evidence matrix；明确没有当前 admin clean visual PASS。
14. 隐藏手势、登录、shell nav、mobile IA、section 顺序、labels/errors/back/recovery 的已批准 Journey/IA artifact。
15. D-5 在 admin read-only 阶段是否允许任何 instanceMode/write control；若不允许，如何防止误把已有 command/actor 暴露出来。

## 11. 对作者的最小处置建议

先不要写详设或实施。先由 Dexter 处理 M-01、M-02、M-05、M-07、M-08、M-09、S-16 等产品/契约决策；作者随后把 §2 事实、§9 判据、§9.2 分类和八步顺序改成与这些决策一致的可执行版本。其余 CONFIRMED finding 可以在需求层直接收窄或补 oracle；UNVERIFIED finding 不得被写成 PASS。

本评审不授权源码、测试、依赖、详设、实施计划、Web、Android、DEV、seed、UAT 或部署动作。需求正本是否接受、如何修订、何时进入下一阶段，仍由 Dexter 另行裁定。
