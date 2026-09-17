REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=NOT_APPLICABLE_RETIRED_COMPLIANCE_CONTROL
ADVERSARIAL_REVIEW_REPORT=INDEPENDENT_DESIGN_REVIEW_REQUIRED_BEFORE_IMPLEMENTATION
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW

## 背景

TER 双机拓扑需求稿已经收口，Dexter 已裁定适用范围、等价性、信任边界、enableSlave 语义及其余第 0.3 节事项。本次产物是 implementation-facing 详设和实施计划，不是源码实现；当前没有构建、测试、设备、Web、Metro、动态或 cleanup 证据。

详设和计划把 laptop 加单屏作为唯一支持形态，把 MASTER/SLAVE、paired/reachable、screen/command route、full state sync、Android host、App/JS restore 和 shared admin-shell topology UI 连接成一个可执行方案。前一批 screen-part form-resolution 的已落地契约作为明确前置依赖；本批不重复实施该批的声明拆分、ready/failure 或 catalog 机制，因此不缩减当前 R-1 至 R-14 的完整双机拓扑基建范围。

本交接只请求 DESIGN review。INDEPENDENT_DESIGN_REVIEW_REQUIRED_BEFORE_IMPLEMENTATION 仍为 YES；本文档不把任何未执行的 U 或 CP 写成通过，也不把设计 review 当成 implementation acceptance。

## 本轮复评处置

针对上一轮 NO-GO 的处置已写回详设与计划：

- M-1（CONFIRMED）：移除不属于当前需求正本的 screen-part 实现范围，包括声明拆分、ready/failure 改造和 catalog 冲突/pre-filter；保留其已落地契约、handoff 与 code/design reconciliation 作为前置依赖。当前 R-1 至 R-14 的双机拓扑 transport、topology、native host、routing、sync、reset、admin UI、双设备执行体仍全部在本批范围内。
- M-2（CONFIRMED）：按当前 contracts/runtime 的真实 status union 重写 D-18/U-14；不新增 registered/dispatched/accepted 等伪 status，也不修改 union，并为 requestLedger 的 topology-local 迁移保留反向 red mutation。
- S-1（CONFIRMED）：将只读 topology facts 与 operation-aware evaluator 分离；evaluator 只返回当前 operation 的 allowed/reason，UI 不得用 paired/reachable 自行重组。
- S-2（CONFIRMED）：D-1/D-2 已按需求编号分别对齐 topology tab 可用性和 host identity/endpoint。
- S-3（CODEX 代 Dexter 裁决）：为兑现两个 app 都跑通，allowlist 采用每个 integration 的真实 secondary 分母：sample-console 为 customerWelcome/customerMember，sample-wallpaper-console 为 waiting/welcome；不开放 primary-only part，不修改需求正本。
- S-4（CODEX 代 Dexter 决定实现形态）：固定 43172 不做静默回退；端口占用有独立 typed reason、可读提示和 focused red fixture。
- N-1/N-2：CP-3 已将 showScreen、openLayer、clearLayers 三条 runtime-boundary 证伪变异写成可执行 red；native/visual 证据仍按未执行档位保持 OPEN。

## 评审目标

请从实施方立场独立判断：

1. 详设是否逐项闭合需求 D-1 至 D-21，实施计划是否能按 CP-0 至 CP-5 落地而没有隐藏的 owner、依赖、协议、生命周期或 evidence 缺口；
2. D-16 operation-aware eligibility、D-17 paired/reachable 正交性、D-19 UI+actor runtime dispatch boundary、D-21 字段级 wire contract 是否足够可证伪；
3. 两个 Android app 的真实 native host、APP/JS 启动恢复、resetRuntime、双设备受管执行体是否是可执行而非设计口号；
4. D-14/D-18 的 members full sync、session/requestLedger local、peer command 本地 lifecycle 是否与当前源码 owner 一致；
5. topology tab 恒显、mobile disabled+reason、laptop master-detail、focus/a11y、两个 integration 共用 base section 的 IA 是否可实现且没有隐藏 tab 或 App 级复制；
6. U-1 至 U-22 的执行体和红夹具能否逮住对应缺陷；哪些必须标 UNVERIFIED/OPEN，哪些需要 Dexter 裁决；
7. 是否存在比方案更小、但仍满足已裁定语义和真实双设备可证伪性的替代。

