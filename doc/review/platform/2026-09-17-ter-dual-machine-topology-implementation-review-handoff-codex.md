# TER 双机拓扑 implementation review 交接

REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=IMPLEMENTATION_REVIEW_HANDOFF
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_REVIEW
EVIDENCE_STATUS=BUSINESS_AND_CLEANUP_CLOSED_WITH_EXPLICIT_SCOPE_BOUNDARIES
ACCEPTANCE_STATUS=NOT_CLAIMED
PRE_DELIVERY_RECONCILIATION=MAIN_AGENT_FALLBACK_AFTER_TWO_FRESH_REVIEW_FAILURES

## 背景

TER 双机拓扑已按 requirements、implementation-facing design 和 implementation plan 完成
CP-0 至 CP-5 的源码实施。阶段一使用两台真实单屏 laptop Android emulator，阶段二使用
单机双屏与 mobile Android emulator；两个阶段分别运行、分别收集 business 与 cleanup，
没有用阶段一代跑阶段二。CP-0 至 CP-4 的步骤级三维对账、以及任何整体测试/设备运行前的
全批三维对账已经保留在既有 evidence；CP-5 的真实动态结果和主 agent 最终回读见本交接的
阅读文件。

本交接只请求 Dexter 和 Claude 对实现源码、验证执行体、证据边界和残留风险做新的
`REVIEW_TARGET=IMPLEMENTATION` 独立复核。它不把 Claude/Dexter review 之前的实现称为
implementation acceptance，也不把本地证据称为产品 release acceptance。

CP-5 步骤级三维对账要求已满足：两次 fresh 只读 verifier 均在有界等待后保持 running、
没有返回 verdict，主 agent 已受控停止并保留状态；随后主 agent 按同一 requirements、
design/plan、project-memory 输入完成 fallback readback，三维均为 MATCHED。该 fallback
不是 fresh PASS，implementation review 仍必须由 Dexter/Claude 独立重新判断。

## 评审目标

请独立核验：

1. CP-0 至 CP-5 是否确实按 requirements 与 design/plan 的 owning source 落地，没有把
   screen-part 前批重新并入，也没有计划外生产落点；
2. 双设备 runner 是否使用真实进程/设备边界、enableSlave 因果链、identity-before-WS、
   route/sync/ledger、断线重连、解绑和 cleanup；
3. 阶段一双机单屏与阶段二单机双屏的 sample-terminal 会员流程是否逐步匹配，mobile 两个
   App 是否都保持 topology tab 恒显且操作 disabled + 可读原因；
4. CP-5 的首败是否被原样保留并按 owning boundary 最小修复，business 与 cleanup 是否独立；
5. U-1 至 U-22 的执行状态、red mutation、focused/native/Android/visual/cleanup 档位是否
   诚实，尤其是 U-5 的设备 supporting 说明和 U-15 的多地址 scope-open；
6. 主 agent 逐代码与详设逐行对账、前置全批对账、CP 步骤级对账的时序是否符合计划，且
   fresh 独立复核是否真的读到了当前字节。

## 需阅读文件

- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`：需求、裁定、R/U/D 及证据边界；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`：implementation-facing 详设、D-1 至 D-21、U 执行体与设计后证据更新；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`：CP-0 至 CP-5 顺序、两阶段停点、失败处理和交付门；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp0-execution-codex.md`：CP-0 source/dependency preflight；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp1-execution-codex.md`：contracts、graph、display-context、topology 和 transport；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp2-execution-codex.md`：Android host、transport、reset/restore 和 lifecycle；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp3-execution-codex.md`：runtime route、receiver、sync、ledger、member-desk 与 red mutation；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp4-execution-codex.md`：admin-shell、两个 integration、mobile disabled reason 和 power；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-full-reconciliation-codex.md`：在整体测试/设备运行前完成的 CP-0 至 CP-4 全批三维对账；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`：阶段一/二真实 release 运行、首败、设备观察和 cleanup；
- `doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md`：主 agent 逐代码/详设逐行对账、U-1 至 U-22 矩阵与 fresh CP-5 对账状态；
- `tools/terminal-topology/run-dual-device.mjs`：受管双设备与单设备形态 runner；
- `apps/terminal/kernel/base/display-context/test/restart.test.ts`：两个 runtime/shared storage 的 VICE hydrate 与双屏 CHIEF 校正 focused proof；
- `apps/terminal/kernel/base/display-context/src/features/actors/validateHydratedDisplayRoleActor.ts`：hydrate 后角色校正 owner；
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`、`apps/terminal/kernel/base/runtime/src/application/createCommandActorDispatcher.ts`：UI/actor 共用 dispatch boundary；
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`、`apps/terminal/kernel/base/topology/src/features/actors/actors.ts`：peer lifecycle、重连、sync、pair/unpair；
- `apps/terminal/assembly/base/android/src/foundations/nativeTopology.ts`：native host bridge 与资源释放；
- `apps/terminal/assembly/android/sample-terminal/android/app/src/main/java`、`apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/src/main/java`：两个 release App 的 native server 接线；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/verification-governance.md`：当前任务上下文、主 agent/独立审查与证据分档约束。

## 独立核验重点

### 源码与边界

- 按 requirements 的 R-1..R-14、R-2a、R-5a、R-9a、D-1..D-21、U-1..U-22 逐项打开 owning source，
  不采信本交接中的总结；确认旧 `resolveSecondarySurfaceAvailable` 仍保持物理语义，
  member-desk 12 个调用点全部切换，routeContext/target 仅由正确 boundary 处理；
- 亲验 `requestLedger` status 使用真实 union，`partial-failed`/`timed-out` 未被文档或实现
  偷换成不存在的 status；确认 wire 不携带 session/requestLedger；
- 检查 `TerminalTopologyServer` 只有身份 GET 和 WS 所需路由，identity 字段最小，未知/错向/超长
  frame fail closed，端口占用是 typed reason；
- 检查两个 integration 的 secondary allowlist、两个 App 的 native host 接线、图/包声明和
  README 是否与当前源码一致，未把 screen-part 前批实现重做或重复落点。

### 真实运行与证据

- 阶段一目录：`.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage1-unpair-wire-repair-37/`。
  亲验两个 App 的 release APK、真实 master/slave 设备、enableSlave→host→hello、命令往返、
  occupancy、断线/重连、full sync、unpair 顺序、endpoint probe 和各自 cleanup；
- 阶段二单机双屏目录：`.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage2-dual-20260918-04/`。
  亲验 display 0/2 的物理映射、sample-terminal 的逐步 UI XML/partKey/state 和与阶段一的
  `stage2-member-stepwise-comparison.json`；不要把默认 CHIEF 观察误写成私有存储注入的
  VICE→CHIEF 设备实验，focused 直接证据在 `display-context/test/restart.test.ts`；
- 阶段二 mobile 目录：`.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage2-mobile-20260918-03/`。
  亲验两个 App 的 360×640 logical mobile、tab 恒显、四个操作 disabled 和可读 reason；
- 逐一阅读 `stage2-dual-20260918-01/02/03` 与 `stage2-mobile-20260918-01/02` 的首败，不得
  用最终 run 覆盖它们；检查每个最终 profile 的 `cleanup-result.json`，区分 runner-owned 资源
  与 Dexter pre-existing emulator；
- 复核 U-15 的多地址通用 runtime 行为仍是本批 scope-open，而不是由单 IP 运行冒充验证；
  复核 U-5 focused VICE 前置和 dual device CHIEF supporting 的分档没有被升格。

### 对账与结论

- fresh 只读审查应重新读本交接、CP-5 evidence、requirements/design/plan、project memory 和
  owning source，输出 CP-5 步骤级三维对账及最终 reconciliation findings；
- 逐行检查主 agent reconciliation 的 `MATCHED`/`OPEN`，发现实际证据不足时保留 `OPEN`，
  不用测试名、退出码、截图差分或结构断言填空；
- 若 fresh 任务失败，保留其真实失败状态；只有在项目既有“多次 fresh 失败后主 agent 完成同范围复核”
  规则适用时，才可由主 agent 明确标注 fallback，不能伪造 fresh PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。
每条 finding 请区分源码事实、证据事实、推论和未证假设，给出仓库相对路径、精确 symbol/行号、
影响面、最小修复建议和是否需要 Dexter 裁决。`GO` 仅表示 implementation review 覆盖范围内
的独立复核结论，不等于产品 acceptance、release PASS 或 visual 全局 PASS；`U-15` 的 scope-open
和 `U-5` 的 supporting 边界必须在结论中明确保留。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 双机拓扑 implementation 做独立复核。

背景：TER 双机拓扑已按需求与 implementation-facing 详设完成 CP-0 至 CP-5。阶段一是两台真实单屏 laptop Android emulator 的双机运行；阶段二是单机双屏与 mobile emulator 的独立运行。两个阶段的最终业务与 cleanup 结果分别为 PASS，但这只是交付证据，不是 implementation acceptance。CP-0 至 CP-4 的步骤级三维对账和整体测试/设备运行前的全批对账已单独留痕；当前请求请重新核验实现源码、CP-5 证据、U-1 至 U-22 分档以及主 agent 最终对账。

目标：请判断当前实现是否满足 requirements R-1..R-14、R-2a、R-5a、R-9a、D-1..D-21 和 U-1..U-22；重点核对真实双设备边界、enableSlave 因果链、identity-before-WS、payload-driven dispatch 与 receiver local 归一、members full sync/requestLedger local、断线重连、unpair 顺序、两个 App 的 release 运行、单机双屏逐步行为对照、mobile tab 恒显 disabled+reason、cleanup 和 evidence-tier 诚实性。请特别检查 U-5 的 focused VICE hydrate 与双屏 CHIEF supporting 证据没有被混写，以及 U-15 多地址通用行为仍保持 scope-open。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md：需求与裁定；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md：详设与 U 执行体；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md：CP 顺序与交付门；
- doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp0-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp1-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp2-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp3-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp4-execution-codex.md：各 CP 实现与步骤级对账；
- doc/evidence/platform/2026-09-17-ter-dual-machine-topology-full-reconciliation-codex.md：整体测试/设备运行前的全批对账；
- doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md：两阶段 release 设备运行、首败、结果与 cleanup；
- doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md：主 agent 逐代码/详设逐行对账、U 矩阵和 fresh 对账状态；
- tools/terminal-topology/run-dual-device.mjs：受管 runner；
- apps/terminal/kernel/base/display-context/test/restart.test.ts、apps/terminal/kernel/base/display-context/src/features/actors/validateHydratedDisplayRoleActor.ts：角色 hydrate focused owner；
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts、apps/terminal/kernel/base/runtime/src/application/createCommandActorDispatcher.ts、apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、apps/terminal/kernel/base/topology/src/features/actors/actors.ts：路由、接收、重连、同步与解绑；
- apps/terminal/assembly/base/android/src/foundations/nativeTopology.ts 及两个 Android App 的 android/app/src/main/java：native host 与 release 接线；
- project-memory/decisions/deterministic-context-only.md、project-memory/operations/verification-governance.md：项目边界与证据规则。

请重点独立核验：
1. 阶段一目录 `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage1-unpair-wire-repair-37/` 的两个 App 真实双机行为、身份先行、host 因果、命令往返、占位拒绝、断线重连、full sync、解绑、endpoint probe 和 cleanup；
2. 阶段二目录 `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage2-dual-20260918-04/` 的 display 0/2、sample-terminal 逐步 partKey/state 对照和 `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage2-mobile-20260918-03/` 的两个 App mobile tab/disabled reason；
3. `stage2-dual-20260918-01/02/03` 与 `stage2-mobile-20260918-01/02` 中保留的首败及其最小修复；
4. U-1 至 U-22 的真实执行体、red mutation、evidence tier，以及 U-5 的 supporting 与 U-15 的 scope-open；
5. CP-5 步骤级三维对账、CP-0 至 CP-4 的前置全批对账和主 agent 逐代码/详设逐行对账是否互相独立、是否都读当前源码。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给出仓库相对路径、精确 symbol/行号、源码或证据事实、影响面、最小修复建议，并区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`；涉及产品/Journey/范围的才标记需 Dexter 裁决。

授权边界：本次只请求 REVIEW_TARGET=IMPLEMENTATION 的独立复核，不授权继续扩大需求、不授权改写 Dexter 已定语义、不授权把 review GO 写成 implementation acceptance、release PASS、visual 全局 PASS 或产品验收 PASS。若发现 OPEN 或实现/证据不一致，请如实报告，不用 focused、截图差分、测试名或退出码冒充业务结论。
```
