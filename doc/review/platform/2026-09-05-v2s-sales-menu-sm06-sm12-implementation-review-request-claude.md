# 销售菜单 SM-06～SM-12 实施结果 review handoff

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=SALES-MENU-SM06-SM12-IMPLEMENTATION-20260905
SCOPE=SM-06..SM-12
SOURCE_BINDING=apps/backend,apps/frontend only
STATUS=READY_FOR_EXTERNAL_CLAUDE_REVIEW

## 背景

销售菜单 SM-06～SM-12 已完成当前授权范围内的源码、契约/生成物、前端、L2、backend acceptance、managed seed 与 cleanup 收敛。此前多轮诊断中的 L2 环境/HMR、异步控件就绪和“HTTP 事件增量代替读模型就绪”问题已由当前实现与最新受管产物反映为通过；本次请求是对当前实现结果做独立 implementation review，不是继续开发，也不要求 Claude 修改代码。

当前正式证据汇总在：
- doc/evidence/platform/2026-09-05-v2s-sales-menu-sm06-sm12-formal-delivery-evidence-codex.md

历史 review 和历史 NO-GO 仍保留，不能直接替代当前字节判断。当前聚合证据记录了最新可复核的动态产物，但仍请 Claude 独立从 owning source、生成物和产物核验，不要只接受作者结论。

## 评审目标

请独立判断销售菜单 SM-06～SM-12 的实现是否满足批准的需求、IA、交互设计、implementation design/plan 及项目记忆约束，重点确认：

1. 31 条受影响 operation（30 条 SalesMenu + 1 条 BusinessChannel 修改）、19 条 command、38 条 owner rule 的分母和 owner 边界；
2. 15 个本批 backend acceptance scenario（13 SalesMenu + 1 BusinessChannel + 1 Asset）是否为精确目标分母，并检查真实结果；
3. 18 个 L2 case 的生成、fixture、testId、source binding、read-model oracle 与同一 runner 的真实闭环；
4. SM-09 的 18/18 browser L2、SM-10/11 的 backend acceptance 与 managed seed 产物是否分别证明 business 和 cleanup；
5. SM-12 的 11 维实现对账是否有当前源码/产物依据，是否存在未发现的契约、权限、owner、数据模型、fixture、oracle、生成、资源或文档分母问题；
6. 永久 source binding 是否严格限定为 apps/backend 与 apps/frontend 根目录，且不把 apps/terminal、TDP runtime、build output、UAT、部署或页面 DEV 可见性带入本交付；apps/backend/terminal-data-server 仅为仓库规定的空占位目录。

## 需阅读文件

请从 catering-v2s 仓库根阅读：

- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md：执行入口、边界和证据规则；
- project-memory/index.md、project-memory/decisions/deterministic-context-only.md、project-memory/decisions/owner-read-model-and-lifecycle-standard.md、project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md、project-memory/operations/implementation-source-reread-discipline.md：本任务适用的设计、owner、fixture/oracle 与复核约束；
- doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md：原始需求与 UI-01～UI-31；
- doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md：页面 IA；
- doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md：交互与状态；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md：owner rule、operation、分母与实现设计；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md：SM-06～SM-12 串行计划与完成定义；
- doc/evidence/platform/2026-09-05-v2s-sales-menu-sm06-sm12-formal-delivery-evidence-codex.md：当前聚合证据与产物索引；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/salesmenu/：SalesMenu owner、command、read model、migration；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java、BusinessChannelAcceptanceScenarios.java、AssetAcceptanceScenarios.java：本批 15 个目标场景；
- apps/frontend/operations-admin/src/features/sales-menu/：页面、Drawer、read model、commands、稳定 testId；
- apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts、apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts：L2 与 UI 静态证据；
- contracts/openapi/components/sales-menu/、contracts/registry/generated/operation-handler-bindings/sales-menu.json、contracts/registry/generated/operation-handler-bindings/index.json：契约与生成 binding；
- contracts/policy/sales-menu-l2-case-blueprint.json、sales-menu-l2-scenarios.json、sales-menu-l2-fixture.json、sales-menu-l2-locator-bindings.json、sales-menu-l2-execution.json、sales-menu-l2-activation-candidate.json：L2 唯一分母、fixture、locator、activation 与 baseline；
- scripts/generate/sales-menu-p1.mjs、scripts/test/browser-l2-runtime.mjs、scripts/test/sales-menu-l2-fixture.mjs：生成/运行与 fixture 规则；
- scripts/dev/sales-menu-seed-plan.mjs、scripts/dev/sales-menu-seed-executor.mjs、scripts/dev/r5-complete-seed-executor.mjs：seed parent/child 顺序与 readback。

可复核动态产物：

- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/readiness-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-execution-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-join-artifact.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-cleanup-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/repository-byte-binding.json
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/run-manifest.json
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/backend-acceptance-result.jsonl.gz
- .runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/seed-report.json
- .runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/run-manifest.json
- .runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.json

## 独立核验重点

请以证伪为优先，逐项检查以下事实：

