# TER 双机拓扑实施计划

SKILL_USED=cs-spec-to-plan@local-.agents/skills/cs-spec-to-plan
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BUSINESS_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md
DEPENDENCY_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md
AUTHORIZED=Dexter 已授权按本计划实施并完成阶段一、阶段二动态验证；本计划不扩大需求范围
IMPLEMENTATION_AUTHORITY=true
PLAN_STATUS=IMPLEMENTATION_IN_PROGRESS
NOT_AUTHORIZED=扩大需求范围、改变已裁定语义、未列入计划的生产落点、设备级开机自启、seed、UAT、部署、Roadmap 推进及仓库控制动作

## 1. 计划目标和边界

### 1.1 目标

按详设完整完成 TER 双机拓扑基建：

- laptop + 单屏是唯一支持形态；两个 app 的 base topology、配对、服务、重连、状态同步、screen/command 行为闭合。
- MASTER 配一个 SLAVE；主机先确认 identity，再写 locator、切角色/模式、reset slave JS、hydrate/connect。
- topology tab 恒显；不适用操作用 disabled + 可读原因；mobile 不以隐藏 tab 表达。
- display-context 继续拥有物理屏事实；topology 拥有 paired/reachable 和 operation-aware eligibility；member-desk 的 12 个调用点全部使用新语义，但旧 physical helper 原样保留。
- runtime dispatch boundary 同时覆盖 UI 和 actor；按每次 payload 决定 local/peer；接收侧归一 local，避免回环；member command 默认 local 不变。
- members 只 master-to-slave full sync；session 和 requestLedger 不跨机；副机 peer command 仍在本地有完整 request lifecycle。
- APP/JS 启动后按 enableSlave 标记恢复 host；不做设备级 boot auto-start。

### 1.2 非目标

不做认证/授信握手、角色矩阵、mobile 拓扑支持、laptop 双屏拓扑、隐藏 tab、通用 UI foundation、App 级 loader、Web L2 代替终端证据、数据库/seed、设备开机自启、协议版本协商、业务层自定义 server 语义或本批未授权的产品范围。

### 1.3 进入实施的前置条件

实施开始前必须由 Dexter/Claude 对本设计和计划作设计评审；评审未完成前不得执行本计划。

进入 CP-0 还必须确认：

1. 当前 requirements 与本设计的裁定版本仍是仓内当前字节；不采信讨论稿、旧 handoff 或作者自报。
2. Android server 依赖能在两个 app 中以同一 wire contract 运行；若现有依赖不存在，依赖选择须先通过设计边界复核，禁止直接手写协议。
3. 按 Codex 代 Dexter 的 DR-02 裁决，allowlist 分母固定为两个 app 各自真实装配的 secondary parts：sample-console 的声明 owner 是 `apps/terminal/ui/feature/sample-member-desk`，开放 customerWelcome/customerMember；sample-wallpaper-console 开放 waiting/welcome；不开放 primary-only part。
4. 可以提供两个真实 Android emulator/device 的受管进程或设备边界；单进程两个 JS runtime 不合规。
5. 2026-09-16 screen-part-form-resolution 批次的已落地契约可被当前拓扑消费；该批不是当前实现范围，不能在本计划中重做。

前置不满足时不开工；不把失败的基线或缺失 runner 改写成通过。移除前批实现不缩减本批 R-1 至 R-14 的完整拓扑基建。

## 2. 交付物总表

