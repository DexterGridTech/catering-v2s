# TER 双机拓扑 implementation-facing 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BUSINESS_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md
JOURNEY_REFS=R-1,R-2,R-2a,R-3,R-4,R-5,R-5a,R-6,R-7,R-8,R-9,R-9a,R-10,R-11,R-12,R-13,R-14,U-1..U-22
CROSS_BATCH_DEPENDENCY=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md（只消费其已落地的 screen-part 契约；不在本批实现 R-10a/R-10b 或 ready/contentFailure/catalog 机制）
IA_REF=本文第 8 节（按 doc/decisions/templates/ia-design-template.md 的终端本地控制页扩展）
INTERACTION_REF=本文第 8 节（按 doc/decisions/templates/ui-interaction-design-template.md 的终端本地控制页扩展）
AUTHORIZED=Dexter 已授权按本详设与计划实施并完成阶段一、阶段二动态验证；需求稿第 0.3 节的裁定在本文中直接执行
NOT_AUTHORIZED=扩大需求范围、改变已裁定语义、未列入计划的生产落点、设备级开机自启、seed、UAT、部署及仓库控制动作
IMPLEMENTATION_AUTHORITY=true
DESIGN_STATUS=IMPLEMENTATION_AUTHORIZED
IMPLEMENTATION_STATUS=READY_FOR_IMPLEMENTATION_REVIEW_MAIN_AGENT_FALLBACK

## 0. 详设边界与 source-of-truth

### 0.1 真实业务目标

本批完整交付 TER 双机拓扑基建：在 laptop 形态、单屏设备上，MASTER 通过身份确认配对一个 SLAVE；SLAVE 切换为 VICE 后，以主机同步的工作区和闭合的副屏条目提供第二块物理显示面。sample-terminal 在双机双屏和单机双屏下的第一版用户行为必须等价。删除跨批 screen-part 实现内容不缩减 R-1 至 R-14 的 transport、topology、native host、routing、sync、reset、admin UI 和真实双设备验收范围。

不可变不变量：

1. mobile 和 laptop 单机双屏不支持双机拓扑；laptop 加单屏是唯一支持形态。拓扑 tab 恒显示，限制以 disabled 加可读原因呈现，不能用隐藏 tab。
2. 一个 MASTER 最多一个 SLAVE；本批不做认证或授信握手，角色占位是配对排他机制。
3. paired 与 peerReachable 正交。断线只影响命令送达，不能改变已配对语义、不能退化 UI，必须持续重连。
4. topology secondary 事实是“本机物理双屏，或本节点为 MASTER 且已配对 SLAVE”，不读在线状态。
5. screen-part 批已经落地的 ready、failure classification 和 catalog 语义是本批的前置依赖；本批只消费其公开结果，不改 ScreenReadyBoundary、readyPartKey 或内容失败传播。
6. 状态和命令都有唯一 owner；主机写 members，requestLedger 保持本地，副机上行意图而不是直接写主机 slice。

### 0.2 直接执行的既有裁定

需求稿第 0.3 节的编号裁决和具名裁定在本设计中直接执行，不重新选择：只支持 laptop 加单屏；两个 app 必须跑通；不认证、一主一副；拓扑 tab 恒显；角色是 base 能力而非 App 矩阵；断线持续重连、不退化、不设放弃条件；enableSlave 是主机侧持久标记，APP/JS 启动后恢复，不做设备级开机自启；R-2、R-6、R-9、R-9a、R-11、R-14 的顺序和语义均以需求正本为准。本批不重做其他立项已完成的 screen-part 机制，但必须把它作为运行前置核对。

### 0.3 当前仓内事实、证据与边界

已从当前源码确认：

- apps/terminal/kernel/base/platform-ports/src/types/topologyHost.ts 已有 TopologyHostPort、status、address 和 diagnostics 类型，本批填充该 port，不创建平行接口。
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts 已有 local/peer 目标，createCommandActorDispatcher.ts 的 actor 子命令回到同一 dispatchInternal；因此 R-9a 必须在 runtime dispatch boundary 实现。
- apps/terminal/ui/base/render/src/types/props.ts 的 RenderDispatchOptions 只有 requestId；RenderContext 不持有 runtime，只改 render 不能覆盖 actor。
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts 的 resolveSecondarySurfaceAvailable 是物理屏 helper；它有其他 production callers 和既有 tests，本批保留其物理语义与测试。
- requestLedger 属于 kernel.base.runtime；RequestLifecycleStatus 当前只有 started、completed、partial-failed、timed-out、error，CommandAggregateStatus 当前只有 running、completed、partial-failed、timed-out、error。registered、dispatched、accepted 不是这两个 status union 的值；不能把生命周期日志 phase 当作 status，也不能未经 D-18 证明就作为业务 state 镜像。
- admin-shell 已有 laptop master-detail、mobile wrap navigation、AdminSectionRenderContext 和默认拒绝的 command boundary；新 section 只能获得 typed 窄 capability。

实施后已确认并保留证据：

- 两个 Android App 的 host/WS 接线、依赖解析、release run 和真实双设备/单设备形态执行已记录在 CP-2 与 CP-5 evidence；没有手写 HTTP parser 或 WebSocket framing。
- `tools/terminal-topology/run-dual-device.mjs` 已作为受管 runner 运行；阶段一使用两个真实设备边界，阶段二使用单机双屏与 mobile 形态，两个阶段的 business/cleanup 分开记录。
- POC connectionActor、v2 传输细节、装配层类型环境仍不是本仓事实；本批结论只引用当前仓源码、focused proof、runner 日志和设备 readback。
- U-15 的多地址通用 runtime 行为没有当前真实消费者，按详设 U-15 保持 scope-open；U-5 的持久化 VICE 前置由两个 runtime 的 focused restart test 直接证明，双屏设备步骤只作 CHIEF/MASTER supporting readback。
- 设计原始写作阶段没有运行构建、测试、设备或 cleanup；实施后的分档结果见 `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`，不改写本设计原始意图。

