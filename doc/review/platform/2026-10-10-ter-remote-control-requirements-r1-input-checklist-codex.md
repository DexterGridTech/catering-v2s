# R1 输入清单

主 agent 转录 reviewer 回报的实际读面；不以导航/标题命中充当全文读取。

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
AUTHOR_INTAKE_READ=false
READ_MODE=READ_ONLY
RUNTIME_READ=NOT_RUN
BUILD_TEST_VERIFY_DEV_DEVICE_DEPENDENCY_DATA=NOT_RUN
FILE_WRITES=NONE
REVIEWED_SHA256=82c110e82592064e355aca88e1b54a872fe9f955c28344dbc8b00967e9eff82e
```

## 已读输入

- 入口全文：AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md（分段1–323）、project-memory/index.md、deterministic-context-only。
- 被审正式需求全文1–397；讨论稿§1/§14全文和§4/§5源码/研究导航；Dexter当前授权与产品原话。
- 全部kernel 01–06全文。
- 只读路由：`scripts/memory/query --task-kind design --domain platform --consumer-face operations-admin --owner platform --impact architecture --trigger task-start`。25个命中原文均打开，截断项分段补读。相关corpus G01/G03/G05A/G05B/G07和账号/节点/权限语境，不借其他业务域推导。
- 路由非kernel全文：confirmed-business-language-corpus 的接受/禁止推导纪律及适用条目、deterministic-context-only、http-crud-efficiency-design-redlines、independent-subagent-adversarial-review、owner-read-model-and-lifecycle-standard、business-corpus-adoption-and-read-policy、business-corpus-parked-domain-intake、designing-from-conversation-not-system、invisible-dimension-drifts-at-implementation、platform-detail-reverse-inference、backend-capability-lookup、collection-boundary-modes、module-call-boundary-ownership、ordering-only-for-consumer-facing、operations/terminal-coding-standard、terminal-architecture-and-stack-rulings（及适用sourceRefs）、terminal-build-order-and-batches、ter-input-and-virtual-keyboard-usage、third-party-library-official-source-verification。
- review skill、review-standard、verification-governance memory、2026-07-25 independent治理、2026-07-24 verification与solution-reasonableness、2026-07-25 corpus-adoption、single-deployable service-shape、roadmap-retirement、agent-control、asset-carry-over、2026-09-26 terminal-service-shape、2026-10-02 Doris amendment、2026-07-29 observability：全文，截断补读。
- TER规范：TR03–05/11/16/17、§3-A/B、§4-D/E/F适用认证/command；frontend §3-D/E/F、§3-K-2/10；backend §2-B–I；foundation §1-A–K/3/4/7/8；third-party全文。
- `2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md`：§4B.1/7/9b/11 Q04/10；terminal-skeleton requirements §6.2/9。历史批次不是当前授权。
- 列出doc/decisions全目录标题，按上述相关决定重开；不声称所有decision全文已读。
- 四模板章节结构/适用性，不声称无关正文全读：journey-decision-template、ia-design-template、ui-interaction-artifact-template、implementation-design-template。逐节N/A原因见report。
- 既有配对Journey正文、IA元数据/相关表、UI导航；大型既有IA/UI未全读，角色依据规范/裁决/当前源码。

## 源码实际读取

| 路径（仓根相对） | 范围 |
| --- | --- |
| apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java | 1–120 |
| 同模块application/TerminalControlOwnerService.java | 1–110 |
| 同模块persistence/TerminalControlPersistence.java | 30–80 |
| apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepository.java | last_activity及相关SQL上下文，不是全文 |
| apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts | 640–765 |
| apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts | 440–590及参数/结果投影 |
| apps/terminal/kernel/base/runtime/src/foundations/createRuntimeJournal.ts | 全文 |
| apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts | 全文 |
| apps/terminal/kernel/base/server-config/src/types/serverConfig.ts | 1–90 |
| apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt | 280–455 |
| apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx | 780–850 |
| libraries/frontend/admin-ui-foundation/src/index.ts | 相关导出命中，非全文 |
| apps/terminal/ui/base/input/README.md | 公开owner说明开头，结合TR17 |

官方查证：LiveKit packets 的reliable/best-effort/15KiB/destination/topic；token/grants官方入口。不声称未安装SDK精确API已证。

## 未用材料与未运行

路由sourceRefs中的catalog/invitation/business-channel/历史性能整改/冻结日志材料与本期无关，未逐篇打开或用作新判据：2026-08-10 extension-readback、2026-08-12 invitation-resumption、rm1p6-extension-hosts/u13、2026-07-24 carryover-manifest、2026-08-13 compliance-retirement、2026-08-16 backend-conformance、2026-08-18 business-channel、2026-08-22 performance review/root-cause/design/requirements、2026-08-23 catalog requirements/IA、2026-08-27 base1、冻结logging规范、implementation-task-template。全部实际适用正本读取见上文；不声称这些无关sourceRefs已通过。

未读作者intake、`.runtime/`或运行evidence；未运行生成/构建/测试/verify/DEV/reset/seed/设备/依赖/数据；未写文件，未联系Codex在途阶段C。
