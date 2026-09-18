# TER 双机拓扑 implementation 收口对账

REVIEW_KIND=IMPLEMENTATION_RECONCILIATION
OWNER=Codex
REQUIREMENTS_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md
PLAN_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md
PRETEST_FULL_BATCH_RECONCILIATION=MATCHED
CP5_STEP_RECONCILIATION=MATCHED
CP5_STEP_RECONCILIATION_OWNER=MAIN_AGENT_FALLBACK
CODE_DESIGN_RECONCILIATION=MATCHED
CODE_DESIGN_RECONCILIATION_OWNER=MAIN_AGENT
IMPLEMENTATION_ACCEPTANCE=NOT_CLAIMED

## 1. 对账边界和时序

本文件不是 Claude/Dexter 的 implementation review verdict，也不是 acceptance。它记录主
agent 在阶段二完成后重新读取需求、详设、计划、项目 memory、源码、测试、runner 和设备
证据的结果，并等待一项新的 fresh 只读 CP-5/全批复核。前置全批对账
`doc/evidence/platform/2026-09-17-ter-dual-machine-topology-full-reconciliation-codex.md`
是在任何整体测试和设备运行前完成的，不能被本文件重写成发生在设备运行之后。

对账顺序真实为：

1. CP-0 至 CP-4 各自完成步骤级三维对账并记录在对应 CP evidence；
2. CP-0 至 CP-4 完成后、整体测试和设备运行前完成全批三维对账，状态为 `MATCHED`；
3. 主 agent 完成 CP-5 两阶段设备运行、读取业务/cleanup 产物并做本文件的逐代码与详设回读；
4. fresh 只读审查者复核 CP-5 步骤级三维对账和本文件的全批/逐代码引用；其结果写入本文件
   的 §5，不由本文件的主 agent 自称为 fresh verdict。

## 2. CP-0 至 CP-4 前置结果

| CP | 步骤级三维对账 | 证据 |
|---|---|---|
| CP-0 | MATCHED（source/dependency preflight） | `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp0-execution-codex.md`；v1 路径核对 `OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED` |
| CP-1 | MATCHED | `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp1-execution-codex.md`；contracts、topology、transport、display-context、graph 与 static 输出 |
| CP-2 | MATCHED | `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp2-execution-codex.md`；native compile、host lifecycle、reset/restore 与 repair |
| CP-3 | MATCHED | `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp3-execution-codex.md`；runtime boundary、receiver local normalize、sync/ledger、member-desk 与 red mutation |
| CP-4 | MATCHED | `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp4-execution-codex.md`；admin capability、恒显 tab、mobile disabled reason、power 与两个 integration |

以上 CP evidence 中的 fresh 任务失败和主 agent fallback 均原样保留；fallback 是项目已确立
的失败处置，不被叙述成 fresh PASS。前置全批对账同时确认：CP-4 未越过 CP-3 机制门、CP-5
没有被提前执行、screen-part 前批只作为 dependency 消费。

## 3. 主 agent 逐代码与详设回读

结果字段仅使用 `MATCHED` 或 `OPEN`。每行重新对照 requirements / design / plan 的 anchor
和真实 source/test/evidence；设备档位不由 focused/static 推导。

### 3.1 Requirements 与 owning source