| 交付物 | 预定路径 | 归属 |
|---|---|---|
| shared surface/topology contracts | apps/terminal/kernel/base/contracts | SurfaceForm、wire types/parser/golden vectors |
| topology kernel | apps/terminal/kernel/base/topology | eligibility、pairing、lifecycle、sync policy、operation capability |
| transport extensions | apps/terminal/kernel/base/transport | frame、session、heartbeat、retry、cancel、replaceServers |
| display-context extensions | apps/terminal/kernel/base/display-context | SurfaceForm import、root route stamp、power confirm |
| runtime/state extensions | apps/terminal/kernel/base/runtime、state | dispatch route、receiver normalize、ledger local、full sync |
| integration assembly changes | apps/terminal/ui/integration/sample-console、sample-wallpaper-console | topology parts/allowlist/assembly capability |
| admin control page | apps/terminal/ui/base/admin-shell | topology section、IA、two layouts、copy/a11y/focus |
| member-desk migration | apps/terminal/ui/feature/sample-member-desk | 12 个调用点切 topology-aware predicate |
| Android hosts | apps/terminal/assembly/android/sample-terminal、sample-wallpaper-terminal | 同构 native adapter、AppControl 接线 |
| graph/docs | apps/terminal/skeleton-graph.ts、package.json、README、invariants/census | 依赖、数量和 TR-10 同步 |
| managed executor | tools/terminal-topology/run-dual-device.mjs | 双真实设备动态执行、日志和 cleanup |
| evidence/review | doc/evidence/platform、doc/review/platform | 分档证据、对账、handoff |

以上是计划中的落点清单，不代表本轮已经创建或修改。未来任何不在本表、且未在详设第 9/13 节对账表出现的生产落点，都是 scope drift，应停止并回到 Dexter。

## 3. 顺序与门控

### 3.1 依赖顺序

~~~text
CP-0 source/dependency preflight
  → CP-1 contracts + display-context + topology pure rules + graph
  → CP-2 transport + two Android native hosts + JS reset/restore
  → CP-3 pairing + sync + dispatch + member-desk
  → CP-4 admin-shell + power + integration assembly/allowlist
  → CP-5 real dual-device runner + dynamic/visual/release/cleanup
~~~

CP-3 是机制批的收口，CP-4 是本批 topology admin section 批。screen-part 的 form resolution、catalog 冲突、ready/failure 和 admin declaration split 已由 dependency source 管理；本批只消费其现状，不重复实施。CP-4 不得在机制批全范围三维对账 MATCHED 之前开始。

每个 CP 的闭环严格是：

1. 主 agent 读取该 CP 对应 requirements、详设/IA、项目 memory 和 owning source；
2. 主 agent 完成该 CP 的源码/测试/README/runner 变更；
3. 主 agent 运行该 CP 的最小 focused proof，保留原始输出；
4. fresh 只读独立子 agent 按需求、详设/IA、项目 memory 三维逐项对账，输出每项 MATCHED 或 OPEN；
5. 有 OPEN，主 agent 按 owning source 修复并让同一 CP 重新 focused proof，再接受新的独立复查；
6. 只有全项 MATCHED 才能开始下一 CP。

所有 CP 完成后、任何整体测试、设备运行或视觉观察之前，fresh 独立子 agent 再做全批三维对账。该对账不是前面结果的汇总，必须重新从需求与 owning source 找跨 CP 偏移。

## 4. 逐 CP 执行步骤

### 4.1 CP-0：source、分母和依赖 preflight

不改业务源码；允许在本 CP 为 DR-01 增加并验证候选 Android server 依赖声明，只有解析成功且后续原生实现实际使用时才保留。

步骤：

1. 重开 requirements 第 0.3、R-1..R-14、U-1..U-22、D-1..D-21 和第 8.3 节；确认裁定不被实现重新谈判。
2. 重开详设第 0、5、6、7、8、9、10、11、12、13、14 节和 dependency source 的 handoff/reconciliation；建立本 CP 的 input version 记录，未执行动态动作。
3. 用 rg 重新枚举 member-desk 的 12 个 hasSecondarySurface 调用；同时枚举 resolveSecondarySurfaceAvailable 的两个 production callers 和四个 tests，列为保留分母。
4. 逐包读取两个 integration 的 assembly/parts，列出所有 secondary part、每个 part 的 form/instanceMode/workspace，确认 DR-02。
5. 读取两个 Android app 的 build.gradle、settings、现有 native module、manifest 和 platformPorts；实际解析是否存在 Android-compatible HTTP/WS server 依赖。没有依赖时不得先写实现。
6. 读取 skeleton-graph 的 DSL、package.json、root workspace、invariants/census 生成方式，确定 topology node 的真实声明方式。
7. 读取 TopologyHostPort、AppControlPort、PeerDispatchGateway、createStateRuntime 和 requestLedger 的 owner/生命周期，形成 owner 矩阵。
8. 只读检查 v1/讨论稿路径是否已经废弃；不存在则记录 OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED，存在则只登记候选，不在本轮无授权删除。

