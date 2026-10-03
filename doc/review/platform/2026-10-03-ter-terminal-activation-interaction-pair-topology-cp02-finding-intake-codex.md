# 终端激活交互与双机拓扑专项 · CP-02 finding intake

```text
REVIEW_ORIGIN=CP_STAGE_INDEPENDENT_RECONCILIATION
CP=CP-02
INTAKE_OWNER=CODEX_MAIN_AGENT
STATUS=REPAIR_APPLIED_PENDING_FRESH_RECONCILIATION
EVIDENCE_TIER=源码/文档静态核验及package focused tests、typecheck、lint；Expo Web/VM/DEV NOT_RUN
```

## 1 · 方法与输入边界

主 agent 重开正式需求 R-03/R-09/R-10/R-12、当前 IA/交互工件、CP-02 详设/计划、terminal-data-client actor/selectors、ACT guide 组件与现有 tests。Claude stage review 的 finding 只作为待核输入。先比对 review §1 哈希：Journey 仍与评审输入同字节；IA 与 UI 工件的当前 hash 已不同于评审列出的 hash，故对实例与 testId 结论按当前字节复核，不沿用旧行号/判断。

## 2 · Findings

### S-1 · ACT 引导不能从 SLAVE 隔离的本地凭证显示成功

- **Classification：PARTIALLY_CONFIRMED（现行字节已部分闭合，保留一处 IA 澄清）**。
- **核验判据**：正式需求 R-03/R-12；IA 的 LMS 承载规则；详设 CP-02；安全展示不得将缺失或旧 projection 显示为 inactive/active。
- **当前证据与反例**：`apps/terminal/kernel/base/terminal-data-client/src/selectors/selectTerminalDataClientState.ts:16-32` 的本地激活 selector 直接读本机 protected credential；`apps/terminal/ui/base/terminal-activation/src/selectors/selectActivationStatusView.ts:20-38` 在 SLAVE 时改读 current-peer projection，并按来源主机身份及应用 revision 标记新旧。旧 `ActivationGuide.tsx` 曾直接使用本地 selector，因此持久化 SLAVE 即使意外留有 credential 也可能显示成功。当前 IA §3 已明示 LMS 单机与双机承载，SAMPLE-09-LMS 已分别写 host selector 与 current-peer host projection；当前 UI 工件 SAMPLE-09-LMS 也区分两种来源。review 引用的该两处排他性内容不在当前 bytes。MMP 本页确认只读本机 host pending；LMP 本页条款已收窄为无 LMS 场景的 local host pending，LMS 两种确认路径只在 SAMPLE-06-LMS 定义。
- **根因与影响**：screen 直接读取隔离的 client owner selector，把本地凭证存在误当成当前 host 已激活；断连/旧 peer 下会产生错误成功文案并影响 integration 阶段理解。
- **最小修正**：`ActivationGuide` 改消费 `selectActivationStatusView`，仅 MASTER 本地 active 或 current-peer projection ready 且 active 时显示“设备已激活成功”；其它情况显示既有引导消息。IA 总则写明 LMS 两种承载及各自事实来源；SAMPLE-05 只定义无 LMS 的 LMP 本页确认，双机/单机 LMS 留在 SAMPLE-06。
- **实际证明**：`yarn workspace @catering-v2s/ui-base-terminal-activation test` PASS，3 files / 9 tests；测试覆盖 SLAVE 隔离 credential 且无 host projection 时 selector 为 unknown，以及 UI 对 unknown/current active projection 的文案。`yarn workspace @catering-v2s/ui-base-terminal-activation typecheck` PASS；该包 lint PASS。整批 Web/VM/DEV 尚未运行。
- **更小替代**：只改引导文案或隐藏本地激活入口不能阻止 selector 将 stale local credential 显示为成功；没有更小的 source-of-truth 修正。
- **Dexter 裁决**：不需要；复用已批准 projection 与 current-peer 判据。

### S-2 · SLAVE 下公开 disconnect command 无角色 guard

