# TER Admin console 非登录区实施计划

```text
PLAN_STATUS=IMPLEMENTATION_IN_PROGRESS_CURRENT_APK_R66_FIRST_BATCH_R64_R65_SECOND_BATCH_MECHANICAL_PASS_IA13_VISUAL_MATCHED_REMAINDER_OPEN
DESIGN=doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md
IA=doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md;doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION=STATIC_AND_FOCUSED_GREEN_OWNER_EVIDENCE_PARTIAL
ARCHITECTURE_HARD_REQUIREMENT=ADMIN_CONSOLE_LOGIN_AND_NON_LOGIN_USE_NAMED_LAPTOP_MOBILE_UI_WITH_SHARED_HOOKS;NO_COMMON_FORM_ADAPTATION
RUNTIME=R66_FIRST_BATCH_R64_DUAL_R65_MOBILE_CURRENT_APKS_BUSINESS_PASS_CLEANUP_PASS;MECHANICAL_UNION_24_OF_30;FULL_SCREEN_BOUNDS_MATCHED;IA13_VISUAL_MATCHED;REMAINDER_VISUAL_OPEN
WEB_METRO_ANDROID_DEVICE=ANDROID_R66_FIRST_BATCH_R64_DUAL_R65_MOBILE_BUSINESS_PASS_CLEANUP_PASS;WEB_NOT_RUN
INDEPENDENT_DESIGN_REVIEW=COMPLETED_FINDINGS_OPEN_REVIEWED_BY_FRESH_SUBAGENT
ADMISSION_BLOCKERS=DISPLAY_FACTS_OWNER:CLOSED_WITH_OWNER_EVIDENCE;TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER:CLOSED_WITH_OWNER_EVIDENCE;MASTER_UNPAIR_GUARD:CLOSED_WITH_OWNER_EVIDENCE
```

本计划定义实施的可执行顺序、文件分母、测试与对账门。Dexter 已于 2026-09-20 明确授权进入实施；2026-09-21 又明确裁定非登录 Admin console 必须 edge-to-edge 全屏，四周不得出现 shell 外部留白；该裁定与高保真 HTML 的 `.shell { inset: 0 }` 视觉正本一致，外层 shell 几何优先采用该全屏语义，内容内部 padding 仍由 IA 控制。当前 CP-0/CP-1 已取得 owner contract、consumer、focused readback、13 个 owning-boundary red mutation `mutation_rc=1` 与 3 个恢复后 baseline `baseline_rc=0`；fresh 独立 verifier 已在 `doc/evidence/platform/2026-09-22-ter-admin-console-non-login-admission-blocker-closeout-codex.md` 给出 `PASS`（仅限 CP-0/CP-1 owner admission），三条 admission blocker 已正式关闭。当前 APK 的 r66 第一批、r64 dual 与 r65 mobile 均完成两套 integration 的受管 Android run，均 `BUSINESS=PASS`、`CLEANUP=PASS`；r66 第一批机械闭合 16/19，IA-03/05/07 OPEN；r64/r65 第二批计划范围闭合 8/11，IA-04/06/08 与 IA-14 error variant OPEN；r66 两个 profile 的 progress/result 终态一致，IA-13 已由 fresh 独立视觉复核 MATCHED。此前 r19/r20/r16/r30/r43/r44/r47/r48/r49/r50/r51/r63 只作为历史证据保留，不与当前 APK 混写。

Dexter 在本次继续实施时新增并提升为本交付硬要求：admin console 的登录框与认证后的非登录 console 都必须由命名明确的 `Laptop`/`Mobile` 两套 production UI 承担，行为、认证、输入焦点、keyboard、选择/命令等共享逻辑只能放在共享 hook 或 owner；不得保留一个无 form 后缀的 UI renderer，再以 `surfaceForm` 条件把 laptop 改造成 mobile。`parts.ts` 仍按同一语义 `partKey` 注册 laptop/mobile sibling，`rendererKey` 必须是 `${partKey}.${surfaceForm}`；form-specific component 不新增公共 partKey，也不把 form 选择下沉到共享 hook。该要求覆盖 `AdminLayerLaptop/Mobile` 内的登录 UI、shell、panel state、navigation、page content、runtime/topology/ports 与 power confirmation；静态结构测试必须能在删除任一 form-specific JSX 或恢复 common renderer 时变红。