### 0.4 设计决策与风险

DR-01：Android 绿色地 HTTP/WS 服务端是新增能力。实施前必须确认一个 Android 兼容、受维护的 server 依赖；禁止手写 HTTP parser 或 WebSocket framing。依赖无法在当前授权内成立时停在 CP-0，交 Dexter。

DR-02 已由 Codex 代 Dexter 裁决为 FOUR_SECONDARY_PARTS：需求裁定⑦要求两个 Android app 都跑通，且 U-4/U-13 的“两个 APP”是每个 app 的 laptop 单屏运行；因此 allowlist 按 app 分别取其真实装配中的 secondary parts。sample-console 的声明 owner 是 `apps/terminal/ui/feature/sample-member-desk`，开放 customerWelcome、customerMember；sample-wallpaper-console 开放 waiting、welcome。两 app 的 primary-only part 均不开放。该决定不改变 requirements，而是把 R-11 的“按副屏实际读取推导”应用到两个 app 的完整装配分母。

## 1. 目标、替代方案与选择

### 1.1 交付目标

实现必须同时闭合：

1. contracts/display-context/topology/transport/runtime/state/platform-ports 的事实、协议、owner 和依赖边。
2. 两个 Android app 的 identity HTTP、单 peer WS、desired/actual host lifecycle、APP/JS 启动恢复与 resetRuntime 接线。
3. shared admin-shell 的配对、服务开关、解绑、状态/错误、焦点和可访问性；两个 integration 使用同一 base capability。
4. 真实双设备受管执行体和 U-1 至 U-22 的分档 evidence；本设计阶段不执行。

### 1.2 方案比较

| 方案 | 做法 | 反例/代价 | 结论 |
|---|---|---|---|
| A | 只在 render 层按 screen part 路由 | actor 发出的 member command 绕过；routeContext 和目标不闭合 | 否决 |
| B | 每个 integration 自己维护 topology、协议和 allowlist | owner 重复；两个 app 漂移；违反 base 能力裁定 | 否决 |
| C | contracts 共享类型；display-context 保留物理事实；新增 kernel.base.topology；runtime dispatch boundary 统一按 payload 路由；原生只实现现有 TopologyHostPort | 需要一条 topology kernel、两个薄 native adapter、双设备 runner | 采用 |
| D | 先引入认证、版本协商、通用远端服务框架 | 超出无认证、一主一副裁定，增加无消费者复杂度 | 否决 |

我选 C 而不是 A/B/D，因为 C 是同时满足 actor/UI 同一 dispatch boundary、base 角色能力、不改物理 helper、两个 app 等价和真实双设备可证伪的最小方案；它不把未来远端通用性误报成本期已验证产品能力。

### 1.3 依赖边

~~~text
contracts
  ├─ display-context ── ui-state ── render
  └─ transport ── topology ── integration / app assembly
                         ├─ state / runtime
                         └─ platform-ports

admin-shell ── typed topology capability ── topology actor
                                      ├─ display-context
                                      ├─ runtime/state
                                      └─ TopologyHostPort
~~~

display-context 不得依赖 ui-state；topology 不得通过跨包相对路径依赖 feature；transport 只做 framing/session，不做业务或 target 决策。

## 2. CP 总览

| CP | 内容 | 主要产出 | 前置 | 收口 |
|---|---|---|---|---|
| CP-0 | source/preflight、依赖、owner、调用点、分母 | preflight 清单与依赖选择 | 设计 review 允许实施 | 所有硬约束有 owner；依赖无法成立则 OPEN |
| CP-1 | contracts、display-context、topology、graph、纯 evaluator、wire parser | 类型、纯函数、state/actor 骨架 | CP-0 | focused pure tests、graph、README；步骤对账 MATCHED |
| CP-2 | transport、两个 Android host、AppControl reset、App 接线 | HTTP/WS、host lifecycle、JS restore、同构 adapter | CP-1 且依赖冻结 | native/focused 契约闭合；步骤对账 MATCHED |
| CP-3 | pairing/unpair、sync、dispatch route、routeContext、member-desk 12 点 | 机制批完整闭环 | CP-2 | 机制 focused/双设备执行体预备；机制全批对账 MATCHED |
| CP-4 | admin-shell IA、topology section、power、两个 integration 装配与 allowlist | 两形态控制页与运行期模块 | CP-3 | UI/mechanism focused；步骤对账 MATCHED |
| CP-5 | 双设备 runner、动态、视觉、release、cleanup、最终对账 | 分档 evidence 和交付包 | CP-4、全批对账 MATCHED | 逐代码与详设逐行 MATCHED；仍由 review 决定 GO |

每个 CP 的 focused proof 完成后、下一个 CP 开始前，fresh 只读独立子 agent 按需求、详设/IA、项目 memory 三维逐项对账；全 CP 完成后、任何整体测试或设备运行之前再做一次全批三维对账。它们不能被最终 review 或动态 evidence 替代。

## 3. 横切机制表

