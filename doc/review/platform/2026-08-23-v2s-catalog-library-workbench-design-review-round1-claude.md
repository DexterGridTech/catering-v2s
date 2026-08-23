# v2s catalog library workbench design review round 1

REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_20260823_DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B  
ROUND_SCOPE=DESIGN_ONLY_STATIC_REVIEW  
BLIND_DECLARATION=本轮未继承或信任作者结论、既有 Claude review、聊天摘要或声明计数；所有可核查计数均从当前文件或 owning source 重新读取。  
FORBIDDEN_ACTIONS_OBSERVED=未编辑产品/设计输入文件；未运行 tests/generators/DEV/reset/start/seed/L2/UAT/Git。

## 0. Verdict block

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
VERDICT=NO-GO  
M/S/N=2/2/1  
L1_ENGINEERING=FAIL: M-001, M-002, S-001, S-002, N-001  
L2_USER_VISIBLE=FAIL: S-001 影响分类树选择/改父级可见行为；S-002 使 8 条 Journey 与 locator/testId/L2 触点无法一一核对；M-002 可能导致跨范围候选可见性 proof 缺口。  
L3_UNVERIFIED=browser L2 未执行且未授权；UAT 未授权；DEV/reset/start/seed 未授权；annotation merge 后业务断言保留未运行验证；新分类候选与 SKU 子行的真实 over-page/cursor 行为未运行验证；新 testId 常量、locator binding、blueprint case denominator 未物化。  
SAME_ROOT_SCAN=已围绕每个 finding 扫描同根设计输入、当前 catalog contract、owner API/task read/coordinator/controller、当前 operations-admin catalog UI、acceptance annotations、L2 blueprint/locator、seed executor；未运行任何动态动作。  
DESIGN_GAPS=写操作 exact-set 30/33 自相矛盾；读授权 4/6/16 分母未分层；category candidate 协议缺失闭合 enum/field/cursor 形状；testId/L2 双分母未在设计冻结时物化。  
EVIDENCE_TIER=STATIC_DOCUMENT_AND_OWNING_SOURCE_ONLY

## 1. Input hashes

| Input | sha256 |
| --- | --- |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` | `f3bade45c3d0383c0d63cd9c519d5f8ecf63eefa5b12a77308a4d5998ff50dc0` |
| `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md` | `40fabfc5ed801e3a9290746c414657d7b986f6c3048864dfcbf7138ee9162689` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md` | `28df22b48361a70e936b2fe64662b45acc0638fc2f5059f87bba9d3d8c94c665` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md` | `4831a16433bc1ff67969c413990f75cfc93fbeacbe29431c9d69f5de0c7767c1` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md` | `c7d898566aca4f203c56979674401d6031634b99be77edbbfa60d7f965bf193b` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md` | `ad86457a90278f0136242d8f4468afdf0117b26afb735a3b1396fd34b74b1cd3` |

## 2. Required references reopened

- Governance/template inputs reopened: `AGENTS.md`, `doc/platform/review-standard.md`, `project-memory/operations/verification-governance.md`, all four requested templates, relevant `doc/platform/frontend-coding-standard.md`, and `doc/platform/foundation-charter.md`.
- Repository context reopened: `PLATFORM-BLUEPRINT.md`, `doc/platform/README.md`, `doc/platform/roadmap-program-registry.json`, current platform roadmap, `project-memory/index.md`, routed review memory via `scripts/context/recall-memory --task-kind review ...`, `project-memory/decisions/deterministic-context-only.md`, and `scripts/README.md`.
- Owning source reopened for premise validation:
  - `scripts/generate/catalog-inventory-p1.mjs`
  - `contracts/catalog/catalog-inventory-edge-contract.json`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogTaskReadService.java`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
  - `contracts/policy/catalog-inventory-l2-case-blueprint.json`
  - `contracts/policy/catalog-inventory-l2-locator-bindings.json`
  - `scripts/dev/catalog-inventory-seed-executor.mjs`

## 3. ACTION_1_VARIANT=1-B extraction

### 3.1 Template omissions

- The implementation design does not provide a single authoritative `UI_WRITE_OPERATION_EXACT_SET` table. It states `UI_OPERATION_DENOMINATOR=46` with `30 mutation`, but the narrative enumeration does not equal 30.
- The read-side design lacks one reconciled table that separates:
  - scoped read authorization operations,
  - UI read consumers,
  - public/non-scoped reads,
  - generated catalog operation denominator.
