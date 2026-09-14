# B7 SalesMenu source/data-flow equivalence ledger

## Evidence identity

- Scope: B7 SalesMenu execution relocation only.
- Evidence kind: SOURCE_DATA_FLOW_EQUIVALENCE_LEDGER.
- Historical runtime capture: NOT_AVAILABLE. No B7 before-capture artifact was saved before the legacy repository files were removed.
- Current after-capture: r5-tc-1789286671083-44639.
- After-capture artifact:
-  .runtime/r5/evidence/remote-testcontainers/r5-tc-1789286671083-44639/sql-captures/apps/backend/catering-business-server/modules/sales-menu/sales-menu-effective-sql-capture-after.xml
- After-capture facts: 119 unique normal points; 82 unique explicit branch-case records; sink counts for normal points are update=61, query=57, queryForList=1. The branch records contain 66 JDBC outcomes and 15 explicit NO_JDBC outcomes, plus one REJECTED invalid-cursor outcome. JUnit capture tests=2, failures=0, errors=0.
- This ledger is the permitted source/data-flow alternative to a same-input before/after capture described by the B7 plan. It does not pretend that the mocked JDBC after capture is a historical database trace. A fresh independent reviewer must decide whether the ledger is complete enough to close B7.

## 1. Before boundary recorded before B7 writes

The following facts were recorded in the CP-0 pre-write inventory before the B7 production change. The line numbers below are locations in that frozen evidence document, not claims that the deleted files still exist in the current tree.

| Before fact | Pre-write evidence |
| --- | --- |
| Public raw boundary | CP-0 evidence §6, lines 1207-1213: SalesMenuRepository.query(String, RowMapper, Object...) and update(String, Object...), with JdbcSalesMenuRepository as the implementation. |
| Legacy application call-site closure | CP-0 evidence §10.6, lines 1746-1748: all six SalesMenu application services are listed by source path and line; private helpers inherit the public caller's owner, and nested JDBC callbacks are distinguished from public raw boundaries. |
| Pre-write transaction counts | B7 execution evidence, pre-read section: Definition=6, Section=4, Item=4, Publication=1, ManualSale=2, OperationRecord=1; total=18. |
| Pre-write persistence call count | B7 execution evidence, pre-read section: 155 receiver calls, of which 128 were generic query/update calls and 27 were existing typed aggregate/receipt/lock/CAS calls. |
| Pre-write service families | CP-0 evidence lines 1851-1857 and implementation design §4.3: collection, section, item, publication, manual-sale and operation-record families are distinct; the facade is a forwarding boundary. |

The following family list is retained as the CP-0 owner/family anchor, but it is not the complete generic sink inventory. The complete 128-call normal execution index, including helper, receipt and readback points omitted from this abbreviated anchor, is in [the B7 normal execution-point ledger](2026-09-12-v2s-readability-b7-sales-menu-normal-execution-ledger-codex.md):

- Definition: 146, 236, 245, 249, 282, 291, 310, 321, 338, 355, 463, 532, 539, 541, 551, 571, 576, 594, 607, 621, 636, 654, 677, 689, 798, 906.
- Section: 162, 166, 186, 209, 345, 443, 449, 455, 670.
- Item: 325, 342, 347, 390, 394, 399, 404, 408, 458, 611, 682, 715, 777, 783, 789, 848, 907, 1139, 1151, 1507, 1529, 1535, 1545, 1550, 1555, 1569, 2033.
- Publication: 155, 168, 191, 253, 574, 592, 606, 676, 716, 739, 754, 816, 827, 839, 1164.
- ManualSale: 193, 214, 306, 404, 542.
- OperationRecord: 207.

The source paths for the six abbreviated lists are the corresponding current-byte pre-write paths recorded in CP-0 evidence §10.6. This anchor is not used as a numeric completion gate; the normal execution-point ledger is the complete 128-point index, and each point is reconciled by owner, target, branch, sink and readback role.

## 1.1 Historical source recovery and branch alignment

Because no B7 runtime before-capture was saved, the before side was reopened as read-only source evidence from the pre-B7 worktree at `/Users/dexter/.codex/worktrees/70c2/catering-v2s`. This is not current production source and is not modified or executed as part of B7. Its identity was checked by content anchors, not by mtime or a hash-chain: `JdbcSalesMenuRepository.java:88-95` contains the CP-0 generic `query`/`update` boundary, and the six service files contain the CP-0 call-site lines listed in §1.