CP-0 红线：dependency 不可用、四项 allowlist 无法从当前两个 integration 真实装配核实、无法在 CP-5 提供真实双设备边界、或任何硬约束无 owner 时状态为 OPEN，不进入下一步。当前 runner 尚未创建本身不是阻断；它是 CP-5 的明确交付物，若到 CP-5 仍无法提供则在该处停下。

### 4.2 CP-1：contracts、display-context、topology 和 graph

预定落点：

- apps/terminal/kernel/base/contracts/src/types/display.ts
- apps/terminal/kernel/base/contracts/src/types/topology.ts
- apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts 及其 public type/export
- apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts
- apps/terminal/kernel/base/topology/src/features/slices/topology.ts
- apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts
- apps/terminal/skeleton-graph.ts、topology/package.json、相关 README/invariants/census

步骤：

1. 把 SurfaceForm 的唯一公共类型放到 contracts；ui-state 若仍需向旧消费者提供类型，只做 re-export，不复制 union。
2. 定义 TopologyOperation 和闭合 reasonCode；纯 evaluator 消费 operation、SurfaceForm、物理 display count、instanceMode、displayRole、paired、peerReachable，但只返回当前操作的 allowed/reason。原始 facts 与 hasTopologySecondarySurface 由独立只读 selector 提供。
3. facts selector 的 secondary 语义严格为物理双屏或 MASTER+paired；peerReachable 不参与该 boolean。pair/unpair/enable-host 分别求值，UI 不得以 paired/reachable 自算 operation allowed。
4. 不在本批实施 screen-part 的 catalog 冲突检测或 pre-filter；CP-0 只确认 dependency source 已提供的 catalog 输入可被 topology allowlist 消费，避免把前批实现重新并入。
5. 定义 D-21 的 parser 和 golden vectors：hello、identity、command-request/result/cancel、state-full、ping/pong、closed error；字段缺失、未知 type/field、方向错误、超长 payload 都 fail closed。
6. 为 topology slice 定义 pairing facts、desired host state、peerReachable 和 repair state；不把 raw native status 直接暴露给 UI。
7. 同步 graph、直接依赖、root workspace、节点计数、invariants、census 和中文 README；检查 type-only/re-export/dynamic import 方向。

CP-1 focused/red：

- evaluator operation 维度删除；
- UI 改用 facts 自算 allowed；
- 复制 SurfaceForm union；
- graph 节点漏 package.json 或反向依赖；
- parser 删除 field validation。

期望结果：纯规则、类型、graph、协议 parser 的 focused/static 均成立；尚未宣称 native/Android。

### 4.3 CP-2：transport、Android host 和 App/JS restore

预定落点：

- apps/terminal/kernel/base/transport/src/... topology frame/session/heartbeat
- apps/terminal/kernel/base/platform-ports/src/types/topologyHost.ts（只扩展现有 port 所需能力）
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/java/.../topology/
- apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/src/main/java/.../topology/
- 两个 Android app 的 platformPorts、MainApplication/MainActivity 或现有 native module 接线
- apps/terminal/kernel/base/topology 的 host lifecycle actor

步骤：