请不要把讨论稿、POC、旧 handoff、作者自报数字或本交接的设计结论当作源码真相；请从仓库当前字节重开 owning source。

## 需阅读文件

- doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md
- doc/decisions/templates/implementation-design-template.md
- doc/decisions/templates/ui-interaction-design-template.md
- doc/decisions/templates/ia-design-template.md
- doc/platform/terminal-coding-standard.md
- doc/platform/review-standard.md
- apps/terminal/kernel/base/platform-ports/src/types/topologyHost.ts
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts
- apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts
- apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts
- apps/terminal/kernel/base/runtime/src/types/peer.ts
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts
- apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts
- apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
- apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts
- apps/terminal/ui/base/admin-shell/src/types/adminSection.ts
- apps/terminal/ui/base/admin-shell/src/parts/parts.ts
- apps/terminal/ui/integration/sample-console
- apps/terminal/ui/integration/sample-wallpaper-console
- apps/terminal/assembly/android/sample-terminal
- apps/terminal/assembly/android/sample-wallpaper-terminal
- apps/terminal/skeleton-graph.ts
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md（仅核对前置依赖边界）
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-review-handoff-codex.md（仅核对前批已落地状态）
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md（仅核对前批对账状态）

## 独立核验重点

1. D-1/D-16：topology tab 是否在所有形态与状态下恒显并以 operation-aware disabled/reason 呈现；operation 是否真正进入同一个纯 evaluator，使 query、pair、unpair、enable-host 的 allowed/reason 不会被一条公共 boolean 混淆；前批 catalog 结果是否只是被正确消费而没有被本批重做。
2. D-17：新 topology secondary 语义是否严格为物理双屏或 MASTER+paired；peerReachable 是否完全正交；member-desk 12 个调用点是否全部切换，同时 resolveSecondarySurfaceAvailable 及其两个生产调用方、四个测试是否保持物理语义。
3. D-19：策略是否确实落在 UI 和 actor 共同进入的 runtime dispatch boundary；target 是否由每次 payload/context 求值而非命令静态名单；member 默认 local 是否保持；peer 接收是否归一 local 且无回环。
4. D-14/D-18：members、session、requestLedger 的精确同步集合、方向、重连 full snapshot 和副机本地四态 ledger 是否与 owning source 一致；requestLedger 当前声明与设计处置是否能由 focused fixture 证伪。
5. D-21：请逐字段核对 hello、identity、command request/result/cancel、state-full、heartbeat、错误、方向、长度、未知字段、单 peer occupancy、routeContext 剥离和无认证边界；确认 Kotlin 与 TypeScript 不会各自复制协议语义。
6. D-20/D-8/D-9：APP/JS hydrate 恢复服务、无设备级 boot auto-start、desired/actual 串行对账、resetRuntime 与 pairing/unpair 补偿顺序是否自洽；Android server 依赖缺证据是否正确保留为 CP-0 OPEN。
7. D-3/D-13：两个 integration 的真实 secondary allowlist（sample-console 的 customerWelcome/customerMember；sample-wallpaper-console 的 waiting/welcome）是否完整；admin-shell 的 laptop master-detail、mobile wrap、tab 恒显、disabled+reason、焦点/a11y、testID 和两个 integration 的实际装配是否有具体落点。
8. U-1 至 U-22：逐条把对应反例代入，判断执行体会不会红；尤其 U-7 是否真正禁止 fixture 持有 TopologyHostPort.start、U-19 是否真的要求两个真实进程/设备、U-20 是否能抓 receiver 回环、U-22 是否能抓未鉴权变更 endpoint。
9. 计划门控：CP-3 机制批全范围三维对账是否确实先于 CP-4 admin 重排；全批三维对账是否先于任何整体测试/设备运行；逐代码与详设对账是否是 review handoff 的硬前置，且 OPEN 不得写实施就绪。
10. 设计风险：DR-01 的 Android server 依赖是否应保持 OPEN；DR-02 已由 Codex 代 Dexter 裁决为两个 app 各自真实装配的 secondary allowlist，复核其是否与 requirements 的“双 APP 跑通”和 U-4/U-13 闭合。

## 期望结论

请给出 GO 或 NO-GO，并报告 M（major）、S（significant）、N（note）数量。每条 finding 请：