The following independent source check compared the exact quoted Java SQL literal values in each old application service with the corresponding current SQL holder. The scanner was case-sensitive and compared quoted Java literal tokens only; it did not normalize SQL or parse comments. The result is a provenance sanity check, not a semantic proof. All distinct old SQL literal values are present in the current holder for every family; the two-token reductions in Section and Item are the repeated `"UPDATE "` token represented once as a shared `UPDATE_PREFIX`.

| Family | Old literal tokens / distinct values | Current holder tokens / distinct values | Result |
| --- | ---: | ---: | --- |
| Definition | 73 / 66 | 73 / 66 | all distinct values present |
| Section | 55 / 46 | 53 / 46 | all distinct values present; repeated prefix shared |
| Item | 109 / 85 | 107 / 85 | all distinct values present; repeated prefix shared |
| Publication | 69 / 61 | 69 / 61 | all distinct values present |
| ManualSale | 37 / 33 | 37 / 33 | all distinct values present |
| OperationRecord | 8 / 8 | 8 / 8 | all distinct values present |

The aggregate lookup and CAS path is also aligned separately from the 82 branch records because it is a typed boundary with a boolean lock suffix rather than a family-specific collection-cardinality matrix:

| Stable typed execution point | Before source / effective SQL shape | After source / effective SQL shape | Parameter and outcome alignment |
| --- | --- | --- | --- |
| `find` / `findForUpdate` and `compareAndSetVersion` | `JdbcSalesMenuRepository.java:30-78`; the same aggregate projection and predicates are used for `find` and `findForUpdate`, with the latter adding `FOR UPDATE OF c`; CAS updates `version=version+1` with the five target/version slots | `SalesMenuPersistence.java:49-67,1945-1972`; the same projection fragments and `SALES_MENU_COLLECTION_LOCK_SUFFIX` select the lock form; CAS uses `SQL_FRAGMENT_017 + SQL_FRAGMENT_018` with the same five slots | `lock=false/true` selects only the lock suffix; aggregate mapper and predicate order are unchanged; CAS result remains `== 1`; both lookup methods and CAS are represented by the normal reflected method points and the current after capture |

The branch-level alignment below expands the 82 stable branch IDs in §2. It records the old effective SQL shape and slot rule, rather than only saying that both sides used a repository call. For a cardinality variant, `empty` means the old and current early return/no-write branch; `one` and `many` use the same SQL template with the corresponding placeholder or value-row cardinality.

