# v2s sales-menu DESIGN adversarial review Round 2

targetPath=doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-claude.md

## Metadata

REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=SELF_DECIDED  
furtherCodexAdversarialRoundAllowed=false  
artifactTranscription=MAIN_AGENT_VERBATIM_FROM_INDEPENDENT_SUBAGENT  
reviewerInputChecklist={path:doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-input-checklist-claude.md,sha256:a9c03f265e8415f26e54fc265265d87b46a9457720dc5df55400cb02daabcf6c}  
blindReviewDeclaration=独立 verdict/findings 固定前未读取作者对账、Round1 checklist、Round1 review 或 Round1 intake  
authorMaterialReadAfterIndependentVerdict=false  
round1MaterialReadAfterIndependentVerdict=true  
writePolicy=NO_REPOSITORY_WRITE_BY_REVIEWER_DUE_READ_ONLY_SUPERIOR_CONSTRAINT  
evidencePolicy=STATIC_SOURCE_REVIEW_ONLY  
dynamicExecution=NOT_RUN  
gitExecution=NOT_RUN

## Verdict

VERDICT=NO-GO

M/S/N summary:

| severity | count |
| --- | ---: |
| M | 2 |
| S | 0 |
| N | 0 |

Outcome: 修订后设计仍不能安全实施。Round 1 的 canonical 模板、INTERNAL seed、parent stage-id 绑定问题在当前设计文本中已静态闭合；但本轮独立重查发现两个未被 Round 1 捕获的 implementation-facing 阻断：sales-menu 图片 stage/release 缺少足够明确的实际目标 owner 复核契约，且“全部经营入口/全部菜单/候选集合”与 cursor/20 的 collection shape 之间仍存在会让 executor 猜实现的断裂。

## Evidence tier

EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY

- Static/source evidence: YES
- Requirements/IA/UI/design/plan: READ_FULL
- Canonical template and standards: READ_FULL
- Six-dimensional recall originals: READ_FULL
- Contract/generated owner source: SAMPLED
- Backend owner/edge source: SAMPLED
- Frontend foundation/catalog image source: SAMPLED
- Backend acceptance source/standard: SAMPLED
- Browser L2 standard/source claims: SAMPLED
- Seed parent/profile/executor/source: SAMPLED
- Testcontainers/backend-acceptance PASS: NOT_RUN
- Browser L2 PASS: NOT_RUN
- DEV/reset/seed PASS: NOT_RUN
- UAT/deploy PASS: NOT_RUN

Static review cannot promote unrun HTTP, Testcontainers, L2, DEV, reset, seed, UAT, or deployment to PASS.

## L1_ENGINEERING

L1_ENGINEERING=NO-GO

Confirmed engineering blockers:

1. `stageOperationsSalesMenuAsset` / `releaseOperationsSalesMenuStagedAsset` are declared as Asset owner commands, but the contract/path/schema design does not pin the actual sales-menu/store target needed for `EDIT_STORE_SALES_MENU` owner recheck.
2. Cursor collection design conflicts with IA/user-visible “all maintainable channels / all menus / right-side candidates” surfaces unless the design chooses visible pagination/load-more/search, bounded complete enumeration, or a documented owner-enforced maximum.

Engineering checks that passed static review:

- Canonical implementation template path is now `doc/decisions/templates/implementation-design-template.md`.
- Current seed source has no real INTERNAL channel instance; current design now explicitly requires true INTERNAL DINE_IN and INTERNAL TAKEAWAY instances and preserves EXTERNAL negative facts.
- Parent seed design now explicitly removes `stages[n]` business binding and requires stage-id owner validator binding.
- Contract generation count issue is correctly routed to the unique codegen/source denominator, not hand-edited generated files.
- `Testcontainers`/backend-acceptance owner placement is described as backend source change plus future authorized execution, not claimed as current proof.
- L2 unique source and managed lifecycle are design-scoped only and not claimed as executed proof.

## L2_USER_VISIBLE

L2_USER_VISIBLE=NO-GO_STATIC

User-visible design facts statically covered:

- 单页门店销售菜单工作台。
- 菜单 owner 是门店，不是品牌/总公司。
- 经营入口 eligibility 是 STORE + INTERNAL + DINE_IN/TAKEAWAY。
- 同一入口允许多份启用菜单；菜单域不替渠道判断“当前有效菜单”。
- 发布冻结菜单快照/前台视图，不声称终端已 ACK、POS 已展示或 TDP 已同步。
- 库存驱动与人工估清分开返回。
- copy 排除发布历史、操作记录、前台版本、人工估清、库存事实。
- SKU 价格 shape 独立，不把目录/库存事实复制进 menu owner。
- 草稿/前台 sales item 表和操作记录表 cursor/20 页码行为有明确 UI 文案落点。