1. 依 CP-0 已确认的 server 依赖实现同构的 Android adapter；若无现成依赖，只使用通过 review 的 Android-compatible 单一 server 依赖，禁止手写 HTTP/WebSocket framing。
2. adapter 提供固定 port 43172、base path /terminal-topology、只读 status identity endpoint 和单 peer WS；start/stop 幂等，关闭时释放 listener/session；bind 失败若为占用必须返回 TOPOLOGY_HOST_PORT_OCCUPIED。
3. native host 只通过现有 TopologyHostPort 暴露 status/address/diagnostics；不让 UI 直接调用 start/stop；不新增 BootReceiver、BOOT_COMPLETED 权限或设备级自启。
4. topology lifecycle actor 以 enableSlave、MASTER、single-screen、laptop 和 desired/actual 指纹串行决定起停；start 后先读真实 address/status，再 connect、hello、snapshot。
5. 复用 AppControlPort.resetRuntime。pair 中 host/服务稳定后切 slave/vice，再 reset JS；reset 不重建 native host。失败调用 repair，确保 CHIEF→MASTER→clear locator。
6. 两 app 的 package/application identity、HTTP status、WS frame、错误 code、heartbeat 和日志字段使用同一 contracts vectors；不要从 app 名称分叉协议。
7. 记录真实 native/readback 日志；敏感字段不写入。

CP-2 focused/native red：

- 删除 desired/actual reconcile；
- 把 fixture 对 TopologyHostPort.start 的直接调用当成成功；
- 在 SLAVE 上 enable host；
- 删除 JS hydrate restore；
- 增加 BootReceiver；
- 把端口占用吞成无原因的 TOPOLOGY_HOST_FAILED；
- Kotlin parser 接受未知字段或错误 direction。

CP-2 收口需要 native adapter 的 focused/Android supporting evidence；没有双设备 runner 不得把 U-7/U-17/U-19 标成完成。

### 4.4 CP-3：机制批

预定落点：

- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts、相关 route policy
- apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts、peer receiver
- apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts
- apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
- 两个 integration assembly/parts 和 assembly tests（真实 secondary allowlist）
- topology sync/dispatch actor 与相关 focused tests

步骤：

1. 在 UI 与 actor 共同汇入的 runtime dispatch boundary 引入 typed route resolver。每次 dispatch 读取 payload 的 displayMode/container/part 或 typed route intent 与 topology facts，严格得出 local 或 peer；不以命令身份静态名单作唯一依据。
2. 保持 member command 的默认 target local。主机 local 路径不绕 peer；需要两侧变化时由上游明确发两次 dispatch，而不是让一次 dispatch 隐式双写。
3. peer receiver 丢弃入站 target 和 routeContext，设置 origin=peer 的内部标志并调用 local dispatch；禁止再次求 peer，验证无回环。
4. 对 showScreen、openLayer、clearLayers 各做一次只经 render boundary、绕过 runtime dispatch boundary 的 production red mutation；每一条都必须由 CP-3 focused proof 捕获。它们不是“看过调用路径”的确认动作。
5. members slice 改为 master-to-slave full sync；按实际 secondary parts 的读取反推 allowlist；session 保持 isolated，requestLedger 设为 local topology policy，并保留副机本地生命周期。
6. 用真实 createCommandPeerDispatcher focused fixture 让副机发起 peer command，按真实 status union 断言副机本地 lifecycle：挂起时覆盖 RequestLifecycleStatus=`started`、CommandAggregateStatus=`running`；远端 completed/timed-out/error 覆盖本地 completed/timed-out/error；远端 partial-failed 按单个 peer-dispatch actor 的真实聚合语义归一为本地 error，不伪造一个不可达的单 actor partial-failed；RequestLifecycleStatus 与 CommandAggregateStatus 的 partial-failed 由现有多命令/多 actor 聚合测试覆盖。registered/dispatched/accepted 若出现在日志只能作为 phase，不得写入 status union；wire 不出现 ledger state.full。
7. member-desk 12 个调用点全部改为 topology-aware operation capability；不改 resolveSecondarySurfaceAvailable、其两个 production callers 或四个既有 tests。
8. 为 pair/unpair 修复路径补 stage log 和 focused tests；unpair 严格 CHIEF→MASTER→clear locator。

CP-3 focused/red：

- 删除 payload route resolver；
- receiver 透传 peer target/routeContext；
- 把默认 target 改成 peer；
- 把 requestLedger 或 session 放进 state.full；
- 反转 unpair 顺序；
- 只改 member-desk 的部分调用点；
- 恢复现有 mode-based requestLedger syncIntent 而没有 topology-local red；
- 取消 showScreen、openLayer、clearLayers 任一 runtime boundary red mutation。

