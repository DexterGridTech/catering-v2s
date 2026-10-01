# 批次二 implementation re-review 请求

## 背景

Claude 对《终端激活与长连接》批次二实施复核原结论为 `NO-GO`，`M/S/N=0/3/2`。主 agent 已修复原评审的 S-1/S-2/S-3 与 N-2；N-1 未证明为真实生产故障，仍作为 `UNVERIFIED_REQUIRES_EVIDENCE` 保留。CP-03 与整批 6b fresh 对账均为 `MATCHED`。新一轮 fresh 独立整批 review 给出 `NO-GO`、`M/S/N=0/1/1`：唯一 S 认为 TER 应拒绝未知 TDS 消息类型。Dexter 已裁定保留当前静默忽略行为，该 S 按 `DEXTER_DECISION` 关闭，不改源码。reviewer 的补充只读 pass 检查了生成链、Java terminal acceptance、TDS config/drain、runtime keys、Node DEV scenarios 等，未新增 finding、原始 verdict 不变；仍未逐行覆盖全部无关 generated DTO、所有 skeleton/readability gates、Android/Web adapter tests 与远端 runner 分支。记录见 [finding intake](2026-10-01-v2s-terminal-activation-batch-2-finding-intake-codex.md)、[CP-03](2026-10-01-v2s-terminal-activation-batch-2-cp03-reconciliation-codex.md) 与 [6b](2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md)。本地验证只覆盖变更影响的两个 TER package，不替代未重跑的 managed acceptance、DEV、backend-acceptance 或 L2。

## 评审目标

