# 商品属性库、点单选项库与两步新建 — implementation 独立对抗盲审第 1 轮

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path:"doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-independent-review-round-1-input-checklist-claude.md",sha256:"25e40de892e50627a95dbff1fafd1d77d895e109f45f9c9c9300bc52f021b078"}
blindReviewDeclaration=I received this checklist in a fresh subagent context, tried to falsify the current implementation, and wrote the independent findings and verdict below before reading an author self-review or author finding disposition.
authorMaterialReadAfterIndependentVerdict=true
```

## Action 1-A — rendered/source fact extraction

| Surface / source | Extracted fact | Outcome |
| --- | --- | --- |
| `CatalogItemCreateDrawer.tsx` + `CatalogWorkbenchPage.tsx` | First step is an AntD `Modal`; create result is withheld from the Drawer until `afterOpenChange(false)`, then `onCreated` opens the same item in edit mode. `categoryRef` is scalar/nullable and TreeSelect supplies one value. | Matches IA; no finding. |
| `CatalogItemDrawer.tsx` | New typed `attributeAssignments` and `orderOptionConfigs` are saved, but the component still hydrates `detail.item.attributes` into `attributesDraftRows`, carries old item-owned `orderOptionsDraft`, validates it, and supplies it to the inventory BOM editor. | M-02. |
| Migration + owner | New relational definition/assignment/configuration tables exist and replacement writes set `catalog_item.attributes` to `{}`. The migration neither removes that column nor clears it. The owner still selects/copies it as a persisted fact. | M-02. |
| Definition schema + copy closure | Attribute definitions have a code. Order-option definition and value tables, OpenAPI requests/readbacks and operations have no group/value code. Copy policy/closure and acceptance contain no new definition closure or same-code semantic conflict proof. | M-01. |
| `CatalogAcceptanceScenarios.java` | Static scenarios exist for typed definition CRUD/delete, 501 limit, `FIXED` rejection, and `MULTIPLE max=1` readback. The specified dynamic run is NOT_RUN/cleanup FAIL, so none of these are HTTP proof for current bytes. | L3, not a static pass. |

## Findings — independent verdict input

### M-01 — 点单选项库没有可执行的 same-code 语义，品牌复制闭包也未覆盖定义库

- **Classification:** `CONFIRMED`; **tier:** L1 and L2; **severity:** M.
- **Evidence:** `V20260820_010000_000__catalog_item_definition_libraries.sql` gives `catalog_order_option_definition` and `_value` no `code` column. The corresponding OpenAPI/generated request/readback types carry name/ref but no group/value code. `CatalogOwnerService`/copy policy and `CatalogAcceptanceScenarios` contain neither definition-library closure/rewrite nor a same-code type/options/materials `BLOCKED` oracle.
- **Why this blocks:** the approved Journey leaves U-02 code mutability unresolved and explicitly forbids replacing same-code semantics with a name or UUID. Without the group/value code identity there is no value to compare; a code-less copy flow cannot safely decide whether a target private definition is the same definition or an incompatible collision. The required hard-BLOCKED preflight and execute-no-write guarantee therefore cannot be true for this batch.
- **Same-root denominator:** (1) order-option definition migration schema; (2) OpenAPI shard and generated Java/TS wire; (3) owner copy preflight/execute + copy policy; (4) operations-admin brand-copy rendering; (5) catalog acceptance. All five were checked; the remaining **0** same-root layers exist outside this finite route chain. The option-library create/update/delete CRUD layer is not an exception because it cannot define the missing identity.
- **Minimum repair decision:** do not infer an identity from `name`/UUID. Return the unresolved U-02 product decision to Dexter, then implement one defined code contract and its copy closure/BLOCKED execute proof, or explicitly remove this definition-library copy claim from the approved scope.

### M-02 — 已退役自由属性 / 商品内联点单组选项仍在运行时 read/DTO/UI 链上

- **Classification:** `CONFIRMED`; **tier:** L1 and L2; **severity:** M.
- **Evidence:** `CatalogOwnerService` still persists/selects/copies `catalog.catalog_item.attributes`; migration does not drop/clear it. `CatalogItemDrawer.tsx` hydrates `detail.item.attributes` into `attributesDraftRows`; it maintains, validates and passes `orderOptionsDraft` from `detail.item.orderOptions` to legacy inventory-BOM selection. These facts are not the typed definition-ref/configuration chain.
- **Why this blocks:** “清库无兼容双写” and the Journey’s “商品不再保存自由 JSON 属性或自创点单组” require one current relationship source of truth. Setting `{}` only on a later save does not clear existing rows and retaining the field in runtime read/interaction provides a live compatibility path. It can make a detail draw/use legacy item-owned values while the new typed configuration is the source meant to control the item.
- **Same-root denominator:** (1) `catalog_item.attributes` migration/persistence/read/copy; (2) detail OpenAPI/generated wire; (3) drawer hydration/form state; (4) legacy BOM option candidate path. All four were checked; remaining **0** in the observed old-fact route.
- **Minimum repair:** remove the old persisted/read/DTO/UI path atomically for the clean-library model and make the BOM editor consume only typed definition values where that is the approved relationship. Do not add a fallback or a dual-write bridge.

### M-03 — 当前实现缺少逐实际变更点的前读 / proof 后读留痕

- **Classification:** `CONFIRMED`; **tier:** L1 governance; **severity:** M.
- **Evidence:** the independent-review input rule requires a per-change IA/original requirement + routed memory + owning source/design/reuse pre-read and the same post-proof readback. No complete current-batch ledger was available in the reviewed inputs; generic source/static material does not identify each actual change point or prove its post-proof reread.
- **Same-root denominator:** the batch comprises production, contract/generator, migration, frontend and acceptance changes; the required evidence must cover every actual change point. Remaining **all unrecorded points** are unverified rather than assumed compliant.
- **Minimum repair:** author must provide actual per-change records; do not manufacture them retrospectively from a global reading pass.

## Required review inventory

| Claim | Static source result | Test result | Nobody has verified |
| --- | --- | --- | --- |
| Modal closes before opening edit Drawer; scalar category; no `FIXED`; `MULTIPLE max=1` remains multiple | Source-supported | focused/HTTP result unavailable this round | Browser rendering, focus/overlay/1280 layout |
| Typed definition CRUD, delete cascade, StockTarget gate, REQUIRED cross-owner path, BOM version CAS | Source-supported in parts | current requested acceptance is NOT_RUN | Real HTTP business effect for current bytes |
| Brand copy includes definitions/configurations/BOM rewrites and incompatible same-code hard-BLOCKED | refuted by M-01 | no proof | all dynamic and user-visible results |
| Legacy free map/item-owned option retirement | refuted by M-02 | no proof | migration outcome and UI behavior |

## Verdict

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=3/0/0
L1_ENGINEERING=findings M-01, M-02, M-03
L2_USER_VISIBLE=findings M-01, M-02; Modal handoff is source-conformant only
L3_UNVERIFIED=real HTTP acceptance NOT_RUN due LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED and cleanup FAIL; browser L2/DEV/seed/UAT not run
SAME_ROOT_SCAN=M-01 five-layer definition identity/copy chain checked; M-02 four-layer legacy runtime chain checked; M-03 all actual change points lack a complete double-read record
DESIGN_GAPS=U-02 point单组选项/值编码可否修改 is explicitly undecided; implementation must not replace it with name/UUID semantics
EVIDENCE_TIER=static source extraction plus existing test-source inspection only; not HTTP, L2, DEV, seed or UAT evidence
```

## Author-material order

The independent verdict above was formed before author review/disposition material. After its
creation, no current-batch author implementation verdict/disposition file was found under
`doc/review/platform/`; this review therefore has no author conclusion to reconcile in round 1.