- Category candidate protocol is intentionally marked as a GAP in IA, but the implementation design does not close it with a component-level request/response enum and cursor shape before handing to executors.
- The testId/L2 design describes a double denominator, but does not materialize the exact new constant list, locator-key list, or blueprint case list for this Journey set.

### 3.2 Cross-document contradictions

- Interaction design says the current true command variant denominator is 30 rows. Implementation design also says write exact-set is 30, but its prose enumeration totals 33 if read literally.
- IA says the first Journey cross-scope acceptance observes four reads: context/navigation/item page/SKU page. Implementation design says read-side authorization includes six scoped reads: context/navigation/parent items/item detail/category candidates/SKU summaries.
- Formal requirements use `disabledReason` for category candidate non-selectable explanations; implementation design shortens this to `reason`, leaving generated contract naming ambiguous.

### 3.3 Unowned concrete bounds/enums

- `usage` in the new category hierarchy/candidate query is a concrete protocol enum in the implementation design, but no closed values are defined.
- Category candidate cursor response fields are not fixed: `items/total/cursor/nextCursor` or equivalent is not specified, and root/null parent semantics are not fixed.
- `30 write`, `16 read`, `59 catalog operations`, `240 platform operations`, `46 problem codes`, `80 annotations`, `47 surfaces`, `16 anchors`, and `17 mechanism rows` are concrete denominators. Some are confirmed below; the write/read exact-set denominators are not yet safely actionable.

## 4. Findings

### M-001 CONFIRMED: write operation exact-set is contradictory, so executors cannot know the real 30 mutations

Evidence:

- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md` declares `FORM_MUTATION_DENOMINATOR=CURRENT_COMMAND_VARIANTS_30` and lists 30 rows.
- That 30-row table includes item, category, dictionary, attribute definition, order option definition, unit, asset, local copy, temporary promotion, and brand copy rows, but omits production-tag create/update/status.
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md` §5.2 says the write exact-set is 30 and refers back to interaction §4.2, but its prose also includes production tag create/update/status plus the other listed families. Literal count is 33, not 30.
- Current `contracts/catalog/catalog-inventory-edge-contract.json` has 57 operations: 20 GET and 37 non-GET. Therefore “30” is clearly a UI subset, but the subset membership is not uniquely defined.

Impact:

- This breaks implementation handoff for generated operation updates, action enablement, problem mapping, testId/L2 denominator, and acceptance coverage.

Exact repair suggestion:

- Add one authoritative `UI_WRITE_OPERATION_EXACT_SET` table with exactly 30 rows. For every existing catalog write not in that table, add an `OUT_OF_SCOPE_WITH_REASON` row.
- Decide explicitly whether production-tag create/update/status are in the 30. If they are in, remove three other operations or update all denominators. If they are out, explain how production-tag UI in `CatalogDictionaryDrawer.tsx` remains existing behavior or excluded scope.
- Align interaction §4.2, implementation §5.2, serial CP-00/CP-13, problem-code coverage, action capability mapping, and L2/testId inventory to the same table.

### M-002 PARTIALLY_CONFIRMED: read authorization denominator is split across 4/6/16 without an enforceable owner-boundary table

Evidence:

- Implementation design §3 states scoped read authorization includes six reads: context, navigation, parent items, item detail, category candidates, and SKU summaries.
- IA for the first Journey states cross-scope acceptance observes four reads: context, navigation, item page, SKU page. It omits category candidates from that acceptance assertion, even though category candidates are used by create/edit/reparent/category control behaviors.
- Implementation design §5.1 lists 16 UI reads, including public asset read, candidate reads, copy reads, library reads, and the two proposed new reads. It does not clearly partition scoped catalog owner reads from public/non-scoped reads.
- Current owner source confirms the new reads do not exist yet: `CatalogOwnerApi.java`, `CatalogTaskReadService.java`, and `CatalogInventoryCoordinator.java` expose current workbench/navigation/items/item/dictionary/copy/shape reads, while `getOperationsCatalogCategoryCandidates` and `getOperationsCatalogItemSkus` are absent from current contract.
- `OperationsCatalogInventoryController.java` already has a `readRequest` helper that resolves session/scope/brand for existing reads; the design should anchor new scoped reads to this same owner boundary.

Impact:

- Candidate visibility is user-visible and permission-sensitive. If category candidates are absent from the cross-scope/read-auth exact set, implementation can accidentally pass list/detail proof while leaking or suppressing candidate rows in create/edit/reparent flows.