| 机制 | 现有准确能力 | 可执行观察与证据档位 | 新形态/先例 | 本批完整范围 |
|---|---|---|---|---|
| 读侧节点授权 | feature 通过公开 selector/read API 读取 topology/display/members，UI 不读 raw root | topology section 只能拿 typed 窄 capability；static/focused | terminal selector 与 AdminSectionRenderContext | topology、member-desk、admin-shell、两 integration |
| 写授权与 grant 复核 | topology actor 写 topology；member owner 写 members；UI 只派 command | 直接 reducer/port 写入 red mutation；focused | runtime command actor | pairing、unpair、enable、mode/role、members、power |
| 跨 owner 写与事务 | route 后由接收 owner 本地执行；无跨 slice 直接写 | receiver target 必须 local；U-20/U-21 | runtime local/peer dispatch | topology/display/members/runtime |
| 集合形态与分页 | state sync 是 full slice，不做 delta | frame 的 slice/direction/完整值逐字段断言；focused/native | createStateRuntime full sync | members；session/ledger 排除 |
| 缓存失效/改完刷新 | host actual 以 port readback 为准，无长缓存 | start/stop 后读 status；断线重连 | TopologyHostPort diagnostics | lifecycle、peer status、UI status |
| RTK 数据读取/loading | 本批是终端 runtime/state，不使用 Web RTK Query | undefined 不表示 lifecycle；focused/static | terminal selector/status | N/A；终端 selector 规范仍适用 |
| 同一事实只有一个住址 | SurfaceForm=contracts；物理事实=display-context；paired/reachable=topology；members=feature owner | 禁止复制 union、online 推导 paired、UI 自算 | displayDerivation/state owner | D-16/D-17/D-18 |
| 失败可见 | disabled+reason；系统和连接失败有 typed code 与 copy | 每个不可用分支有 copy/code；native/JS 日志脱敏 | admin-shell InlineAlert/EmptyState | topology tab、identity、pair、enable、unpair |
| owner error mapping | native/transport 错误由 topology actor 归一 | UI 不枚举 reason 字符串；unknown generic；focused/native | typed runtime errors | HTTP/WS、host、state sync |
| 幂等/replay | requestId 和当前 state 使重复操作可识别 | 重放不重复写；reconnect 不重放副作用 | requestLedger lifecycle | pair/unpair/host/command |
| generated material | 无 OpenAPI；contracts type/parser/golden vectors 冻结协议 | TS vectors 与 Kotlin parser 对照 | hand-authored contract vectors | D-21 |
| 日志/脱敏 | runId、connectionId、requestId、nodeId 关联 | 实际读取结构化日志；敏感字段 absence | observability standard | JS/native/runner/cleanup |
| migration | 无 DB；本地 persistence schema version，未知值 fail closed | stale/incomplete pairing 修复；无 seed | existing local slice persistence | topology local storage |
| frontend shared behavior | 终端用 terminal primitives/admin-shell，不是 Web foundation | section 不持 Runtime/port；focused | terminal primitives | topology section、layout、a11y |
| candidate data | 只查询单个已确认 identity，不做可信发现 | identity 在连接前读；focused/native | status endpoint | pairing form |
| naming/encoding | R/U/D/J 只在 doc/evidence；单机型文件名含 form | review-only/static | terminal coding standard | TS/Kotlin/runner |
| atomic groups | contracts、native、sync、routing、UI 各是原子组 | 中间态不能交付；每组 red mutation | CP-1..CP-5 | 全部本批 |

## 3a. UI/L2 前置

这是终端本地控制页，不是两个 Web admin app；消费面记为 TER_LOCAL_ADMIN，使用 apps/terminal/ui/base/primitives 和 admin-shell。

~~~text
UI_DESIGN_REVIEW=OPEN：本详设第 8 节提供终端 IA/interaction，进入实现前由 Dexter/Claude 逐项复核
TESTID_REVIEW=OPEN：实现时在 apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts 增加 topology roster，再由 focused 反查
L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本批对象是终端 Android/真实双设备，不是受管浏览器 L2
~~~

不得用 Web L2、隐藏 tab 或结构测试替代设备视觉；结构测试只证明装配、状态、copy、disabled、testID 和 a11y。

## 4. CP 可证伪收口

### 4.1 CP-0

失败命题：未核 server 依赖、所有者、12 个 member-desk 调用点或副屏分母就开始写实现。

不变量：每个事实唯一 owner；display-context 不依赖 ui-state；旧物理 helper 语义与 tests 不改；POC 不升格。

禁止：先写 native 再补协议；fixture 直接持有 TopologyHostPort.start；单进程假双机；按端口杀未知进程。

### 4.2 CP-1

失败命题：SurfaceForm 重复；topology 反向依赖 ui-state；wire parser 只比较 type；UI 自行拼 topology 操作允许性。

不变量：SurfaceForm 只有 contracts 一份；operation evaluator 只给当前 operation 的 allowed/reason；原始 topology facts 由独立只读 selector 提供；字段闭合。

red：删除 operation 参数、让 UI 用 paired/reachable 自算 allowed、删除 field validation、复制 SurfaceForm union。

### 4.3 CP-2

失败命题：enableSlave 只写 flag；native start 被 fixture 直接调用；两 app wire 不同；JS reload 丢 flag或重复 host。

不变量：desired/actual 串行对账；start→locator readback→connect→snapshot；APP/JS hydrate 恢复；无 BootReceiver。

### 4.4 CP-3

失败命题：只改 render 漏 actor；receiver 再转 peer 形成回环；sync 白名单漂移；unpair 顺序错误。

不变量：每次 payload 求 local/peer 且互斥；receiver 强制 local；members 仅 master-to-slave；session/ledger local；CHIEF→MASTER。

red：删除 payload resolver、透传 target、开放 requestLedger state.full、反转解绑顺序、改 member 默认 peer。

### 4.5 CP-4

失败命题：mobile 隐藏 tab；三个操作共用无操作维度 boolean；section 获得 Runtime；power 不重检；两个 integration 的 topology section 或本 app secondary parts 缺失。

不变量：operation-aware evaluator 是唯一允许性来源；tab 恒存且 disabled 有理由；两形态共享 hook；内容和屏幕迁移沿用 screen-part 批的既有契约；两个 app 的真实 secondary allowlist 分别闭合。

### 4.6 CP-5

失败命题：单进程假双机、只测在线、断线退化、没有 cleanup、用截图差分当绝对布局 oracle。

不变量：真实进程/设备；持续重连；business/cleanup 分开；动态日志和设备 evidence 分档。