| requirement | owning source / evidence | 实际回读性质 | result |
|---|---|---|---|
| R-1、R-2、R-2a | `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`、`apps/terminal/ui/base/admin-shell` | 拓扑能力、角色/机型准入、operation-aware disabled reason；CP-1/CP-4 focused 与 mobile 设备观察 | MATCHED |
| R-3、R-4 | `apps/terminal/kernel/base/topology/src/features/actors/actors.ts`、`apps/terminal/assembly/base/android/src/foundations/nativeTopology.ts`、两 Android app | identity-before-WS、enableSlave、APP/JS restore、固定 host lifecycle；阶段一 timeline 与 CP-2 proof | MATCHED |
| R-5、R-5a | `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`、`apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts` | 物理 helper 未改；member-desk 12 个调用点使用 paired secondary 语义，断线不降级；CP-3 red 与阶段一断线/重连 | MATCHED |
| R-6 | `apps/terminal/kernel/base/display-context/src/features/actors/validateHydratedDisplayRoleActor.ts` | JS restart 后按 display count 校正角色，focused restart matrix；双屏设备重启观察 CHIEF/MASTER | MATCHED |
| R-7、R-8 | `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts`、`apps/terminal/kernel/base/transport`、Android `TerminalTopologyServer.kt` | 本仓字段级 wire、HTTP identity、单 peer、hello、state/full、heartbeat、错误和资源释放；CP-1/CP-2 与阶段一 endpoint/WS | MATCHED |
| R-9、R-9a、R-10 | `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`、`createCommandActorDispatcher.ts`、`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` | UI/actor 共用 runtime dispatch boundary；payload 决定 local/peer，receiver 归一 local，routeContext 不过线；CP-3 三条 boundary red | MATCHED |
| R-11 | `apps/terminal/kernel/feature/sample-member-registry`、`apps/terminal/kernel/base/topology`、`stage1.../result.json` | members 仅 master-to-slave full sync，session/ledger 不跨机；阶段一断线期间变更、重连后恢复 | MATCHED |
| R-12 | `apps/terminal/kernel/base/topology/src/features/actors/actors.ts` | 配对建立与解绑顺序、持续重连和 locator 清理；阶段一 unpair/reconnect timeline | MATCHED |
| R-13 | `apps/terminal/assembly/android/.../TerminalTopologyServer.kt`、stage1 endpoint probe | 仅身份 GET 与 WS；未鉴权变更探测拒绝；阶段一 probe 输出 | MATCHED |
| R-14 | `apps/terminal/kernel/base/display-context` power commands/actors | request/confirm/cancel 的 focused proof 和确认时 fresh read；本批没有用设备截图替代 focused 语义 | MATCHED |
| U-1 至 U-6 | display-context/topology focused logs、`display-context/test/restart.test.ts` | 配对顺序、物理门、route stamp、真实 catalog、两个 runtime hydrate/reset 由当前测试和源码闭合 | MATCHED |
| U-7 至 U-10 | 阶段一两个 profile 的 `result.json`、timeline、cleanup-result | enableSlave 因果起 host、跨机 command、1:1 occupancy、断线重连 full recovery 真实设备完成 | MATCHED |
| U-11、U-12 | display-context focused test/logs、`createPowerStatusBridge` | power command/cancel/re-read 与重启首事件播种保持；设备 runner 不声称未执行的 power UI | MATCHED |
| U-13、U-14 | CP-3/CP-4 evidence、阶段一 topology/admin、stage2 mobile | 两 App section/allowlist、ledger local、wire 不含 ledger；focused 与设备 UI readback | MATCHED |
| U-15 | `apps/terminal/kernel/base/transport` contract vectors | 详设已明确本批没有多地址真实消费者；contract 形状有 focused proof，通用 multi-address runtime 行为保持范围内未验证，未被写成 PASS | MATCHED |
| U-16、U-17 | 阶段一两个 profile `result.json`、endpoint/log readback | identity 先于 WS、enableSlave 驱动 desired/actual host、JS restart restore、SLAVE 不起 host | MATCHED |
| U-18 | 阶段二 mobile 两 profile `result.json` 与截图 | 360×640 logical mobile 下 topology tab 恒显，操作 disabled，reason 可读；两个 App 均完成 | MATCHED |
| U-19 | 阶段一 sample-terminal 与阶段二 dual `stage2-member-stepwise-comparison.json` | 双机单屏与单机双屏按 partKey/state/display 逐步对照，结果 MATCHED；断线保持 secondary 语义 | MATCHED |
| U-20 | CP-3 route red、阶段一 command/result 与两侧状态 | payload-driven peer、receiver local、单写者 members、master local 未被改坏 | MATCHED |
| U-21、U-22 | 阶段一 unpair timeline、endpoint/mutation probe、CP-3 red | CHIEF→MASTER→locator clear、无鉴权变更端点扫描与身份最小字段 | MATCHED |