| Stable branch family and variants | Before source / effective SQL shape | After source / effective SQL shape | Parameter and outcome alignment |
| --- | --- | --- | --- |
| `list-menu-rows/{no-cursor,cursor}` | `SalesMenuDefinitionService.java:120-166`; base collection projection, optional `AND (c.name > ? OR (c.name = ? AND c.collection_ref > ?))`, then `ORDER BY c.name,c.collection_ref LIMIT ?` | `SalesMenuPersistence.java:164-200`; `SQL_FRAGMENT_002..018` plus the same cursor fragment and final limit | initial channel/workspace/group/store/filter slots; cursor adds sort key, sort key, tie breaker in that order; both reach `query` |
| `insert-version/{source-draft-null,source-draft-present}` | `SalesMenuDefinitionService.java:646-666`; one insert template, `sourceDraft == null ? null : sourceDraftRevision` is the ninth value | `SalesMenuPersistence.java:405-425`; `SQL_FRAGMENT_082..084`, same nine value positions | null/present source-draft branch is unchanged; one `update` |
| `read-order-option-groups/{empty,one,many}`, `read-order-option-values/{empty,one,many}`, `read-sku-rows/{empty,one,many}`, `read-media-items/{empty,one,many}` | `SalesMenuDefinitionService.java:669-774`; early empty return, then `version_ref=? AND sales_item_ref IN (?,...)` with family-specific projection/order | `SalesMenuPersistence.java:654-730`; same early return, placeholder cardinality, projection and order fragments | version first, then distinct item refs in list order; empty is `NO_JDBC`, nonempty is one `query` |
| `find-adjacent/{SECTION,ITEM} × {UP,DOWN} × {no-section,section}` | `SalesMenuSectionService.java:396-460`; enum-selected table/ref column, direction-selected predicate/order, optional section predicate, then adjacency query, max query and three updates | `SalesMenuPersistence.java:932-980` plus `982-1015`; same table/ref-column enum mapping and branch expressions | adjacency slots are version, optional section, current order, current order, target; max/set slots remain in source order; all eight combinations are captured |
| `find-item-adjacent/{UP,DOWN} × {no-section,section}`, `max-item-display-order/{no-section,section}`, `set-display-order/item` | `SalesMenuItemService.java:730-794`; item table/ref column fixed by the old caller and direction/section branches are identical in shape | `SalesMenuPersistence.java:1576-1644`; fixed `sales_version_item`/`sales_item_ref` typed target with the same predicates and slots | item ordering has the same five adjacency slots; max has version/optional section; set has display order/version/item; all variants are captured |
| `read-version-item-page/{no-frontier,frontier}`, `read-version-item-rows/{no-section,section} × {no-item,item}` | `SalesMenuItemService.java:797-907`; page adds the three frontier predicates/slots only when cursor exists; rows adds optional section and item predicates in that order | `SalesMenuPersistence.java:1646-1715`; same projection fragments, frontier branch and optional argument order | page slots are version/section/[display order/display order/item]/limit+1; rows are version/[section]/[item]; all six branch combinations are captured |
| `insert-sales-items-batch/{empty,one,many}`, `insert-draft-version-items-batch/{empty,one,many}` | `SalesMenuItemService.java:673-727`; empty return, comma-separated tuples, item fields followed by fixed version/section/collection/media arguments | `SalesMenuPersistence.java:1526-1574`; same empty return, tuple separator and append order | `itemRefs[i], collectionRef, catalogItemRefs[i]` and the draft seed/fixed tail slots are unchanged; empty is `NO_JDBC` |
| `insert-published-items/{empty,one,many}`, `insert-published-skus/{empty,one,many}`, `insert-published-media/{empty,one,many}` | `SalesMenuPublicationService.java:622-743`; per-row tuple separator, source-order argument append, empty values return | `SalesMenuPersistence.java:529-607`; typed seed records retain the same tuple and argument order | item 18-slot, SKU 8-slot and media 4-slot rows remain paired by input order; empty is `NO_JDBC` |
| `read-operation-record-rows/{no-cursor,cursor,invalid-cursor}` | `SalesMenuOperationRecordService.java:115-153`; base operation-record query, optional occurred-at/tie-breaker frontier, invalid numeric cursor rejected before repository call | `SalesMenuPersistence.java:1126-1161`; same base fragments, parse/reject branch and optional frontier | five base scope/menu/channel slots; cursor adds occurred-at twice and tie breaker; invalid is `REJECTED` with no JDBC |
| `read-manual-item-rows/{no-section,section} × {no-item,item}` | `SalesMenuManualSaleService.java:376-404`; common item projection, optional section then item predicate and argument | `SalesMenuPersistence.java:1341-1368`; `SQL_FRAGMENT_028..050`, same optional order | version then optional section then optional item; all four branches captured |
| item projection/status `{empty,one,many}` and `count-draft-items-by-catalog/{empty,one,many}` | `SalesMenuItemService.java:1131-1158,1278-1326,1439-1455,1933-1947`; empty collection return, placeholder expansion and input-order append | `SalesMenuPersistence.java:1717-1807,1870-1885`; same four projections, status projection and count query shapes | version/channel or collection+version precede item/catalog refs; empty is `NO_JDBC`, nonempty is one `query` |

This alignment is a source/data-flow proof of the relocation shape: each old dynamic branch has an explicit after target, old SQL template, branch condition, argument append order and current capture obligation. It does not claim a historical runtime capture that was not saved. The remaining runtime limitation is the mocked-JDBC nature of the after capture, which is stated in §5.

## 2. After boundary and public-surface proof

The current production boundary is:

- SalesMenuPersistence is a Spring Repository at lines 41-45 and receives JdbcTemplate directly.
- Its public methods from lines 49-1940 are typed by SalesMenu business values, read models, commands, targets, scopes, page inputs and seed records.
- The only raw helpers are protected query and update at lines 1975-1980. They are internal implementation helpers, not public persistence boundary methods.
- The six application services have typed SalesMenuPersistence fields and constructors. A current scan of those six files has zero direct .query(...) or .update(...) calls and no SalesMenuRepository, JdbcTemplate, RowMapper or public raw-SQL method parameter.
- The deleted production SalesMenuRepository and JdbcSalesMenuRepository are not present under src/main. The compatibility interface and adapter exist only under src/test and are not Spring beans.
- The renamed SQL holder SalesMenuCollectionPersistenceSql is under application/persistence. The other SalesMenu SQL holders are also consumed by SalesMenuPersistence, not by application services.