Exact repair suggestion:

- Add one `READ_BOUNDARY_EXACT_SET` table that separates:
  - `SCOPED_CATALOG_READ_AUTH=6`,
  - `UI_CATALOG_READ_CONSUMERS=16`,
  - `PUBLIC_OR_NON_SCOPED_READS`,
  - `CURRENT_CONTRACT_GETS=20` and planned catalog operation count `57 -> 59`.
- Update IA stateAndPermission rows to include category candidates anywhere the UI can present category choices.
- For each of the 16 UI reads, identify controller helper, owner API/task read method, state owner, UI consumer, permission/session dependency, and focused static proof.

### S-001 CONFIRMED: category hierarchy candidate protocol is not concrete enough to implement safely

Evidence:

- Formal requirements require stable category identity, parent/child relation, name/code, business order, selectable flag, and `disabledReason`; they also require reparent to disable current node and descendants.
- IA explicitly marks category hierarchy protocol as a GAP because current navigation lacks full path/selectable/disabledReason semantics.
- Implementation design proposes a new query with `usage/currentCategoryRef/parentCategoryRef/keyword/cursor/pageSize` and row `path/selectable/reason`, but does not define the closed `usage` enum, field names, root/null semantics, or cursor response contract.
- Current frontend confirms why this matters: `CatalogItemCreateDrawer.tsx` currently builds `TreeSelect` from navigation tree rows with `{categoryRef, name, parentCategoryRef}` only; `CatalogWorkbenchPage.tsx` currently computes descendant blocking locally from navigation tree for existing reparent behavior. The new design intends to move candidate semantics to owner task read, so the protocol must be exact.

Impact:

- Executor choices here directly affect visible disabled rows, reparent safety, batch assignment, create/edit category selection, and cross-scope candidate correctness.

Exact repair suggestion:

- Add an exact contract component for `CatalogCategoryCandidateQuery` and `CatalogCategoryCandidatePage`.
- Define the closed `usage` enum and required field combinations per usage.
- Pick one field name: `disabledReason` or `reason`; use it consistently in formal, IA, implementation, P1 generator, model decoding, and UI.
- Define `parentCategoryRef=null` root semantics, descendant/current blocking semantics, `path` element shape, business ordering, cursor fields, and pageSize bounds.

### S-002 CONFIRMED: testId/L2 double denominator is a stated principle, not a materialized inventory

Evidence:

- Formal requirements require a double denominator: Journey behavior paths and blueprint cases must be decoupled; testIds are operation anchors, not L2 truth by existence.
- Implementation design CP-10 requires `catalogTestIds.ts -> component -> locator binding -> blueprint` parity, but does not list the concrete new constants, locator keys, or case IDs.
- Current `contracts/policy/catalog-inventory-l2-case-blueprint.json` is the older `CATALOG_INVENTORY_L2_REBUILD_20260816` blueprint with 18 scenario groups.
- Current `contracts/policy/catalog-inventory-l2-locator-bindings.json` has `caseCount=41` and existing catalog/inventory locator bindings, not the new 8-Journey catalog library workbench denominator.

Impact:

- Implementation can add testIds and still fail the user-visible proof requirement because there is no reviewable expected denominator for the 15 screens, 47 surfaces, 12 candidate controls, and 8 Journey paths.

Exact repair suggestion:

- Add a design-time `CATALOG_LIBRARY_TEST_ID_DENOMINATOR` table or source stub with exact stable names for surfaces, controls, submit/cancel/dirty/problem/result states, and row templates.
- Add the expected L2 case denominator IDs for J-CATUI-01..08 and map each to locator keys and business oracle; explicitly keep execution as `L3_UNVERIFIED` until separately authorized.

### N-001 UNVERIFIED_REQUIRES_EVIDENCE: annotation consolidation plan is plausible but assertion preservation is not yet proven

Evidence:

- Current acceptance tree contains 80 `@AcceptanceScenario` annotations.
- `CatalogAcceptanceScenarios.java` contains the four merge anchors named by the design:
  - `catalog.sku-removal-blocked-by-inventory`
  - `catalog.sku-code-change-keeps-inventory`
  - `catalog.copy-definition-semantic-conflict`
  - `catalog.copy-order-option-definition-semantic-conflict`
- The design plans to merge two pairs and add two new scenarios, preserving 80. This is plausible as a plan, but no static design artifact enumerates the business assertions that must survive each merge.