### 3.2 D-1 至 D-21 与详设落点

| D | 详设落点 | source/evidence readback | result |
|---|---|---|---|
| D-1 至 D-4 | 详设 §9、§10、计划 §4.4/§4.6 | tab 恒显、operation eligibility、identity、43172 host/error；CP-4 与阶段一/二 | MATCHED |
| D-5 至 D-10 | 详设 §9、§10.1、§13；计划 CP-1/CP-2/CP-3 | routeContext、APP/JS restore、pair/unpair、native owner 与固定 server | MATCHED |
| D-11 至 D-15 | 详设 §9、§8 IA；计划 §3/§4 | 依赖顺序、admin 定位、视觉分档、full sync、power confirmation | MATCHED |
| D-16 至 D-17 | `evaluateTopologyOperation.ts`、member-desk actors、CP-3/CP-4 tests | facts 与 operation result 分离；paired/peerReachable 正交；12 点全切且旧物理 helper 保留 | MATCHED |
| D-18 | `apps/terminal/kernel/base/runtime/test/requestLedgerLifecycle.test.ts`、CP-3 red | peer command 本地 lifecycle 使用真实 union，partial-failed/timed-out 没有反向改 contracts；wire 不含 ledger | MATCHED |
| D-19 | `createCommandDispatcher.ts`、receiver in `createTopologyModule.ts`、CP-3 red | runtime boundary 依据 payload，接收侧强制 local，三类屏幕迁移各有 red | MATCHED |
| D-20 | `createTopologyModule.ts`、CP-2、阶段一 JS restart | 只做 APP/JS 启动后按持久标记恢复；无 BOOT_COMPLETED/BootReceiver | MATCHED |
| D-21 | `topologyWire.ts`、transport tests、Kotlin server、阶段一 probe | 字段级契约、方向/大小/未知字段 fail closed、资源释放与 endpoint | MATCHED |

### 3.3 计划 CP 与步骤

| plan anchor | 实际落点 | result |
|---|---|---|
| §3.1 CP-0→CP-1→CP-2→CP-3→CP-4→CP-5 | CP evidence、当前源码和阶段运行顺序一致；CP-4 未早于机制门，CP-5 在前置全批对账之后 | MATCHED |
| §4.1 CP-0 | 依赖/owner/分母、v1 路径与 `OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED` 已记录 | MATCHED |
| §4.2 CP-1 | contracts/display-context/topology/transport/graph 与 CP-1 evidence | MATCHED |
| §4.3 CP-2 | native host、reset/restore、desired/actual、无 boot auto-start 与 CP-2 evidence | MATCHED |
| §4.4 CP-3 | route/sync/ledger/member-desk、三条 boundary red 与 CP-3 evidence | MATCHED |
| §4.5 CP-4 | topology admin、two app allowlist、mobile disabled reason、power 与 CP-4 evidence | MATCHED |
| §4.6 CP-5 阶段一 | 两台真实单屏 laptop emulator、两个 App profile、business/cleanup 分离、阶段一停点已执行 | MATCHED |
| §4.6 CP-5 阶段二 | 单机双屏 member 对照、dual CHIEF/MASTER、mobile 两 App 恒显/disabled reason 均已执行 | MATCHED |
| §5 判据矩阵 | 当前 U 矩阵见本文件 §4，动态证据见 CP-5 evidence；U-15 的范围限制没有被遮蔽 | MATCHED |
| §6 逐行对账 | 本文件 §3 按 requirement/D/plan anchor 与 source/evidence 回读 | MATCHED |
| §7 失败处理 | 所有 stage2 首败与修复目录保留在 CP-5 evidence；无盲重跑或 timeout 掩盖 | MATCHED |
| §8/§9 交付门 | 本文件、handoff 和 checker 是最终交付收口；不宣称 acceptance | MATCHED |