- 31/19/38、15、18、UI-01～UI-31 的来源、精确性和是否有第二处不一致的分母；
- 13 个 SalesMenu、1 个 BusinessChannel、1 个 Asset 目标 scenario 的源码 annotation 与同一 backend run 中的 CONTRACT/BUSINESS/STATUS；
- L2 readiness 到 active execution 到 join 的同一 run 关系：18 discovered/selected/results、notRunCaseIds 为空、business/cleanup 分离、18 个 case join complete、31 条 operation completion 覆盖；
- L2 的 FRAMEWORK_ONLY committed profile 是否被正确理解为无 readiness 时的 baseline，不能把它误读成或手改成动态 active set；
- sales-menu-l2-case-blueprint.json 当前 236 个 declared control entries、68 个 case-used unique key、locator binding 78 个 key 与真实 *TestIds.ts 节点、action metadata、fixture/oracle 是否一致；
- backend owner 的 DINE_IN/TAKEAWAY、PROJECT/GROUP_BUY/EXTERNAL 排除、库存可售与手工销售状态分离、媒体 owner、publish/copy/CAS/idempotency/失败恢复等语义；
- seed parent 的 stage 顺序、子阶段身份/readback、无 direct DB write、21 menu/21 item/库存与媒体事实、business 与 cleanup；
- repository-byte-binding 的 includedDirectories、文件/字节重算、apps/terminal=0、当前关键源码是否与绑定快照一致，并正确识别 apps/backend/terminal-data-server 仅为占位文件；
- 11 维对账：行为、形态/表单、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据源/失效边界；
- cleanup 是否独立 PASS，是否存在历史 artifact、运行 profile、文档分母或 build output 被误当成当前交付的情况。

请区分：
- 当前源码/生成物可以证明的静态事实；
- 已落盘且与当前 source binding 一致的动态 artifact；
- 当前仍无法证明的事项。
不要把 apps/terminal、UAT、部署、切流或页面 DEV 可见性作为本次 finding；不要把生产全产品验收从本批证据中推导出来。

## 期望结论

请给出明确的 GO 或 NO-GO，附 M/S/N 数量。每个 finding 必须包含：

- 严重级别 M/S/N；
- CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；
- 仓根相对路径和精确行号；
- 影响面；
- 最小修复建议；
- 是否需要 Dexter 产品/范围裁决。

如果没有阻断，请明确写出“没有发现当前实现的 M 缺陷”，并区分“实现已通过”和“某些范围不在本次授权内”。如果证据只足以支持 UNVERIFIED，不要升级为 GO，也不要用历史 PASS 代替当前 proof。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 catering-v2s 销售菜单 SM-06～SM-12 做一次独立的 implementation review。

背景：本批已完成当前授权范围内的销售菜单源码、契约/生成物、operations-admin、backend acceptance、浏览器 L2、managed seed 与 cleanup 收敛。请以当前仓库字节和已落盘产物为准，独立判断实现是否真的满足批准的需求、IA、交互设计、详设、实施计划和项目记忆约束；不要把历史 review 的结论直接当作当前结论。当前聚合证据是 doc/evidence/platform/2026-09-05-v2s-sales-menu-sm06-sm12-formal-delivery-evidence-codex.md。

评审目标：请独立核验 31 条受影响 operation（30 条 SalesMenu + 1 条 BusinessChannel 修改）、19 条 command、38 条 owner rule、15 个目标 backend acceptance scenario、18 个 L2 case、UI-01～UI-31、SM-09 的真实 browser L2 business/cleanup、SM-10/11 的 seed/readback/cleanup，以及 SM-12 的 11 维实现对账。请重点找业务语义、权限/owner 边界、契约/生成物、fixture/oracle/分母、testId/source binding、operation completion/join、cleanup/资源和文档漂移问题。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；
- project-memory/index.md 及 deterministic-context-only、owner-read-model-and-lifecycle-standard、backend-acceptance-route-fixture-oracle-integrity、implementation-source-reread-discipline；
- doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md；
- doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md；
- doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md；
- doc/evidence/platform/2026-09-05-v2s-sales-menu-sm06-sm12-formal-delivery-evidence-codex.md；
- 当前 apps/backend/catering-business-server、apps/frontend/operations-admin 销售菜单 owning source、L2 spec/static test、contracts/policy 销售菜单生成物和 scripts/dev、scripts/test 相关实现；
- 上述聚合证据列出的 browser L2、backend acceptance、seed 产物；SalesMenu child seed report 的实际路径是 .runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.json。

请重点独立核验：15 个目标 scenario 是否精确且在真实 backend 结果中 CONTRACT/BUSINESS/STATUS 全 PASS；L2 是否由同一 readiness→execution→join 链证明 18/18 与 31 operation 实际覆盖；business 和 cleanup 是否分离；repository-byte-binding 是否只含 apps/backend、apps/frontend 根目录且 apps/terminal 为 0，同时正确识别 apps/backend/terminal-data-server 只是空占位；236/68/78 的 L2 控件分母是否与真实 testId 节点一致；以及 11 维实现对账是否存在 OPEN。请将静态事实、已落盘动态证据和无法证明的范围分开。无需修改代码，也无需启动 DEV/Testcontainers/reset/seed/浏览器；如认为某项必须 fresh 动态验证，请标为 UNVERIFIED_REQUIRES_EVIDENCE 并说明最小证据。

烦请给出明确 GO 或 NO-GO，并给出 M/S/N 数量。每个 finding 请列严重级别、状态标签、仓根相对路径与精确行号、影响面、最小修复建议以及是否需要 Dexter 裁决。请不要把 apps/terminal、UAT、部署、切流或页面 DEV 可见性纳入本次范围，也不要把本批结果扩大为生产全产品验收。

授权边界：本次 review 只用于判断销售菜单 SM-06～SM-12 的实现与证据是否闭合；不授权新增产品语义、权限、数据模型或 operation，不授权修改代码/文档/数据，不授权 UAT、部署、切流，也不扩展到 apps/terminal/TDP。谢谢。
```