CP-3 收口是机制批的前置门：步骤级三维对账 MATCHED，之后才允许 CP-4。此时不得先做 admin 版式。

### 4.5 CP-4：admin-shell 与两 integration

预定落点：

- apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts
- apps/terminal/ui/base/admin-shell/src/types/adminSection.ts
- AdminSectionContent、AdminSectionNavigation、AdminSectionNavigationLaptop、AdminShellLaptop/Mobile 相关装配
- apps/terminal/ui/base/admin-shell/src/parts/parts.ts
- 新 topology section 的 base package 文件，单机型组件文件名含 laptop/mobile
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx、parts、tests
- apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx、parts、tests
- display-context power request/confirm/cancel owner 与 focused tests

步骤：

1. 在 adminTestIds topology namespace 注册 section、identity、query、pair、unpair、enable、status、reason、alert 和 power confirmation IDs；不把 R/U 编号放入 runtime/test 文件名。
2. 在 AdminSectionRenderContext 中增加只含 getSnapshot、getOperationEligibility、query、pair、unpair、setHostEnabled 的 typed topology capability；section 不得拿 Runtime、stateSource、platform port、native lifecycle。
3. topology tab 以 laptop/mobile 两个 sibling 或等价真实 catalog entry 恒显；mobile 只把不支持操作置灰并显示原因，不隐藏 section。
4. laptop 复用 vertical master-detail；mobile 复用 wrap navigation 和纵向 content；两形态共用 hook，layout 不判 paired/reachable/operation。
5. 按 D-16 统一使用 operation-aware evaluator；所有 disabled copy 和 retry copy 来自 reason mapping，断线不抢焦点、不退化。
6. power 操作由 display-context owner 提供 request/confirm/cancel actor；confirm 时重新读 display/role/form/mode；cancel 零写；auto confirm 3 秒。
7. 两个 integration 将 topology section 和各自真实 secondary allowlist 接入同一 shared console assembly；本批 focused tests 验证 topology section 与 allowlist 的 assembly 契约。
8. 四个相关 package README 按 TR-10 同步；示例回源码。

CP-4 focused/red：

- 去掉 mobile topology catalog entry；
- 让 section 直接读取 Runtime/platform port；
- 以 peerReachable 决定 secondary 或启用性；
- 删除 operation 参数；
- power confirm 不重读事实；
- 任一 integration 缺少 topology section 或其真实 secondary allowlist；
- integration 直接复制 admin parts 或只注入一个 app。

### 4.6 CP-5：受管双设备、动态、视觉和 cleanup

预定新增执行体：

tools/terminal-topology/run-dual-device.mjs

runner 约束：

- 两个真实 Android emulator/device，两个真实 app 进程或设备边界；不得单进程两个 runtime。
- 按 run-scoped manifest 登记 host、boot id/start token、PID、package、日志路径、设备 display shape；不按端口/命令名猜归属。
- host 必须由 enableSlave actor 链路启动；runner 不持有 TopologyHostPort.start。
- 支持 identity-before-WS、pair、reset、state.full、command round trip、断线、重连、unpair、服务 stop 和 cleanup。
- 断线期间允许命令 send failure，但不允许 paired 语义、surface predicate 或 UI 退化；重连后按完整 snapshot 恢复。
- business 与 cleanup 分开；未知进程、残留 host、残留 emulator、缺日志或资源回收失败不得报告 cleanup PASS。

执行顺序：

