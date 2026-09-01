REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01
REVIEW_STATUS=READY_FOR_CLAUDE

> 当前 `AGENTS.md` 与 `CLAUDE.md` 已明确退役 `DESIGN_GRANULARITY_MANIFEST`、`ADVERSARIAL_REVIEW_REPORT` JSON 和 `scripts/check/implementation-design-granularity`。旧 handoff 模板中的这三项不得恢复、不得作为输入或 finding；本文件直接遵循当前上位规则和保留的结构检查。

## 背景

Dexter 已确认门店销售菜单 IA，并要求补齐可直接实施的全链详设与串行实施计划，范围覆盖 contract/generated、后端新 owner 与跨 owner API、operations-admin、backend-acceptance/Testcontainers、同一 browser L2 runner、DEV Seed 与父编排。Codex 已完成同一 DESIGN cycle 两轮 fresh 独立对抗审查：Round 1 `NO-GO M=2/S=1/N=0`，Round 2 `NO-GO M=2/S=0/N=0` 且 `ROUND_FINAL_DECISION=SELF_DECIDED`。作者已对五项 finding 逐项重开 owning source、完成同根修复并停止第三轮；现在请求 Dexter 与 Claude 对修复后当前字节做独立 DESIGN review。

当前证据仅为静态设计/源码核对。没有修改生产 contract/generated/前后台代码/Testcontainers/L2/Seed脚本，没有执行 Testcontainers、browser L2、DEV reset/seed、UAT 或部署。

## 评审目标

请先从业务用户和 Dexter 立场独立判断问题、方案与成本是否合理，再核验当前 implementation-facing 设计能否让实施 agent 不猜 contract、owner、transaction、collection、frontend state、acceptance、L2 或 Seed 语义。重点判断：

1. 门店独占菜单、STORE INTERNAL DINE_IN/TAKEAWAY、同入口多 enabled menu、销售端自行选择、草稿/发布冻结、copy 排除项是否准确且不过度扩张；
2. 31 operations（30新增+1既有修改）、19 commands、schema/path/face/auth/owner recheck/generated chain是否闭合；
3. SalesMenu owner、Catalog/Inventory/BusinessChannel/Organization task read、Asset target-bound command和事务/幂等/CAS/audit/log是否守 owner 主权；
4. operations-admin 单页 IA、SKU逐价、两个状态维度、七套 Cursor 可达性、foundation复用、焦点/失败恢复/缓存失效是否足够精确；
5. 13+1+1 backend-acceptance、16 L2 cases、真实 INTERNAL channel + sales-menu Seed、stable stage-id父编排是否能证伪业务错误且不越动态授权边界。

## 需阅读文件

请从 `catering-v2s` 仓库根按顺序阅读：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：当前入口、授权、review与已退役控制面；
2. `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`：业务需求正本；
3. `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`：Dexter 已确认的单页 IA及implementation-facing集合可达性澄清；
4. `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`：逐控件/失败/分页交互；
5. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`：当前修复后详设；
6. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`：后续实施 agent 的串行计划；
7. `doc/decisions/templates/implementation-design-template.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/foundation-charter.md`：canonical模板与项目前后台约束；
8. `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`、`doc/platform/browser-l2-execution-standard.md`、`scripts/README.md`：Testcontainers/L2/Seed执行约束；
9. 相关 owning source：`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/CatalogAssetCommandApi.java`、`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsOwnerScopeGrant.java`、`libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts`、`libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`、`scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/external-collaboration-business-channel-seed-plan.mjs`；
10. 独立形成初步 verdict 后，再读 `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md`、`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-intake-claude.md`、`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-claude.md`、`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-intake-claude.md`、`doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md`，核验两轮治理与作者处置，不继承其结论。

## 独立核验重点