## 5. 操作、路径和写 owner

| 操作 | 入口 | owner | allowed 事实 | 成功状态 |
|---|---|---|---|---|
| query-host | host input/query | topology actor + local port client | laptop、single、PRIMARY、MASTER、未配对 | identity card；不写 pairing |
| pair | identity card confirm | topology actor | query 成功且 operation=pair allowed | locator→SLAVE→VICE→reset→hydrate/connect |
| enable-host | host switch | topology lifecycle actor | laptop、single、MASTER | desired 持久化；actual readback |
| unpair | unpair button | topology actor + local mode/role actors | paired；不要求 reachable | CHIEF→MASTER→clear locator |
| member dispatch | member-desk actor | runtime dispatch boundary | 每次 payload 与 topology facts | local 或 peer 单目标 |
| power confirm | display context control | display-context actor | confirm 时重新读取事实 | confirm 才写；cancel 零写 |

routeContext 只在本地 dispatch/root surface stamp 存在，不进 wire。跨机 receiver 丢弃原 target/routeContext，以 origin=peer 的内部标记执行 local，避免回环。

## 6. 状态、事务与恢复

| 事实 | owner | 写法 | 失败/恢复 |
|---|---|---|---|
| masterLocator | topology slice actor | pair/unpair command | incomplete mode/role/locator 在 hydrate 修为 MASTER/CHIEF；已配对断线保留 |
| instanceMode | runtime/topology owner | local command | pair 失败回滚 MASTER |
| displayRole | display-context owner | local command | pair 按要求切 VICE；unpair 先 CHIEF |
| enableSlave | topology slice actor | desired command | APP/JS hydrate 后恢复；无设备启动广播 |
| members | member-registry owner | confirm/withdraw actor | master-to-slave full snapshot；副机不写 |
| requestLedger | runtime owner | local lifecycle emitter | peer command 在本地记；不 state.full |
| host actual | port readback→topology actor | UI 不写 | desired/actual reconcile，保留 typed error |

配对补偿顺序：identity 只读；persist locator；切 SLAVE；切 VICE；reset slave JS；hydrate/connect/snapshot。中途失败按逆序 repair：确保 CHIEF，再 MASTER，再 clear locator。repair 失败保留 diagnostics 并在下次 hydrate 重试，不报 paired success。

解绑按 CHIEF→MASTER→clear locator。若清 locator 失败，MASTER/CHIEF + locator 被 hydrate 视为 stale locator 并清理，不阻塞本地 MASTER 使用。

## 7. 声明、传递、消费

| 声明 | owner | 传递 | 消费 | 禁止 |
|---|---|---|---|---|
| SurfaceForm | contracts | display-context/topology/UI | evaluator/准入 | 复制 union |
| physical display | display-context/platform port | topology | R-2a/R-5a | 用 helper 替代 count |
| pairing facts | topology slice | actor/runtime/admin capability | pair/unpair/dispatch | UI 自持久化 |
| peerReachable | connection actor | typed status | 送达/文案 | 决定 secondary |
| allowlist | integration assembly | catalog admission | slave catalog | 只开放本 app 已核实的四项 secondary parts；不在本批重做 screen-part 冲突检测 |
| routeContext | root/runtime local | dispatch/receiver | mode/workspace | 过 wire |
| payload | command definition/actor | boundary→wire | resolver/receiver | static command list |
| state.full | topology sync owner | transport→state | members | session/ledger/delta |

新增 topology graph node、package.json direct dependency、root workspace、invariants、census、README 必须 CP-1 同步，不能只改 skeleton-graph。

## 8. 终端本地控制页 IA 与 interaction

本节按 ia-design-template 和 ui-interaction-design-template 的适用字段编写。它不是 platform-admin/operations-admin Web 页面；consumer face 是 TER_LOCAL_ADMIN。

### 8.1 IA-01 元数据

~~~text
IA_STATUS=DESIGN_READY_FOR_REVIEW
CONSUMER_FACE=TER_LOCAL_ADMIN
UI_SURFACE=apps/terminal/ui/base/admin-shell
HOST_AND_ENTRY=admin.console.topology，经既有管理员入口进入 shared admin-shell
ACTOR=已登录本地管理员
BUSINESS_SCENARIO=单屏 laptop 主机查询、配对副机、管理服务和解绑
BUSINESS_GOAL=让管理员能看清形态/角色/配对/可达/服务事实并安全执行操作
FOUNDATION_PRIMITIVE=apps/terminal/ui/base/primitives + existing admin-shell
~~~

### 8.2 IA-01 内容

| 字段 | 设计 |
|---|---|
| entry/surface | topology section；laptop 在 master-detail detail，mobile 在 wrap navigation 后 |
| control | 形态/屏幕/角色卡；host 输入/查询；identity card；pair/unpair；enableSlave；连接状态 |
| validation/error | evaluator(operation) 只返回当前操作的 allowed/reason；事实卡片另读只读 topology facts，不允许 UI 用 paired/reachable 重组操作可用性；地址错误、identity 失败、形态/角色限制分开 |
| empty/loading/error | 未查询提示、查询 progress、未配对 empty、断线“已配对，正在重连” |
| accessibility/testID | tablist/tab/tabpanel；输入、按钮、switch、alert 在 adminTestIds topology namespace 有稳定 id |
| container | laptop vertical master-detail；mobile wrap nav + vertical content；永不隐藏 tab |

### 8.3 interaction map

~~~text
打开 admin
  → topology tab 恒显
  → 读取 topology facts
  → evaluator(operation)
  → 不可用：保留控件 + disabled + readable reason
  → 可用：派 typed capability command
  → actor 写入/读回
  → settled state 或 typed error/retry guidance
~~~

