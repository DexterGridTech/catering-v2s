# 销售菜单目标选择与细粒度沽清 · Claude DESIGN review 请求

```text
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-DESIGN-20260907
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_INDEPENDENT
SOURCE_REVIEW=CLAUDE_NO_GO_M1_S3_N1
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
INDEPENDENT_SUBAGENT_REVIEW_REF=doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-independent-review-codex.md
CLAUDE_REVIEW=FOLLOWUP_COMPLETED_NO_GO_M0_S2_N1_S1_ABSORBED
AUTHOR_STATUS=DEXTER_ACCEPTED_IMPLEMENTATION_AUTHORIZED_PENDING_INDEPENDENT_REVIEW
DYNAMIC_EXECUTION=NOT_RUN
IMPLEMENTATION_AUTHORITY=true
DEXTER_DECISION=S1_DISABLED_SKU_INELIGIBLE_2026-09-07;OPTIONAL_ZERO_VALID_2026-09-07;NO_DETACH_EVENT_2026-09-07;NO_MIXED_SHAPE_2026-09-07;ORDINARY_OPTION_SUPERSEDE_2026-09-07
```

## 背景

本轮是门店销售菜单已有设计的业务补充，不是另起一个菜单 owner。Dexter 发现两个根因问题：

1. SKU 销售项虽然已有 `sales_version_item_sku` 和每规格挂牌价概念，但编辑器没有真实选择控件，无法让同一商品的不同 SKU 建成两个独立 SalesItem；普通商品的 Catalog 选项只有只读投影，销售项无法选择要暴露的选项值。
2. 人工沽清当前以 `(salesItemRef, channelRef)` 为唯一事实，不能单独沽清一个 SKU 或一个点单选项值。

本轮已重新打开现有需求、IA、交互、实现基线、SalesMenu owner、OpenAPI source、迁移、acceptance、frontend testId 与 Catalog/sales-menu seed。设计稿引用 `SEED-LATTE`、`SEED-CAESAR`、`SEED-MILK-TEA` 作为候选 fixture；该引用不是事实证明，请在 owning source 中亲验 candidate、ref、数量和后续 reset/reseed 是否真的可用。

业务语言以 confirmed corpus 的 G-11/G-12 为约束：CatalogItem/SKU/点单选项回答“卖的是什么、规格和怎么做”，SalesCollection/销售项回答“向经营入口暴露什么”，库存状态与销售集合的人工可售控制是独立事实。不得从旧页面、表结构或技术字段反推新的产品语义。

本文件是给 Claude 的外部独立 DESIGN review 请求，不是 Claude verdict，也不声称已经完成 fresh 独立子 agent 轮次。项目治理要求的 fresh `INDEPENDENT_SUBAGENT` 盲审仍须单独留痕；Claude review 不能替代该轮，也不能把作者自评当结论。

## Claude review intake（不改写原始 verdict）

已收到并保留 `doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-design-review-claude.md`。该报告为纯静态外部 DESIGN review，结论为 `NO-GO`，finding 计数为 `M=1/S=3/N=1`，未执行 DEV、Testcontainers、reset/reseed、backend acceptance、browser L2 或 UAT。

Dexter 于 2026-09-07 对 S-1 作出产品裁决：Catalog `SKU.status=DISABLED` 不得作为销售菜单可选候选，也不得通过直接 HTTP 写入草稿或发布版本；`ENABLED` 才是可选状态，`VOIDED` 同样拒绝。follow-up Claude review 已完成（M=0/S=2/N=1，S-1 已吸收），且 Dexter 已同步裁决 optional 零选择、无 detach event、无混合 shape、普通选项 supersede；这些内容已写回四份设计/计划工件。剩余实施前条件是交互精确控件表、required option fixture、stale SKU 终态、Catalog candidate fixture 与 fresh independent subagent blind review。

## 审查入口与独立性要求