- 先独立构造至少一个更小替代，判断新 `sales-menu` owner + normalized immutable publication 是否必要，是否有为未来终端/TDP过度设计；
- 逐项对照用户31条反馈和copy裁定，检查行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效；
- 对 operation/path/schema/face/command分母重新计数，不信文档自报；确认 generated唯一源、不手写派生物，也不恢复退役compliance-control；
- 证伪图片 actual-target：无 capability、cross-store/menu/item、wrong usage、released/claimed/version conflict 是否都有明确contract、owner判定和no-write oracle；object I/O事务外与claim事务内是否一致；
- 证伪集合边界：21 channels、21 menus、21 candidates、21 items、21 records是否均能从真实UI显式到达，七套cursor identity是否足够，是否存在自动抽干、client slice或selected menu丢失；
- 核验Testcontainers场景归各 owner 文件、L2仍只有一个managed runner/唯一case source、Seed真实INTERNAL channel由BusinessChannel owner创建且父validator按stable stage id绑定；
- 明确区分静态可确认与尚未运行的Testcontainers/L2/DEV Seed/UAT事实。当前review不得要求或执行DEV/reset/seed/L2/UAT/deploy，也不得把未运行项写成PASS。

## 期望结论

请输出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给精确文件与行号、可证伪失败条件、影响面、最小修复、为何更小替代不足，以及 `CONFIRMED / PARTIALLY_CONFIRMED / UNVERIFIED / DEXTER_DECISION`。另请单列方案合理性、UI合理性、动态证据边界和两轮review治理检查。

Claude review文件请写到 `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-claude.md`；除该review文件外仓库只读。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次门店销售菜单 implementation-facing 详设与串行实施计划。

背景：Dexter 已确认销售菜单单页 IA。Codex 随后完成 contract/generated、后端 sales-menu owner 与跨 owner 边界、operations-admin、backend-acceptance/Testcontainers、同一 browser L2 runner、Seed/父编排的详设与计划，并完成同一 DESIGN cycle 两轮 fresh 独立对抗审查。Round 1 为 NO-GO（M=2/S=1/N=0），Round 2 为 NO-GO（M=2/S=0/N=0）且按两轮上限 SELF_DECIDED；作者已逐 finding 重开 owning source、修复并停止第三轮。当前只请求你对修复后字节做独立 DESIGN review，不继承作者或前两轮结论。Testcontainers、browser L2、DEV reset/seed、UAT、部署均未运行。

目标：请先站在业务用户与 Dexter 立场判断问题、方案与成本是否合理，再独立核验需求/IA、contract/generated、owner/transaction/auth、operations-admin状态与交互、Testcontainers场景、L2唯一源/runner、Seed旧+新及父编排是否完整、准确且足以让实施 agent 不猜语义。

请从 catering-v2s 仓库根按顺序阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、CLAUDE.md；
- doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md；
- doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md；
- doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md；
- doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md；
- doc/decisions/templates/implementation-design-template.md、doc/platform/backend-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/platform/foundation-charter.md；
- doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md、doc/platform/browser-l2-execution-standard.md、scripts/README.md；
- apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/CatalogAssetCommandApi.java、apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsOwnerScopeGrant.java、libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts、libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx、scripts/dev/r5-complete-seed-executor.mjs、scripts/dev/external-collaboration-business-channel-seed-plan.mjs。

请先形成你自己的初步 verdict，再读两轮review与作者intake：doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md、doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-intake-claude.md、doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-claude.md、doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-intake-claude.md、doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md。

请重点独立核验：门店独占与INTERNAL DINE_IN/TAKEAWAY、多菜单同时enabled及销售端选择、草稿/发布冻结与copy排除；31 operations/19 commands的path/face/schema/auth/generated闭环；SalesMenu与Catalog/Inventory/BusinessChannel/Organization/Asset的owner主权、图片完整store/menu/item target与事务；单页31条用户需求、SKU逐价、两个状态、七套Cursor和第21项可达性；13+1+1 backend-acceptance、16 L2 cases、真实INTERNAL channel Seed和stable stage-id父编排。请明确区分静态结论与尚未执行的动态证据，并确认当前上位规则已退役design-granularity manifest/check，不要恢复它们。

烦请给出明确 GO 或 NO-GO，并报告 M / S / N 数量。每条 finding 请注明精确文件与行号、可证伪失败条件、影响面、最小修复、为何更小替代不足，以及是否需要 Dexter 产品裁决；另请单列方案合理性、UI合理性、动态证据边界和两轮review治理判断。

授权边界：本次结论只代表当前销售菜单 implementation-facing DESIGN 是否可进入后续由 Dexter 单独指派的实施；不授权生产实现、契约生成物写入、Testcontainers、browser L2、DEV start/stop/reset/seed、UAT、部署或任何其他外部动作。评审期间除 doc/review/platform/2026-09-01-v2s-sales-menu-design-review-claude.md 外仓库只读。谢谢。
```
