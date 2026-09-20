# TER Admin console 非登录区实施计划

```text
PLAN_STATUS=READY_FOR_DESIGN_REVIEW_WITH_ADMISSION_BLOCKERS
DESIGN=doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md
IA=doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md;doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md
IMPLEMENTATION_AUTHORITY=false
IMPLEMENTATION=NOT_AUTHORIZED
RUNTIME=NOT_AUTHORIZED
WEB_METRO_ANDROID_DEVICE=NOT_AUTHORIZED
INDEPENDENT_DESIGN_REVIEW=COMPLETED_FINDINGS_OPEN_REVIEWED_BY_FRESH_SUBAGENT
ADMISSION_BLOCKERS=DISPLAY_FACTS_OWNER;TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER;MASTER_UNPAIR_GUARD
```

本计划只定义未来实施的可执行顺序、文件分母、测试与对账门。本轮用户授权是“写详设与实施计划并交 review”，不授权改源码、改测试、加依赖、构建或启动任何运行环境。

## 1. 目标、范围与不变量

目标是把已确认 IA 变成可由同一 shared admin-shell 承载的三页非登录 console：平台端口、运行状态、双机拓扑；同时在 laptop 和 mobile 形成两套明确的信息优先级，而不是把 laptop 布局换行到手机上。

必须保持：

1. `ui.base.input`、`AdminLayer`、认证、keyboard、power-confirmation 和 feature page 的 owner/生命周期不变；
2. 内部 catalog/part 兼容结构不因用户页面聚合而删除；`runtime` 与 `display-context` 仅在 user page registry 中合并；
3. shared primitive 只拥有无业务词汇的呈现能力；integration 只拥有 semantic token 的具体值与业务 assembly；
4. ports 以 capability unit 计数，synthetic undeclared unit 不能被吞掉；
5. runtime/display 只消费 display-facts owner；topology 只消费 page availability/snapshot/capability；admin-shell 不读 raw slice；
6. topology mobile 只有不可用 gate；laptop 主机/副机动作集合不同，查询身份不成为用户步骤；
7. current/non-current surface 信息不对称、真实宽高比、unknown 数字位置、主副标题和状态文字必须与已同步的需求/线框/高保真 IA 逐 frame 对齐；
8. 所有状态证据分 `static`、`focused`、`Web`、`Android/native/device`、`visual`、`cleanup`，不混写。

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

- 如果 display facts 仍只有 `displayCount`，但没有获得 display-context/device adapter 的最小公共 contract 方案：`CP-0=OPEN`，不进入 CP-1；不读日志补 UI。
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
- fresh 只读子 agent 完成需求+IA+详设+memory 三维对账；缺一维不得把 CP-1 记为完成。
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
3. current/non-current projection 严格按已同步 IA：non-current 不能出现 resolution/readiness/physical；current physical missing 的数字位置是 `未知`。mobile 若输入事实声称多 surface，复用 IA-14 的 `display-facts-error` 变体，不生成第二块矩形。
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

完成 topology focused tests 后，fresh reviewer 逐帧核对状态机、用户文案、角色动作、failure/recovery、local IP、no-query 和 mobile gate。再做全批三维对账，之后才允许整体 focused/typecheck；本轮无 implementation authority，不执行。

## 7. CP-5：验证与证据计划（后续授权后）

CP-5 不在本轮执行，但必须提前定义证据层级：

| 档位 | 必须证明 | 不得冒充 |
| --- | --- | --- |
| static | import/owner/token/registry/public surface/禁止词 | 不证明布局运行或视觉 |
| focused | primitive/page projection/state/action/subscription/red mutation | 不证明真实字体/设备/像素 |
| Web | mobile/laptop selector、scroll、dropdown、surface map、topology actions | 不证明 Android native |
| Android/native | 两 integration theme、surface facts、键盘/inset、真实 action | 不证明 release |
| visual | IA 与运行截图/geometry/颜色/文案逐帧对账 | 截图单独不能证明业务状态 |
| cleanup | 受管 process/device/resource 回收与 readback | business PASS 不能替代 cleanup |

CP-5 开工前必须另获动态授权，并遵循受管入口、日志/PID/readback、first failure/last known good、business 与 cleanup 分离。若 display/topology owner contract 未闭合，CP-5 不得以截图掩盖。

## 8. 每个 CP 的统一闭环

IA 正本优先级声明：frame inventory 是用户旅途、可见字段、状态、文案和动作的语义正本；high-fidelity IA 是同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token 的视觉正本。任何 reconciliation/对账发现语义与视觉冲突，必须先修两份 IA；详设、实施与 reviewer 不得自行择一。

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

当前不得写 `IMPLEMENTATION=COMPLETE`、`VISUAL=PASS`、`ANDROID=PASS` 或 `ACCEPTANCE=PASS`。本轮正确状态是设计文档待独立 review，owner blockers 诚实保留，implementation 未授权。
