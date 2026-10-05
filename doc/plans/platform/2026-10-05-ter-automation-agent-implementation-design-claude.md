---
title: TER automation-agent 详设提案
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
implementationAuthority: false
uiApproval: UNSET
---

# TER automation-agent 详设

## 0 · 元数据与授权边界

- 需求：`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`；本轮读取 SHA-256：`37fe9363e79b6db3dbb68a36429d109cb8f7d586e465f701f86de4bf09507739`。
- 原话：`doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md`。本轮 Dexter 最新指派：由我编写详设/计划，单批次顺序 CP，最终 Expo Web + mobile 虚拟机验证，退役旧 runner，交另一位 Claude review。
- Journey、IA、UI：同日 `doc/decisions/2026-10-05-ter-automation-agent-{journey,ia,ui-interaction}-claude.md`。全部 PROPOSED，线框 UNSET。本详设是完整待评提案，不能冒充已获批 implementation-facing 定稿。
- 新指派允许现在做设计，替代需求 D-1 的「设计也等待 Codex」时间限制；不允许修改 Codex 在途源码。实施开始仍需 Dexter 批准，并重新读取届时字节。N-1：需求 D-1 与 §8 仍保留旧时间限制；需求正本不在本轮修改授权内，此源头同步保持 OPEN，下次获授权修订时登记本次指派来源。本包明确披露，不能声称需求已经同步。
- Dexter 本轮已裁定：R-18 使用 fresh 报告全文/命令的逐字转录规则；实施期允许从 TDC acceptance 抽取共享 operations fixture。两项已定，不改变本轮文档授权。Dexter 本轮进一步裁定按 seed key 共享终端：dual=term-front，mobile=term-handheld；激活码仅从 seed 契约读取，不新增终端、不改 seed，串行受管运行防争用。未来实施授权须单独列出 §9a 的 DEV readback 跨 owner 扩展，本轮未授权修改该源码。
- GOVERNING：AGENTS、PLATFORM-BLUEPRINT、terminal-coding-standard、review-standard、implementation-task-template、deterministic-context-only、适用六维路由原文。
- 当前完成：源码读取、语义盘点、官方资料/元数据读取、设计文档。依赖安装/解析验证、生成、编译、测试、verify、Web、VM、DEV、reset/seed、L2、UAT、cleanup 全部 NOT_RUN。
- 一批交付；CP 是内部顺序，不是独立产品批次。最终依然整批 review。新增 UI 只有两条常量事实。

## 1 · 真实目标与方案比较

旧 runner 各自解析 UI dump、坐标、状态与业务结果，不能让同一脚本以 Runtime 的真实语义观察两端。目标是复用现有 owner，通过一个固定 JSON 协议实现同一旅途；不是重写 TER runtime 或做远程业务工作台。

| 比较 | 选择 | 原因/成本 |
|---|---|---|
| App 监听端口 / App 主动 WS | 主动 WS | 不增平台端口；双机连接彼此独立；RN/Web 同代码 |
| agent 读 full state / Runtime 按名 selector | 按名 selector | TR-03 保持；扩展现有 RuntimeModule 契约，不建业务快照 |
| primitives 依赖 agent/render / 注入接缝 | primitives 定义无依赖接缝，render 提供 surface，上层 assembly 注入 agent sink | 保持依赖 DAG；关闭时 no-op |
| 再造设备 runner / 迁移受管基础能力 | 一个 driver + Vitest 旅途 | 保留身份/日志/cleanup；设备命令在 driver 内，旅途无平台分支 |
| JSON-RPC/通用恢复框架 / 消息信封 | 固定闭集消息 | 没有 eval、服务总线、持久队列、自动 command 重发 |
| 新建 admin Tab / 现有运行状态加行 | 后者 | 两项构建事实，不需 slice、新路由或按钮 |

### 1.1 当前源码与完整盘点

附件：`doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json`。
静态遍历 145 个含 testID/testId/data-testid 的 TER 源码/测试文件，其中源码 115、测试 30；共 1,483 个文本定位点，639 个生产 TSX testID 属性位置。文本定位点不是节点数量或验收分母。
附件逐文件列 SHA/全部定位行，并逐 JSX 节点列实际 tag；包含 application/base/android 与 application/android，排除依赖、build、dist、.expo、.gradle、.cxx、ios。
按包根函数签名及 RuntimeModule 所属判定得到 42 个公开 StateRoot selector，18 个定义文件；不是 `select*` 搜索分母。附件保留被排除的 factory/hook/路由输入 helper 理由，以及两个 integration 中未从包根导出的八个 StateRoot selector。
附件 selectorReturnTypeAnalysis 使用仓内 TypeScript 6.0.3 checker、各包真实 tsconfig 与函数签名静态读取 42 项返回类型，不 emit、不运行 tsc/build/test；顶层含 undefined 恰为 selectScreen/selectTopologyFacts/selectPendingWallpaperId。该结论不证明对象内部字段和运行时值一定可 JSON 化，仍按 §4.2 校验。
该盘点是当前设计输入，不是今后写入白名单：实施前同一语义算法重扫在途变化；新出现的命中必须纳入。

## 2 · CP 总览

| CP | 完整阶段 | 输入→退出 | 首要反例 |
|---|---|---|---|
| CP-01 | 固定协议、构建配置、最小 agent/driver、接缝及 F-1/F-2 | 旧 ID；实现基础真实输入与同会话订阅→F-1/F-2 与静态/退出对账 MATCHED | 双重缩放、正常 close 不重连、旧会话污染 |
| CP-02 | Runtime selector 全集登记、command 观察、完整控件能力 | 使用 CP-01 连接→42 项及新增项登记，全部公开能力可调用 | 不带 select 前缀的 selector 漏登；同步拒绝/迟到结果丢失 |
| CP-03 | 全构建装配、admin 常量行、F-4a/F-4b | 两 sample integrations/applications 均装配→关闭 no-op 与开销 proof | 每 surface 建一条连接；关闭仍测量；日志落令牌 |
| CP-04 | 首个冻结旅途，现有 ID 两端 focused proof | 前三 CP MATCHED→同一脚本 Web/Android 双屏通过；mobile 追加 proof | 直接 command 冒充用户点击；只读成功文本 |
| CP-05 | testID 全量重建及语义机械门 | CP-04 旧 ID 已通过→新 ID 同一旅途两端 focused proof；全部引用同步 | wrapper ID 冒充动作节点；旧别名残留 |
| CP-06 | skill、规范迁移及最后 runner 退役 | CP-05 新 ID 两端通过→旧入口/独占 helpers/harness 移除，focused 复验与 CP 退出 MATCHED | 删除 TR-04 证明却未登记空窗；删检查器/协议验收 |

全 CP 完成→独立全批三维对账 6b→最终统一 W/Android 双屏/mobile 验收→逐代码与详设 13c→整批 IMPLEMENTATION 独立审查→Dexter/Claude review。
CP-04/05 的两端 proof 是该阶段必需 focused proof，不冒充最终整体验收；6b 不被这些 proof 代替。最终重新验证是因为 testID/装配/harness 删除改变了执行字节；未改变的 CP 对账不重做。

## 3 · 横切机制对照表

| 实现步骤 | 现成能力/精确落点 | 可做的验证 | 无现成能力时的同形约束 |
|---|---|---|---|
| 新包 | `.agents/skills/` 项目 scaffold 规则；`ui/base/terminal-activation` 包形状 | skeleton graph/三重标识/dependency red | ui.base.automation-agent、@catering-v2s/ui-base-automation-agent、ui/base/automation-agent；index 仅导出 |
| Runtime selector | `runtime/src/types/module.ts`；commandDefinitions 契约 | root exports 与 selectorDefinitions 语义比对；删/多登记红例 | defineStateSelector 返回可直接调用函数及只读 descriptor；不改既有调用签名 |
| 无空窗观察 | `createRuntimeJournal.ts`、`createCommandDispatcher.ts` | 同步 started/拒绝/完成均捕获；mixed actor timeout 与 late-error | 先真实 subscribe 再 dispatch；requestId journal filter；不建账本 |
| 注册/几何 | `primitives`、`render/SurfaceRoot.tsx`、`SurfaceHostController.tsx`、`admin-shell/AdminLauncher.tsx#coordinateSpaceOf` | F-1 两轴非等比、offset、滚动、双屏真实点；关闭不 measure | owner 接缝注入；真实 native/DOM ref；不新增 View 改布局 |
| Web/Android 生命周期 | `scripts/test/ter-admin-display-web.mjs`、`ter-virtual-keyboard-android.mjs`、`tools/terminal-topology/process-identity.mjs` | stale PID/boot、未知 reverse、失败后首败/cleanup | 仅迁移身份/受管能力；不迁移 dump/sleep/直接改 slice |
| 业务旅途 | 冻结需求 §4.3～4.5；`run-sample1-frozen-journey.mjs` case 集 | visible part + selector + request 逐步三断言 | Vitest 一份纯 driver 旅途，无 Web/Android 条件判断 |
| admin UI | 两 RuntimeSection、PrimitiveFactGrid | enabled/address 同源；长地址换行；value 文本节点 ID | FactGrid item 增 valueTestID，保留 item 外框 ID，不建 Tab/slice |
| testID 来源 | primitives 的品牌 TestId、现有 typecheck | 字面量/拼接必须编译失败；窄 AST cast 红例 | 用编译器检查 props 传递，不自写符号流分析 |
| 激活 fixture | TDC acceptance/operationsFixture.ts（待抽取） | 共享 helper focused + driver 身份拒绝/回收 | owner 保持 TDC acceptance；两消费者，不复制五个私有函数 |
| 脱敏 | AGENTS 日志条款、observability 标准 | secret sentinel 在 JSONL/报告/截图均不可见 | 日志白名单 metadata，不把 raw JSON/error/URL 写盘 |