请从仓库根建立本轮输入清单，逐项记录 repository-relative path、SHA-256、是否已读和 corpus 检索结论。必须先从冻结输入、现行 Roadmap 授权字段、适用 project-memory 与被审设计推导自己的预期行为和初步 verdict，再阅读本 review 请求中的推荐结论或任何作者 intake/disposition；缺少输入、先继承作者结论或无法证明 source readback 时，明确标为 `UNVERIFIED_REQUIRES_EVIDENCE`，不要用文档自报补齐。

六维路由必须实际执行：

```bash
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger task-start
```

逐条打开该命令返回的全部 memory 原文；使用某条 assertion 前，继续打开其 `sourceRefs` 中适用文件的 literal owning heading。终端专属命中若与本轮无关，记录 `NOT_APPLICABLE` 及理由，不把它转成销售菜单要求。已退役的 compliance-control（包括 `contracts/policy/standards-coverage-matrix.json`、`scripts/check/standards-coverage`、`scripts/check/implementation-design-granularity`）不作为本轮准入、finding 或 GO/NO-GO 条件。

## 评审目标

请独立证伪以下设计是否能在不破坏既有 SalesMenu owner/发布/权限/库存边界的前提下闭合：

1. `SalesMenuSaleContentInput.orderOptionSelections` 与 `selectedOrderOptions` 是否正确表达“菜单暴露集合”而非顾客订单选择；required/optional、selectionMode、min/max 语义是否无矛盾。
2. SKU selected subset 与 option snapshot 是否能让同一 Catalog 商品的多个 SalesItem 绑定不同集合，同时保持发布快照不可变、Catalog 后续变化不回写已发布菜单。
3. manual target `(salesItemRef, channelRef, targetKind, targetRef)`、published membership 校验、child 状态读回、publish detach/no resurrection 是否是最小且完整的 owner 模型。
4. 复用既有 status operation ID 并扩 request target，是否遗漏了 route/permission/error/operation-record/acceptance/L2 coverage。
5. normalized option tables、immutable trigger、set-based readback 是否存在 FK、并发、N+1、迁移或审计缺口。
6. frontend Drawer/Modal 的目标层级、真实 testId、foundation 接入、失败恢复和无障碍是否与用户任务一致；是否有更简单路径。
7. `SEED-LATTE`/`SEED-CAESAR`/`SEED-MILK-TEA` 的 candidate 数量和选择期望是否足够；是否会把 Catalog fixture/seed denominator 复制成第二 owner。
8. 设计是否明确把 reset/reseed、DEV、backend acceptance、browser L2、UAT 留在后续授权边界内。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`：仓库入口、review 话术、owner/事务/运行边界。
- `doc/platform/roadmap-program-registry.json` 与其唯一 ACTIVE program 指向的 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：只读当前授权字段；不要从历史 `CURRENT_*` 或旧状态段落推断本轮授权。
- `scripts/README.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md`：真实验证入口、证据分层和机器门边界。
- 全部 kernel：`project-memory/kernel/01-workspace-and-roadmap.md`、`project-memory/kernel/02-service-shape-and-owner.md`、`project-memory/kernel/03-transaction-data-and-dependencies.md`、`project-memory/kernel/04-contract-consumer-and-admin.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`、`project-memory/kernel/06-heritage-and-change.md`。
- 六维路由命中的全部 memory：`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/backend-acceptance.md`、`project-memory/operations/business-corpus-adoption-and-read-policy.md`、`project-memory/operations/business-corpus-parked-domain-intake.md`、`project-memory/pitfalls/check-repo-before-authoring.md`、`project-memory/pitfalls/criterion-degraded-into-list.md`、`project-memory/pitfalls/analysis-ruler-and-scope-discipline.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`，以及上列六个 kernel；并按各文件的 `sourceRefs` 打开适用原文和 literal anchor。
- `project-memory/operations/claude-review-handoff-standard.md`、`doc/platform/claude-review-handoff-template.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：本次交接话术、独立盲审、两轮上限和作者 intake 边界。
- `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md` 中 G-11/G-12 的采用与使用纪律，以及其适用 source refs：核验 CatalogItem、SalesCollection、SKU、选项、库存和沽清的“不得推导”边界。
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`：既有销售菜单业务基线。
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`：既有页面 IA 和 SKU/状态入口。
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`：既有交互与 foundation 约束。
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`：既有 contract/owner/HTTP/frontend/test/seed 实施基线。
- `doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md`：本轮 Journey 边界、Dexter 已裁决项与仍独立保留的 published snapshot 生命周期边界。
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`：需求背景、业务语义、方案取舍和验收口径。
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`：编辑 Drawer、状态 Modal、testId 和失败恢复。
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md`：契约、migration、owner、HTTP、前端、acceptance、L2、seed 的完整设计。
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-plan-codex.md`：按 CP 排序的实施、验证、reset/reseed 与对账计划。
- `contracts/openapi-source/sales-menu.schemas.json`：当前唯一手写销售菜单契约 source，核验本轮 proposed diff 是否完整。
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuSaleContent.java`：当前 SKU/价格 domain owner。
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`：当前 update/publish/manual 状态事务和 readback owner（如实际路径不同，以 `rg` 定位同名类）。
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260901_000000_000__sales_menu_owner.sql`：当前 SKU snapshot、manual current/event、published immutability 表结构。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemEditorDrawer.tsx`：当前 SKU 编辑器缺少真实选择列的 owning UI。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`：当前 item-level 状态入口和 published 表。
- `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`：现有真实 action testId owner。
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`：当前真实 HTTP 业务验收 owner。
- `scripts/dev/sales-menu-seed-plan.mjs`：当前静态 seed denominator/shape matrix。
- `scripts/dev/sales-menu-seed-executor.mjs`：当前真实 HTTP seed executor，特别核验 SKU `.slice(0, 2)` 和 item-level manual status。
- `contracts/policy/catalog-inventory-fixture-catalog.json`：Catalog fixture 的 SKU/普通选项 candidate 事实。