The after-capture test uses reflection over all public, non-synthetic declared methods of SalesMenuPersistence. It found 111 methods and generated one normal capture point per method. It then explicitly executes 82 stable branch cases, rather than relying on the reflection default arguments. The branch-case inventory is:

| Branch family | Explicit case IDs | Count | Parameter/slot obligation |
| --- | --- | ---: | --- |
| list-menu-rows | `no-cursor`, `cursor` | 2 | channel/scope/filter/page; cursor adds sort key and tie breaker |
| insert-version | `source-draft-null`, `source-draft-present` | 2 | source ref and source revision nullability are recorded in source order |
| insert-published-items/skus/media | each `empty`, `one`, `many` | 9 | batch element fields and separator/placeholder shape in list order; empty is NO_JDBC |
| read-order-option-groups/values/sku-rows/media-items | each `empty`, `one`, `many` | 12 | version ref plus item-ref list cardinality; empty is NO_JDBC |
| find-adjacent | SECTION/ITEM × UP/DOWN × no-section/section | 8 | table/ref column, direction predicate/order, optional section ref |
| max-display-order | SECTION/ITEM × no-section/section | 4 | table and optional section ref |
| set-display-order | SECTION/ITEM | 2 | display order, version ref, target ref |
| read-operation-record-rows | `no-cursor`, `cursor`, `invalid-cursor` | 3 | operation scope/page; cursor adds occurred-at and tie breaker; invalid is REJECTED before JDBC |
| read-manual-item-rows | no-section/section × no-item/item | 4 | version ref plus each optional target ref |
| find-item-adjacent | UP/DOWN × no-section/section | 4 | direction predicate/order and optional section ref |
| max-item-display-order | no-section/section | 2 | version ref and optional section ref |
| read-version-item-page | `no-frontier`, `frontier` | 2 | version/section/page; frontier adds display order and item ref |
| read-version-item-rows | no-section/section × no-item/item | 4 | version ref plus each optional target ref |
| item projection reads | five methods × `empty`, `one`, `many` | 15 | channel/version ref plus item-ref list cardinality; empty is NO_JDBC |
| insert-sales-items-batch | `empty`, `one`, `many` | 3 | item-ref and catalog-ref remain positionally paired; empty is NO_JDBC |
| insert-draft-version-items-batch | `empty`, `one`, `many` | 3 | item seed fields followed by version/section/collection/display-media args; empty is NO_JDBC |
| count-draft-items-by-catalog | `empty`, `one`, `many` | 3 | collection/version refs plus catalog-ref set cardinality; empty is NO_JDBC |

The 82 records are emitted with `branch-case-id`, `outcome`, `sink`, `parameter-mapping` and runtime positional `slots`. The current XML contains 119 normal points plus those 82 branch records; its normal signature-point denominator is 111 reflected public method-signature points plus eight additional explicit normal shape points. The normal-point assertion requires non-empty effective SQL, while no-write and rejected branches are represented explicitly without fake SQL. The second capture assertion proves that no public method is varargs and no public method accepts RowMapper. The source-only/result-mapping branches (for example schedule decoding and null result filtering) do not change effective SQL; they remain covered by the existing typed behavior tests and are not silently counted as SQL-shape cases.

## 3. Family-to-target ledger

The following rows reconcile every pre-write application family to the current typed persistence target. The old call-site list in §1 is the before anchor; the current line ranges and method names are the after anchor. The capture XML is the execution-point ledger for the after sink and slot shape.