Exact repair suggestion:

- Before implementation, add a small assertion-preservation checklist for the two merge pairs: old assertion, destination scenario, retained request/response/fact assertion, and red mutation. Do not rely only on annotation count staying 80.

## 5. Candidate reconciliation ledger

| Candidate challenge | Classification | Evidence and disposition |
| --- | --- | --- |
| State owners / cascade completeness | PARTIALLY_CONFIRMED | IA has explicit three-state residence and cascade sections; current frontend uses foundation lifecycle, overlay lock, currentData generation guard, idempotency, and accepted page state. However, read-boundary and testId denominator gaps prevent full acceptance of cascade completeness. |
| Whether two new reads are minimal | REJECTED_WITH_EVIDENCE | Current contract lacks category candidates and item SKU page reads; current UI reuses navigation tree/detail structures that do not carry the proposed owner-owned selectable/path/cursor semantics. Two new reads are a plausible minimal addition, provided M-002 and S-001 are repaired. |
| Category hierarchy cursor shape | CONFIRMED | Finding S-001. |
| 80 annotation consolidation | UNVERIFIED_REQUIRES_EVIDENCE | Finding N-001. Count and anchors are verified; assertion preservation is not. |
| 59/240 counts | REJECTED_WITH_EVIDENCE | Current catalog contract count is 57 and registry operation count is 238. Two new operations imply 59/240 if no other operation changes occur. CP-00 still correctly requires recalc on implementation. |
| 17-row mechanism table | REJECTED_WITH_EVIDENCE | Implementation design §3 contains 17 rows and covers permissions, state, generated reads, mutations, errors, counts, seed, candidate controls, L2/testIds, and review. No count finding. |
| 16 unique anchors | REJECTED_WITH_EVIDENCE | Exact anchor strings from implementation §9b each occur once in current owning source files. No uniqueness finding. |
| seed 10b | REJECTED_WITH_EVIDENCE | Implementation design §10b names seed-only sources and executor boundaries; current `scripts/generate/catalog-inventory-p1.mjs` and `scripts/dev/catalog-inventory-seed-executor.mjs` exist. Execution remains L3 unverified because seed is not authorized. |
| testId/L2 double denominator | CONFIRMED | Finding S-002. |
| UI-only language | REJECTED_WITH_EVIDENCE | Formal/IA/implementation repeatedly prohibit raw owner/ref/UUID/profile/effect/manifest/problem/raw enum language and require user-task language. No design finding on wording itself. |
| Permission / owner boundaries | PARTIALLY_CONFIRMED | Owner/module boundaries are broadly consistent with current source and project memory, but M-002 leaves read authorization and candidate visibility insufficiently reconciled. |

## 6. Same-root scan notes

- For M-001, scanned all write-denominator references in formal requirements, interaction §4.2, implementation metadata/§3/§5.2/CP rows, and serial CP-00/CP-13, then compared current contract non-GET count. Contradiction remains.
- For M-002, scanned IA stateAndPermission rows, implementation §3/§5.1, Journey precondition table, current controller `readRequest`, owner API/task read/coordinator methods, and current contract GET operations. Gap remains.
- For S-001, scanned formal category TreeSelect requirements, IA category hierarchy GAP, implementation CP-01/CP-02/§7, serial CP-01/CP-07, current P1 schema, current frontend category usages, and current owner source. Gap remains.
- For S-002, scanned formal §9, interaction screen testId mentions, IA testId/L2 notes, implementation CP-10/§7/§10, serial CP-10, current L2 blueprint, and locator bindings. Gap remains.
- For N-001, scanned current acceptance annotation count across acceptance sources and specific catalog scenario anchors. Count and anchors are verified; post-merge business assertion preservation is unverified.

## 7. Required repair list before GO

1. Repair the write exact-set contradiction with a single 30-row authoritative table, or update every dependent denominator if the real count is not 30.
2. Repair read-boundary exact sets by separating scoped read auth, UI read consumers, public/non-scoped reads, and generated operation totals.
3. Close the category candidate protocol before implementation: closed `usage` enum, consistent disabled-reason field, root/null semantics, cursor response shape, and path element shape.
4. Materialize the catalog library workbench testId/L2 denominator as design data, not only as a future implementation promise.
5. Add assertion-preservation details for the two acceptance annotation merges so the 80 annotation budget does not hide semantic deletion.