## 独立核验重点

请先以证伪立场独立阅读以上材料，不把本文件的推荐决定当成事实。重点输出：

1. 先站在业务用户与 Dexter 立场回答“问题是否正确、方案是否优于更小替代、复杂度和验证成本是否匹配”，再核对闭环完整性；不能因为文档自洽或门可通过就默认 GO。
2. 对每项结论使用 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION` 分类，并区分仓内事实、推论、产品判断和缺证据假设。
3. 对 option selection 的 published freeze 与 Catalog 后续变更找反例；确认“菜单暴露集合”不会被误解为顾客订单选择，required/optional、selectionMode、min/max 的约束分属正确 owner。
4. 对 target status 的 membership、detach/no resurrection、CAS、审计、库存独立性、父子不级联和失败原子性找反例。
5. 对 contract→generated→Java/RTK→HTTP→acceptance→L2→seed 的完整变更面找遗漏；不得只看 source schema 数量，也不得把候选清单当作可穷尽分母。
6. 对 frontend 是否存在更简单、更符合用户任务的交互给出 M/S/N finding；逐项检查真实 testId 是否落在 action node、foundation 是否复用、焦点/失败恢复是否可证明。
7. 对每个计划 CP 的前读/后读、owning source、focused proof 与整体三维对账要求找缺口；不得以总览阅读、静态通过或未来 L2 代替点对点证伪。
8. 不执行生产实现、生成、迁移、reset/reseed、DEV、backend acceptance、browser L2、UAT 或部署；只进行独立设计 review，并把未执行内容标为未证实。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。每条 finding 使用：

```text
M/S/N
精确文件与行号：...
事实与反例：...
影响面：...
最小修复建议：...
是否需要 Dexter 产品裁决：是/否
```

本轮不是 implementation review；即使 `GO`，也只表示设计可以进入 Dexter 决定的实施阶段，不授权任何生产代码、生成文件、migration、reset/reseed、DEV、L2、UAT、部署或仓库控制动作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对本次“销售菜单目标选择与细粒度沽清” DESIGN 草案做一次独立 review。

背景：本轮不是另起一个菜单 owner，而是修复两个业务根因。当前 SKU 销售项无法让同一 Catalog 商品的不同 SKU 形成不同 SalesItem；普通商品的 Catalog 选项只有只读投影，销售项无法选择要向经营入口纳入的选项值；人工沽清也只有 SalesItem 级，不能单独沽清某个 SKU 或选项值。设计草案建议由 SalesMenu owner 保存 selected SKU/option snapshot，并用 `(salesItemRef, channelRef, targetKind, targetRef)` 扩展同一 manual status owner，同时保持库存事实独立。设计稿引用 `SEED-LATTE`、`SEED-CAESAR`、`SEED-MILK-TEA`，但这些 candidate、ref、数量和 reset/reseed 可用性必须回到 owning source 亲验，不能直接采信；optional 零选择、无 detach event、无混合 shape、普通选项 supersede 已由 Dexter 裁决。

评审目标：请先从业务用户与 Dexter 立场判断“问题是否正确、方案是否优于更小替代、复杂度与验证成本是否匹配”，再独立证伪 option selection 契约/发布冻结、SKU 子集、目标级人工状态 identity/membership/detach/CAS/audit、权限与事务、前端交互与 testId、acceptance/L2/seed 的完整同步面。请不要把文档自洽、静态检查通过或历史 review 结论直接当作 GO 依据。

请从 `catering-v2s` 仓库根按以下顺序阅读并建立输入清单（每项记录相对路径、SHA-256、是否已读和结论）：

1. 入口、授权与规范：
   - `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`；
   - `doc/platform/roadmap-program-registry.json`；
   - Registry 唯一 ACTIVE program 指向的 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`，只读取当前授权字段及本轮适用授权；不要从历史 `CURRENT_*` 叙述推断当前步骤；
   - `scripts/README.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md`。