## 4. U-1 至 U-22 实际证据矩阵

“结果”表示判据在其适用的证据档位中有真实执行体；`scope-open` 表示详设明定本批不
声称该通用行为已验证，不是把未验证改成 PASS。`red` 只引用实际存在的红变异或 focused
negative branch，不用测试名/退出码/路径字符串代替业务观察。

| U | 实际执行与结果 | red / 反例记录 | 档位 |
|---|---|---|---|
| U-1 | PASS：阶段一 `slave-role-after-pair`，最终 SLAVE/VICE；CP-2/CP-3 actor 顺序 focused | CP-2 pairing order focused negative；阶段一最终 slice readback | focused + native/Android |
| U-2 | PASS：display-context derivation/behavior 的 succeeded、count>1、malformed、unavailable 分支均读端口、命令结果和 slice | `apps/terminal/kernel/base/display-context/test/derivation.test.ts` negative cases | focused |
| U-3 | PASS：PRIMARY/SECONDARY/缺 routeContext 的 render/dispatch focused | CP-3 `red/show-screen-runtime-boundary-bypass.log`、`red/clear-layers-runtime-boundary-bypass.log` | focused |
| U-4 | PASS：两个 integration 的真实 assembly/catalog；阶段一/二真实 member partKey 进一步证明实际容器 | CP-4 两 app allowlist focused negative | focused + native/Android |
| U-5 | PASS：两个 runtime shared-storage restart test；双屏 release 设备观察 CHIEF/MASTER。设备步骤没有私有存储注入，focused test 是 VICE 前置的直接证据 | `apps/terminal/kernel/base/display-context/test/restart.test.ts` R-2/R-3/R-4 | focused + native/Android supporting |
| U-6 | PASS：阶段一 host/JS restart 的 successor PID/start ticks 与持久状态 readback | CP-2 reset/restore focused negative | focused + native/Android |
| U-7 | PASS：阶段一两个 App 均由 enableSlave actor 链路起 host，副机经真实 endpoint/WS hello | CP-2 `unavailableTopologyHostPort` 与 lifecycle-removed focused red；阶段一因果 timeline | focused + native/Android |
| U-8 | PASS：阶段一真实跨设备 command/result，`sample-terminal` 和 `sample-wallpaper-terminal` 均完成 host/peer 流程 | CP-3 payload/receiver red；阶段一两侧 result/readback | focused + native/Android |
| U-9 | PASS：阶段一第二连接 `ROLE_OCCUPIED`，已有 peer 仍保持 | CP-1/CP-2 role occupancy negative；阶段一 occupancy probe | focused + native/Android |
| U-10 | PASS：阶段一断线期间 members 变化，重连后 full recovery；profile result 与日志均保留 | CP-3 state-full/ledger isolation red；阶段一 disconnect/reconnect timeline | focused + native/Android |
| U-11 | PASS：display-context power request/confirm/cancel 与确认时 fresh-read focused | CP-4 `red/power-confirm-no-reread.log` | focused |
| U-12 | PASS：重启后 power bridge 首事件只播种、同值去重的 focused proof | display-context focused negative/behavior branch | focused |
| U-13 | PASS：两个 App 的真实 topology section/allowlist；阶段二两个 mobile App 也真实可见 | CP-4 `red/missing-mobile-topology-part.log`、两个 allowlist red | focused + native/Android |
| U-14 | PASS：requestLedger local declaration、peer lifecycle focused、wire/state.full readback 无 ledger | CP-3 `red/request-ledger-state-full.log`；`requestLedgerLifecycle.test.ts` | focused + native/Android |
| U-15 | MATCHED：transport contract vectors 有 focused proof；本批只有单 master/单 IP，多地址 failover/replaceServers runtime 行为按详设明确保持 scope-open，未被写成已验证 | 详设 §11 U-15 明列 scope limitation；无真实 multi-address red 被伪装成设备结果 | focused contract / scope-open |
| U-16 | PASS：阶段一 identity-before-WS、取消不写 locator 的真实流程与 endpoint 观察 | 阶段一 identity timeline；CP-3 route/target negative | focused + native/Android |
| U-17 | PASS：默认关闭、enableSlave 起停、JS restart restore、SLAVE 不起 host 均在阶段一 readback | CP-2 lifecycle/SLAVE negative；阶段一 host PID/status | focused + native/Android |
| U-18 | PASS：阶段二 mobile 两 App 真实 tab visible、四操作 disabled、可读 reason | stage2-mobile screenshots/UI XML；stage2 mobile negative controls | native/Android + visual supporting |
| U-19 | PASS：阶段一双机与阶段二单机双屏 member stepwise comparison `MATCHED`, missing=[]；显示 partKey/state/displayId 逐项读回 | CP-3 `red/member-desk-partial-call-migration.log`；双屏比较 JSON | native/Android + visual supporting + cleanup |
| U-20 | PASS：阶段一副机 intent→主机写入→full sync；主机 local path 未变 | CP-3 `red/default-local-target-peer.log`、`red/receiver-peer-target-passthrough.log`、`red/payload-route-resolver-removed.log` | focused + native/Android |
| U-21 | PASS：阶段一 unpair timeline 观察 CHIEF→MASTER→locator clear、peer notice、host stop | CP-3 `red/unpair-order-reversed.log`；阶段一 unpair XML/result | focused + native/Android |
| U-22 | PASS：阶段一 endpoint 枚举、unauthenticated POST/PUT/DELETE probe 拒绝、identity 最小字段 | `.runtime/.../stage1-unpair-wire-repair-37` endpoint probe；CP-2 closed-error red | static + native/Android |