1. 先确认 CP-0..CP-4 的步骤级和全批三维对账都是 MATCHED；全批对账必须在本步骤任何整体测试之前完成。
2. **阶段一（现有两台单屏 laptop 虚拟机）**：通过受管 runner 运行两 app 的 U-16 identity-before-WS、U-17 desired/actual/JS restart、U-7 enableSlave→host→hello 因果链。
3. **阶段一**：运行 U-8/U-20 command routing、receiver local normalize、单主单副角色占位拒绝和 endpoint/mutation probe；用日志、两侧终态与真实设备边界判定，不只看 exit code。
4. **阶段一**：运行 U-10/U-14 members full sync、requestLedger local、断线变化后的 full recovery，以及双机侧 sample-terminal 会员登记流程逐步记录。
5. **阶段一**：运行 U-21 unpair 顺序；记录两个 app 各自 host/连接/清理结果。U-9、U-22 的动态结果在阶段一收口，但静态/ focused 结果仍按对应 CP 单独记录。
6. **阶段一停点**：不得运行任何阶段二场景。先分别读取日志、run manifest、PID/start token、设备状态，完成两台虚拟机、host、连接和 runner 的资源回收；business 与 cleanup 分开记录。向 Dexter 报告阶段一结果，并明确列出阶段二所有判据为 OPEN，逐项写“等待 Dexter 启动对应形态虚拟机”。不得用 focused、结构断言、截图差分或 mock 顶替阶段二设备观察，不得把单机双屏未跑说成行为一致已验证。
7. **阶段二（仅在 Dexter 启动对应形态虚拟机后）**：在单机双屏形态补跑 sample-terminal 会员登记流程的逐步记录，与阶段一双机记录逐步对照；补跑重启时已是双屏必须改回 CHIEF 的设备级分支。
8. **阶段二**：在 mobile 形态验证 topology tab 恒显、拓扑操作置灰和可读不可用原因；不以隐藏 tab 或结构断言替代设备观察。
9. **阶段二收口**：分别完成 business/cleanup，读取两阶段证据并复核 U-1..U-22 的覆盖；任一阶段或任一前置对账仍 OPEN 时，交付语句必须是“实施未就绪”。

## 5. 每批测试和判据对应

| 批次 | focused/static | native/Android/managed | 对应 U |
|---|---|---|---|
| CP-0 | graph/source/owner/dependency/preflight | 不执行 | 进入全部 U 的前置；无 U 通过声称 |
| CP-1 | contracts parser、evaluator、route stamp、graph | 不执行设备 | U-2/U-3/U-22 的静态部分 |
| CP-2 | lifecycle actor、reset/repair、desired/actual、parser | 两 app native status/WS smoke | U-5/U-6/U-7/U-16/U-17 的对应部分 |
| CP-3 | payload target、receiver local、sync allowlist、ledger、12 调用点、U-1 precondition order | 两设备 command/sync | U-1/U-4/U-8/U-10/U-14/U-20/U-21 |
| CP-4 | topology UI capability、tab/copy/a11y/focus、power、真实 assembly | 不替代设备证据 | U-1/U-4/U-11/U-12/U-13/U-18 |
| CP-5 | runner self-check、证据读取、cleanup checks | U-7..U-22 full managed/native/Android/visual | U-7 至 U-22 |

U-1 至 U-22 的真实执行体、red mutation 和证据档位以详设第 11 节为单一对账表；计划不以测试名、退出码或路径字符串冒充业务 oracle。

## 6. 逐代码与详设对账

该对账是 review handoff 的硬前置，不等同于步骤级三维对账，也不等同于测试。

### 6.1 主 agent 逐行方法

完成 CP-5 后，主 agent 必须按以下顺序逐行核对，不抽样：

1. requirements R-1..R-14、R-2a、R-5a、R-9a、U-1..U-22、D-1..D-21；
2. design 第 0、2、3、4、5、6、7、8、9、10、11、12、13、14 节；
3. 本 plan 第 1、3、4、5 节每一个步骤、落点、反例和 evidence；
4. 实际源码、测试、README、graph、native adapter、runner 和 evidence path。

每行填写：

| 字段 | 要求 |
|---|---|
| requirement/design anchor | 精确到 R/U/D 或 design/plan 标题与短语 |
| source/test/evidence path | 仓库相对路径和唯一 symbol/section anchor |
| expected property | 行为、位置、copy、状态、失败/恢复、a11y/focus、owner、数据来源 |
| actual observation | 只能写源码/测试/日志/设备的实际观察 |
| result | 仅 MATCHED 或 OPEN |
| unresolved action | OPEN 必填 owning source、最小修复、下一次 focused proof |