2. 全部 kernel 与六维路由：
   - `project-memory/kernel/01-workspace-and-roadmap.md`；
   - `project-memory/kernel/02-service-shape-and-owner.md`；
   - `project-memory/kernel/03-transaction-data-and-dependencies.md`；
   - `project-memory/kernel/04-contract-consumer-and-admin.md`；
   - `project-memory/kernel/05-evidence-runtime-and-git.md`；
   - `project-memory/kernel/06-heritage-and-change.md`；
   - 从仓根执行：`scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger task-start`；逐条打开命中的全部 memory 原文，并按各文件 `sourceRefs` 打开适用文件的 literal owning heading；
   - 本轮路由命中的 memory 至少包括：`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/backend-acceptance.md`、`project-memory/operations/business-corpus-adoption-and-read-policy.md`、`project-memory/operations/business-corpus-parked-domain-intake.md`、`project-memory/pitfalls/check-repo-before-authoring.md`、`project-memory/pitfalls/criterion-degraded-into-list.md`、`project-memory/pitfalls/analysis-ruler-and-scope-discipline.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`，以及上述六个 kernel；
   - 重点回读 confirmed corpus 的 G-11/G-12 与“不得推导”边界，特别是 CatalogItem/SKU/选项、SalesCollection/销售项、库存状态和人工可售控制的 owner 关系；
   - `project-memory/operations/claude-review-handoff-standard.md`、`doc/platform/claude-review-handoff-template.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`；
   - 从仓根执行 `find doc/decisions -maxdepth 1 -type f -print | sort`，逐条核对标题，并打开与本轮相关的 decision 全文；
   - 不把已退役的 `contracts/policy/standards-coverage-matrix.json`、`scripts/check/standards-coverage` 或 `scripts/check/implementation-design-granularity` 当作本轮准入、finding 或 GO/NO-GO 条件。

3. 原始需求、既有基线与本轮设计：
   - `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`；
   - `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`；
   - `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`；
   - `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`；
   - `doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md`；
   - `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`；
   - `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`；
   - `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md`；
   - `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-plan-codex.md`；
   - `doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-design-review-request.md`；请先形成自己的初步判断，再阅读其中的推荐决定。