| 动作 | 成功 | 失败/边界 | 焦点 |
|---|---|---|---|
| 查询 | identity card | 输入保留；不显示敏感诊断 | heading/alert |
| 配对 | progress→paired/connecting | repair copy；不提前显示成功 | settled/error 可读 |
| 开服务 | desired/actual 都显示 | slave/形态/角色不符 disabled+reason | switch 保持 |
| 解绑 | CHIEF→MASTER→clear | 阶段失败显示 repair/retry | 回到 unpair |
| 断线 | 背景持续重连 | 不退化、不强迫重新配对 | 不抢焦点 |
| power | confirm 后执行 | confirm 重检；cancel 零写 | dialog confirm，取消回原控件 |

### 8.4 copy、状态和 a11y

| reason | copy | code |
|---|---|---|
| mobile | 当前机型不支持双机拓扑 | TOPOLOGY_UNSUPPORTED_FORM |
| laptop dual | 双屏设备不支持双机拓扑 | TOPOLOGY_REQUIRES_SINGLE_SCREEN |
| not master | 当前节点不是主机 | TOPOLOGY_REQUIRES_MASTER |
| already paired | 当前主机已有副机 | TOPOLOGY_ALREADY_PAIRED |
| not paired | 尚未配对副机 | TOPOLOGY_NOT_PAIRED |
| unreachable | 已配对，副机暂时不可达，系统将持续重连 | TOPOLOGY_PEER_UNREACHABLE |
| identity failed | 无法读取对端身份，请检查地址后重试 | TOPOLOGY_IDENTITY_FAILED |
| host failed | 服务未能按当前设置启动 | TOPOLOGY_HOST_FAILED |
| host port occupied | 服务端口 43172 被占用，请关闭占用该端口的应用后重试 | TOPOLOGY_HOST_PORT_OCCUPIED |
| stale locator | 旧配对记录已清理 | TOPOLOGY_STALE_LOCATOR |

disabled 控件不只显示通用文案；reason 由同一 evaluator 映射。实现时只在 apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts 注册 topology namespace，不把 R/U 编号放进 runtime/test 文件名。

### 8.5 两形态布局

~~~text
Laptop:
+----------------------+----------------------------------+
| admin tabs            | topology detail                 |
| platform/runtime/... | [form/role/display facts]       |
| topology active      | [identity/pairing controls]     |
|                      | [service/reconnect/unpair]      |
+----------------------+----------------------------------+

Mobile:
[platform] [runtime] [display] [topology]
[topology detail]
[facts]
[identity/pairing]
[service/reconnect/unpair]
~~~

复用既有 vertical master-detail 和 wrap navigation，不新增横向滚动能力。hook 只读取 typed topology selector/capability，layout 组件不判业务状态。样式来自 terminal primitives 的 token、Stack/Grid/ScrollView 和 RN style，不依赖 App tailwind 扫描不到的包。

焦点和恢复：查询/配对/解绑/开关显示 settled/error，不因 rerender 丢失输入焦点；重连不抢焦点；JS reload 后先 loading，再 paired/repair；若 disabled primitive 不可聚焦，紧邻 alert 必须可聚焦。两形态共用 hook，只有 layout 不同。

## 9. D-1 至 D-21 逐项结论