- **Classification：PARTIALLY_CONFIRMED（命令允许清理，但不是副机业务权限）**。
- **核验判据**：R-12 禁止 SLAVE 使用凭证、激活或建立 TDS 连接；现有 `closeLocalConnection` 和 `disconnectTerminalCommand`。
- **当前证据与反例**：`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:305-307,549-552` 的 disconnect 仅清本地心跳/监听/connection 并调用 `transport.stop`；它不调用 start、HTTP、credential reducer 或 projection publisher。调用路径虽没有 `MASTER` guard，但单纯 cleanup 与“副机不得建连接/业务使用凭证”不同。反例是 actor/adapter 在角色切换中可能还持有旧本地连接；拒绝 stop 会留下本机资源。
- **根因与影响**：现有 CP-02 角色 guard 判据没有说明 disconnect 是业务命令还是 teardown。将所有 public command 一概拒绝会阻断 cleanup；不写清则测试和实施者可能产生两种解释。
- **最小修正**：维持现有 cleanup 语义，不增 role guard；在详设与计划写明 SLAVE 的 disconnect 只可释放本地 connection/transport 资源，不得 start、HTTP、清 credential 或改 host status projection。focused test 通过真实 actor command 验证 stop 一次、start/HTTP 零次且 credential 不变。
- **实际证明**：`yarn workspace @catering-v2s/kernel-base-terminal-data-client test` PASS，8 files / 35 tests；新增/修改的 SLAVE actor 反例在此套件执行。代码调用形态静态检查如上。整批动态运行尚未进行。
- **更小替代**：增加新的 teardown command 或通用 role capability 会重复现有 `disconnectTerminalCommand`，没有收益；给其加 SLAVE 拒绝则无法释放已存在的本地资源。
- **Dexter 裁决**：不需要；按 owner command 既有职责及 R-12 最小解释执行。

### N-1 · logout/exit testId 是否误作现存常量

- **Classification：REJECTED_WITH_EVIDENCE（当前字节已区分）**。
- **核验判据**：只可把源码真实存在的 TestId 标为 current source；logout/exit 是已定设计功能但尚未实施的 ID 提案。
- **当前证据与反例**：`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md` 的 SAMPLE-07/08 roster 将当前源码常量限定为 title/options/confirm，并单独标“设计提案：logout / exit”；`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` 的 SAMPLE-07/08 行也把新增 logout/exit 列为提案。review 输入 hash与当前 UI/IA 文件不同；现行字节不存在其所述“logout 当前常量”混淆。
- **最小处置**：无修改。源 reviewer 的 N-1 结论绑定旧哈希，不反向覆盖当前文档。
- **Dexter 裁决**：不需要。

## 3 · 当前 CP-02 变更与证据状态

变更：

- `apps/terminal/ui/base/terminal-activation/src/components/ActivationGuide.tsx`：使用安全状态 view selector，不读取 SLAVE 隔离 credential。
- `apps/terminal/ui/base/terminal-activation/test/activationStatusView.test.ts`、`test/activationGuide.test.tsx`：新增局部 stale credential 与文案反例。
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`：证明 SLAVE disconnect cleanup 不触网且保留 credential。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`：明确 LMS 双承载，并把 LMP 本页确认限定为无 LMS。
- CP-02 design/plan：说明 ACT 消费 current-peer activation projection，且 disconnect 是 cleanup-only 例外。

当前证据：client tests 8/8 files、35 tests PASS；activation UI 3/3 files、9 tests PASS；UI typecheck PASS；两包 lint PASS。独立阶段对账由 fresh reviewer `/root/cp02_reconciliation_r2` 完成，`CP-02_RECONCILIATION=MATCHED`；检查范围为 CP-02 的需求、详设/IA、项目记忆、实现与 focused proof。修订后完整 `node tools/terminal-skeleton/verify-static.mjs` 以 run ID `ter-local-static-21377-1790970009305` 退出码 0，结果 `TERMINAL_STATIC=PASS`。对账与静态门均不证明整批动态行为；Expo Web、VM/device、adapter、DEV、V-01～V-20 仍为 `NOT_RUN`。