当前执行状态：`CP-0=PASS_CURRENT_SOURCE_RECONCILIATION`；`CP-1=OWNER_ADMISSION_CLOSED_WITH_EVIDENCE;IMPLEMENTATION_REVIEW_NO_GO_VISUAL_OPEN`；`CP-2..CP-4=IMPLEMENTED_FOCUSED_GREEN`；`CP-5=R66_FIRST_BATCH_MECHANICAL_16_OF_19_R64_R65_SECOND_BATCH_8_OF_11_IA13_VISUAL_MATCHED_REMAINDER_OPEN`。r66/r64/r65 两套 integration 均 `BUSINESS=PASS`、`CLEANUP=PASS`；三次 current run 的 progress/result terminal snapshot 一致；当前 APK 机械 union 为 24/30，IA-03/04/05/06/07/08 OPEN，IA-14 display-facts-error 另行 OPEN；IA-13 fresh visual 已 MATCHED，其余完整 30 帧逐控件视觉仍 OPEN；三条 admission blocker 已由 owner closeout 记录关闭；fresh implementation review 的历史 `NO-GO,M/S/N=0/2/3` 只说明当时 blocker/视觉未闭合，不升级为当前 visual PASS。

构建历史清理已完成并单独记录于 `doc/evidence/platform/2026-09-22-ter-admin-console-non-login-build-cleanup-codex.md`：保留当前 release APK、r64/r65/r66 动态 evidence，清理两套 app 的 intermediates/debug/native/CMake 生成历史；cleanup 不改变源码、APK SHA 或 30 帧分母。

历史动态运行目录仍包括 `.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage1-single-screen-sample-terminal-r30/`、r19、r20、r16、r36、r42、r43、r44、r47、r48、r49、r50、r51；它们保留原始 SHA 与历史边界，不能代替 current APK 全量证据。当前 sample-terminal APK 为 `bytes=88923471`、SHA-256 `98b83be6d1dd68069c3863230a74876cd54cb46f782ccbdbf60dbd11353a2508`，sample-wallpaper-terminal APK 为 `bytes=89329763`、SHA-256 `ed5d6275c66ac1bf7b0f6ad046f8f3997e12fa277f426a93d6635693249d90c9`；r66 master/slave、r64 dual、r65 mobile 均已 exact installed readback。

当前第二批目录为：`.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-dual-all-r64/` 与 `.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-mobile-all-r65/`。r64/r65 两套 integration 的 `BUSINESS=PASS`、`CLEANUP=PASS`、`FIRST_FAILURE=null`、`BROKEN_BOUNDARY=null`，且 progress/result terminal snapshot 一致；按第二批计划分母实际机械闭合 8/11：IA-02、10、12、14、15、16、17、32；IA-04/06/08 因合法 release 状态条件缺失保持 OPEN，IA-14 display-facts-error 仍 OPEN。

最新 r66 运行时 `adb devices -l` 的 `emulator-5554` 与 `emulator-5556` 均为 single-screen、physical `2560x1600`、density `320`；第一批 current APK exact binding 已通过，机械闭合 16/19，`BUSINESS=PASS`、`CLEANUP=PASS`，`firstFailure=null`、`lastKnownGood=master-unpair-order-and-host-stop`、`brokenBoundary=null`。r64/r65 的 dual/mobile 事实作为第二批 current APK 证据保留；两批计划 union 仍严格为 19+11=30，IA-13 的横向尺寸标签已由 fresh vision review MATCHED，其余机械 MATCHED 仍须经过逐控件视觉对账后才能形成 visual 结论。r66 root/panel bounds 与 r64/r65 的 fresh bounds 均 edge-to-edge。

三条 admission blocker `DISPLAY_FACTS_OWNER`、`TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`、`MASTER_UNPAIR_GUARD` 已在 2026-09-22 owner closeout 中 `CLOSED_WITH_OWNER_EVIDENCE`。fresh Popper visual review 为 `REVIEW_TARGET=IMPLEMENTATION,VERDICT=NO-GO,M/S/N=0/1/3`；fresh Meitner implementation review 为 `REVIEW_TARGET=IMPLEMENTATION,VERDICT=NO-GO,M/S/N=2/2/0`；这些历史视觉/实施 verdict 不关闭当前视觉 OPEN；owner-only closeout verdict 见上述 evidence 文件。

## 1. 目标、范围与不变量

目标是把已确认 IA 变成可由同一 shared admin-shell 承载的三页非登录 console：平台端口、运行状态、双机拓扑；同时在 laptop 和 mobile 形成两套明确的信息优先级，而不是把 laptop 布局换行到手机上。

必须保持：