User-visible blocker:

- IA 要求 channel card group 展示全部可维护内部堂食/自提入口，menu selector/manager 展示当前入口全部菜单，添加候选区域展示可选商品/SKU；implementation design 却将这些集合改成 cursor/20，并只写“visited pages/顺序加载”而没有用户可观察分页/加载更多/搜索/自动抽干边界。超过 20 条时用户可能看不到第 21 条入口、菜单或候选。

L2 dynamic facts not verified:

- 焦点返回、抽屉可见实例选择、图片失败卡保留、真实 20+1 翻页无重无漏、发布/估清/copy 文案逐字呈现均未运行浏览器 L2。

## L3_UNVERIFIED

L3_UNVERIFIED=NON_EMPTY

Unverified groups:

1. Backend acceptance scenarios are proposed only; no Testcontainers/backend-acceptance execution was run.
2. Browser L2 scenarios are proposed only; no browser L2 execution was run.
3. Seed old+new orchestration is design only; no DEV reset/seed/start was run.
4. Asset upload authorization and release lifecycle are static design only.
5. Cursor behavior for over-20 channels/menus/candidates/items/logs is static design only.

Because this is DESIGN review under explicit read-only/no-dynamic constraints, these are evidence boundaries rather than independent failures. The two M findings are static design failures.

## ACTION_1_VARIANT=1-B extraction

### Template extraction

Canonical implementation design template requires:

- explicit metadata and authorization boundary;
- business goal and at least three implementation options;
- CP plan;
- cross-cutting mechanism table;
- complete operation/path/face/collection shape;
- cross-owner write matrix;
- declaration-transfer-consumption;
- owner API and consumer inventory;
- full-chain synchronization denominator;
- data model/migration;
- seed old+new adjustment;
- acceptance scenarios;
- unresolved/open decisions;
- stop conditions;
- staged and whole-batch three-dimensional reconciliation.

Current packet is structurally complete against the template, but two design rows remain unsafe: Asset command actual-target recheck and collection-shape reconciliation for all/menu/candidate surfaces.

### Cross-document extraction

Key contradictions:

1. IA/interaction say channel cards and menu manager/selector show all relevant business objects; implementation design introduces cursor/20 without a matching visible interaction or bounded complete enumeration.
2. Asset command authorization rows claim owner recheck, but operation schema/path details do not define the target facts that make the recheck falsifiable.

Key Round 1 closures independently confirmed before reading Round 1:

1. Canonical template path is correct.
2. Current seed source lacks true INTERNAL DINE_IN/TAKEAWAY channel instances; revised design requires adding them in business-channel owner and preserving EXTERNAL negatives.
3. Parent seed orchestration removes `stages[n]` and binds validators by stage id.

### DEXTER_DECISION

DEXTER_DECISION=NONE_REQUIRED_FOR_CONFIRMED_FINDINGS

No confirmed finding depends on unresolved product preference. Both blockers are engineering/design completeness issues. Product choices such as empty-menu publish policy remain explicitly bounded by current requirements/design and were not used as findings.

## Findings

### F-M-201 — Sales-menu Asset stage/release operations lack a falsifiable actual-target owner recheck contract

severity=M  
classification=CONFIRMED  
ownerDimension=OWNER_BOUNDARY_CONTRACT_AUTHORIZATION  
owning source:

- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- `doc/platform/backend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `project-memory/kernel/02-service-shape-and-owner.md`
- `project-memory/kernel/03-transaction-data-and-dependencies.md`
- existing comparison source: catalog asset stage/release contract and operation bindings in generated/catalog source
- existing comparison source: `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemBasicEditor.tsx`

Evidence:

- Design declares sales-menu image stage/release as Asset owner commands.
- Design declares image Asset commands must perform owner recheck.
- Operation path for stage is described as `/api/operations/sales-menu/assets/stage`.
- The operation description names `usage=SALES_MENU_ITEM_IMAGE`, but the design does not define a concrete request/path schema carrying the actual `storeRef`, `salesMenuRef`, `businessChannelRef`, or equivalent stable sales-menu target needed to validate `EDIT_STORE_SALES_MENU`.
- The key schema table does not define `SalesMenuAssetStageRequest` or `SalesMenuAssetReleaseRequest` target facts.
- Existing catalog asset flow carries actual context through request data such as `dataNodeRef`; sales-menu design lacks an equivalent explicit target.
- Owner standards require commands to recheck authority against the actual owner target, not only workspace/session/usage.

Falsifiable failure condition:

- A user with valid workspace access but no authority for the target store/menu can stage a `SALES_MENU_ITEM_IMAGE` asset because only workspace/usage/status is checked.
- A staged asset can be released or associated with a menu item without proving the staged asset was created for the same store/menu capability target.
- A cross-store or orphan staged asset passes through because the Asset owner cannot map the stage/release request to the sales-menu owner context.
- Backend acceptance cannot write a red scenario for “no EDIT_STORE_SALES_MENU on target store rejects image stage/release” because the target is not in the contract.

Minimum fix:

- Add explicit sales-menu asset stage and release request/path design with the actual authorization target facts.
- Define whether target is `storeRef`, `salesMenuRef`, `businessChannelRef`, or a required combination; the design must map this to `EDIT_STORE_SALES_MENU`.
- Require stage and release to recheck workspace, usage, asset status, staged asset ownership, and sales-menu/store capability on the same target.
- Add backend acceptance rows for at least:
  - no store/menu capability rejects stage;
  - cross-store staged asset rejects release;
  - wrong usage rejects release;
  - already released/deleted staged asset rejects release;
  - valid stage/release returns authoritative readback.
- Add frontend request model notes so extracted foundation image editor passes the target facts rather than relying on ambient page state only.

Why smaller alternative is insufficient:

- “Use current selected store from UI state” is insufficient because backend owner recheck must be falsifiable from the request/session boundary.
- “Check workspace and usage only” permits cross-store/orphan asset staging.
- “Reuse catalog upload shape” without naming the sales-menu target does not establish the sales-menu owner capability.
- “Validate only when saving item” leaves staged asset side effects and release semantics outside the owner boundary.
- “Document in implementation only” is insufficient because this is an implementation-facing design packet; executor should not guess contract shape for an authorization-sensitive command.

Same-root scan:

- Scanned sales-menu operation table, cross-owner write matrix, owner API rows, image/foundation rows, acceptance scenario rows, and frontend image extraction plan.
- Scanned existing catalog image editor and generated catalog asset request shape as the nearest implemented precedent.
- Scanned backend/foundation owner rules for command authority and actual-target recheck.
- Same-root impact is limited to sales-menu image stage/release and item-image association. Non-image menu commands already carry menu/item/store context in their operation design.

Required design update:

- Add an explicit “SalesMenuAssetStage/Release contract and owner recheck” subsection to implementation design.
- Add the matching operation table request/response facts and acceptance scenarios.
- Update implementation plan CP for contract/backend/frontend tests accordingly.

### F-M-202 — Cursor design for channel/menu/candidate collections contradicts “all” IA surfaces and lacks user-observable traversal semantics

severity=M  
classification=CONFIRMED  
ownerDimension=COLLECTION_SHAPE_USER_VISIBLE_CONTRACT  
owning source:

- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- `doc/platform/frontend-coding-standard.md`
- `project-memory/practices/collection-boundary-modes.md`
- `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`
- `libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts`
- `libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogWorkbenchReadModel.tsx`

Evidence:

- Requirements UI-31 explicitly assigns fixed cursor/20 pagination to draft sales item table, front sales item table, and operation record table.
- IA says the channel card group displays all maintainable internal dine-in/takeaway entrances.
- IA says menu selector lists all menus for the current channel.
- IA says menu manager drawer displays all menus for the current channel.
- Interaction design carries those “all menus/all entrances” surfaces forward.
- Implementation design changes `getOperationsStoreBusinessChannels`, `getOperationsSalesMenus`, and `getOperationsSalesMenuItemCandidates` to cursor collections with page size 20.
- The design text says frontend sequentially collects “visited pages” or loads “visited pages,” but does not define:
  - visible pagination;
  - load-more behavior;
  - search/filter traversal;
  - automatic exhaustive loading;
  - owner-enforced maximum count;
  - what happens when eligible count exceeds 20.
- L2 design includes over-page coverage for sales item tables/logs, but not for 21st channel, 21st menu, or 21st candidate reachability.

Falsifiable failure condition:

- A store has 21 eligible INTERNAL DINE_IN/TAKEAWAY channels; the 21st channel never appears in the card group.
- A channel has 21 menus; the 21st menu is not selectable or manageable.
- A candidate list has 21 eligible catalog/SKU candidates; the 21st candidate cannot be found or added.
- Frontend tries to “auto-drain” all cursor pages, silently converting owner cursor into an unbounded full scan and violating collection-boundary rules.
- Browser L2 passes common small fixtures but misses the over-20 control-surface failure.

Minimum fix:

- For each same-root collection surface, choose and document one explicit shape:
  - visible cursor pagination;
  - load-more;
  - searchable cursor;
  - bounded complete enumeration with an owner-enforced maximum and overflow behavior.
- Apply this separately to:
  - channel card group;
  - menu selector;
  - menu manager drawer;
  - add-item candidate panel.
- Keep draft item table, front item table, and operation record table as explicit cursor/20 paginated tables.
- Add contract/schema notes for cursor request/response where collection is cursor-based.
- Add L2/acceptance design cases with 21 channels, 21 menus, and 21 candidates, not only 21 sales items/logs.
- Update IA/interaction wording so “all” means either actually exhaustive under a bound or user-reachable through visible traversal.

Why smaller alternative is insufficient:

- “Visited pages” is not a user-visible interaction contract.
- Keeping cursor/pageSize in backend only does not tell frontend how to make the 21st object reachable.
- Testing only sales item table pagination does not cover channel cards, menu selectors, manager drawers, or candidate panels.
- Auto-loading all cursor pages without bound contradicts collection-boundary guidance and can create hidden performance/runtime risk.
- Replacing all surfaces with page tables would violate IA shape unless IA/interaction are deliberately revised.

Same-root scan:

- Same root affected and failing: channel card group, menu selector, menu manager drawer, add-item candidate panel.
- Same root already adequately specified: draft sales item table, front sales item table, operation record table.
- Frontend existing foundation has `useCursorStack` and `CursorPagination`, so the missing piece is not reusable capability existence; it is design selection and placement.
- Catalog workbench source confirms cursor/20 can be implemented, but does not resolve sales-menu “all card/selector” semantics.

Required design update:

- Add a collection-shape reconciliation table mapping every sales-menu collection to exact UI traversal and over-20 proof.
- Update implementation plan CP and L2 cases to include over-20 channels, menus, and candidates.

## SAME_ROOT_SCAN

sameRootScanStatus=COMPLETED_FOR_CONFIRMED_FINDINGS_STATIC_ONLY

| finding | scanned same-root set | result |
| --- | --- | --- |
| F-M-201 | sales-menu image operation table, cross-owner matrix, owner API rows, acceptance rows, frontend image reuse, existing catalog asset precedent | sales-menu stage/release target facts are not explicit enough for falsifiable owner recheck |
| F-M-202 | requirements UI-31, IA collections, interaction collections, implementation collection table, frontend cursor foundation, catalog cursor precedent, planned L2 cases | sales item/log pagination is explicit; channel/menu/candidate traversal over 20 remains unspecified |

## DESIGN_GAPS

DESIGN_GAPS=NON_EMPTY

1. Asset command target gap: sales-menu image stage/release lacks exact contract facts for actual-target capability recheck.
2. Collection-shape gap: channel/menu/candidate “all” surfaces conflict with cursor/20 without visible traversal or owner-enforced bound.
3. L2 design gap: over-20 coverage is missing for channels, menus, and candidates.
4. Backend acceptance gap: asset authorization negative cases cannot be written mechanically until request target facts are defined.

## Static checks by required dimension

| dimension | static review result |
| --- | --- |
| behavior | PARTIAL_NO-GO: main menu behavior is declared; image stage/release behavior lacks target-bound authorization; over-20 channel/menu/candidate behavior unclear |
| shape/form | PARTIAL_NO-GO: page/drawer/table shapes mostly declared; card/selector/candidate cursor traversal is not user-observable |
| actions | PARTIAL_NO-GO: publish/copy/enable/manual sold-out declared; image stage/release action missing exact target facts |
| relationships | PARTIAL_NO-GO: catalog/inventory/menu relations separated; asset-to-menu staged relation under-specified |
| placement | PARTIAL_NO-GO: major placements declared; pagination/load-more/search placement missing for channel/menu/candidate collections |
| user-visible copy | OK_STATIC_DESIGN_ONLY: publish/copy/manual copy declared; dynamic copy unverified |
| limits | PARTIAL_NO-GO: table/log cursor limits declared; channel/menu/candidate count limits not reconciled with “all” IA |
| state/control | PARTIAL_NO-GO: draft/published/manual/inventory states declared; staged asset lifecycle target-state control incomplete |
| failure/recovery | PARTIAL_NO-GO: typed problems/log/audit declared generally; asset authorization and cursor overflow failures not mechanically specified |
| accessibility/focus | OK_STATIC_DESIGN_ONLY: requirements exist; L2 unverified |
| data source/invalidation | PARTIAL_NO-GO: RTK/foundation patterns declared; target facts for asset invalidation/release and over-20 collection refresh still need design detail |
| owner sovereignty | NO-GO: asset owner command cannot prove sales-menu/store target recheck from current operation design |
| contract generated unique source | PARTIAL_NO-GO: codegen denominator fix is OK; asset request schema and collection traversal cases incomplete |
| transaction/idempotency/CAS/audit/log | PARTIAL_NO-GO: mechanisms declared; image stage/release idempotency/CAS/audit target linkage incomplete |
| publication freeze | OK_STATIC_DESIGN_ONLY: declared; dynamic proof absent |
| multi-menu | PARTIAL_NO-GO: domain supports multi-menu, but over-20 menu selector/manager reachability under-specified |
| copy exclusions | OK_STATIC_DESIGN_ONLY: copy exclusions declared |
| inventory/manual status | OK_STATIC_DESIGN_ONLY: separate facts declared |
| shape/SKU price | OK_STATIC_DESIGN_ONLY: separate SKU price shape declared |
| cursor | NO-GO: table/log cursor is clear; channel/menu/candidate cursor conflicts with “all” surfaces |
| frontend | PARTIAL_NO-GO: foundation reuse declared; exact traversal component placement and image target propagation incomplete |
| Testcontainers owner归位 | OK_STATIC_DESIGN_ONLY: backend acceptance owner placement declared; no execution run |
| L2唯一源/managed lifecycle | PARTIAL_NO-GO: single runner/blueprint declared; missing over-20 channel/menu/candidate L2 cases |
| Seed旧+新/父编排 | OK_STATIC_DESIGN_ONLY: Round 1 seed issues now closed in design; no seed run |
| dynamic evidence boundary | OK_STATIC: design does not claim unrun dynamic evidence as PASS |

## Round 1 directed closure table

Round 1 review and intake were read only after independent Round 2 verdict/findings were fixed. This table does not change the independent findings above.

| Round 1 item | Round 1 severity | Current Round 2 closure result | Evidence |
| --- | ---: | --- | --- |
| F-M-001 canonical implementation template path | M | CLOSED_STATIC | Current implementation design/plan use `doc/decisions/templates/implementation-design-template.md`; missing old path is not treated as canonical. |
| F-M-002 INTERNAL business-channel seed facts | M | CLOSED_STATIC | Current design recognizes existing seed has no true INTERNAL channel instance and requires real INTERNAL DINE_IN + TAKEAWAY channel instances while preserving EXTERNAL negatives. |
| F-S-001 complete seed parent positional coupling | S | CLOSED_STATIC | Current design explicitly requires stage-id lookup/validator binding and removal of `stages[n]` business assumptions. |
| Round 1 did not identify sales-menu Asset target contract gap | — | NEW_ROUND2_OPEN | F-M-201 remains open. |
| Round 1 did not identify channel/menu/candidate “all” vs cursor gap | — | NEW_ROUND2_OPEN | F-M-202 remains open. |

## Final decision

ROUND_FINAL_DECISION=SELF_DECIDED  
furtherCodexAdversarialRoundAllowed=false  
VERDICT=NO-GO

This is the final Codex adversarial round for `REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01` under the two-round cap. The main agent should not summon another Codex adversarial reviewer for this same DESIGN cycle/scope. Minimum safe next action is author-side source-first intake and design repair for F-M-201 and F-M-202, followed by SELF_DECIDED closeout or Dexter product decision only if repair uncovers a true product ambiguity.

## Verification notes

- No repository file was modified.
- No Git command was run or suggested.
- No Testcontainers/backend-acceptance command was run or suggested.
- No Browser L2 command was run or suggested.
- No DEV start/stop/reset/seed command was run or suggested.
- No UAT/deploy action was run or suggested.
- All conclusions are static/source/design-review conclusions only.