| D | 结论 | owner/落点 | 验证与反例 |
|---|---|---|---|
| D-1 | topology tab 在任何机型、状态、角色下恒显示；各操作按 operation eligibility 置灰或拒绝，并显示可读原因；不实现 tab 显隐判断 | admin-shell topology section、operation capability | U-13/U-18；删除 mobile tab 或移除 disabled reason 必红 |
| D-2 | identity 采用只读 GET /terminal-topology/status；成功只返回 protocolVersion、nodeId、displayName、instanceMode、displayRole；输入 IP 后先查询并展示，用户确认后才进入 WS/pairing；失败不写 pairing | TopologyHostPort/native adapter、contracts parser、admin capability | U-16/U-22；把 identity 查询移到 WS 后、或 status 写 state 必红 |
| D-3 | allowlist 由两个 integration 各自按实际装配声明；sample-console 为 customerWelcome/customerMember，sample-wallpaper-console 为 waiting/welcome；primary-only 不开放 | integration assembly/topology catalog admission | U-4/U-13/U-19；删除任一 app 的真实 secondary part 或放开 primary-only 必红 |
| D-4 | 固定 port 43172、basePath /terminal-topology、status 与 ws 路径；heartbeat 10s、timeout 30s、call 5s；退避 500ms 起、10s 封顶、永不放弃。绑定失败若为端口占用，返回独立 TOPOLOGY_HOST_PORT_OCCUPIED、显示“服务端口 43172 被占用，请关闭占用该端口的应用后重试”，不做静默回退端口 | contracts/transport/topology/native | U-7/U-16/U-17；占用端口 red fixture 必须使 host lifecycle 失败且 reason 可读 |
| D-5 | Root Surface 首次主表面写 routeContext displayMode/workspace；workspace 仍 resolveWorkspace 派生 | render/root surface | U-3；display-context 不引 ui-state |
| D-6 | 两 app 使用同一 U 矩阵和 base 能力，不建 role matrix；差异只在 adapter/装配输入 | topology base + app adapter | U-4/U-19 |
| D-7 | 新 kernel.base.topology；复用 TopologyHostPort；contracts 拥有 wire parser/vectors；transport 拥有 frame/session；两个 app 薄 Kotlin adapter | graph/package.json/README/native paths | static graph、contract focused、native |
| D-8 | Android app 内单 peer HTTP/WS host；JS desired flag 驱动起停；无 BootReceiver；bind exception 必须归一为 typed host reason，端口占用不能吞成普通 running failure | assembly/android adapter + topology lifecycle | U-7/U-17；port-occupied 与 unavailable 两个分支分别可观察 |
| D-9 | 复用 AppControlPort.resetRuntime；host 稳定后 reset slave JS；失败 repair mode/role/locator | topology actor + app control | U-5/U-6；重复 reset/失败回滚 |
| D-10 | unpair operation 内部 CHIEF→MASTER→clear；UI 不拆三个独立按钮 | topology actor | U-21；反转顺序必红 |
| D-11 | 顺序 contracts/display→transport/topology→native→state/runtime→integration→UI→runner/evidence | CP-0..CP-5 | 步骤依赖和三维对账 |
| D-12 | admin-shell、topology、两个 integration、两个 Android adapter 的中文 README 按 TR-10 更新 | 各 package README | 示例回源码；U-13 |
| D-13 | 结构证据只证装配/state/copy/a11y；视觉证据由真实设备，ROI 只能辅助 | U-4/U-5/U-9/U-10/U-13/U-19 | visual/release 当前 OPEN |
| D-14 | members master-to-slave full；session isolated；requestLedger local；不 delta | member-registry/runtime/topology sync | D-18 peer ledger focused、U-14 |
| D-15 | display-context owner 的 request/confirm/cancel actor；confirm 重读 display/role/form/mode；auto confirm 3s | display-context/admin primitive | U-11/U-12 |
| D-16 | SurfaceForm 单一放 contracts；独立只读 selector 提供原始 topology facts 和 secondary 事实；operation evaluator 接 operation discriminator，只返回当前操作的 allowed/reason。UI 只能用 evaluator 的结果决定操作，不得用 facts 重组 allowed | topology/foundations/evaluateTopologyOperation + topology facts selector | pair/unpair/enable 三操作不同；把 paired/reachable 自算 allowed 的 UI red mutation 必须红 |
| D-17 | secondary=physical count>=2 或 MASTER+paired；不含 reachable；member-desk 12 点全切；旧物理 helper 原样保留 | topology capability + member-desk actors | 12 点清单、断线不退化、旧四 tests |
| D-18 | 真实 createCommandPeerDispatcher 夹具证明副机本地 ledger 使用仓内真实 status：挂起时 RequestLifecycleStatus/CommandAggregateStatus 分别观察为 started/running；远端 completed、timed-out、error 分别落为本地 completed、timed-out、error；远端 partial-failed 对单个 peer-dispatch actor 按真实实现归一为本地 error（单 actor 没有可聚合的 partial-failed），而 RequestLifecycleStatus 与 CommandAggregateStatus 的 partial-failed 由仓内多命令/多 actor 聚合路径证明。registered/dispatched/accepted 只可作为日志 phase（若存在），不是 status；wire 不传 ledger | runtime peer dispatcher/requestLedger | 恢复现有 mode-based ledger sync、漏 partial-failed/timed-out、或删除本地 ledger 的 red mutation 必须红；不得改 union |
| D-19 | runtime dispatch boundary 处理 UI+actor；payload/context 每次求 target；receiver 强制 local；不按命令静态名单 | createCommandDispatcher/runtime route policy | payload mutation、receiver loop、default peer red |
| D-20 | APP/JS hydrate 后按 flag 恢复 host；不做设备 boot auto-start | topology lifecycle + native source | BOOT_COMPLETED/BootReceiver source scan |
| D-21 | 八类 wire contract 逐字段冻结：message、endpoint/frame、identity/role、command identity/parent、payload/result/error、state/direction、heartbeat/reconnect/limits、安全/归一 | contracts parser + Kotlin adapter | unknown/missing/oversize/wrong direction red |

## 10. API、同步和 wire

### 10.1 typed API

contracts 新增 SurfaceForm、TopologyOperation、TopologyFailureCategory、TopologyOperationResult、TopologyWireMessage 和 parser。ui-state 可以 re-export type，但不得复制 union。

topology 将两个读取面严格分开：

- selectTopologyFacts 是只读 selector，返回 display form/count、instanceMode、displayRole、paired、peerReachable 和 hasTopologySecondarySurface；它只用于状态展示与屏幕语义。
- evaluateTopologyOperation({operation, facts}) 只返回当前操作的 {allowed, reasonCode}；query-host、pair、unpair、enable-host、switch-role 各自重新求值。

准入门、enableSlave 控件和 tab 内操作只消费 operation result；它们不得用 selector facts 自行重组 allowed/reason。focused red mutation 会把任一消费方改成 facts 自算，预期必须失败。

admin section 只拿：

~~~text
getSnapshot()
getOperationEligibility(operation)
queryMasterIdentity(input)
pair(input)
unpair()
setHostEnabled(enabled)
~~~

不暴露 Runtime、任意 dispatch、TopologyHostPort、start/stop、storage 或 raw state source。getSnapshot 只用于呈现事实；所有 action control 必须调用 getOperationEligibility，不得从 snapshot 的 paired/reachable 字段自行推导。

### 10.2 field-level wire contract

固定 framing 字段：

| 字段 | 约束 |
|---|---|
| type | 固定 union；未知拒绝并断开 |
| wireId | 非空 bounded string，连接内唯一 |
| protocolVersion | major=1；不协商 |
| nodeId | 非空身份标识，不是认证 |
| instanceMode | MASTER/SLAVE |
| displayRole | CHIEF/VICE |
| error | closed code + retryable，不含 raw message |

HTTP 只读 identity：

~~~text
GET /terminal-topology/status
200 application/json
{
  type: "identity",
  protocolVersion: 1,
  nodeId: string,
  displayName: string,
  instanceMode: "MASTER" | "SLAVE",
  displayRole: "CHIEF" | "VICE"
}
~~~

WS frame：