1. `ui.base.input`、`AdminLayer`、认证、keyboard、power-confirmation 和 feature page 的 owner/生命周期不变；
2. 登录和已认证 console 均采用命名 laptop/mobile UI；共享 hook 只承载行为/事实/命令边界，不承载另一形态的布局 JSX；
3. 内部 catalog/part 兼容结构不因用户页面聚合而删除；`runtime` 与 `display-context` 仅在 user page registry 中合并；
4. shared primitive 只拥有无业务词汇的呈现能力；integration 只拥有 semantic token 的具体值与业务 assembly；
5. ports 以 capability unit 计数，synthetic undeclared unit 不能被吞掉；
6. runtime/display 只消费 display-facts owner；topology 只消费 page availability/snapshot/capability；admin-shell 不读 raw slice；
7. topology mobile 只有不可用 gate；laptop 主机/副机动作集合不同，查询身份不成为用户步骤；
8. current/non-current surface 使用相同可见字段；每屏逻辑画布分辨率、物理像素尺寸和状态按自身来源显示；设备显示区域只用于真实矩形宽高比，不显示数值标签；
9. 所有状态证据分 `static`、`focused`、`Web`、`Android/native/device`、`visual`、`cleanup`，不混写。

## 2. 实施前 admission：CP-0

CP-0 是硬门，顺序不可跳过。

### 2.1 重新打开的正本