请独立复核原三项 S 修复、N-2 文档与当前批次二实现。关于未知 TDS 消息类型，Dexter 已明确裁定客户端保留静默忽略；请核实当前实现是否符合该决定与 R-4.9。也请核实 N-1 是否应保持 OPEN、README 与 catalog 是否一致，并对批次二整批实现形成当前静态结论，不继承旧 GO/MATCHED、作者 intake 或上一位 reviewer verdict。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`：项目权限、实现和独立审查规范。
- `doc/platform/README.md`、`scripts/README.md`：项目执行规范与当前受管入口说明。
- `project-memory/index.md` 的全部 kernel，以及本任务六维路由命中的记忆原文：项目记忆导航与 TER/失败/owner 约束。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：R-1.6、R-10.3、V-T7 等原始验收语义。
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`：批准的架构边界、CP-03 与验证要求。
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md`：历史逐代码索引与明确的证据限制；不得将其中旧 run 当作本轮证明。
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-finding-intake-codex.md`：作者 finding intake、实际局部验证及遗留项，仅作待证输入。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts` 与 `test/terminalDataClientActor.test.ts`：激活并发与 connect 状态机。
- `apps/terminal/kernel/base/transport/src/foundations/createTransportNetworkStatusBridge.ts`、`src/application/createTransportModule.ts`、`test/networkStatusBridge.test.ts`、`test/moduleCommands.test.ts`：退订结果与异步资源错误传播。
- `apps/terminal/kernel/base/transport/src/foundations/createTransportConnectionOwner.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts`：计时器失败边界。
- `scripts/test/terminal-client-dev-acceptance.mjs` 与 `scripts/README.md`：当前 Node acceptance catalog 与文档一致性。

## 独立核验重点

- S-1：无 await 临界区的 pending 激活秘密是否能抵御两个 root command、不同输入冲突、HTTP 逆序完成；测试是否使用有效的规范凭证样本并真正逆序完成。
- S-2：重复 connect 在 connecting、awaiting-ready、connected、backoff、stopped 五态下是否符合 R-10.3；client owner 是否保留会话、heartbeat、listener，且只在应恢复的状态调用通用 transport start。
- S-3：unsubscribe 三种 typed 非成功结果是否以脱敏失败进入现有 cleanup 聚合；订阅身份是否在成功之前保留、失败之后可重试，且 unavailable capability 不被误称为已观察的设备泄漏。
- N-1：区分静态可推导路径与真实生产运行证据。测试手工重发 timer payload 是否仅能证明 actor 路径，不得推成生产自动恢复。判断 `OPEN` 是否准确且修复期间没有为猜测加旁路。
- N-2：目录实际五个 catalog 条目、单场景选择规则与 README 是否逐项一致。
- 对上述同根调用链进行反例搜索；检查是否引入全 runtime 队列、凭证副本、timer 绕行 owner 等不必要复杂度。

作者记录的当前局部证据：`terminal-data-client` owned typecheck/test/lint PASS（26 tests）；`transport` owned typecheck/test/lint PASS（48 tests）。owned runner 未输出 run id，本轮未重跑 managed backend-acceptance、Node acceptance、DEV、reset、seed、L2 或 UAT。请将这些事实与批次二此前的 managed 证据分开评价。

## 期望结论

请给出独立整批 `GO` 或 `NO-GO` 与 `M/S/N`。每项 finding 写明详设条目和真实实现位置、性质/证据、影响、最小可验收修正及是否需要 Dexter 产品裁决；动态证据不足处标为 `OPEN`/`NOT_RUN`，不得继承作者结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《终端激活与长连接》批次二实施做一轮独立整批静态复核。

背景：您上一轮对批次二的结论为 NO-GO，M/S/N=0/3/2。主 agent 已修复原评审的 S-1/S-2/S-3 与 N-2；N-1 仍标记为 UNVERIFIED_REQUIRES_EVIDENCE/OPEN。CP-03 fresh 独立三维对账为 MATCHED（M/S/N=0/0/0），整批 6b fresh 独立对账为 MATCHED；记录见：
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-cp03-reconciliation-codex.md`
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md`
fresh 整批 implementation reviewer 给出 NO-GO，M/S/N=0/1/1；补充只读 pass 核验生成链、Java terminal acceptance、TDS config/drain、runtime-key inventory 与 Node DEV scenarios，没有新增 finding，原始 verdict 不变。reviewer 未逐行覆盖所有非核心 generated DTO、全部 skeleton/readability gates、Android/Web adapter tests 与远端 runner 分支；范围详见 intake。唯一 S 认为 TER 应拒绝未知 TDS 消息类型。Dexter 已明确裁定“TER 客户端把未知 TDS 消息类型静默忽略”没问题，按此保留，不改源码。请 Claude 核实实现符合 R-4.9 与该裁决；N-1 timer 项仍 OPEN。详见：
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-finding-intake-codex.md`
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md`（历史运行索引，不是本轮当前运行证明）

评审目标：请从原始需求、详设、计划、项目记忆、生产源码与测试重新形成批次二整批 REVIEW_TARGET=IMPLEMENTATION 判断，不继承历史 GO/MATCHED、作者 intake 或前一位 reviewer 的 verdict。重点核验原三项 S 修复、unknown-type 实现是否符合 Dexter 裁决、N-1 是否应保持证据 OPEN、README catalog 与当前入口是否一致，并主动寻找同根反例。

请从 catering-v2s 仓根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md：项目和执行规范；
- project-memory/index.md 的全部 kernel 与本任务六维路由命中的项目记忆原文：当前治理、owner 与失败处置规范；
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：需求原文；
- doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md 和 doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md：批次二批准详设与计划；
- doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-finding-intake-codex.md 与 doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md：作者处置与历史证据索引，均只作为待核材料；
- apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts、test/terminalDataClientActor.test.ts；
- apps/terminal/kernel/base/transport/src/foundations/createTransportNetworkStatusBridge.ts、src/application/createTransportModule.ts、src/foundations/createTransportConnectionOwner.ts、test/networkStatusBridge.test.ts、test/moduleCommands.test.ts；
- apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts；
- scripts/test/terminal-client-dev-acceptance.mjs：当前 catalog 真相。

请重点核验：
1. 原 S-1：同 operationId 并发 command 是否只生成、登记并提交同一秘密；参数冲突拒绝及响应倒序测试是否可靠。
2. 原 S-2：client command 五态是否符合 R-10.3，connected/inAttempt 时不 stop，backoff/stopped 正确恢复。
3. 原 S-3：三类退订失败是否进入 cleanup 聚合，保留订阅身份、脱敏并可重试。
4. 未知类型：核实客户端对 `FUTURE_MESSAGE` 静默忽略的实现与测试，是否符合 R-4.9 及 Dexter 已作出的“先忽略”决定；未知字段兼容规则仍只适用于已知消息类型。
5. N-1：手工重发 timer payload 不证明生产自动恢复；确认 OPEN 是否准确。
6. N-2：README catalog 与实际五项入口、精确单场景 selector 是否一致。
7. 扩大到 owner、pending/成功提交、timer 与 transport command 同根路径，检查是否留下缺口或过度设计。

局部证据边界：当前终端 client owned typecheck/test/lint 均 PASS（7 files/26 tests）；transport owned typecheck/test/lint 均 PASS（8 files/48 tests）。runner 未输出 run id 或时间戳；本轮未重跑 backend-acceptance、受管 Node/DEV、reset、seed、L2 或 UAT。不得把旧字节结果描述为本轮运行。

请给明确 GO/NO-GO 与 M/S/N。每条 finding 附详设条款、实现路径与行号、证据、影响、可验收的最小修正和是否需 Dexter 裁决；区分仓内事实、推论与未验证动态项。

授权边界：本次只授权独立静态 implementation review 与结论转交；不授权改需求/详设/计划/源码、生成、构建、测试、verify、受管 acceptance、DEV、reset/seed、L2、UAT、部署或批次三。谢谢。
```