| type | 必填 | 语义 |
|---|---|---|
| hello | type/protocolVersion/wireId/nodeId/instanceMode/displayRole | 建一对一 session，检查 role occupancy |
| hello-accepted | type/protocolVersion/wireId/nodeId | 只代表连接接受，不代表 snapshot 完成 |
| hello-rejected | type/protocolVersion/wireId/error | 重复/形态/协议错误，不写业务 state |
| command-request | type/protocolVersion/wireId/requestId/commandId/parentCommandId?/commandName/payload | payload 参与 target 求值，不带可转发 target |
| command-result | type/wireId/requestId/commandId/status/result?/error? | 本地结果，safe error |
| command-cancel | type/wireId/requestId/commandId | 取消尚未执行命令 |
| state-full | type/wireId/sliceName/direction/revision/value | 只允许 members/master-to-slave，完整值 |
| ping/pong | type/wireId/sequence | 保活，不改变 paired |

所有 ID bounded；payload 必须可序列化且不得有 token、cookie、password、原始 IP 或 raw diagnostic。sliceName 只允许 members；routeContext、session、requestLedger、runtime root 拒绝。单连接单 peer，第二个 hello 拒绝。connectionId 区分重连但不改变 paired。parser 对未知字段 fail closed。

### 10.3 transport/native

transport 只负责 frame boundary、cancel token、connection identity、heartbeat、replaceServers、sticky address、bounded retry；不读取业务 state、不决定 screen part/command target。

native adapter 只负责固定端口 listener、identity endpoint、单 peer WS、frame 转交、status/diagnostics 和 stop 资源释放；重复 start/stop 幂等。CP-0 以实际 Gradle resolution 选择 Android-compatible server 依赖，禁止手写协议 parser。

## 11. 证据执行体（设计基线；实际结果见 CP-5 evidence）

本节保留设计阶段的执行体、反例和档位定义。实施后的真实结果统一见
`doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`
和 `doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md`，
不把计划态文字改写成运行结果。

| U | 执行体 | 对应缺陷的反例 | 档位/当前 |
|---|---|---|---|
| U-1 | pairing actor 的 command trace + 终态 slice focused | 交换 SLAVE/VICE 顺序或只断言命令发出 | focused/OPEN |
| U-2 | switchDisplayRole 的 getDisplayInfo port、command result、最终 slice focused | count>1、失败、缺失或非整数仍写 VICE | focused/OPEN |
| U-3 | Root Surface routeContext 与 display-role admission focused | PRIMARY/SECONDARY/缺 routeContext 的准入边界放宽 | focused/OPEN |
| U-4 | 两 app 真实 assembly 的 SLAVE+VICE+MAIN catalog/container focused | 任一 app secondary part 空、只测 catalog 不测真实容器 | focused/OPEN |
| U-5 | 两 runtime 实例的 role hydrate/reset focused/native | 只测 VICE 保留，漏双屏 CHIEF 或 port failure repair | focused/native（设计档位；实际见 CP-5 evidence） |
| U-6 | AppControlPort resetRuntime successor-runtime observation | 只看 port succeeded、不验证新 JS runtime 和持久值 | focused/native/OPEN |
| U-7 | 两真实设备经 enableSlave actor 的 host/hello managed runner | fixture 直接 port.start、移除 lifecycle actor、单进程假双机 | native/Android/OPEN |
| U-8 | 两 app 双设备 command request/result round trip | 只验发送或用同进程 fake peer；超时/迟到不归一 | native/Android/OPEN |
| U-9 | 主机已有 peer 时第二连接的 occupancy probe | 只看第二连接失败，不验证既有连接和 ROLE_OCCUPIED | native/Android/OPEN |
| U-10 | 断线期间主机改 members，重连后 state.full readback | 只验连接恢复、不制造断线期间差异或不验值 | native/Android/OPEN |
| U-11 | power request/confirm/cancel actor focused + stale-precondition fixture | 无确认即写、cancel 写入、确认前事实已变仍执行 | focused/native/OPEN |
| U-12 | JS restart 后首个 power event focused | 首个播种事件误切 displayRole | focused/OPEN |
| U-13 | 两 app 生产 assembly 的 topology tab/render smoke focused | 只测一个 app、tab 声明存在但实际 section 不可渲染 | focused/OPEN |
| U-14 | requestLedger declaration/readback + wire capture | 什么都不做；session/ledger 出现在 state.full；方向漂移 | focused/native/OPEN |
| U-15 | transport contract vectors；单 IP 消费者不足时保持未验证 | 只因 API 存在就声称多地址 failover 已验证 | focused contract/scope-open（设计档位；实际见对账） |
| U-16 | identity HTTP readback before WS + cancel path managed scenario | 先开业务 WS、身份来自本地字符串、取消仍写 locator | native/Android/OPEN |
| U-17 | desired/actual host lifecycle + JS restart + SLAVE negative scenario | 只写 flag、SLAVE 起 host、JS reload 丢 flag | native/Android/OPEN |
| U-18 | mobile form focused/visual 与 tab presence | 隐藏 tab、误放行 VICE/enable、无可读 reason | focused/visual/OPEN |
| U-19 | sample-terminal local dual-screen vs two-device stepwise scenario + reconnect | 单进程假双机、只比截图/target、不验两侧终态和断线不退化 | native/Android/visual/cleanup/OPEN |
| U-20 | payload-driven dispatch + receiver local normalization + both-app scenario | static command list、default peer、一次双写、receiver 回环 | focused/native/OPEN |
| U-21 | slave VICE unpair stage trace | MASTER 先于 CHIEF、locator 先清导致 hydrate 误配对 | focused/native/OPEN |
| U-22 | host route enumeration + unauthenticated mutation probe | 保留 POST/PUT/DELETE 变更端点、status 写 state、只验返回码 | static/native/OPEN |

### 11.1 U-7 runner

实施时新增 tools/terminal-topology/run-dual-device.mjs，作为记录式受管执行体。它必须启动两个真实 Android emulator/device 进程，记录 host/boot/start token、日志和 package；只通过 App/JS enable actor 触发 host；记录 nodeId、role、mode、display shape、runtime session、connectionId、requestId；能执行 pair/reset/state.full/command/reconnect/unpair；business 和 cleanup 分离；未知进程、残留 host、残留 emulator 或日志缺失均不得报 cleanup PASS。不能按端口/命令名猜进程，不能同进程起两个 runtime。