| Family / owner | Before execution anchor | Current typed persistence target | Branch and slot obligations | Transaction, lock/CAS, receipt and readback |
| --- | --- | --- | --- | --- |
| sales-menu.collection / SalesMenuDefinitionService | The Definition call-site list in §1; old calls entered the generic repository boundary. | SalesMenuPersistence.find/findForUpdate/compareAndSetVersion/lockCommandReceipt/readCommandReceipt/insertCommandReceipt/readCommandReceiptForReplay/recordSuccess at 49-161; collection list/read/write/copy/version methods at 164-425 and 732-800. | listMenuRows has no-cursor/cursor cases; insertVersion has source-draft-null/present parameter cases; collection create/copy/activation/schedule use the typed argument order recorded in capture keys and slots. | Current annotations remain six REQUIRED entries at Definition lines 179, 210, 241, 249, 257 and 272. CAS and receipt methods remain common typed calls; current readMenu/listMenus paths read the authoritative menu rows through typed methods. |
| sales-menu.section / SalesMenuSectionService | The Section call-site list in §1; old section/order SQL entered the generic repository boundary. | createSection/createSectionVersion/renameSection/sectionHasItems/deleteSection/readCurrentSection/readSections/readSectionDraftVersion/readSectionPublishedVersion at 841-931; findAdjacent/maxDisplayOrder/setDisplayOrder/advanceSectionDraftRevision/sectionExists at 932-1026; section receipt and operation methods at 1036-1104. | findAdjacent covers SECTION versus ITEM × UP/DOWN × optional section; maxDisplayOrder covers both tables × optional section; setDisplayOrder covers both tables. All cases are explicit in the branch XML, not just item/down/no-section and section/up/section examples. | Current annotations remain four REQUIRED entries at Section lines 158, 171, 182 and 195. Section command receipt, CAS, lock and readback stay in the Section service flow; current persistence exposes typed receipt and section rows. |
| sales-menu.item / SalesMenuItemService | The Item call-site list in §1, including the three old dynamic table/column points and the three SQL-variable points recorded as RAW_SQL_VARIABLE_BOUNDARY in CP-0. | Draft item snapshot, SKU, option, media, item existence and item operation methods at 1434-1540 and 1820-1940; item batch/copy methods at 1526-1574; findItemAdjacent/maxItemDisplayOrder/setItemDisplayOrder/readVersionItemPage/readVersionItemRows at 1576-1715; item option/SKU/media/manual projections at 1717-1809. | Item ordering covers direction/optional section; page covers frontier/no-frontier; rows cover both optional targets; five projection reads and three batch methods cover empty/one/many cardinalities, with empty branches explicitly NO_JDBC. XML slots record each effective positional shape. | Current annotations remain four REQUIRED entries at Item lines 253, 301, 358 and 379. Item update/delete/move flows still call typed CAS/receipt/readback helpers; asset target and Catalog/Inventory/Channel calls remain in the application service rather than in persistence. |
| sales-menu.publication / SalesMenuPublicationService | The Publication call-site list in §1; old publication SQL entered the generic repository boundary. | insertPublicationRecord/setLatestPublishedVersion/removeUnpublishedChildManualStatuses/copyPublishedSections/insertPublishedOrderOption/insertPublishedOrderOptionValue at 428-528; batch published item/SKU/media methods at 529-610; publication read/version support at 732-800 and 1809. | Batch methods preserve the empty-input no-write branch and the values/argument append order; item, SKU, option, media and published-section paths have separate typed methods and capture keys. | Current annotation remains the single REQUIRED entry at Publication line 130. The publication service still validates before writes, inserts the publication record, changes the latest version, cleans stale child status, and performs published readback; typed persistence does not change that order. |
| sales-menu.manual-sale / SalesMenuManualSaleService | The ManualSale call-site list in §1; old manual status/name/receipt SQL entered the generic repository boundary. | upsertManualStatus/insertManualStatusEvent/readPublishedSkuName/readPublishedOptionValueName/manual receipt methods/readManualItemRows/readManualDraftVersion/readManualPublishedVersion/recordManualOperation at 1208-1432; current manual status projections are at 1791-1807. | ITEM, SKU and ORDER_OPTION_VALUE target values remain application/domain inputs; name lookup and status projection use typed UUID/list inputs. Empty projection lists remain an explicit no-write/read-empty branch. | Current annotations remain two REQUIRED entries at ManualSale lines 117 and 131. Manual receipt lock, first-use/replay, CAS and authoritative manual-status readback remain in the ManualSale flow; Inventory availability is still read separately. |
| sales-menu.operation-record / SalesMenuOperationRecordService | The single OperationRecord call-site anchor in §1; old rejected-operation SQL entered the generic repository boundary. | readOperationRecordRows and insertRejectedOperation at 1126-1206; recordSuccess is shared only as the typed persistence implementation used by operation writers. | Operation query/page inputs are typed; operation record target kind/ref/display snapshot remain separate business fields, not manual-sale target inputs. | Current annotation remains one REQUIRED entry at OperationRecord line 153. Failure-record persistence/readback stays separate from menu mutation and manual status. |

This is a source/data-flow ledger rather than a claim that all six old files still exist. It is complete at the family boundary because:

1. every old application sink family is named in §1;
2. every current public persistence method is represented by the 111-method reflection sweep and the 119-point capture artifact (111 reflected signature points plus eight additional explicit normal shape points);
3. the public application services contain no raw query/update calls;
4. the current transaction annotation count is the same 18-entry distribution as the B7 pre-read; and
5. every reachable effective-SQL branch listed by the source scan is represented by one of the 82 stable branch-case records, including its parameter mapping and no-write/rejected outcome where applicable.

## 4. Invariant-by-invariant equivalence checks

| Invariant | Before anchor | After anchor | Result |
| --- | --- | --- | --- |
| SQL execution sink and effective SQL | Legacy generic repository at CP-0 §6; all six application call-site groups in CP-0 §10.6. | Every typed persistence point reaches the production JdbcTemplate through protected helpers; after XML records SQL, sink and slots. | After sink proof PASS. Historical pair is unavailable; source/data-flow ledger is the equivalence basis submitted for independent review. |
| SQL fragment order and parameter slots | CP-0 records the old dynamic frontier, ordering, SQL-variable and dynamic table/column points. | Current source builds arguments immediately beside each typed SQL call; after XML records slot shape. The branch rows in §3 identify optional fragments and argument append order. | SOURCE_LEDGER_REVIEW_REQUIRED; no sensitive parameter values are recorded. |
| Transaction propagation and outer protocol | B7 pre-read distribution 6/4/4/1/2/1. | Current annotations at Definition 179/210/241/249/257/272; Section 158/171/182/195; Item 253/301/358/379; Publication 130; ManualSale 117/131; OperationRecord 153. | Static distribution MATCHED. Self-call and proxy behavior remain a required focused/independent review point. |
| Receipt and idempotency | CP-0 family anchors and service flows; each service's receipt lock/read/insert/replay methods were in the old sink inventory. | Typed lock/read/insert/replay methods at SalesMenuPersistence 69-123, 750-830, 1036-1086 and 1291-1339; service flow remains in the corresponding target service. | Source mapping MATCHED; behavior proof remains the focused module test and independent review. |
| CAS and lock order | CP-0 class/family map and old service calls; CAS/lock were classified as typed-existing facts. | compareAndSetVersion at 57-67, lockCommandReceipt at 69-72, findForUpdate at 53-55; service calls remain at the current application lines listed by the post-write source scan. | Static call/target mapping MATCHED; runtime ordering is not inferred from capture alone. |
| Authoritative readback and exception/result shape | CP-0 family result/readback anchors at lines 1851-1857 and the service read paths. | Each family has its own typed read rows and current application readback path; no new DTO or HTTP contract was added. | Focused module behavior PASS; current evidence does not upgrade this to full acceptance. |
| Raw boundary does not return | Before public generic query/update was the target boundary. | No production SalesMenuRepository/JdbcSalesMenuRepository; no raw receiver in six application services; only protected helpers in SalesMenuPersistence; test-only legacy adapter is outside production. | Static boundary MATCHED. |

## 5. Explicit limits and closure decision

- The current capture test is intentionally a mocked JdbcTemplate capture. It proves the current source reaches the sink and records the after SQL shape; it does not prove a historical database result.
- Empty-list branches that intentionally return without JDBC are represented by source branch rows and existing behavior tests, not by a point in the after XML. They must not be mistaken for missing sink points.
- The original production repository files were removed before a B7 before-capture artifact was saved. No hash-chain or synthetic before artifact is introduced to hide this fact.
- The focused SalesMenu module run after the last B7 source/test edit is r5-tc-1789283436456-24469 and its cleanup is PASS. The exact-branch-set after-capture run is r5-tc-1789286671083-44639 and its cleanup is PASS. Its XML was parsed with `xmllint`; it contains 119 normal points and 82 unique branch records, including 15 NO_JDBC branches and one REJECTED invalid-cursor branch. The companion normal execution-point ledger records all 128 historical generic query/update invocation lines.
- Fresh independent B7 step reviewer `01a099d0-bd49-7360-aff4-65d69c747eec` accepted the pre-write CP-0 anchors, the complete 128-point normal execution ledger, the current 119-point/82-branch after capture, and the typed transaction/receipt/CAS/readback mappings. The reviewer found no finding and performed no writes or dynamic execution.

  B7_EFFECTIVE_SQL_EQUIVALENCE=MATCHED

  B7_ENTRY=UNBLOCKED; the next approved CP may start. This is a step-level reconciliation, not the final `REVIEW_TARGET=IMPLEMENTATION` verdict or full backend acceptance.
