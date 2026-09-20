REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=IMPLEMENTATION_REVIEW_HANDOFF
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_REVIEW
EVIDENCE_STATUS=STATIC_FOCUSED_KOTLIN_NATIVE_DEVICE_CLEANUP
ACCEPTANCE_STATUS=NOT_CLAIMED
INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER

## 背景

本交接对应 TER 双机拓扑基础设施加固需求的 CP-0 至 CP-4 实施，以及阶段一双机单屏和阶段二单机双屏
动态验证。设计复评结论为 `GO,M/S/N=0/1/3`，Dexter 随后授权按详设与实施计划完成实施和动态验证。

本批已完成：不更换 NanoHTTPD；transport 直接使用 `fflate@0.8.3` 完成完整 slice 的压缩、文本分片、
重组和边界保护；保留整片同步；将 deterministic payload failure 与 session/peer 生命周期隔离；补齐
副机应用层 heartbeat；按 reference equality 和 transfer-plan 成功点约束 members revision；在真实 module
测试冻结后拆分 topology 大模块；补齐 Android JVM proof、静态门和受管双设备/双屏 evidence。

阶段一命令为：

`node tools/terminal-topology/run-dual-device.mjs --stage 1 --app all --master-serial emulator-5554 --slave-serial emulator-5556`

结果为 `TERMINAL_TOPOLOGY_STAGE1=PASS CLEANUP=PASS STAGE2=OPEN`，阶段一结束后按要求停机。

阶段二命令为：

`node tools/terminal-topology/run-dual-device.mjs --stage 2 --shape dual --app all --serial emulator-5558`

结果为 `TERMINAL_TOPOLOGY_STAGE2=PASS CLEANUP=PASS SHAPE=dual`。阶段二的 sample-terminal 双屏角色
hydrate、会员主副屏逐步 partKey/state、JS/冷重启恢复与阶段一对照为 `MATCHED`；
sample-wallpaper-terminal 的双屏 hydrate、topology smoke 与 cleanup 也为 `PASS`。

fresh 独立 adversarial subagent 曾按要求启动并经过三次有界读取，但未返回最终报告。依据项目已授权的
主 agent fallback 规则，步骤级对账、CP-3 后全批三维对账和交付前逐代码/详设对账由主 agent 完成，状态保持
`OPEN_DEXTER_WAIVER`。本交接不把该 fallback、设计 review 或本文档自身写成 fresh independent verdict。

## 评审目标

请独立复核当前源码、详设、计划与 evidence 是否真正满足以下 implementation 范围：

1. CP-0 的旧 CP-2 指令已先分类，limiter 已删除且没有换名复活；`fflate` 是 transport 的直接依赖，
   D-12 的四份 fixture、实际 fflate chunk 数和 overflow 预检与 manifest 一致；
2. CP-1 的 Android server/status/address、platform-ports parser、缺 topology slice 防护和 JVM test
   真实可执行；
3. CP-2 的 state-full-chunk、压缩/两种 raw fallback、sender/receiver encoded-total 上限、
   deterministic/transient failure 隔离、revision/checksum/reassembly、应用层 heartbeat 和 control
   priority queue 真正落在对应 owner；
4. CP-3 的 members reference equality、send failure revision 不变、并发 command cancel、TTL/容量边界和
   R-15 生产模块拆分没有改变既有业务语义；冻结的 module test 文件没有被修改；
5. 阶段一的双机单屏与阶段二的单机双屏是分开的真实设备 evidence，UI XML/timeline 是 U-4 主证据，
   截图不是唯一 oracle，业务与 cleanup 没有混写；
6. U-1 至 U-18 的执行档位、red mutation、首败/根因/重验记录和 `MATCHED` 对账没有把 focused 或
   supporting evidence 升格为 release、Web、visual 全局或产品 acceptance。

## 需阅读文件

### 权威需求、详设和计划

- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md`：本批需求、R-1～R-16、U-1～U-18 与裁定范围；
- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md`：D-1～D-15、wire/codec/failure/heartbeat 设计与 CP 门；
- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md`：CP-0～CP-4 落点、命令、red mutation 与对账门；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`：上游拓扑通信、R-7 收窄条款和 D-17 来源；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`：旧 CP-2 指令，核对 CP-0 的 supersession 分类；

### 当前源码与测试

- `apps/terminal/kernel/base/contracts/src/types/topology.ts`、`apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts`、`apps/terminal/kernel/base/contracts/src/foundations/topologyTransportConfig.ts`：typed wire、payload failure、配置边界与 parser；
- `apps/terminal/kernel/base/contracts/topology-transport.config.json`、`apps/terminal/kernel/base/contracts/terminal-invariants.json`：固定传输事实与公共面静态约束；
- `apps/terminal/kernel/base/transport/package.json`、`apps/terminal/kernel/base/transport/src/foundations/createTopologyStateTransfer.ts`：fflate 直接依赖、codec、encoded-total 预检和 chunk plan；
- `apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts`、`apps/terminal/kernel/base/transport/src/foundations/createTransportHeartbeat.ts`：重组、session generation、应用层 heartbeat 与控制优先级；
- `apps/terminal/kernel/base/transport/src/foundations/createTopologyIdentityClient.ts`、`apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts`、`apps/terminal/kernel/base/transport/src/foundations/createTransportRetryController.ts`：identity、地址与 retry owner；
- `apps/terminal/kernel/base/transport/test/stateTransfer.test.ts`、`apps/terminal/kernel/base/transport/test/session.test.ts`、`apps/terminal/kernel/base/transport/test/transportPrimitives.test.ts`、`apps/terminal/kernel/base/transport/test/identityClient.test.ts`：codec、重组、heartbeat、边界与 identity focused proof；
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`、`apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`、`apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`、`apps/terminal/kernel/base/topology/src/application/topologyModuleTypes.ts`：R-15 拆分后的 production owner；
- `apps/terminal/kernel/base/topology/test/topology.test.ts`：真实 module 测试、U-13/U-16/U-17 与拆分前后冻结 hash；
- `apps/terminal/kernel/base/platform-ports/src/foundations/parseTopologyHostStatus.ts`、`apps/terminal/kernel/base/platform-ports/terminal-invariants.json`：platform-ports parser 与公共面；
- `apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServer.kt`、`TerminalTopologyHostRegistry.kt`、`apps/terminal/assembly/base/android/android/src/test/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServerTest.kt`：Android server、可变 address、status/close/stats 与 JVM proof；

### Fixture、runner 与 evidence

- `doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json`：四份 fixture 的 hash、canonical members bytes、CP-0 实测来源；
- `doc/plans/platform/fixtures/ter-dual-machine-members-capacity-fixture.json`、`ter-dual-machine-members-multi-chunk-stress-fixture.json`、`ter-dual-machine-members-low-compressibility-fixture.json`、`ter-dual-machine-members-small-raw-fixture.json`：各自绑定的业务/物理边界分支；
- `tools/terminal-topology/run-dual-device.mjs`：阶段一/阶段二受管执行体及设备形态、UI XML、timeline、cleanup readback；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/cp0-preflight-codex.md`：D-15、fflate 实测、overflow 预检和首败；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/cp2-reconciliation-codex.md`：CP-2 对账、focused 命令与边界；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/cp3-reconciliation-codex.md`：R-15 对账、冻结测试 hash 与有效 red mutation；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage1-dynamic-validation-codex.md`：两台单屏 emulator 的阶段一证据；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage2-dynamic-validation-codex.md`：单机双屏阶段二证据，UI XML/timeline 主证据；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/final-implementation-reconciliation-codex.md`：CP/U 总矩阵、逐代码与详设对账及证据边界。

## 独立核验重点

1. 不要只读 manifest 或测试名：用当前 `fflate 0.8.3` 的 `zlibSync`/transport path 复核四份 fixture 的
   branch、encoded bytes、48 KiB chunk 数；确认 `multi-v1` 实际为 8 片，overflow generator 的
   `encodedBytes=8,443,440` 超过 `8,388,608`，且没有把设计时 node-zlib 预览当成 CP-0 runtime 结果。
2. 逐行核对 `createTopologyStateTransfer` 的顺序：压缩/编码后、分片和 transferId 分配前完成发送侧
   total precheck；超限不发任何 frame，接收侧仍保留防御上限；同一 typed `reassembly-overflow`
   不关闭 peer/session、不把 deterministic revision 无限重传。
3. 核对 `createTopologySession` 的 control queue、heartbeat timeout 与 topology module 的普通
   peer-loss/reconnect 边界；heartbeat timeout 不得写 payload terminal，multi-chunk delayed write
   期间 ping/pong 不得被 data queue 饿死。
4. 核对 R-11：无关 slice 不构造 members payload；reference equality 与 revision owner 相互独立；
   transfer plan/write 失败后 `membersSyncRevision` 不变；恢复序列化 fingerprint 不得悄悄回归为 owner。
5. 核对 R-14/R-15：取消按在途 `commandId` 集合而非单槽；`partial-failed`、`timed-out`、`error` 和
   disconnect 都有真实 module 结果；R-15 拆分前后 `topology.test.ts` 内容 hash 与行为证明保持一致。
6. 复核 CP-0 删除 `createTransportLimiter.ts` 后不存在 export/invariant/README/test 残留，也没有在
   阶段二用控制优先级队列换名重建 limiter；本批 transport 只消费批准的拓扑通信形态。
7. 复核 static/focused/Kotlin/native/device/cleanup 分档。阶段一路径为
   `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage1-20260918T100533Z/`，阶段二路径为
   `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage2-20260918T105418Z/`；U-4 必须以第二阶段
   display 0/display 2 UI XML、timeline 和 stepwise comparison 为主，不能以截图或两台单屏机替代。
8. 复核两个阶段的 cleanup readback：app PID/startTicks 为空、runner 无残留、未知进程没有按端口或
   命令名停止；业务 PASS 与 cleanup PASS 必须分别保留。
9. 复核最终对账中 `INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER` 未被改写为完成；本 handoff 的
   目标是请求新的 implementation review，而不是自授 acceptance。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding
请区分仓内源码事实、实际验证事实、推论与尚缺证据的假设，给出仓库相对路径、精确 symbol/行号、
影响面、最小修复建议以及是否需要 Dexter 产品或范围裁决。

即使结论为 `GO`，也只表示当前 `REVIEW_TARGET=IMPLEMENTATION` 范围内的独立 review 结论，不等于
整体产品 acceptance、release PASS、Web PASS、visual 全局 PASS 或未覆盖档位的 PASS。请特别保留
fresh independent subagent review 的 `OPEN_DEXTER_WAIVER` 披露，不要把 Claude DESIGN review 或主
agent reconciliation 当作该独立 verdict。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 双机拓扑基础设施加固的 implementation 做独立复评。

背景：本批需求是 doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md，设计与实施计划已按 CP-0 至 CP-4 落地。阶段一用两台真实单屏 laptop emulator 完成双机流程，结果为 TERMINAL_TOPOLOGY_STAGE1=PASS CLEANUP=PASS；随后按硬停机要求启动单机双屏 emulator，阶段二结果为 TERMINAL_TOPOLOGY_STAGE2=PASS CLEANUP=PASS SHAPE=dual。sample-terminal 的双屏 JS/冷重启恢复、会员主副屏 partKey/state 逐步观察与阶段一对照为 MATCHED，sample-wallpaper-terminal 的双屏 hydrate/topology smoke 与 cleanup 也已记录。当前交付不宣称 implementation acceptance，fresh 独立 adversarial subagent 状态仍是 OPEN_DEXTER_WAIVER：主 agent 按已授权 fallback 完成了三维对账，但没有把它写成 fresh independent verdict。

目标：请独立核验 CP-0 的旧 CP-2 指令分类与 fflate 直接依赖、CP-1 Android/JVM 边界、CP-2 压缩分片/发送与接收上限/typed payload failure/heartbeat、CP-3 reference equality/revision/cancel/R-15 拆分，以及阶段一与阶段二的真实 evidence、cleanup 和 U-1 至 U-18 档位是否与源码和详设一致。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md：需求与 U-1 至 U-18；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md：D-1 至 D-15 与 CP 门；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md：实施落点、red mutation 与对账要求；
- apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts、apps/terminal/kernel/base/contracts/src/foundations/topologyTransportConfig.ts：wire/config owner；
- apps/terminal/kernel/base/transport/src/foundations/createTopologyStateTransfer.ts、createTopologySession.ts、createTransportHeartbeat.ts：codec、chunk、边界和 heartbeat；
- apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、createTopologyStateSyncController.ts、createTopologyPeerCommandController.ts：revision、command cancel 与 R-15 split；
- apps/terminal/kernel/base/topology/test/topology.test.ts：真实 module proof 和冻结 hash；
- apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServer.kt、apps/terminal/assembly/base/android/android/src/test/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServerTest.kt：Android server 与 JVM proof；
- doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json 及四份 fixture：D-12 分母与 fflate 实测；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage1-dynamic-validation-codex.md：阶段一双机单屏 evidence；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage2-dynamic-validation-codex.md：阶段二单机双屏 UI XML/timeline evidence；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/final-implementation-reconciliation-codex.md：最终 U 矩阵与证据边界。

请重点独立核验：发送侧是否在分片前按 encoded total 做 8 MiB 预检且超限零 frame；接收侧是否仍有同一防御闸；payload terminal 是否不关闭 peer/session；heartbeat timeout 是否只走普通 peer-loss/reconnect；无关 slice 是否不构造 members payload；revision 是否只在 transfer plan/write 成功后递增；并发 cancel 是否按 commandId 集合处理；R-15 拆分前后测试文件是否未改且真实 module red mutation 能逮住对应缺陷。请逐份读取两个阶段的 result.json、timeline、UI XML、stepwise comparison 与 cleanup-result.json，不能用截图差分或两台单屏机替代 U-4。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请给出精确仓库相对路径与 symbol/行号、影响面、最小修复建议，并区分源码事实、实际证据、推论和尚缺证据的假设。请保留 static、focused、Kotlin JVM、native/device、cleanup 的证据分档，不要把本地结果写成整体 acceptance、release PASS、Web PASS 或 visual 全局 PASS；也请保留 INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER 的披露。

授权边界：本次只请求对已实施的 TER 双机拓扑基础设施加固做 implementation review。请不要据此扩大需求、改变 Dexter 已定裁决、执行未授权的部署或产品验收，也不要把 review 结论表述成超出上述覆盖范围的 acceptance。谢谢。
```

## 授权边界

本次交付只请求 `REVIEW_TARGET=IMPLEMENTATION` 的独立复评。源码、测试、依赖、受管 runner、两阶段动态
验证和本交接文档均在既有实施授权内；本交接不授权新增产品范围、改写 Dexter 裁定、Web/Metro/seed/UAT/
部署或 release 验收。review 通过与否由 Dexter 和 Claude 根据当前源码与 evidence 定论，Codex 不预先宣称
implementation 或 acceptance PASS。