### 3.1 第三方实际版本与官方依据

以下区分「仓内锁文件/包元数据已读」与「本包拟声明，尚未安装」。新依赖不因版本存在就算 API/产物验证通过。

| 库 | 精确选择/现状 | 官方一手依据 | 消费与 focused proof |
|---|---|---|---|
| RxJS | 7.8.2；新依赖 NOT_RESOLVED | [tag 源码](https://github.com/ReactiveX/rxjs/tree/7.8.2)、[WebSocketSubject](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts)、[throttleTime](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/throttleTime.ts) | agent/driver 各声明；complete/error、takeUntil、trailing、先订阅测试；没有公开 Observable |
| Zod | 4.4.3；仓内已有间接解析，两个新包须直接声明 | [官方 Mini](https://zod.dev/packages/mini)、[对应 gitHead](https://github.com/colinhacks/zod/tree/f3c9ec03ba7a28ae72d25cc295f38674bee0f559) | 仅协议；strictObject/discriminatedUnion/parse；未知 method/坏形状红；bundle 增量 |
| adbkit | 3.3.9；新依赖 NOT_RESOLVED | [官方仓库](https://github.com/DeviceFarmer/adbkit)、[发布 gitHead](https://github.com/DeviceFarmer/adbkit/tree/f474b57f6b1b1b41edd4abbfa1dd9bfad6420d6a) | listDevices、getDevice、reverse、shell；源码核对参数数组仍由库转成 shell 字符串，不能当安全边界 |
| ws | 8.21.3；yarn.lock 已有，driver 直接声明此版本 | [官方仓库](https://github.com/websockets/ws)；实施重核 8.21.3 源码，当前网页精确 tag 读取未成功 | WebSocketServer、maxPayload、bufferedAmount、close/terminate；连接失败不重发 command |
| pixelmatch | 7.2.0；新依赖 NOT_RESOLVED | [官方源码/README](https://github.com/mapbox/pixelmatch)、[发布 gitHead](https://github.com/mapbox/pixelmatch/tree/9faed09302aaecec130b4ce0e8505d5ed5221393) | PNG 对比 threshold=0.1/includeAA=false；误差大于 0 即失败（排除已声明区域后） |
| pngjs | 7.0.0；替代 driver 借用的间接 3.4.0 | [官方 v7.0.0](https://github.com/pngjs/pngjs/tree/v7.0.0) | PNG.sync.read/write，仅 driver；格式/尺寸不等直接失败 |
| dequal | 2.0.3；仓内已有，agent 直接声明 | [官方 v2.0.3](https://github.com/lukeed/dequal/tree/v2.0.3) | 只比较已验证 JSON 值；相同键不同顺序不重复推送 |
| Playwright/Vitest | 1.61.1 / 4.1.10；实际 node_modules metadata 已读 | [Playwright API](https://playwright.dev/docs/api/class-locator)、[Vitest](https://vitest.dev/)；实施补对应 tag 核对 | driver 自己声明 playwright，devDependency vitest；不用 @playwright/test 做 runner |
| React Native/Expo | 0.86.3 / 57.0.18；lock 解析，根 node_modules 不可直接解析 RN/Expo | [RN 版本源码](https://github.com/facebook/react-native/tree/v0.86.3)、[测量官方说明](https://reactnative.dev/docs/the-new-architecture/layout-measurements) | 实施从 application 解析实际 RN/Expo/Metro；Fabric/Presentation 仍 F-1 OPEN，不能用旧架构 manager 推成原生 PASS |

本轮 npm registry 已读指定版本元数据：RxJS、Zod、adbkit、pixelmatch、pngjs 的版本存在；metadata 不等于安装或 API proof。精确 tag 暂不可读的依据必须在 CP 写入前补齐，不能凭 master 文档实现。
不选 pino/execa：既有日志/manifest、Node spawn 足够；不引入两套进程回收机制。结构化落盘仅写白名单，库自动 redact 不能代替截图脱敏。

## 3a · UI/testID 前置复核

UI_DESIGN_REVIEW=OPEN（两条常量行线框未确认）；TESTID_REVIEW=OPEN（现有/新 ID 两阶段）；L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本批执行 TER Web/VM，不执行两个管理后台 browser L2。
不过 UI-bearing 的控件 roster 与前置复核义务保留，不用 N/A 跳过实际操作控件。

| case/action 全集 | 控件/实际动作节点 | owning source 与常量来源 | 复核与观察 |
|---|---|---|---|
| admin 信息 | 两 RuntimeSection 的实际 FactGrid 文本 | admin-shell/adminTestIds.automation | UI 组件 proof +两端读到一致常量，无按钮 |
| normal/reject-retry/abandon/withdraw | staff 输入、登录；member 新增/姓名/电话/提交；客户年龄/确认/拒绝/撤回；虚拟键盘每键 | staff-auth、member-desk、input 当前 testID 定义；CP-05 改各包唯一 *TestIds.ts | 旧、新 ID 各核对真实 Input/Button，不用外层补定位；禁用/失焦/两屏相同 ID 反例 |
| render-smoke | 当前会员列表、主要 part 根、两屏静态只读节点 | member-desk、render、primitives | 节点→可见 part→对应 selector；不按 text 成功即 PASS |
| mobile 新执行面 | MMP 登录、会员确认；normal/reject-retry/abandon 及输入 | 同一 owning source 的 mobile 组件，shape 参数决定业务 roster | 不借双屏 withdraw 或 render-smoke 的不合法 mobile 分支补数 |
| F-1/F-2/F-4 | surface 根与测量节点、connection subscriptions、静态页 | inventory 全部定位、render/agent/driver | 新能力对应真实节点；布局改变使旧 bounds 失效 |

验证控制面全集：`tools/terminal-automation/src/{driver,session,webInput,androidInput,managedRun,displayMapping,redaction,requests}.ts`；`protocol` 消费；`journeys/{sampleConsole,agentCapabilities}.test.ts`；`fixtures/{terminalActivation,member}.ts`；`vitest.config.ts`；`scripts/test/terminal-automation.mjs`；各 owning package focused tests；旧 runner 删除表 §9a.1。全部是待实现路径，不声称当前存在。

## 4 · 各 CP 门控与具体方案

### 4.1 CP-01：传输、配置与注册接缝

**配置**：各 integration/application package.json 增 `terminalAutomation: {enabled:false, url:"ws://localhost:19090", sessionToken:""}`；打开须非空令牌。禁止 URL userinfo、token query/hash。localhost 包括显式 loopback `127.0.0.1`/`[::1]`，非 loopback 强制 wss，系统正常校验证书，不提供 insecure 开关。
沿现有 `packageJson.terminalSurfaces/serverSpaces→createAssembly` 路径传入同一个只读对象。Android application 值覆盖 integration 默认；Web 取 integration 值。driver 不在运行期改开关；受管测试先完成构建输入再启动，运行期间冻结源码。
新 `createAutomationAgentModule` 在 integration-assembly 所建 Runtime 中装配一次，runtime install 后启动连接；多个 surface 只注入同一 sink，不多建 socket。两 sample integrations、两 Android applications、application/base/android、dev-host 全装配；production/debug 无分支删包。

**接缝**：primitives 提供 `AutomationNodeSink`、`AutomationSurfaceScope`、`AutomationRegistrationProvider`、`useAutomationNode`、`createTestId`。纯 React/type/no-op，不依赖 render/agent；接口仅普通函数/JSON/ref，无 RxJS。关闭时不注册、不 measure、不加额外事件监听。
render 的 SurfaceRoot 提供 PRIMARY/SECONDARY、displayIndex、canvas、host snapshot、layoutRevision；assembly 注入 agent sink。Root/surface 尚未 ready 返回 BOUNDS_NOT_READY，不猜坐标。
没有 surface 的宿主/启动节点用 `scope=HOST`（与 PRIMARY/SECONDARY 联合判别式分开），不可被用于 business surface 点击；Android启动页明确所属 displayIndex，准备好的 surface 可识别后归其实际 surface。不能把 Web 外框假归属为 PRIMARY。
所有 primitives 在实际 Rnr/native 节点挂接 ref、layout、pressIn/out；内部 derived testID 节点也登记，不仅最外层。不能额外套 View；不能抢走业务 ref、替换原用户回调或改变 disabled guard。
附件中的非 primitive 节点逐个消费相同 hook：render 的 ScreenContainer/LayerStack/ScreenReadyBoundary/SurfaceHostController/SurfaceRoot；input 的 InputKeyboard/InputSurfaceFrame/VirtualKeyboard 根；admin AdminLauncher；dev-host 的 View/Pressable/Text 与 HostStateCard；integration-assembly 的 PairReadinessInterlock；AndroidTerminalApp 启动根。InputScrollArea、MemberRow、WallpaperOptionCards 的转发 ID 在最终 Primitive 节点登记，wrapper 不重复注册。

**节点生命周期**：key=`{session-independent nodeInstanceId, scope, testID}`；查询同一 scope/testID 多个活动节点报 AMBIGUOUS_NODE，不能拿第一个。挂载注册、props 更新字段、layout/scroll/reparent/窗口变更递增 layoutRevision、卸载即删除。操作携带 nodeInstanceId+revision，卸载/旧 revision 返回 NODE_GONE/STALE_BOUNDS；可重新查询，不自动重放点击。
可见=已挂载、宽高非零、与其 surface viewport 有交集；clip 后才能选输入点。遮挡只由真实按下事件验证，不自报「可点击」。pressIn/out 记录原始 page/location 坐标、实际目标 ID、触发来源；仅协议返回，落盘脱敏。

**坐标唯一换算链**：
1. Web：真实 DOM ref 的 getBoundingClientRect→viewport CSS px；保留 scroll 后值，不再加 scrollX/Y；locator 在同一 surface 根下，先确认 node identity/revision，再真实 click 或逐键点击。
2. Android：同一 display 的 surface window 基线与实际 native 节点 ref，用当前 RN/Fabric 的 measureInWindow 得窗口逻辑坐标；它已有祖先变换，不能再乘 host/canvas 比例或扣一次 presentation offset。
3. driver 读取 dumpsys display 的 logicalSize、physicalSize、rotation/insets 与 DisplayFlinger 映射；native 返回的窗口矩形先加已证明的 window-origin/insets，最后只做一次该 display 的 dp→物理 px 转换。不得用主屏的 PixelRatio 套副屏。
4. Native ref 测量是否包含 window inset/transform，必须先查实际 RN 0.86.3 的 Fabric 路径，并由 F-1 四角+中心证明；无法建立独立的原点/密度来源时停在 CP-01，不能用多乘一个比例补偿。
5. F-1 容差 `N=ceil(2×该屏密度)` 物理 px（两 dp 的整数舍入/触点边界预算）；测试点向内留至少 N+1，目标尺寸不足则选择较大既有按钮而非改业务 UI。Web 容差 1 CSS px，含非零 scroll、非等比 scale、非零 offset。
两个 Android display ID 由 driver 解析，结合实际 displayIndex/current presentation readback建立一对一映射；不能从数组下标猜 physical ID。surface 与显示器映射变化使 bounds 全失效。
`adbkit` 优先承担 device/reverse/shell；没有对应多屏方法时仅在 driver 内补 `spawn('adb', ['-s', serial, 'shell', 'input', '-d', logicalDisplayId, 'tap', x, y])` 与 `['-s', serial, 'exec-out', 'screencap', '-d', surfaceFlingerDisplayId, '-p']`。serial 从已选设备身份取得，ID 保持已读回的十进制整数字符串（SurfaceFlinger ID 不转成可能丢精度的 JS Number），坐标接受有限整数并序列化为字符串；禁止 shell:true、任意 shell 命令或把用户文本拼入 shell。input 与 screencap 的两个 ID 不能混用；具体当前 Android 命令支持须由 CP-01 官方依据及 focused proof 确认，不支持则明确停止该执行面。

**重连**：RxJS `defer` 每次建立新的 WebSocketSubject；complete/error 统一为连接结束后可重试信号，单条 retry 流，500ms→1s→2s→4s→最多5s。openObserver 重置连续失败计数；不是 resetOnSuccess。外层 takeUntil(本地主动关闭/销毁) 终止 retry 和 delay。每次 open 新 automationSessionId；runtimeId 原样取 Runtime；旧会话 finalize 清订阅/registry观察/待响应映射。连接失败业务继续；发送失败不重发业务 command。

**wire v1**：JSON text；agent 与 driver 共用 `automation-agent/src/protocol` 的 zod/mini strict schema，driver 只引用 protocol subpath（不 import React/agent runtime），两个包各声明 zod。RxJS 不出公开类型。driver tools workspace 不进入 TER application依赖图。
信封：`{protocolVersion:1, sessionId, messageId, type, body}`；agent 每次 open 先生成 automationSessionId，再以该 sessionId 发 hello，携 token、runtimeId、localNodeId、appName/构建版本，driver 验证后 welcome；其后每条核对 sessionId。protocol version 不匹配明确拒绝。日志不写 hello 原文。启动日志写 enabled 与脱敏 addressDescription：移除 userinfo/query/hash，IP host 映射为 LOOPBACK/REMOTE_HOST 标签，保留 scheme/port/非敏感 path；admin 行显示合法配置地址。不得为满足地址诊断而将原始 IP 或令牌落盘。
方法闭集：`runtime.info`、`selector.read/subscribe/unsubscribe`、`command.dispatch`、`controls.query/subscribe/unsubscribe/bounds/act`。response/event/error 引用 messageId/subscriptionId/requestId 与会话 seq；不设 eval/scripts/fullState。
hello/auth 期限5s；WS单消息上限1MiB（本自动化协议，不改变 TDP 的65,536字节）。超限返回 VALUE_TOO_LARGE；不能截字段、伪造成功或自动拆业务状态。128个订阅、32个 command observer/连接；超限返回 RESOURCE_LIMIT，仅技术工具容量。socket bufferedAmount>1MiB 即结束本会话并清资源，不能在JS内无限排队。
driver 为每个受管 Android serial 创建独立 host listener 端口，reverse 同一设备端固定19090→所属 host端口，故可把连接绑到精确 serial 而不猜来源IP；一个 driver 管理多 listener/连接。Web使用其受管 browser context与连接元数据匹配。localNodeId 不等于硬件 serial。

**CP proof/FORBID**：normal close/error/reverse恢复、本地 dispose、双Runtime；无 token日志；卸载/重复节点/两轴几何真实反例。不得增加平台 port、UI业务 state、uiautomator 找 React 节点、全状态读取。RECALL：R-01～04/R-08～10/F-1/F-2、几何 memory、上述 owning source。

### 4.2 CP-02：selector 登记与 command

`RuntimeModule.selectorDefinitions` 为可选只读数组；RuntimeModuleDescriptor 加 selectorNames/parameters；Runtime 增 `evaluateSelector(name,argsTuple)`，内部才取得 StateRoot。各模块 install 不持有 agent。
`defineStateSelector(moduleName,name,parameters,existingFn)` 生成具有原调用签名的函数+descriptor，模块工厂登记它；不再保留一套第二实现。参数使用 Runtime 简单 JSON descriptor：string/finite-number/boolean/null/enum/array/object/optional；序列 argsTuple 映射原函数的第2..n参数，无参为[]。不会给 kernel/feature 加 zod。
参数全集：Runtime requestId、workspace、displayMode；ui-state displayMode/containerKey/workspace；topology requiredSliceNames；TDC now；store-basic topicKey；server-config defaults/serverName。server-config defaults 是已有公开 API 必填参数，完整校验 TransportServerConfig 的 spaces/servers/addresses/proxy 结构，不隐式从 agent 私读配置；`resolveServerNetworkSnapshot` 虽不叫 select，依定义也登记。
42项完整名单在附件；implementation 还须语义重扫全部包根导出，不仅已知 selectors 目录。render 的 createCatalogContext、useUiStateSelector、module factories/resolveTopologyCommandTarget 都不是登记分母；无 runtime module 的 toolkit 不能为登记而造模块。
严格 JSON 检查：允许 JSON primitives、有限数、plain object/array；拒绝 undefined、function、symbol、bigint、Date、Map/Set、循环引用、NaN/Infinity、会被 JSON.stringify 丢弃的字段。返回 undefined 的 selectScreen/selectTopologyFacts/selectPendingWallpaperId 在空态明确 NON_JSON_VALUE；不偷偷改原 selector 返回 null。
敏感 selector 原样协议返回；日志/报告不可返回正文。附带时间 `now` 的 selector 无 args 时沿现有默认行为；状态未变化不保证时钟值更新，不为自动化另加 timer slice。

selector stream：先真正订阅 store，推一次当前值；state变化合并50ms，按名求值→严格JSON→dequal→`throttleTime(50,asyncScheduler,{leading:true,trailing:true})`；最后值保留。NON_JSON_VALUE 是一次明确的值状态事件（valueState=NON_JSON，reason=UNDEFINED/FUNCTION/NON_FINITE_NUMBER 等受控原因码），不发送不可表示的正文，不改成 null，订阅保持；后续合法 JSON 值照常推送。同原因值状态可以去重，NON_JSON→JSON→NON_JSON 必须可观察。读一次返回同样明确的 NON_JSON_VALUE。只有求值抛错、超预算（含单消息容量）或会话结束使订阅失败/终止；显式 unsubscribe 正常释放。会话结束 takeUntil；不改业务 subscribe callback机制。
预算：单次求值/序列化分别8ms，越界可观测并终止该订阅，不承诺能抢占同步 selector；最大 selector负载的同步处理段与控件query P95≤16ms/max≤50ms，超限F-4b不通过。容量与成本要在真实设备验证，不把计时后的拒绝说成同步计算已被中断。测量口径见 §4.3。

command：observer 先订阅 journal，再调用 Runtime.dispatchCommand(name,payload,options)；requestId 缺省复用 createRequestId。root command options routeContext/target 由显式协议 JSON输入传入现有Runtime path，不绕过 topology/actor准入。agent不校验payload业务形状。
journal事件与 dispatch result 分列（result未必业务成功）；同步拒绝捕获typed key，未知异常返回 GENERIC_DISPATCH_ERROR，不落原始error/payload。多actor收集整个dispatch结果，不能首个actor完就关。
当结果含timed-out，观察同request的所有迟到actor事件；观察上限是本次dispatch起120s，或连接结束（先到者），延时取消不会取消actor。到期明确 TRACKING_EXPIRED（最后状态可能UNKNOWN）；不补执行、不在重连后恢复 observer。journal 本身不回放，不能用 defer 替代先 subscribe。非timeout结果仍等待 dispatch返回后已同步queued事件发送完；如存在继续运行peer，按其返回终态语义保留到期限。
机械门扩展 `tools/terminal-skeleton/check-static.mjs`：TypeScript checker识别包根签名(first arg StateRoot)，对照publicExports与RuntimeModule登记；遗漏、多登、非StateRoot helper登记红。测试fixture与production都按同一语义，不允许 select前缀正则。
RECALL：R-05～07/R-12/R-19、RuntimeModule/Journal/Dispatcher/current TDP late paths。失败反例：同步完成漏started、已有observer抢掉另一订阅、mixed终态提前关闭、错误参数未拒绝、undefined被JSON悄悄丢。

### 4.3 CP-03：装配、可见行与关闭/开销

构建输入同源扩展 existing IntegrationAssemblyInput/AdminSectionRenderContext 的只读构建事实；admin-shell不importagent。UI见交互工件，两实际文本节点挂adminTestIds唯一常量；无开关按钮、实时连接slice。当前 PrimitiveFactGrid 的 item.testID 在外层 RnrView（PrimitiveAdmin.tsx:74–90），不能当作 value 文本 ID。CP-03 为 item 增可选 valueTestID 并挂实际 value RnrText；新两行必须提供，item 原 ID 保留。全部 FactGrid 调用点在 CP-05 使用构造函数/常量提供同形 value ID，不从字符串拼接或拆解派生；组件测试分别断言外框与文本节点。
两sample App的all modules包含新包，开关只限制 install启动。HOT换bundle可打开；不假造HOT发布系统测试，本批focused模拟构建输入变化+JS重建。
F-4a：同一静态页面与viewport、字体、deviceScaleFactor，开/关构建不依赖agent，用Playwright DOM ready条件截图。仅排除时钟、文本光标、既有动画区域与新增两条admin事实行；掩模在截图前按明确节点bounds生成，不得整页遮蔽。pixelmatch threshold0.1/includeAA=false，余下diff pixels=0；缺region mask/不同尺寸直接失败。
F-4b：选择附件节点最多的生产page，在 release 构建的 mobile/双屏 VM 测100次query/1,000次state bursts；挂载/卸载计数一致、无残留；query P95≤16ms/max≤50ms、单selector预算见CP-02、500ms内推最后值。
测量用该 JS 线程 performance.now/mark：state 推送从实际 flush 开始，到该次所有活跃订阅完成按名求值、严格 JSON、dequal、信封编码并交给 socket send 队列为止，包含本段同步日志成本；不包含50ms合并等待、网络往返或用户等待。query 从 agent 接受 query 到完整响应入发送队列，含 registry 遍历/过滤/编码；native 异步测量等待另列 bounds latency，不冒充同步 query。两个分布分别报告样本数、P95、max、订阅数和 payload bytes；最大128订阅负载须包含，不能将总周期拆成每流16ms。16ms 是本批初始预算，依据 [RN 0.86 官方性能说明](https://reactnative.dev/docs/0.86/performance) 的60Hz约16.67ms帧时间及 release 测量建议，不是现有性能事实。
账本测试覆盖长驻30min窗口后真实累积的 workspace request view，保留时长取 runtime 的 requestRetentionMs；它不是条数上限。记录实际条数/完整 JSON bytes/求值与序列化耗时，并构造超过1MiB/8ms的受控红例验证明确拒绝和退订，不截断 ledger。§4.4 使用一次基线读+有限订阅减少重复快照，仍须测其真实成本。未达到时优化同根，不增业务限制。
bundle增量初始上限1MiB（未压缩 JS、相同release Metro输入，agent+RxJS+Zod Mini+dequal合计；给基础工具留一小于典型媒体资源的预算，尚无本轮实测）。记录raw与压缩增量/版本/tree-shaking输入；超上限交Dexter决定预算，不能移到driver虚报agent没体积。关闭仍包含代码，此项不以无增量为要求。
RECALL R-02/04/15/19/20、admin屏IA、当前package/build输入。禁止生产/调试能力不同或开关关仍注册测量。

### 4.4 CP-04：旧 ID 旅途与前提链

同一 `journeys/sampleConsole.test.ts` 接driver接口，case配置normal（age空/37）、reject-retry、abandon、withdraw、render-smoke。只改执行面fixture，不在业务步骤写平台分支。
每步先建立节点事件、相关 selector 与 request 观察，再执行实际 press，随后等待匹配节点事件和业务结果。真实操作不能用 directCommand 替代。UI 自己创建的 requestId 通过已登记的 `selectRequestExecutionViews` 观察：每个动作建立以当前 workspace 为参数的 selectRequestExecutionViews 订阅，确认收到初值后仅做一次 selector.read 保存基线 request 身份集合；观察在动作之前已激活。动作后按新增 request 的 root commandName、workspace、displayMode 匹配，候选确定即关闭集合订阅，再订阅 `selectRequestExecutionView(requestId)`，消费真实 results/errors；复用既有账本，不新增 journal 全流接口。workspace 参数仍包括 workspace=null 的既有请求，不能宣称完全省去扫描；全数组构造/编码成本按 F-4b 计入。路由断言不新增 integration selector 导出：activation 用 selectActivationStatusView（currentPeerValue/activation.status；非 MASTER 且 host projection 不可用或身份不匹配时返回 null，null 是合法 JSON，不是 NON_JSON_VALUE）、staff 用 selectHostStaffQualification，实际 part 用 selectScreen(displayMode,containerKey) 和 selectLayers，业务用 selectMembers/selectPendingMember；结合真实控件与 request 断言，不复制内部 route stage 推导。driver 的 tools/terminal-automation/src/requests.ts 提供唯一薄封装 requests.observeUiAction({workspace,displayMode,commandName}, action)：先建立集合订阅并确认首值，再在动作前读一次基线，合并两份已见 requestId；随后调用 action 的真实输入，按新的 requestId、view.workspace 与 rootCommandIds 对应 commands 的 commandName/displayMode 匹配。从当前集合快照中核验唯一候选后转到该 requestId 的精确订阅并消费初值；候选不唯一则 AMBIGUOUS_REQUEST，不能取最近或第一项。关闭集合订阅后仍用 Runtime 保留账本的精确初值覆盖快速完成，不复制账本或推导 payload。结束等待与迟到结果期限沿用 §4.2，finally 释放所有本地订阅；helper 返回 {requestId, view}，只有请求的真实结果与业务 selector 同时符合断言才算成功。该 helper 不发业务 command，只包裹传入的动作；受管旅途串行执行。当前 observation 不含 command payload；feature 的 selector/结果公开 operationId 时另外核验该身份，不假设可从账本读取 payload。快速完成仍可由保留的账本快照读到；候选不唯一或账本缺失时明确失败，不能猜最近一条或只看成功文本。driver一次失败即停止后续业务动作，只允许诊断/cleanup。不能先fill后又整段input无显式submit；文本逐键，按schema合法字符读取virtual key节点，最后显式按实际提交键/按钮。
现有源码首屏由activation→staff→member路由，不再默认staff-login。准备通过真正CBS fixture+TDC activateTerminalCommand；只是准备步骤标semantic，成功后selectActivationState=active且store绑定相符，才开始真实店员登录。
R-17需要受管DEV（真实激活与store-basic启动读取），但本批无后端更改与新seed。DEV输入不足时是明确prerequisite，不改App跳过。详见§10b。
mobile虚拟机：同一agentCapabilities脚本完整覆盖R-02～13适用单屏能力、真实虚拟键盘、single-screen业务normal（age空/37）、reject-retry、abandon；不执行不合法dual-only withdraw/render-smoke。hand-back 与 keyboard-alpha-probe 明确属 R-16 的 HANDOFF 待重写空窗，不用模糊“返回”替代。双屏R-17仍在支持Presentation的Android虚拟机完成；若当前VM不支持第二display，报告F-1硬前提未满足，不能宣布全部设备通过。
双机F-2两VM只测两连接身份及独立断开；不扩成另一套双机业务专项。sample-wallpaper App装配/关闭/查询能力要证明，但不重建其已撤回的整套冻结业务旅途。

### 4.5 CP-05：新 testID

唯一 `createTestId(moduleName,part,element?,key?)`，四段各校验；key用encodeURIComponent保持可逆且不含分隔冒充，禁止surface段。输入ID含身份证/phone的动态key不用姓名/电话，采用已有稳定业务ref；协议原样返回，落盘遮蔽。
每包 `*TestIds.ts` 为常量唯一源；派生内部元素也调用构造函数，不能`${testID}:busy`旁路。props收到外部ID后若要派生，使用构造函数的同形结构输入，而非从字符串split猜module/part。
附件145文件逐项：生产JSX实际动作、nativeSlots内部、常量/派生、测试消费各定位全同步；旧现行文档/README/memory引用同步，历史review/evidence不回改。
品牌类型由 primitives 唯一定义并导出：TestId = string & {readonly [testIdBrand]: true}，testIdBrand 是不可导出的 unique symbol；只有 createTestId 构造文件校验后作品牌断言。所有项目拥有的 testID/testId props、常量、转发组件、registry 入参都用 TestId。nativeSlots 的 Rnr* Props 用 Omit<NativeProps,"testID"> 加 {testID?:TestId} 收窄第三方 string；直接 native/DOM 节点也必须传品牌值；RN 自带 testID:string 不受项目 props 收窄保护，所以由下述属性定点类型门补齐。不修改第三方声明、不加布局 View。
现有 typecheck 检查跨组件品牌 props 的传递；字面量、模板拼接、旧 string 常量传给这些 props 必须编译失败。既有窄 AST 门额外遍历 TER 生产 TSX 中每个 JSX testID/testId 属性，在该属性处用 checker 取实际表达式类型（含直接字符串属性），不可赋给 primitives 唯一 TestId 即报红；不按组件标签豁免。未提供属性不检查，存在属性但值未收窄的 TestId | undefined 不能绕过，应先条件分支省略属性或收窄。门同时禁止构造文件之外的 TestId 断言（含别名/尖括号），并拒绝定点 any/unknown 绕过。此门只做单点类型查询，不做跨组件流分析。附件现有639属性位置中55个直接View/Text/Pressable/Animated.View、12个文件均纳入；实施时重扫新增属性。测试消费者导入同一常量；红夹具在隔离仓内 fixture，先证明正常构造/转发可编译，再证明 literal/derived/旧 string 传给品牌 prop 必须编译失败，as TestId 单独使窄门报红。新增 `<View testID="x">` 红夹具：RN 类型自身允许它，属性定点门必须拒绝；品牌值传直接 View 的绿例必须通过，不能把该红例误称为 RN 编译失败。错module由构造器参数/owner测试证明；跨surface相同ID合法，只有同scope重复活动节点报AMBIGUOUS_NODE，不能用门禁止合法跨屏复用。V-14 接入既有 typecheck/skeleton 流程。
新ID两端focused旅途通过才准退役旧runner。RECALL R-14、完整inventory、TR-16、原sample行为。不许兼容旧别名、只改测试不改真实节点。

### 4.6 CP-06：skill、规范与退役最后执行

完成 `cs-terminal-automation`（草案附件），更新TR-08精确例外、§4-C/T-12、platform-ports README、production禁用词；不修改其余TR-08豁免。ter-failure偏差只登记HANDOFF，不顺带扩张/修复失败注入产品能力。
F-4等先完成；CP-05新ID两端通过后，按§9a.1最后删除旧runner、独占helpers及ter-vk mounts。非R-17回归空窗明确登记HANDOFF，不能假装driver接口就已覆盖所有旧场景。
R-18/V-18 按 Dexter 裁决：fresh agent 只读新 skill，在只读报告给出完整旅途文件全文和完整命令行（含两端参数）；主 agent 仅逐字转录并按原命令执行，不改变任何一个字符，不补 import/参数/断言/操作步骤。必要修改任意字符即记为 skill 缺口，先修订 skill，再换一个新的 fresh agent 从 skill 重来；不得由主 agent 调整旅途或沿用原 agent 草案充数。执行结果交回同一 fresh agent 只读核对，记录报告与转录文件内容相等、命令相等及其结果核对。测试仍须 selector订阅+command跟踪+realclick，W→M 与 cleanup。该裁决不豁免 main 唯一写入；本轮均 NOT_RUN。
删后focused复验App启动、无ter-vk导入、各remaining checker可读取输入，所有引用不存在文件报红。已MATCHED且内容未变的CP不重开；受改删除装配路径做本CP与后续全批6b。

## 5 · operation / path / face / 集合形态

无新增HTTP operation/consumer face；CBS/TDS/TDC协议不改。自动化固定JSON方法见CP-01，集合是当前已挂载节点/当前模块descriptors/当前订阅，不是业务分页数据。控制查询最多返回一条完整message；超1MiB明确失败，不假装全量。

## 6 · 跨 owner 写矩阵

| 意图 | 入口 | 目标owner | 成功/失败 |
|---|---|---|---|
| 脚本业务command | agent→Runtime.dispatchCommand | 现有actor/topology路由 | 现有结果/拒绝；agent无slice直写 |
| selector求值 | agent→Runtime.evaluateSelector | selector所属模块 | 当前值/明确JSON或参数错误；无状态副本 |
| 语义控件动作 | registry act→原控件回调 | 既有feature command | 标semantic；缺回调/disabled拒绝 |
| 真输入 | driver→Playwright/ADB | 原DOM/native事件→原owner | 标real；必须收到实际目标事件，不能软件回调冒充 |

生产自动化能力不新增数据库或跨schema事务；CP-04 fixture通过共享operations HTTP能力调用CBS owner准备/取消，仍属于现有授权与事务，不由driver直接写数据库。

## 7 · 声明—传递—消费矩阵

| fact/机制 | 声明 | 传递 | 消费/proof |
|---|---|---|---|
| 开关/地址 | package.json | assembly readonly input | agent启动与admin行同值；V-02/04 |
| state selector | module root + defineStateSelector | selectorDefinitions→descriptor | Runtime求值；gate分母；V-05/06 |
| command身份 | requestId/runtime journal | session/message/request关联 | late actor events与dispatch结果；V-07 |
| surface/坐标 | render上下文/currentdisplay事实 | primitives sink + driverdisplay映射 | F-1真实点击；V-08/09 |
| 授权执行点 | 固定开关+driver校验token/可信wss | hello→welcome | unauthorized不下指令；不声称保护终端权限 |
| 缓存失效 | layoutRevision/sessionId | 操作携身份/revision | 拒绝stale，不重放业务动作 |
| 错误映射 | AUTH/PROTOCOL/NODE/SELECTOR/TRACKING/RESOURCE codes | 明确响应；业务错误用已有typed key | report metadata；无raw异常/secret |
| 日志与脱敏 | AGENTS敏感项 | 落盘白名单及截图mask | secret sentinel red；截图未能mask则不落原图，记SCREENSHOT_REDACTION_FAILED |

## 8 · 业务规则 → owner 判定点

R-01～04：assembly/agent session；R-05～07：Runtime selector/dispatcher与agent session observer；R-08～11：primitives/render registry与driver input/display adapter；R-12：protocol闭集；R-13：driver managedRun/journey；R-14：primitives构造器+静态gate；R-15：terminal规范/禁用词；R-16：退役清单；R-17：sampleConsole旅途；R-18：skill与主agent执行验证；R-19/20：两个包依赖/内部流/官方依据。无空号。

## 9 · owner API 与消费者清单

| API | 消费者（待实现路径） |
|---|---|
| defineStateSelector/selectorDefinitions | 附件11个所属RuntimeModule包及新增公开selector |
| Runtime.evaluateSelector/descriptors/journal/dispatchCommand | `ui/base/automation-agent/src/application/createAutomationAgentModule.ts` |
| AutomationRegistrationProvider/useAutomationNode | 附件全部实际primitive、非primitive节点；render/assembly注入 |
| createTestId | TER各包唯一常量与内部derived节点 |
| driver selector/command/controls/bounds/input/requests.observeUiAction/fixtures.ensureActivated | `tools/terminal-automation/journeys/*.test.ts`、skill小旅途 |

每个API有生产消费者；不增加无人调用的platform getter或按slice读取接口。

## 9a · 实施前全链同步变更清单

| 事实 | 契约/生成输入 | owner/实现 | 测试/fixture | 处置 |
|---|---|---|---|---|
| selector身份 | Runtime types/module、附件root exports；terminal-invariants | 附件每个模块定义/工厂，Runtime registry | selector gate/self-test，全部selector参数/JSONfocused | 同步；无OpenAPI生成 |
| 控件事实/ID | primitives接缝/testID构造器 | 附件145个文件与639 JSX位置、render/input/admin/dev-host/application | packagefocused/新driver/所有旧ID消费者 | 同步；不得只更外框 |
| 配置输入 | 四sample integration/application package.json | assembly/platformPorts/test-expo/App与admin context | 开关build、F-4、wrongtoken/wss | 同步；不改server-config |
| 控制协议 | agent protocol唯一schema | agent/driver共享protocol subpath | invalidJSON/version/body/late tests | 同源；无TDP生成修改 |
| runner身份/生命周期 | managedRun manifest、资源profile/run根 | 新driver与旧身份helpers迁移；§9a.1九处登记/helper同步 | failure+cleanup red；资源门拒绝未知/错误kind | 同步；不改后端DEV拓扑 |
| 激活operations fixture | TDC acceptance私有五函数/常量 | 抽取 acceptance/operationsFixture.ts；devScenarios.test.ts、新driver各消费 | TDC共享helper focused、acceptance typecheck；driver seed-key选取/遗留binding身份红例 | 实施允许改TDC acceptance，本轮只设计，不复制 |
| DEV readback（跨 owner） | scripts/dev/r5-dev-runner.mjs 的 readManagedTerminalBindingByName / parseManagedTerminalBindingReadback；r5-dev-runner.d.mts | CP-04 扩展 SQL projection 的 bound_device_id/store_ref、parse 的形状/唯一性/身份校验与 .d.mts 两函数返回声明；取消仍走 HTTP owner | owned parser focused 红例：字段缺失/非法、重复或错 terminal/store/device、DEV manifest身份错；bound_device_id 只内存比对，落盘仅匹配结果，不写原值 | 未来实施授权单独点名；本轮仅设计，不改 DEV 源码/拓扑 |
| 规范/旧入口 | R-15/16、scripts README/package scripts/HANDOFF | CP-06 | 失效引用/production禁用词red、skillproof | 最后退役；历史证据保留 |

### 9a.1 旧 runner 完整当前分类与场景迁移

当前静态清单如下；附件 `runnerInventory` 保留11份入口/编排/contract源码，并增加9处登记点/helper（共20条分类记录，不称20个runner）的 SHA、用途与处置。判别式同时覆盖 import/require/动态导入旧入口的模块，以及按路径字符串登记入口的 package scripts、检查器、format/health catalog、资源profile、memory/sourceRefs、README；命中后按语义决定迁移/同步/删除，不按run字样删除。Web contract 的13种命名场景、sample1的7种case及age取值、sample2的pending/confirmed/restart、双机stage1/2、冷启动失败分支均已列入；keyboard action CLI不冒充业务scenario catalog。实施前按同判别式重扫新增入口，每个入口退出前将当前case逐条标迁移或HANDOFF空窗，不能仅删文件，也不把生命周期action的存在算业务覆盖。

| 当前入口/族 | 实际覆盖/形态 | 处置与替代 | 回归空窗 |
|---|---|---|---|
| `scripts/test/ter-virtual-keyboard-android.mjs` + test | 两App键盘输入、焦点、移动/双屏几何与设备动作 | 身份、build/install/launch、display ID迁driver；删除ter-vk专用harness与mounts | 首旅途键盘覆盖，其余专用用例登记待重写 |
| `ter-admin-display-web.mjs`、`-contract.mjs`、`-stage.mjs` + test | admin、配置、激活/角色、会员/壁纸Web场景 | 迁fixture/admission/failure discipline；不带dump/旧locators；删入口 | 非R-17专项场景待重写 |
| `ter-admin-display-android.mjs` | 对应Android管理/屏幕行为 | 迁设备身份与受管动作；删除 | 专項完整UI矩阵待重写 |
| `ter-persist-kv-prechange-android.mjs` + test | 两App重启、持久化marker/TR-04 | 迁build/设备能力；删除 | TR-04完整重启持久化证明明确无自动回归，不用R-03重连替代 |
| `tools/terminal-topology/run-dual-device.mjs`、`android/NoIdleUiDump.java` | 双机会员、拓扑切换、屏幕动作 | 删除UI入口/dump；身份/进程/bounds相关通用helper迁移或复用 | 完整双机业务待重写；本期仅F-2两连接 |
| `tools/terminal-sample2/run-sample1-frozen-journey.mjs` | 双屏5cases+age；mobile hand-back/keyboard probe | 双屏首旅途重建；delete最后执行 | 单屏原特有cases未重建者登记 |
| `run-sample2-frozen-journey.mjs` | wallpaper确认/取消/投影 | 删除 | 非首旅途业务待重写 |
| `run-a9-runtime.mjs`、`run-u8-release-cold-start.mjs` | runtime/发布冷启动设备UI | 删除 | 对应原生完整启动证明待重写 |
| `tools/terminal-sample2/check-behavior.mjs`、`check-u8-focused.mjs` | 运行package focused tests及red mutation，源码中不驱动UI设备 | **保留检查器**，更新受影响ID/文件引用 | 无，不能按run字样误删 |
| `scripts/test/terminal-topology-{device-identity,heartbeat-window,runner-guards}.test.mjs` | 独占helper/runner guards | 必需通用能力迁driver Vitest测试后删旧测试；非独占能力随使用方判断 | 不遗漏negative ownership proof |
| `tools/terminal-topology/{android-ui-prompts,member-form-submit,member-journey-admission,journey-acceptance,role-occupancy-probe,tcp-bridge,heartbeat-window,device-identity,process-identity}.mjs` | 原双机专用实现及身份/桥/时间工具 | 实施扫全仓imports；仍被非UI入口消费的共享helper保留或明确迁移。独占UI helper删除，必要生命周期能力改为新driver模块 | 新身份/cleanup tests保持，不以整目录rm代替判别 |
| 两App `controlledKeyboardHarness.tsx`、`App.tsx` mount | ter-vk特定UI注入 | 删除harness/mount/import；正常App启动回归 | 同上 |
| `ter-terminal-interaction-android.mjs` | 当前不存在 | 不为旧专项补造；若在途新增，按判别式纳入最后退役 | 记录当前查无，不推成动态结论 |

| S-5补充登记/helper | 当前事实 | 实施处置 |
|---|---|---|
| scripts/test/terminal-business-fixtures.mjs | 顾客姓名/电话生成；旧Web/keyboard消费者 | MIGRATE：CP-04准备阶段迁 tools/terminal-automation/fixtures/member.ts，首次顾客输入前由新driver消费；CP-06删独占旧helper/tests引用，敏感值只内存使用 |
| tools/terminal-sample2/wallpaperCatalog.mjs | 旧sample2/keyboard test独占catalog | DELETE：本批无壁纸冻结旅途，删独占helper及旧消费者，不另建catalog |
| scripts/test/test-health-entry-runner.mjs | L62–64登记三份旧runner测试 | SYNC：CP-01登记首批新文件健康入口，后续CP创建时同步新文件；CP-06移除旧测试路径，不保留转发壳 |
| tools/terminal-shared/run-terminal-format.mjs | L58–68/L94列旧runner | SYNC：CP-01登记新tools TS/test/config，后续CP创建时登记新增文件及共享operationsFixture；CP-06删旧路径 |
| scripts/env/check-runtime-resource-budget | 两独立profile、旧TER运行根 | SYNC：CP-01第5步完成driver调用ter-validation-with-dev、DEV侧新根/精确kind登记和红例，见§9a.2；CP-06仅删除旧根豁免 |
| tools/terminal-sample2/check-production-bundle.mjs | L16旧run-u8与automation禁词 | KEEP/SYNC：保留门，删除退役入口禁词；按R-15精确放行，不扩大其他调试豁免 |
| project-memory/required-inventory.json | 旧测试/sourceRefs登记 | SYNC（实施期）：随真实memory源头改sourceRefs/assertions，不能只删索引藏漂移 |
| project-memory/index.json（及index.md） | 自动导航含旧路径 | REBUILD（实施期）：先同步原文和required-inventory，再用既有build-index及--check，本轮不生成 |
| project-memory/operations/test-closed-loop.md、scripts/README.md | sourceRefs/旧入口与拓扑说明 | SYNC（实施期）：换成新driver真实能力及空窗；保留TDC/backend语义，不声称全旧场景迁移 |

上述9处对应附件20条分类记录的9个新增项；最后一项联合两份源文件，附件分别保存哈希。均为设计处置，不代表已迁移/删除。

保留：`terminal-client-dev-acceptance.mjs`、`terminal-ws-wire-client.mjs`、managed-run-summary、terminal-skeleton、check-production-bundle 等非TER UI driver。核对新目录只有新driver，不保留旧runner别名/转发壳。

### 9a.2 资源与日志

资源准入在 CP-01 第5步、首次 F 动态之前完成；health/format 随文件创建登记，不延后至 CP-06。顾客 fixture 在 CP-04 准备完成；CP-06 对这组事项只做旧根豁免、旧入口和旧 helper 的最终删除。
run manifest记录source输入、设备serial/boot/build/app/version、display映射、OS进程PID/start token、host/boot/start ticks（若涉及远端DEV只消费其受管manifest）、WS listener/reverse/browser/安装拥有者、阶段/日志路径、业务与cleanup。
新driver运行根固定 .runtime/terminal-automation/<runId>/run-manifest.json，kind=terminal-automation-run-manifest；仓根realpath约束与runId校验后创建。任何driver/Expo/browser/ADB长运行启动前调用既有 scripts/env/check-runtime-resource-budget --profile ter-validation-with-dev <仓根>/.runtime：该profile仅豁免精确r5/run-manifest.json且kind=r5-dev-run-manifest的DEV，不豁免未知R5或历史driver存活tree。DEV侧现用admin-validation-with-ter增登记新根；新增豁免须同时核对该根/kind和PID/startToken，不按目录字符串放行其他manifest或alias。旧根豁免在旧runner退役后清除；外部不归属资源依然拒绝。资源门4GiB是现有profile值，不替代下述driver自身2GiB预算；driver运行中在manifest/heartbeat按实际owned tree采样并执行自身预算，不在启动后重复调用会拒绝自身live tree的preflight。红例包括错kind、外根/alias、旧driver仍live、stale startToken、超过自身预算。
启动前只按明确owner预检，未知资源拒绝，不按端口kill。本机driver+Expo初始RSS预算2GiB合计（不把已有DEV Java算成本机）；每run最多两个AndroidVM、一个browser、一个active业务旅途；已有VM若不是本run拥有只借用指定设备，结束不杀VM。超预算拒绝并报告，不追加并行。
build/install到独立受管snapshot，仓根内路径/realpath校验；不在包运行期间改package.json。已有App不能随意覆盖/uninstall：需要在manifest记录允许的测试App原始状态与替换策略，无法恢复则fail closed。reverse创建前list，冲突不覆写，cleanup仅remove自己建立的映射。截图写入前按节点bounds/host地址+敏感可视字段遮蔽；mask失败保留原因metadata而不落raw图。
失败即冻结业务动作，保留first failure/last known good/broken boundary；cleanup仍运行且单列。debug screenshot不是业务成功。不得用延长timeout/sleep/重跑掩盖失败；同失败族二次按实施模板处置。

## 9b · 变更定位

实施以唯一锚点写入：RuntimeModule/RuntimeModuleDescriptor、Runtime类型、createRuntime context、createRuntimeJournal.subscribe、createCommandDispatcher dispatch；SurfaceRoot/SurfaceHostController；每个实际Primitive定义；两RuntimeSection facts；四packageJson装配；附件source文件符号。行号仅定位本设计快照，写入前重新确认锚点唯一。

## 10 · 数据迁移

N/A：不新增业务slice、数据库或持久化模型。automation session/controls/subscriptions都是会话内资源，断线销毁；不把UI registry存进Redux/持久化。testID变更是工具标识替换，没有旧ID兼容层。

## 10b · seed 数据与验收 fixture

### 10b.1 受影响seed全集

N/A（业务形状未改）：既有 `scripts/dev/seed` 的 r5-full输入不随selector/ID变更。不得借测试新建集团/门店产品规则或改seed。
### 10b.2 新/旧功能

新能力无seed事实；既有业务fixture只为激活准备，成员样例数据本地生成。不能用seed账户/直接slice替代CBS owner授权。
### 10b.3 覆盖判据

driver 按 seed key 从唯一契约读取合法8位activationCode（只在内存），经同空间 CBS 列表/详情与 managed readback 确认 storeRef/terminalRef，再使用本机 deviceId；TDC返回binding并经selector确认与fixture一致。错误空间/失效code给明确拒绝，不能从HTTP200推active。
### 10b.4 同步项与共享位置

实施期从 TDC acceptance 抽取 `apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts`，owner 仍是 TDC acceptance，不进入生产 src/public API。导出 Node 可用的 `createOperationsFixtureClient(input)`；input 显式含 httpBaseUrl、workspaceKey、storeCode、loginName/password 与 fixture 列表。不读 Vitest/全局环境，不 import .test.ts，不复制 HTTP 业务链。五个私有函数 operationsSession、operationsTerminalByRef、operationsTerminal、cancelByOperations、prepareFixture 与 L58–63 常量改为显式输入；原有 httpJson/dispatcher 按抽取所需最小边界共享，既有 transport 测试仍消费同一 HTTP 实现，不另造登录/取消请求。
消费者：原 `acceptance/devScenarios.test.ts` 保留自己的五槽位和场景输入；新 `tools/terminal-automation/fixtures/terminalActivation.ts` 消费同一 helper。driver 直接消费工具用 acceptance helper 源码，由 workspace/Vitest 配置与直接依赖声明支持，不依赖隐式hoist、不增加生产export。
driver 终端唯一来源为 doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json 的 stableFixtures.organization.storeTerminals；固定 shape→seedKey：dual=term-front（laptop），mobile=term-handheld（mobile），两者属于 store-operating。仓根/realpath 校验后按 key 唯一选取，核对 ENABLED、deviceType、store 与8位 activationCode；门店 code/空间从同契约相关条目与受管 DEV 输入核验，terminalRef/storeRef 经 CBS 列表/详情与受管 readback 权威解析。受管 JSON 不存 activationCode，不自行指定另一套终端数据；manifest 仅记录 seedKey、terminalRef、storeRef、本机 deviceId、相关 generation/intent/DEV身份与契约 hash 等非秘密身份，账号/激活码/password/cookie 仅内存。与 TDC acceptance 共享 seed 终端，不再要求不重合；靠同一时间仅一个受管运行防争用，禁止与 TDC acceptance 并行。不新增终端、不改 seed，缺数据/身份不符即 PREREQUISITE_BLOCKED。
共享 prepareFixture 显式接受ACTIVE处置参数：原acceptance维持其已授权语义；driver采用REQUIRE_INACTIVE，不调用无条件cancel。当前共享函数尚不存在，实施才抽取（Dexter已裁定可纳入未来实施范围，本轮无实施授权）。
上次driver崩溃留下ACTIVE时，仅凭新driver仓内受管manifest回收：同一DEV身份、空间/store/terminal/seedKey、预先记录的activation intent/deviceId，且当前binding读回deviceId相同；若有原generation记录还须匹配。缺manifest、deviceId缺失/不匹配均拒绝。以当前读回generation调用既有cancel CAS并权威readback为INACTIVE，才允许新激活。不假称CBS取消已清除终端本地凭证；本run TDC清理仍走其owner command。当前 StoreTerminalBinding.java:4–8 仅含status/activatedAt/generation，HTTP detail不能证明deviceId；不得凭空假定字段存在。复用 scripts/dev/r5-dev-runner.mjs:1054 的 readManagedTerminalBindingByName（现有DEV manifest/boot绑定的远端只读readback），实施期为其既有projection/parse增 bound_device_id 与store_ref，并按解析出的terminalRef/storeRef/空间核对唯一行；bound_device_id 只用于内存中的 run 身份相等核验，不将读回原值落 manifest、日志或报告；只落匹配布尔值/受控原因码。本机 deviceId 仍按上述非秘密身份规则记入 manifest。store_ref 用于 scope 核验，不改CBS产品API，无PG tunnel。取消仍由共享operations HTTP owner完成，SQL只读不替代业务授权/写入。该跨 owner helper 的 SQL projection、parse 校验、r5-dev-runner.d.mts 声明及 parser 红例一并列入CP-04（错deviceId/store/manifest拒绝）；目前新增projection未实现，不能执行或宣称PASS。
driver 提供普通 Promise helper fixtures.ensureActivated({shape})，仅显式调用才执行上述准备：共用 operationsFixture、REQUIRE_INACTIVE 与受管身份 readback，通过现有 TDC activateTerminalCommand 激活并等待 selectActivationStatusView.activation.status=active、currentPeerValue=true 与 store 绑定符合 fixture。失败即停止；返回 {seedKey,terminalRef,storeRef,deviceId} 非秘密身份，未运行不宣称成功。用于 R-17/R-18 业务旅途，不在纯连接/几何 proof 中隐式激活；不绕过产品 UI 或写 slice，准备标 semantic，业务点击仍 real。
TDC focused验证：新增 `acceptance/operationsFixture.test.ts` 在该owner配置中检查登录/PROJECT/STORE选择、按key解析/形状核验、REQUIRE_INACTIVE及本driver身份回收、typed状态/取消readback及失败；原devScenarios owned typecheck/lint检验共享消费；当前acceptance.vitest.config.ts已include acceptance/**/*.test.ts，focused命令显式选择operationsFixture.test.ts而非整个acceptance集；driver真实激活覆盖相同HTTP链。只补受影响focused证明，不要求重跑未受影响E1～E5整旅途。若既有配置不发现该测试，CP-04同步显式include；文件存在不是执行证明。

### 10b.5 边界

本轮设计不执行任何DEV/seed。实施默认消费已获授权的受管DEV与合法现有fixture；不会自动reset或seed。没有合法数据则标PREREQUISITE_BLOCKED交Dexter授权。
### 10b.6 父流程与准入

角色与操作人：运营账号 r5-account-multi-role，密码仅从 V2S_SEED_OPERATIONS_DEFAULT_PASSWORD 读入，不写值；必须通过真实session候选选择唯一PROJECT角色、STORE数据节点（现有空间aurora/门店S-OP），核对终端管理查询/取消的现有权限和返回，不从seed名称推定权限。现场TER admin沿用本机既有认证，sample店员仍来自sample owner本地常量。
环境输入采用现有 V2S_TERMINAL_DEV_HTTP_BASE_URL、V2S_TERMINAL_DEV_MANIFEST、V2S_TERMINAL_DEV_MANAGED_DEV_RUN_ID、V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL；新driver的runId/shape等非秘密受管JSON作为本run输入，seedKey固定由shape映射，激活码只从上述seed契约内存读取，不复制旧acceptance runId。缺密码/角色/合法seed条目/manifest/readiness均停止准备，不运行后续业务；日志仅受控原因码，账号/凭证/激活码不落盘。
真实激活fixture是相应CP内focused proof准备；每个CP第一次dynamic前fresh独立做需求、详设/IA、记忆规范三维静态对账，不是CP退出MATCHED；同CP后续运行只对影响字节补差量。最终R-17/R-18统一受全CP/6b与UI/testID复核约束。
若实际需要reset/seed/L2：必须另获明确授权，并执行模板动态前整体准入（全部CP、6b、适用§3a、当前字节完整seed dry-run）；不能因本计划列出DEV就推导破坏性数据授权。

## 11 · 验收场景设计

执行面定义：F=owned focused/红例；W=integration Expo Web；D=Android单机双屏VM/application；M=Android mobile单屏VM/application；P=两VM小型连接proof。不再用字母A同时指阶段与设备。
所有运行当前NOT_RUN；official源码/静态inventory不是运行PASS。每场景都有build/run身份、业务断言和cleanup；拒绝/失败场景是预期业务判据，但运行工具自身失败仍须FAIL。

### 11a · 验收判据逐条映射

| 需求判据 | 场景id/业务断言 | 档位 | cleanup |
|---|---|---|---|
| V-01/R-01 | agent.package-boundary：三标识、graph、port无新增、零反向deps | F | 临时red fixture恢复 |
| V-02/R-02 | agent.build-toggle：关不连接不注册不测量；开全部能力；两App production/debug | F,W,D,M | build/Expo/App/reverse |
| V-03/R-03 | agent.session-lifecycle：重启/reload runtime变化，断网不变；complete/error恢复，dispose不恢复；两连接独立；远端无ADB仅agent能力 | W,D,M,P | 所有session/listener/reverse释放 |
| V-04/R-04 | agent.connection-admission：坏token拒、remote ws拒、wss证书验证；admin同源；无token落盘 | F,W,D,M | 日志/截图脱敏；连接清理 |
| V-05/R-05 | agent.selector-inventory：全root签名登记，纯helper不登；漏/多登记red；undefined/非法参数显错 | F | red mutation恢复 |
| V-06/R-06 | agent.selector-stream：初值NON_JSON保持订阅→合法JSON→NON_JSON，去重/trailing、显式解除、抛错/超预算/断线终止；无getState/slice string | F,W,D,M | subscription清零 |
| V-07/R-07 | agent.command-observation：public/internal、同步拒绝与完成；mixed actors；timeout后late完成/error；有限期；连接不断 | F,W,D,M | observer到期/会话销毁；不重执行 |
| V-08/R-08 | agent.node-lifecycle：附件各tag方案、同ID跨surface、mount/change/unmount、事件坐标、gone拒绝 | F,W,D,M | registry对应卸载清零 |
| V-09/R-09 | agent.coordinates：F-1两屏四角中心、scroll、scale/offset；display双ID正确 | W,D（M单屏补充） | 输入与测量session清理 |
| V-10/R-10 | agent.input-modes：real/semantic明确；禁用不触发；缺callback拒；Webscope定位 | W,D,M | 无后续失败业务操作 |
| V-11/R-11 | agent.control-stream：出现/消失/字段/press变化；运行info逐来源 | F,W,D,M | nodes/订阅释放 |
| V-12/R-12 | agent.protocol-closed：eval/未知方法/表达式消息全部拒绝 | F | 无副作用 |
| V-13/R-13 | agent.managed-journey：同一脚本/无sleep；首败可诊断；RSS/identity/cleanup负例 | F,W,D,M | business与cleanup分别PASS才完成 |
| V-14/R-14 | agent.testid-constructor：完整inventory迁移；品牌TestId props、正常转发通过，literal/derived/旧string编译失败，非法cast窄门红；全生产TSX属性定点类型查询，直接 `<View testID="x">` 门红/品牌值绿；新ID旅途 | F,W,D,M | mutation恢复 |
| V-15/R-15 | agent.standard-alignment：TR-08仅例外、T12/README/production禁词、failure偏差登记 | F+静态 | 不修改其他debug权限 |
| V-16/R-16 | agent.runner-retirement：所有判定入口/独占helper/harness/refs清零，保留checker/protocol入口；旧case空窗登记 | F+静态,W,D,M启动focused | 不删除历史evidence；无旧进程残留 |
| V-17/R-17 | sample.member-journey：normal age空/37、reject-retry、abandon、withdraw、render-smoke逐三类断言 | W,D；mobile适用子场景另列 | fixture业务cleanup+driver cleanup |
| V-18/R-18 | agent.skill-journey：fresh仅读skill报告完整全文/命令；main逐字转录执行；任一字符变更记skill缺口并换fresh；结果同一fresh核对 | W,M | 两端受管cleanup |
| V-19/R-19 | agent.rxjs-lifecycle：各流使用RxJS且无公共Observable/跨层依赖；late/complete/dispose/trailing | F,W,D,M | 订阅清零 |
| V-20/R-20 | agent.dependency-usage：直接依赖锁版本/API实际调用；adbkit reverse与多display补齐；Zod坏协议拒；F4像素反例 | F,W,D,M | red fixture/受管input资源回收 |

运行清单按以上对应条件，不将D/P专属要求降成M。所谓mobile完成不是伪造第二屏；不能因VM缺第二display就删V-09/V-17。

## 12 · 未决项与开放证据

| 项目 | 当前状态 | 最小闭合方式 |
|---|---|---|
| 新UI位置/文案线框 | UNSET | Dexter确认本包两屏；无新产品机制待选 |
| RN Fabric/Presentation坐标、VM双display | UNVERIFIED | CP-01官方实际路径+F-1，失败停并报告，不猜 |
| 配对服务/activation fixture当前变化 | SOURCE_RECHECK_REQUIRED | CP-04重开届时assembly/fixture实现，真实owner输入与权限确认 |
| RxJS/adbkit等新包实际解析、tag API | NOT_RESOLVED/部分官方读取OPEN | CP写入前安装获授权后绑定实际版本与对应tag，focused验证 |
| F-4性能/bundle | NOT_RUN | CP-03预算实测；超限先根因优化，改上限回Dexter |
| R-18 逐字转录验收 | DECIDED / NOT_RUN | §4.6 已按 Dexter 指定规则，实施期由新 fresh 出全文/命令，main 逐字转录，结果交同一 fresh 核对 |
| 需求 D-1/§8 设计开始时间源头同步 | OPEN / NOT_AUTHORIZED | §0 登记当前授权；本轮不改需求正本，下次获授权同步 |
| 内部DESIGN审查 | PENDING | 新cycle独立静态审查；工具容量失败不伪造verdict，交外部review说明 |

## 13 · 停机条件

不变量冲突、前提与源码不符、API官方版本依据不足、F闸失败不能最小修复、需动FORBID时按实施模板报告原文/两种理解/建议。普通授权内失败先诊断修复再focused，不结束任务。未知资源不可清理；cleanup非PASS不可交付。

## 13b · 实施节奏与三维对账

每点写前/证明后双读同组原始需求、详设/IA、记忆规范与owning source。CP完整focused proof之后fresh独立对整个CP做三维对账；MATCHED才下一CP，不为每个文件开新对账。每个 CP 第一次动态运行前，fresh 独立做需求、详设/IA、记忆规范三维静态对账；这不是 CP 退出 MATCHED。同一 CP 后续运行不重复，除非字节变化影响已对账范围，此时只补差量。全CP结束另做全批6b，不能汇总CP结论代替。已MATCHED未变化范围不重复；局部修复仅复核影响CP/6b差量。

## 13c · 逐代码与详设对账

最终交付前fresh只读reviewer逐新增/修改/删除代码、测试、依赖、脚本、生成/配置/规范对应详设条款、调用者、失败路径、真实proof边界，结论MATCHED/OPEN。零消费者/未经设计的机制/静态当动态/历史冒当前都OPEN。找不到设计判据记DESIGN_GAPS交回设计侧。

## 14 · 交付前自查

完整需求V-01～20映射已列；当前生产源只读、新docs为提案。无实现或动态授权。本设计的资源/性能值是有依据的初始验收预算，不是现有运行事实。待外部review、UI确认及实施授权；最终交付必须有新driver、旧runner退役、技能、全范围current-byte证明及cleanup闭包。