任何只有“计划中会做”却没有 actual source/evidence 的行是 OPEN。任何 OPEN 时，交付语句必须是“实施未就绪”。

### 6.2 三维对账与逐代码对账的不可替代性

- 步骤级三维对账：确认每一个 CP 没有偏离需求、详设/IA、项目 memory 规范。
- 全批三维对账：在整体测试前重新找跨 CP 的 owner、状态、失败、用户可见行为和边界偏移。
- 逐代码与详设对账：确认每一个设计落点在真实源码/测试/runner/evidence 有实际对应。

三者任一缺失都不能生成 review handoff；后续动态结果不能把前置 OPEN 改成 MATCHED。

## 7. 失败处理

任一命令、focused test、native smoke、受管 runner 或设备观察失败时：

1. 保留原始 stdout/stderr、结构化日志、run manifest 和失败时的资源状态。
2. 记录 first failure、last known good、broken boundary、business result 与 cleanup result。
3. 按 owning source 定位根因；先读失败边界上下游和同根反例，不延长 timeout、不盲目重跑、不用路径/退出码改写业务结果。
4. 只做详设已列落点内的最小修复；修复后只 focused 重验受影响判据，再回到对应 CP 的独立三维对账。
5. 同一 signal 第二次尝试前必须完成边界诊断；无日志或日志缺失记 LOG_NOT_AVAILABLE/OPEN。
6. 若发现需求冲突、server 依赖不可用、双设备边界不可提供或计划外生产落点，停止并交 Dexter，不静默放宽。

## 8. 证据分档和交付

证据档位独立记录：

- static：graph、依赖、源码导入、命名、endpoint 暴露扫描；
- focused：纯函数、owner、catalog、dispatch、sync、UI capability、a11y/focus；
- native/Android：两个 app 的真实 native host、reset、status/WS、冷启动；
- Web：本批不是 Web L2；记录 NOT_APPLICABLE_WITH_REASON，不用 Web 代替终端；
- visual/release：真实设备、单机双屏/双机双屏、mobile tab、断线、解绑和布局；
- cleanup：runner 进程、host、emulator、日志、资源回收。

未执行档位明确 OPEN 或 NOT_APPLICABLE_WITH_REASON；不以设计描述、测试名、退出码、作者自报或 Claude 逻辑 review 升格。动态 evidence 必须读取日志并分离 business/cleanup。

交付 review handoff 前必须同时有：

1. CP-0..CP-5 的步骤级三维对账；
2. 全批三维对账（在任何整体测试之前）；
3. 主 agent 逐代码与详设逐行对账，全部 MATCHED；
4. U-1..U-22 的执行结果和对应 red mutation 记录；
5. 双设备 runner 的真实过程/设备证据和 cleanup；
6. REVIEW_TARGET=IMPLEMENTATION 的另行 implementation review 交接。当前这两份文档只请求 DESIGN review，不宣称 implementation 或 acceptance GO。

## 9. 计划自查与未决

| 检查项 | 设计态状态 |
|---|---|
| D-1..D-21 有实施落点 | READY；DR-01 OPEN，DR-02 已按四项 allowlist 裁决 |
| U-1..U-22 有执行体和红夹具 | READY；尚未执行 |
| CP 依赖与机制/管理台先后 | READY；机制 CP-3 先行，UI CP-4 后行 |
| screen-part dependency | READY_AS_EXTERNAL_DEPENDENCY；不在本批重做 |
| R-6/D-20 的 APP/JS restore | READY；CP-2 |
| 双设备受管执行体 | READY_AS_DELIVERABLE；尚未创建/运行 |
| 三维对账 | REQUIRED_PER_CP_AND_FULL_BEFORE_TESTS |
| 逐代码与详设对账 | REQUIRED_BEFORE_REVIEW_HANDOFF |
| 当前实施 | IN_PROGRESS；CP-0 已开始，已完成候选依赖声明与 Gradle 解析，业务实现尚未进入 |

任何未决项不因本计划存在而自动关闭。设计 review 前，本轮只交付详设、计划和 review request。