## 5. 独立对账状态

`INDEPENDENT_REVIEW_STATUS=FAILED_TO_COMPLETE_MAIN_AGENT_FALLBACK`。

本阶段 fresh 只读审查必须核对：

1. CP-5 evidence 是否真的覆盖计划阶段一停点、阶段二范围、两阶段 business/cleanup 分离；
2. §3 的每一行是否有真实 source/test/evidence，而不是只复述计划；
3. §4 的 U-1 至 U-22 是否把 scope-open、focused supporting 和设备业务结果区分开；
4. U-5 的设备 supporting 说明是否诚实，没有把默认 CHIEF 观察写成私有 VICE 注入；
5. 全批前置对账仍保持“设备运行之前”的时序事实；
6. 是否有计划外生产落点、未记录的首败、未关闭 cleanup 或应保留 OPEN 的行。

fresh 结果未返回：第一位任务 `01a0b1e5-1ab1-7e82-91e7-d031d5d8da6f` 在多次有界等待后
仍为 `running`，第二位任务 `01a0b1e9-6b71-7bb1-9cda-d3b4ebb14f8b` 在两次有界等待后
仍为 `running`；两者均由主 agent 受控停止，前后状态和无 verdict 事实已记录在
`doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`。
它们都没有写文件、运行动态环境或产生可采纳 finding，因此不被改写成 fresh PASS。

按项目既有规则，主 agent 已对同范围 requirements/design-plan/project-memory 三维、CP-5
两阶段 JSON/timeline/UI/cleanup、U-1 至 U-22 矩阵、前置全批对账时序和本文件全部引用做
fallback readback，结果分别为 `MATCHED`。该结果明确标记为 `MAIN_AGENT_FALLBACK`，等效
关闭 CP-5 步骤级对账执行前提，但不替代后续 Dexter/Claude 的 implementation review。

## 6. 最终交付边界

阶段一和阶段二的动态结果都已真实读取为 `BUSINESS=PASS`、`CLEANUP=PASS`；实现代码、
focused/static、Android release、双机/双屏/mobile 设备观察和 cleanup 的证据路径已列出。
这只说明交付材料具备进入 `REVIEW_TARGET=IMPLEMENTATION` 独立评审的输入，不表示
implementation acceptance、visual/release 全局 PASS 或 Claude/Dexter 已批准。