4. 当前 owning source 与验证/seed 入口：
   - `contracts/openapi-source/sales-menu.schemas.json`；
   - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuSaleContent.java`；
   - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`；
   - `apps/backend/catering-business-server/src/main/resources/db/migration/V20260901_000000_000__sales_menu_owner.sql`；
   - `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemEditorDrawer.tsx`；
   - `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`；
   - `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`；
   - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`；
   - `scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`；
   - `contracts/policy/catalog-inventory-fixture-catalog.json`；
   - `libraries/frontend/admin-ui-foundation/` 中本交互实际复用的 capability source；若未覆盖，说明为什么必须 app-local。

请先以“找出设计为什么不成立”为立场写出初步 findings/verdict，再读作者的 self-review、intake 或 disposition（如有）。Claude review 是独立外部 review，但不能替代本 cycle 必须单独完成的 fresh `INDEPENDENT_SUBAGENT` 盲审；本请求不声称该轮已经完成。

请重点独立核验：
1. `orderOptionSelections` / `selectedOrderOptions` 是否始终表示菜单暴露集合而不是顾客订单选择；required/optional、selectionMode、min/max 是否分别属于正确 owner，是否存在 required 空集合、重复 ref、陌生 ref、shape 混用和 Catalog 后改写 published snapshot 的反例；
2. 同一 Catalog 商品的多个 SalesItem 是否能绑定互不串写的 SKU/option subset，SKU selected price 是否与 owner 当前事实一致，新增 Catalog candidate 是否不会自动进入草稿或已发布菜单；
3. `(salesItemRef, channelRef, targetKind, targetRef)` 的唯一性、published membership、parent/child 不级联、detach/no resurrection、CAS、audit、失败原子性和 inventory independence 是否完整且不过度设计；
4. contract source→generated→Java/domain/owner→HTTP/permission/error/operation record→frontend model/action→acceptance→L2→seed 的完整变更面，是否遗漏 source、重复 owner、N+1、跨 owner 写、历史兼容 fallback 或只改 schema 不改行为；
5. UI 是否来自批准的用户任务，是否有更短更自然的路径，真实 `salesMenuTestIds.ts` 是否落在实际 action node，foundation 是否复用，loading/失败/焦点/无障碍/权威 readback 是否闭合；
6. seed 的 candidate/ref/数量和业务 oracle 是否由真实 Catalog owner readback 获得，是否把 Catalog fixture 复制成 SalesMenu 第二 owner，是否覆盖 SKU subset、option subset、child sold-out/restore 和 inventory independence；
7. 每个计划 CP 是否有对应的逐点前读、写入后的 focused proof、同一输入后读与整体三维对账；不得用总览阅读、静态 PASS 或未来 L2 替代点对点证明；
8. 明确区分当前静态可证明事实、尚未执行的 acceptance/L2/DEV/reset/reseed/UAT 事实和需要 Dexter 裁决的产品语义。

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 必须使用以下格式：

`M/S/N`；`CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；仓根相对路径与精确行号；事实与可复现反例；影响面；为什么更小替代不足；最小修复建议；是否需要 Dexter 产品/Journey/范围裁决。另请单列“方案合理性”“UI 合理性”“动态证据边界”“独立 review 治理检查”。

授权边界：本次 `GO`/`NO-GO` 只表示当前 DESIGN 草案是否通过本 cycle 的 fresh independent blind review 前置复核；Dexter 已授权该 Journey 的实施范围，但在独立 review verdict 留痕前不要写生产代码。不得扩大到 Catalog backend `admittedShapes` enforcement、其他 Journey、TDP、部署、切流或 UAT；评审期间不要执行动态运行，也不要把 review 结论伪装成实现/运行证据。谢谢。
```

## 交付前检查

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-design-review-request.md
```

该文件保留历史 Claude 的静态 follow-up `NO-GO` 结果和 Dexter 裁决；`INDEPENDENT_SUBAGENT_REVIEW=PENDING_REQUIRED_BEFORE_CODE`，不把 Claude follow-up 替代 fresh independent subagent，也不把实施授权误报为动态证据完成。