动态证据分两阶段：阶段一只使用当前已有的两台单屏 laptop 虚拟机，完成所有双机行为、两个 app 的 host/建连、命令往返、角色占位、断线重连 full sync、identity-before-WS、desired/actual+JS restore、解绑、endpoint probe 与双机侧会员登记逐步记录；阶段一结束必须回收两台虚拟机及其 host/runner 资源并向 Dexter 报告。阶段二只能在 Dexter 启动单机双屏与 mobile 虚拟机后进行，补做单机双屏会员登记对照、双屏 hydrate 改回 CHIEF，以及 mobile topology tab 恒显和 disabled+reason。阶段二未运行时其设备判据保持 OPEN，不能以 focused、结构断言、截图差分或 mock 顶替。

## 12. 前批 screen-part 契约依赖（不纳入本批实现）

本批完整实现双机拓扑基建，但不吸收 screen-part-form-resolution 批次的实现范围。其需求、详设、实现交接和 evidence 是本批的前置依赖：

- dependency requirements：doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md
- dependency design：doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md
- dependency implementation handoff：doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-review-handoff-codex.md
- dependency code/design reconciliation：doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md

本批不重新实现或修改该批的 screen-part form resolution、catalog 冲突检测、ready/failure classification、ScreenReadyBoundary 或 readyPartKey。CP-0 只核对它们的既有结果能被本批的 topology catalog、routeContext 和 U-19 行为对照消费；若前批未达到其 handoff 声明的开工条件，本批保持 OPEN，不把前批条目重新拆成当前 CP。

本批自己的 runtime 诊断仍使用 runId、connectionId、requestId、commandId；只记录 nodeId、role、mode、operation、reasonCode、phase、safe endpoint kind、elapsed bucket 和 counts，禁止 password、token、cookie、Authorization、原始 IP、raw payload 和敏感 error message。

## 13. 现有源码与测试影响

必须重开并逐点对账：

- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts 的 12 个 hasSecondarySurface 调用，全部改为 topology-aware capability；不改 resolveSecondarySurfaceAvailable、sample-wallpaper-console caller、dev-host caller 和四个物理 helper tests。
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts 与 createCommandActorDispatcher.ts 的共同 boundary；member commands 仍默认 local，route resolver 只改变本次 dispatch 的目标。
- apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts 的既有 sync descriptor，按 D-18 改为 topology-local 语义，确保 peer command 仍有本地 lifecycle。
- apps/terminal/kernel/feature/sample-member-registry 的 members slice 改为 master-to-slave full sync；session 及 requestLedger 不进入白名单。
- apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts、AdminSectionRenderContext、AdminSectionContent、AdminSectionNavigation 两形态，新增 topology capability/roster，不复制 admin assembly。
- 两个 integration 的 assembly/parts 与本批 topology assembly focused tests：验证 topology section 和各自 secondary allowlist 通过 shared capability 接入。
- skeleton-graph、package.json、workspace、invariants、census、各中文 README 一并同步。

## 14. 风险、停止条件与交付门

实施前必须关闭或显式保留：

1. server dependency 的 Android 可用性；
2. 前批 screen-part 契约的 handoff 与 code/design reconciliation 仍可被本批消费；前批实现不在本批重做；
3. POC/v2 外部引用不能升级为仓内事实；
4. 双设备 runner 的资源、重连、冷启动和 cleanup 能力。

这些 OPEN 不由写计划自动关闭。发现需求与硬约束不能同时满足时，停在 owning boundary，报告事实、反例、更小替代和 Dexter 决策点，不自行放宽。

交付前：

- 步骤级三维对账逐 CP 完成；
- 全批三维对账在任何整体测试和设备运行之前完成；
- 主 agent 按需求、本文、计划、源码、测试、README、runner 逐行对账，结果只允许 MATCHED 或 OPEN；
- 任一 OPEN 的交付语句必须是“实施未就绪”；
- Claude/Dexter review 不替代对账，本文不宣称 implementation、acceptance、visual、release 或 cleanup PASS。

## 15. 详设自查

| 项目 | 状态 |
|---|---|
| 业务目标、裁定、硬边界直接来自需求正本 | READY |
| D-1 至 D-21 有结论、owner、验证和反例 | READY；DR-01 OPEN，DR-02 已由 Codex 代 Dexter 裁决 |
| U-1 至 U-22 有执行体、红夹具、证据档位 | IMPLEMENTED；真实结果见 CP-5 evidence 与最终对账 |
| IA、interaction、两形态、copy、a11y/focus 有落点 | READY_FOR_REVIEW |
| native server、双设备 runner、设备/release evidence | CLOSED_FOR_EXECUTION；两阶段 business/cleanup PASS，U-5 设备角色观察标为 supporting |
| 独立 DESIGN 对抗 review | ROUND_2_COMPLETE；本轮 implementation authorization 已生效，后续独立步骤对账按 CP 执行 |

## 16. 实施后证据更新

CP-0 至 CP-4 的步骤级三维对账和整体测试前的全批三维对账仍以各自 evidence 为准；CP-5
真实执行记录为：

`doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`

阶段一双机单屏 laptop 与阶段二单机双屏/mobile 均已分别完成，两个阶段的最终 profile
均为 `BUSINESS=PASS`、`CLEANUP=PASS`。主 agent 的逐代码/详设逐行回读、U-1 至 U-22
证据矩阵和 fresh CP-5 对账状态见：

`doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md`

本更新不代表 implementation acceptance 或 Claude/Dexter review 已 GO；U-15 的多地址
通用行为仍按设计标为本批 scope-open，U-5 的设备步骤没有伪造私有 VICE 存储注入。