主 agent 必须在任何写入前重新读取：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md` §3–§9；
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md` 全文；
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md` §2–§8；
- 本批详设全文，尤其 §4、§5、§7、§9a、§13；
- `doc/platform/terminal-coding-standard.md` TR-03、TR-06、TR-07、TR-09、TR-10、TR-11、TR-12、TR-13、TR-15；
- `project-memory/decisions/deterministic-context-only.md`、shared admin/primitive/theme、selector subscription、UI visible business language 与 detail reverse-inference 相关命中；
- `apps/terminal/ui/base/admin-shell`、`ui/base/primitives`、`ui/base/render`、`ui/base/console-assembly` 当前源码与 tests；
- 两个 integration 的 assembly、theme、Tailwind、test-expo 入口。

### 2.2 必做只读扫描

用当前字节重新建立分母，不采信旧行号：

```bash
rg -n --glob '*.ts' --glob '*.tsx' 'PrimitiveSelect|PrimitiveDropdownSelect' apps/terminal/ui
rg -n --glob '*.ts' --glob '*.tsx' 'TopologyAdminCapability|queryMasterIdentity|pair\(|getOperationEligibility' apps/terminal
rg -n --glob '*.ts' --glob '*.tsx' 'DisplayInfo|displayCount|SurfaceContextValue|hostLogicalSize' apps/terminal/kernel apps/terminal/ui/base
rg -n 'platformPortCapabilities|describePlatformPortCapabilities|terminal\.admin' apps/terminal/ui/base/admin-shell apps/terminal/ui/base/render apps/terminal/kernel/base/platform-ports
rg -n 'color-(login|surface|action|focus|ok|warn|error|info)' apps/terminal/ui/integration/sample-console apps/terminal/ui/integration/sample-wallpaper-console
rg -n 'color-admin-|sharedColors|createTailwindConfig' apps/terminal/ui/integration/sample-console apps/terminal/ui/integration/sample-wallpaper-console apps/terminal/assembly/base/android/config apps/terminal/assembly/base/android/test apps/terminal/assembly/android/sample-terminal apps/terminal/assembly/android/sample-wallpaper-terminal
```

输出必须回答：旧 `PrimitiveSelect` 是否有生产消费者；旧 query/pair 是否有除 admin section 外的消费者；display facts 是否已有完整 public owner；每个 port/capability 是否能归入五类；每个现有 testID 是结构观察还是动作 locator。

### 2.3 CP-0 停止条件

- CP-0 应核对当前 `DisplayInfo.surfaces[]` 的逐屏 logicalSize/physicalSize/readiness 以及 assembly 已解析的 surfaceDeclarations；不得再把“display facts 只有 displayCount”作为现状。若任一 owner 当前字节不具备其已声明字段，才按 owner 边界记录 `OPEN` 并停止，不从日志或另一块屏补值。
- 如果 topology 没有办法由 owner 提供 `getPageAvailability()` 和 `pairByHost()`，或者旧 query/pair 有未知消费者无法安全调整：`CP-0=OPEN`，不在 admin-shell 自行重算或造 command。
- 如果 MASTER unpair 仍以 `masterLocator` 而不是 typed `paired` 作为通用前置，或没有验证成功清理 `masterLocator`、`peerIdentity`、`peerReachable` 并 read back：`CP-0=OPEN`，不进入 CP-2。
- 如果五类映射漏掉当前 port，或 feature part 与三页 user registry 的可见边界不清：`CP-0=OPEN`，交 Dexter 决定，不静默删 feature。
- 任一阻断必须报告仓内事实、owner、反例、最小替代和是否改变既有语义；不把阻断改写成“可用但未测试”。

CP-0 关闭条件：源码分母、owner contract、feature 边界、primitive consumer 扫描和 stop condition 全部 `MATCHED`；否则不开始实现。

## 3. CP-1：owner public read model/capability（仅在 CP-0 放行后）

### 3.1 Display facts

若 CP-0 确认必须扩展 public contract，按以下原子组一次完成：

1. 在 display-context owner 定义 `DisplayFactsReadModel`，包含真实 surface 集合、current key、display count、逻辑尺寸、物理尺寸、role、readiness、typed unavailable/malformed 状态；
2. 在 device port/Android adapter 公开能产生这些事实的最小契约；adapter 不能只写 Log；
3. Web/test fixture 提供单屏、双屏、physical unknown、malformed、超过支持范围的 fixture；
4. render context 以稳定 identity 注入，admin-shell 只消费该 read model；
5. 不修改既有 `resolveSecondarySurfaceAvailable` 的物理语义，不让 admin page 依赖它代替 all-surface facts；
6. public-surface/typecheck 和 focused behavior tests 同批更新。

红变异：删掉 secondary surface、复制 primary logical/physical size、用 logical size 代替 physical、在 owner unavailable 时返回默认尺寸、display count=2 却只给一块 surface；每项必须在 focused/public-surface 层变红。

### 3.2 Topology page availability/direct pair

1. 在 `kernel-base-contracts` 定义 `TopologyPageAvailability` 与 reason contract；全局 page gate 由 topology owner 计算，不从 UI operation reason 反推。
2. 在 `createTopologyAdminCapability` 增加 `getPageAvailability()`；它必须处理 mobile、非单屏、capability 缺失和其它全局资格；paired/reachable 仍是 operation/state 事实，不被 gate 吞掉。
3. 增加 `pairByHost({host})`。内部可复用 identity/protocol path，但用户只看到输入 IP、进行中、成功或失败；owner 在命令边界逐项完成 host 规范化、identity 查询、moduleName 匹配、stale identity 拒绝、MASTER/CHIEF 前置、single-pair 占位、locator 构造、`SLAVE`/`VICE` 切换、失败回滚与成功/失败 readback；每项都必须有 focused red mutation。
4. 全仓扫旧 `queryMasterIdentity`/`pair(locator)` 的消费者；有真实消费者则先给出兼容迁移方案，不得删除无审计；无消费者才从 admin-facing public surface 退休。
5. topology focused tests 覆盖 page gate、host/slave action matrix、direct pair、occupied/invalid/timeout/protocol failures、unpair both roles、MASTER 使用 peerIdentity 的解绑、成功清理三项事实、reconnect remains paired。

红变异：UI 以 `getOperationEligibility('pair')` 代替 page gate、重新出现查询按钮、副机显示主机服务、只给主机 unpair、把 unpair guard 改回只查 `masterLocator`、漏清除 `peerIdentity` 或 `peerReachable`、reconnect 回未配对、switch-role 变成按钮；每项必须变红。

### 3.3 CP-1 gate

- 逐代码与详设对账只允许 `MATCHED`/`OPEN`；public owner declaration/transfer/consumer/test 全闭合才进 CP-2。
- fresh 只读子 agent 完成需求+IA+详设+memory 三维对账；本轮已派出 fresh 只读审查，审查回传前 CP-1 保持 `PENDING_REVIEW`，不把 focused 绿升级为整批完成。
- 本轮若没有 implementation authority，不执行 CP-1，只把上述步骤作为计划；当前计划状态保持 `NOT_AUTHORIZED`。

## 4. CP-2：shared primitives 与两个 integration theme

### 4.1 Primitive 变更

实施顺序：

1. `PrimitiveDropdownSelect`：真实 trigger、expanded menu、option press、disabled/busy、稳定 testID；不改变旧 `PrimitiveSelect` 的循环行为。
2. `PrimitiveRatioBar`：多段比例、同一 total、非负值、空总数的 neutral 状态；不计算业务单位。
3. `PrimitiveDisclosure`：controlled expanded，标题/副标题/状态/chevron/pressed；不持 page expansion state。
4. `PrimitiveSurfaceMap`：消费 `SurfaceMapModel`，根据传入 logical ratio 绘制矩形；只显示 owner projection 允许的字段。
5. `PrimitiveIcon` 只扩充 IA 实际使用的通用图标；不把业务 enum/port 名称下沉。
6. 更新 `src/types/types.ts`、component exports、token recipes、README、`terminal-invariants.json` 与 primitive tests；公共面必须原子同步。

红变异：dropdown 仍只循环不展开、ratio bar 按 port 数量而非传入 segments、disclosure 在 primitive 内持业务 state、surface map 固定比例、surface map 自己读取 state、primitive import admin-shell/topology。

### 4.2 Theme

两个 integration 同批补齐 `admin-*` semantic CSS variables 与 Tailwind mapping，并同步 `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors`；值只能在各自 `theme/global.css` 或 Android shared mapping 中出现，base primitives/admin-shell 只使用 semantic class。theme focused/static 需：

- 两包 key 集合相同；
- 两包 CSS var 与 Tailwind mapping 双向一致；
- sample-console 与 sample-wallpaper-console 的已批准主题差异保留；
- 两个 Android app 的 Tailwind config 均能继承 sharedColors；公共 config test 覆盖本批 admin token，删除 sharedColors 映射的红变异必须变红；
- base、admin-shell、primitive 源码无 RGB/hex/fixed app color；
- 状态色复用既有 ok/warn/error/info，不复制第二套 red/green state language。

### 4.3 CP-2 gate

完成 primitive focused tests 后，fresh 只读子 agent 按每个新 public symbol 与 IA-ID 对账。随后完成两个 theme、两个 integration Tailwind、Android sharedColors 和公共 config test 的静态/focused proof，再做一次 CP-2 全组对账；任一 primitive/token/test/README/mapping 漂移均 `OPEN`。

## 5. CP-3：panel frame、page registry、ports 与 runtime

### 5.1 Panel/shell

1. 为 page registry 建稳定 `AdminPageKey`，把内部 raw catalog 映射为三个 user page；不要删除 raw runtime/display parts。
2. `AdminShellFrame` 增加显式 overall status slot；仍由 shell 传入 presentation status，不从 frame 读取 raw state。
3. laptop 保持 header→nav/content row；mobile 改为 header→唯一 dropdown→单列 content；移除 wrap tablist 行为。
4. empty/loading/error 保留 header、close、navigation/selector，不隐藏 topology tab。
5. 结构 testID 集中到 `adminTestIds`；action ID 必须挂在真实 press/input/dropdown node，结构 ID 单独标记。

### 5.2 Ports

1. 新建纯 `buildPortUnits`，实现 descriptor/empty synthetic unit 规则；不改 `describePlatformPortCapabilities` 的 owner 数据。
2. 新建 `buildPortOverview`：summary counts、ratio segments、固定五类、有限 category detail；同一 unit object 贯穿三层。
3. disclosure expansion 由 section 局部 state 持有；切换页面不修改 owner facts；无无限拉长列表。
4. 测试总数守恒、类别守恒、synthetic undeclared、source/reason 保留、category unknown red。

### 5.3 Runtime/display

1. 新建 `projectRuntimeDisplay`，把 runtime facts 与 display facts 转成一个 page model；技术词 `承载几何`、raw enum 不进入用户主文案。
2. 单屏 laptop/mobile 画一块实际 surface；dual laptop 画两块实际 surface；mobile 不伪造 secondary。
3. current/non-current projection 均显示该 surface 自身的逻辑画布分辨率、物理尺寸和 readiness；设备逻辑显示区域只用于矩形比例、不显示数值标签。缺失的画布为“未声明”、缺失的设备事实为“未知”，不得跨屏复制。mobile 若输入事实声称多 surface，复用 IA-14 的 `display-facts-error` 变体，不生成第二块矩形。
4. `PrimitiveSurfaceMap` 使用每块 logical size 的真实 ratio；双屏测试使用不同 ratio，防止固定框假绿。
5. 运行状态整体 status 先于 details；status 同时有 dot/tone 与文字，loading/missing/error 分开。

### 5.4 CP-3 gate

Focused shell harness 必须能注入 catalog/render context/read model/capability，独立覆盖 laptop/mobile；不以 sample integration 单一路径替代 shared shell test。完成后 fresh reviewer 逐 frame 核对详设 §4.6 的 IA-01–IA-29、IA-32 及 page registry/feature 边界；任一 frame 文案、控件、顺序、状态或 selector 关系不匹配为 `OPEN`。

## 6. CP-4：topology page 实施与状态机

### 6.1 页面状态顺序

拓扑组件只按 owner read model/capability 输出以下状态，不把 raw facts 平铺：

1. page unavailable → 单一 gate card；
2. laptop available/unpaired → role choice 两张 action card；
3. host starting/ready/error → 对应 host card；ready 显示本机 IP、等待副机、关闭服务；
4. slave pairing/pair error → 输入保留、进度/失败/重试；不显示 query identity；
5. paired reachable/reconnecting → 维持已配对语义，角色动作不同；
6. unpairing → 原角色 card + busy；成功回 role choice；失败保留事实并显示 typed feedback。

IA frame 对账分母：`IA-16/17` gate，`IA-18` role choice，`IA-19/20/21` host lifecycle，`IA-22/23` pair lifecycle，`IA-24/25/26` master paired lifecycle，`IA-27/28/29` slave paired lifecycle。不要创建 recovery page。

### 6.2 Action matrix

| 状态/角色 | 允许动作 | 必须没有 |
| --- | --- | --- |
| laptop master unpaired | 开启主机服务 | 直接配对、查询身份、switch-role |
| laptop slave/unpaired | 输入 IP、直接配对 | 开启主机服务、查询身份 |
| master paired | 解除配对；按 owner 状态显示 host lifecycle | 目标选择、pair form |
| slave paired | 解除配对 | 主机服务、查询身份 |
| reconnecting | 解除配对仍可见；保留 paired | 回退未配对 |
| mobile | 无 topology action | 所有角色/pair/unpair/host controls |

`switch-role` 即使 evaluator 返回 `allowed` 也不渲染，因为 capability 没有执行方法；这不是 UI 另造权限，而是缺 command 的安全 fail-closed。

`query-host` 归类为 direct-pair 的 internal-only identity/protocol 细节，不生成用户按钮、IA-ID 或独立状态；`pair` 由 `pairByHost` 承接；`enable-host`、`unpair` 保留真实 capability command，`unpair` 必须覆盖 MASTER/SLAVE 两侧。

### 6.3 CP-4 gate

完成 topology focused tests 后，fresh reviewer 逐帧核对状态机、用户文案、角色动作、failure/recovery、local IP、no-query 和 mobile gate。再做全批三维对账，之后才允许整体 focused/typecheck；当前实现授权已存在，相关 focused proof 已完成，但 fresh implementation review 仍待实施完成后执行。

## 7. CP-5：验证与证据计划（当前部分执行）

CP-5 保留历史 r20/r16 的 Android/native run，并保留 r30/r43/r44/r47/r48/r49/r50/r51 第一批与第二批历史运行；后续已按 Dexter 授权用当前 APK 在 r66 single-screen、r64 dual、r65 mobile 完成两批计划范围的可达子集。r66 已完成第一批 current APK exact rebind，r64/r65 已完成第二批 current APK run；IA-03/05/07 仍因 release 状态条件缺失 OPEN，IA-04/06/08 与 IA-14 error variant 也保持 OPEN；IA-13 已经 fresh visual MATCHED；不能把历史 run 冒充当前 APK，也不能把第二批子集扩大为全量 30 帧。下表仍是硬证据分档，未把结构测试、历史产物或截图文件名升级为 visual PASS：

| 档位 | 必须证明 | 不得冒充 |
| --- | --- | --- |
| static | import/owner/token/registry/public surface/禁止词 | 不证明布局运行或视觉 |
| focused | primitive/page projection/state/action/subscription/red mutation | 不证明真实字体/设备/像素 |
| Web | mobile/laptop selector、scroll、dropdown、surface map、topology actions | 不证明 Android native |
| Android/native | 两 integration theme、surface facts、键盘/inset、真实 action | 不证明 release |
| visual | IA 与运行截图/geometry/颜色/文案逐帧对账 | 截图单独不能证明业务状态 |
| cleanup | 受管 process/device/resource 回收与 readback | business PASS 不能替代 cleanup |

CP-5 后续必须继续遵循受管入口、日志/PID/readback、first failure/last known good、business 与 cleanup 分离。r66 first batch、r64 dual 与 r65 mobile 两套 integration 均 `BUSINESS=PASS`、`CLEANUP=PASS`；r66 第一批机械闭合 16/19，IA-03/05/07 因当前 release UI 没有合法状态制造路径保持 `OPEN`；r64/r65 第二批计划范围机械闭合 8/11，IA-04/06/08 同样保持 `OPEN`，IA-14 display-facts-error 变体另行 `OPEN`，IA-13 fresh visual MATCHED。r66/r64/r65 的 terminal `progress.json` 均与 result 的 cleanup 终态一致。不能用结构测试或截图文件名替代动态/视觉结论。

## 8. 每个 CP 的统一闭环

IA 正本优先级声明：frame inventory 是用户旅途、可见字段、状态、文案和动作的语义正本；high-fidelity IA 是同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token 的视觉正本。任何 reconciliation/对账发现语义与视觉冲突，必须先修两份 IA；详设、实施与 reviewer 不得自行择一。

全屏几何裁定：Dexter 2026-09-21 的直接验收要求是非登录 Admin console 充满可用 surface，shell 外部不得有四边留白；本门对账必须同时核对 desktop/mobile root 无 outer padding、shell 无 fixed max-width/min-height、实际运行 screenshot/hierarchy bounds 覆盖可用 surface。若历史证据仍把 bounded shell 写成当前结论，以当前源码、最新 IA 与新截图回源修正，不以旧文案延续误判。

每一个 CP 都执行以下固定顺序：

1. 主 agent 读取该 CP 对应的需求、IA frame/规格、详设、memory 与 owning source；
2. 主 agent 只做该 CP 的最小源码/测试/主题改动；
3. 先跑最低档 focused/static proof，保留首败与日志；
4. fresh 只读独立子 agent 做需求、详设、IA、memory、源码的逐点对账和证伪；
5. 主 agent 处理所有 findings，再由同一 CP 的 fresh reviewer 复查；
6. 只有对账结果全 `MATCHED` 才进入下一 CP。

全部 CP 完成后，先做一次全批三维对账，再做整体测试；不允许把开发阶段应发现的偏差留给 device/visual review。

## 9. 逐代码与详设对账清单

交付前主 agent 使用详设 §9a/§9b 作为同步分母，并逐项回读：

| 组 | 代码文件集合 | 对账内容 | 结论 |
| --- | --- | --- | --- |
| owner contract | display-context/platform-ports/topology/contracts/render/assembly | declaration→transfer→consumer→failure/test 全链 | `MATCHED`/`OPEN` |
| primitives | primitives component/types/index/tokens/README/invariants/tests | 每个 primitive 与 IA-ID、无业务 state、事件/geometry/pressed/disabled | `MATCHED`/`OPEN` |
| theme | 两 integration `global.css`、Tailwind、theme tests | semantic key 对称、integration-owned value、base 无 RGB | `MATCHED`/`OPEN` |
| shell | AdminShellFrame/Laptop/Mobile/navigation/hooks/page registry/tests | panel states、laptop/mobile layout、唯一 dropdown、close | `MATCHED`/`OPEN` |
| ports | PlatformPortsSection/纯 projection/tests | unit/category/summary/detail 守恒 | `MATCHED`/`OPEN` |
| runtime | Runtime/DisplayContext sections/projectors/tests | dual surface、ratio、current asymmetry、unknown、mobile display-facts-error variant | `MATCHED`/`OPEN` |
| topology | TopologySection/capability/state/tests | gate/roles/direct pair/host close/unpair/reconnect/errors、MASTER peerIdentity unpair readback | `MATCHED`/`OPEN` |
| evidence | test logs、visual/native/device/cleanup | evidence tier honesty、未授权项 OPEN | `MATCHED`/`OPEN` |

任一组 `OPEN`，最终交付状态必须写“实施未就绪”；不能用 test name、exit code、截图文件名或路径字符串冒充业务结论。

## 10. 未来实现文件分母

### 10.1 允许变更（以 CP-0 当前字节复核为准）

- `apps/terminal/ui/base/primitives/src/components/`、`src/types/types.ts`、`src/index.ts`、`src/theme/tokens.ts`、README、invariants、primitive tests；
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、navigation、hooks、foundations、sections、tests；
- `apps/terminal/ui/integration/sample-console/theme/global.css`、`tailwind.config.cjs`、theme tests；
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`tailwind.config.cjs`、theme tests；
- `apps/terminal/assembly/base/android/config/index.cjs`、其公共 config test，以及两个 Android app 的 Tailwind config（只为同步本批 semantic token mapping）；
- 如 CP-0 放行，display-context/platform-ports/topology/contracts/render/Android adapter 的最小 owner contract 与测试文件。

### 10.2 明确不变

- `apps/terminal/ui/base/input` 的 input/keyboard owner；
- `AdminLogin`、`AdminLayer` 的认证/关闭/焦点语义；
- `resolveSecondarySurfaceAvailable`、`hasTopologySecondarySurface`、topology transport/protocol/actor/slice；
- feature parts、wallpaper/member/topology business feature、power confirmation 的业务语义；
- Android App.tsx/Metro 入口，除 CP-0 证明 public display contract 必须在 adapter 边界补齐且得到授权的最小 adapter 变化；
- 数据库、HTTP backend、migration、seed、deploy/release。

## 11. 失败处理与最小替代

| 发现 | 先做的根因诊断 | 最小安全处置 |
| --- | --- | --- |
| public display facts 不可提供 | 查 owner/adapter/public surface，不读日志猜 | 停 CP-0，报告 contract 扩展边界；没有授权不改 |
| topology page gate 不可提供 | 查 owner capability，不用 operation reason | 停 CP-0，报告 `getPageAvailability` 最小接口 |
| direct pair 需要 identity | 查 command owner/其它消费者 | 设计 `pairByHost`；不增加 UI query step |
| MASTER unpair 资格允许但 actor 拒绝 | 对照 `selectTopologyFacts.paired` 与 actor guard，并检查成功清理/readback | 停 CP-0/CP-1，修 owner guard；不在 UI 另造解绑路径 |
| Android admin token 缺 sharedColors mapping | 查 assembly/base/android config 与其 config test | 停 CP-2，补三侧 mapping；不把 Android 主题降级成 integration-only |
| mobile selector 误用旧 PrimitiveSelect | 查所有消费者/公共面 | 新建 `PrimitiveDropdownSelect`，保留旧行为 |
| 端口分类出现未知 port | 查 descriptor source/category map | fail closed 更新详设/fixture，不塞“其它” |
| visual 与 IA 不一致 | 回 IA-ID/规格表/geometry source | 修 IA/详设/实现对应层，不靠截图解释差异 |
| focused 与动态现象冲突 | 保留 first failure，定位 owner | 不把 focused 升级为 Web/Android/visual PASS |

## 12. 交付状态与 Claude review 前置

本计划完成后交付：

- 详设文件；
- 本实施计划；
- `doc/review/platform/2026-09-20-ter-admin-console-non-login-design-review-request-codex.md`；
- fresh 独立 design adversarial review 的结果文件或明确 `OPEN` 披露；
- `scripts/check/claude-review-handoff --file ...` 的 PASS 输出。

当前不得写 `IMPLEMENTATION=COMPLETE`、`VISUAL=PASS`、`ANDROID=PASS` 或 `ACCEPTANCE=PASS`。当前状态是实施进行中、三条 admission blocker 已由 owner closeout 关闭、current APK r66/r64/r65 机械验证 union 仅 24/30、IA-03/04/05/06/07/08 与 IA-14 error variant 仍 OPEN、IA-13 已 fresh visual MATCHED、完整逐控件视觉仍 OPEN；owner closeout 不替代视觉/帧可达性/整体验收证据，后续结论仍必须保留 first failure、last known good、broken boundary 与 evidence tier 分档。

## 13. r30 第一批历史执行增补（当前状态见文首与 CP-5）

本节只记录当前实施授权下的新 run，不覆盖前文历史 r19/r20/r16 叙述。

`RUN=.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage1-single-screen-sample-terminal-r30/sample-terminal`

当前 release APK 已重新构建并绑定到 master/slave：88,910,779 bytes，SHA-256
`94c83be9b78246f3ca1399891b46b74f2d006c2d54edc46ce9f52b8ef260e31f`。r30 结果为
`BUSINESS=PASS`、`CLEANUP=PASS`、`FIRST_FAILURE=null`、
`LAST_KNOWN_GOOD=master-unpair-order-and-host-stop`、`BROKEN_BOUNDARY=null`。

第一批 19 帧分母未变；r30 runner 16 帧 MATCHED，`IA-03/05/07` 因 release UI 没有合法的真实
empty/loading/error 状态制造路径保持 `OPEN`。IA-09 ratio bar 已接入独立 `admin-ratio-undeclared`
语义 token；当前生产数据为 10 个 undeclared unit，所以真实画面显示该段占满，不引入 high-fidelity
示例数据。IA-11 改为 summary/detail scroll union，IA-13 保留 summary/detail scroll union；两者
均仍要通过 fresh 独立视觉逐控件审查后才可将 visual 列改为 MATCHED。

r29 曾在 IA-11 首败，原因是 runner 的 summary resource-id 与生产 testID 不一致；其 raw
`result.json` 保留 `firstFailure=master wait ... IA-11`、`lastKnownGood=frame-IA-09-ports-overview`，
而旧 runner 误把上一成功帧写入 `brokenBoundary`，所以 raw `brokenBoundary` 也是
`frame-IA-09-ports-overview`。语义上的失败边界仍是 IA-11；当前 runner 已改为对
`RunnerFailure` 使用 owning label 记录失败边界，未知异常才回退到既有兜底值。r29 原始 artifact
不改写为通过，修复后 r30 重新跑通。

在 r30 运行时 `adb devices -l` 只发现两台单机单屏设备 `emulator-5556` 与 `emulator-5558`；当时
第二批所需 single-machine dual-screen 与 mobile 未在场，故 r30 不得伪造 IA-16、不能用单屏替代双屏、
不能把第一批结果外推到第二批。历史 r36/r42 曾补充第二批可达子集；当前 APK 的第二批以 r50/r51 增补为准，但不改变 r30
历史结果的 SHA 与边界。三条 admission blocker
`DISPLAY_FACTS_OWNER`、`TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`、`MASTER_UNPAIR_GUARD`
仍为 `OPEN`；r30 的 owner 行为/readback/red mutation 证据不能代替正式 closeout。