- 区分仓内事实、外部事实、推论和未证实假设；
- 标明 owning source、详设/计划落点和适用条件；
- 给出可复现的仓库相对路径、symbol/section anchor、命令或 focused/native 核验方式；
- 用反例说明“缺陷真实发生时是否会红”；
- 区分 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION；
- 若建议收窄或删减，说明为什么不破坏已裁定的用户语义、等价性和真实双设备验收；
- 不把当前设计文档的计划态 OPEN 升格为执行 PASS，不把设计 GO 表述为 implementation acceptance。

## 可直接复制给 Claude 的话术

```text
您好 Claude，

背景：
TER 双机拓扑需求稿已经收口，Dexter 已裁定 laptop 加单屏唯一支持、双机与单机双屏行为等价、一主一副且不认证、拓扑 tab 恒显、限制用 disabled 加可读原因、掉线持续重连不退化、主副角色属于 base 能力，以及 enableSlave 在 APP/JS 启动后按标记恢复而不做设备级开机自启。本次交付的是 implementation-facing 详设和实施计划，不是源码实现；当前没有构建、测试、设备、Web、Metro、动态或 cleanup 证据。

目标：
请独立评审两份产物能否进入实施，重点核验 D-1 至 D-21 是否逐项闭合、CP-0 至 CP-5 是否可执行、U-1 至 U-22 的执行体是否能逮住对应缺陷，以及是否存在更小但仍满足已裁定语义和真实双设备边界的方案。请不要把讨论稿、POC、旧 handoff 或作者自报当源码真相，务必从当前仓库字节重开 owning source。

请从仓库根阅读：
1. doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md
2. doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md
3. doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md
4. doc/platform/terminal-coding-standard.md
5. apps/terminal/kernel/base/platform-ports/src/types/topologyHost.ts
6. apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts
7. apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts
8. apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts
9. apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts
10. apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts
11. apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
12. apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts
13. apps/terminal/ui/base/admin-shell/src/types/adminSection.ts
14. apps/terminal/ui/integration/sample-console
15. apps/terminal/ui/integration/sample-wallpaper-console
16. apps/terminal/assembly/android/sample-terminal
17. apps/terminal/assembly/android/sample-wallpaper-terminal
18. apps/terminal/skeleton-graph.ts
19. doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md（仅核对前置依赖边界）
20. doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-review-handoff-codex.md（仅核对前批已落地状态）
21. doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md（仅核对前批对账状态）

请重点独立核验：
一，D-16 的 evaluator 是否带 operation 维度，D-17 的 paired/reachable 是否正交，member-desk 12 个调用点是否全切且旧物理 helper 未被改坏。
二，D-19 是否在 UI 与 actor 共用的 runtime dispatch boundary 按 payload 求 target，member 默认 local 是否保留，peer receiver 是否归一 local 并防回环。
三，D-14/D-18 的 members full sync、session/requestLedger local、重连恢复和副机本地 ledger 四态是否真正可证伪。
四，D-21 的 field-level wire contract、双 Android host、APP/JS restore、resetRuntime、无 BootReceiver、单 peer 和无认证边界是否完整；server dependency 的未核状态是否应保持 OPEN。
五，D-1/D-3/admin IA 的真实装配、mobile tab 恒显、disabled+reason、laptop master-detail、焦点/a11y，以及两个 integration 各自 secondary allowlist 的完整分母。
六，逐条把 U-1 至 U-22 的缺陷反例代入；特别检查 U-7 不能直接持有 TopologyHostPort.start，U-19 不能用单进程假双机，U-20 必须能抓 receiver 回环，U-22 必须覆盖无鉴权变更端点。
七，确认 CP-3 机制批和三维对账先于 CP-4 admin 重排，全部 CP 完成后全批三维对账先于任何整体测试/设备运行，逐代码与详设对账全部 MATCHED 才能交 review。

请给出：
GO 或 NO-GO；M/S/N 数量；每条 finding 的严重度、状态、仓内事实/推论/尚缺证据、owning source、详设/计划落点、可复现核验方式和反例。若需要 Dexter 裁决，请单独标 DEXTER_DECISION；不要自行改需求裁定。

授权边界：
本次只授权对需求、详设和实施计划做 DESIGN review，不授权实施、修改源码/测试/脚本/依赖、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或任何仓库控制动作。review GO 也不等于 implementation acceptance；是否进入实施由 Dexter 另行决定。

谢谢。
```
