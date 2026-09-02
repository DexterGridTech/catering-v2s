# V2S Sales Menu SM-05 Ordered Sections and Items Stage Reconciliation Recheck

REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.ordered-sections-and-items
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_ROUND=不适用（步骤级对账，不是正式 REVIEW_TARGET review）
blindReviewDeclaration=本轮以证伪为立场重新读取当前字节、项目记忆、需求/IA/交互/详设/计划、owning source、contract/generated 边界、既有 evidence ledger、上一轮 verifier artifact、latest managed run 与 preserved first-failure run；未继承主 agent 或上一轮 verifier 的修复结论，也未把 managed run PASS 自动当作阶段 PASS。
FINAL_STAGE_VERDICT=PASS
OPEN_COUNT=0
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO

## INPUTS

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `scripts/README.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `doc/platform/review-standard.md`
- `.agents/skills/cs-review/SKILL.md`
- `.agents/skills/cs-memory-recall/SKILL.md`
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`
- `project-memory/index.md`
- `scripts/context/recall-memory`
- recall-memory routes actually executed/read:
  - `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner sales-menu --impact ordering --trigger stage-recheck` returned `PROJECT_MEMORY=FAIL REASON=unknown or non-specific route: owners:sales-menu`; this was not used as proof.
  - `scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact architecture --trigger review`
  - `scripts/context/recall-memory --task-kind review --domain contract --consumer-face backend --owner contract --impact contract --trigger review`
  - `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner product --impact evidence --trigger review`
  - `scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact database --trigger failure`
- reopened project-memory/kernel and routed governance sources:
  - `project-memory/kernel/01-workspace-and-roadmap.md`
  - `project-memory/kernel/02-service-shape-and-owner.md`
  - `project-memory/kernel/03-transaction-data-and-dependencies.md`
  - `project-memory/kernel/04-contract-consumer-and-admin.md`
  - `project-memory/kernel/05-evidence-runtime-and-git.md`
  - `project-memory/kernel/06-heritage-and-change.md`
  - `project-memory/decisions/deterministic-context-only.md`
  - `project-memory/practices/ordering-only-for-consumer-facing.md`
  - `project-memory/practices/collection-boundary-modes.md`
  - `project-memory/operations/backend-acceptance.md`
  - `project-memory/operations/test-closed-loop.md`
  - `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`
  - `project-memory/operations/phase-retrospective-and-systemic-repair.md`
- requested sales-menu source documents:
  - `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
  - `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
  - `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
  - `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
  - `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- current acceptance/source/contract/generated boundary:
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuReadback.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuOwnerApi.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuMoveDirection.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuPageRequest.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuCursorIdentity.java`
  - `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/collection/OpaqueCollectionCursor.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuWireMapper.java`
  - `contracts/openapi-source/sales-menu.schemas.json`
  - `contracts/openapi/paths/operations-admin/sales-menu.paths.json`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuSectionMoveRequest.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuItemMoveRequest.java`
- existing evidence ledger and previous verifier artifact:
  - `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md`
  - `doc/evidence/platform/2026-09-02-v2s-sales-menu-ordered-stage-reconciliation-codex.md`
- latest managed run:
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/run-manifest.json`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/evidence-artifacts.tsv`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/http-request-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/db-operation-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/backend-acceptance-result.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/statement-dictionary.json.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304965912-3745/gradle.log`
- preserved first-failure run:
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/run-manifest.json`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/evidence-artifacts.tsv`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/http-request-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/db-operation-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/backend-acceptance-result.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/statement-dictionary.json.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788304804685-3507/gradle.log`

No Testcontainers, DEV, reset, seed, browser, dynamic infrastructure, implementation edit, contract edit, generated edit, test edit, plan edit, or existing evidence ledger edit was run. The only write in this review was this file.

## Previous findings dispositions

| Previous OPEN | Current disposition | Evidence |
| --- | --- | --- |
| OPEN-01: section lifecycle oracle did not prove full order/readback/no-mutation closure | CLOSED_BY_CURRENT_BYTES | `SalesMenuAcceptanceScenarios.java:631-757` now asserts the initial three-section full tuple, exact post-rename/post-DOWN tuple, rejected non-empty delete `SECTION_NOT_EMPTY`, exact unchanged tuple after reject, and post-empty-delete remaining tuple. |
| OPEN-02: item move oracle did not prove rejected-UP no mutation or DOWN authoritative readback | CLOSED_BY_CURRENT_BYTES | `SalesMenuAcceptanceScenarios.java:759-823` now captures complete reachable item sequence and per-item versions, asserts first item `UP` returns `MOVE_NOT_ALLOWED`, asserts full sequence and versions unchanged after reject, then asserts `DOWN` swaps former first/second while preserving cardinality, identity set and versions. |
| OPEN-03: duplicate catalog item oracle did not assert distinct `salesItemRef` identities | CLOSED_BY_CURRENT_BYTES | `SalesMenuAcceptanceScenarios.java:660-712` now adds the same catalog item to a second section, gathers rows by `catalogItemRef`, asserts exactly two rows, asserts each `salesItemRef` is nonblank, and asserts distinct `salesItemRef` count is two. |

## Focused falsification checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| 1. Three section initial complete tuple: ref/name/displayOrder/itemCount/canMoveUp/canMoveDown | MATCHED | Scenario creates A/B/C and asserts `sectionFact(ref,name,order,itemCount,canMoveUp,canMoveDown)` equals A `0/21/false/true`, B `1/0/true/true`, C `2/0/true/false` at `SalesMenuAcceptanceScenarios.java:631-642`; helper extracts exactly those fields at `2305-2321`. |
| 2. Rename specified section then DOWN exact authoritative full order | MATCHED | Scenario renames `second.ref()` then moves the same `second.ref()` DOWN, then asserts exact full tuple order A, C, B renamed at `714-728`. Owner `moveSection` requires the specified section and swaps adjacent rows at `SalesMenuOwnerService.java:636-649` and `1780-1849`. |
| 3. Non-empty delete returns `SECTION_NOT_EMPTY` and exact tuple unchanged | MATCHED | Scenario deletes first non-empty section with expected 409, asserts problem code `SECTION_NOT_EMPTY`, rereads draft sections, and asserts equality to `expectedSectionsAfterMove` at `729-745`. Owner rejects when section has any version item at `SalesMenuOwnerService.java:614-631`. |
| 4. Empty section delete removes only target identity and keeps remaining order/itemCount/canMove flags correct | MATCHED | Scenario deletes `third.ref()` after it is the empty middle section, then asserts only first and renamed second remain with A `0/21/false/true` and B renamed `2/1/true/false` at `746-757`. Owner delete targets `version_ref` + `section_ref` at `SalesMenuOwnerService.java:625-628`; section canMove flags are recomputed by owner adjacent existence at `1851-1885`. |
| 5. 21 candidate 20+1, 21 draft items 20+1, real continuation cursor | MATCHED | Scenario creates 21 catalog items, reads candidates `pageSize=20`, asserts 20, nonblank `nextCursor`, second page 1, and all catalog refs retained at `586-629`; after adding 21 items it asserts draft item first page 20, nonblank cursor, second page 1 at `630-658`. Page size is fixed to 20 in edge/domain at `SalesMenuEdgeSupport.java:172-174` and `SalesMenuPageRequest.java:3-12`; owner item pages use cursor identity + frontier + `LIMIT pageSize+1` at `SalesMenuOwnerService.java:1888-1947`; `OpaqueCollectionCursor` binds query identity, sort key and UUID tie-breaker at `OpaqueCollectionCursor.java:18-55`. |
| 6. Same Catalog item across two sections has two nonblank distinct `salesItemRef` | MATCHED | Scenario adds `catalogRefs.getFirst()` to the second section, gathers both sections' item rows, filters by same `catalogItemRef`, asserts exactly two rows, asserts each `salesItemRef` nonblank, and asserts two distinct `salesItemRef` values at `660-712`. Owner creates a fresh `UUID.randomUUID()` sales item per catalog ref add and inserts `sales_item`/`sales_version_item` at `SalesMenuOwnerService.java:654-711`. |
| 7. First item UP returns `MOVE_NOT_ALLOWED` and full sequence + versions unchanged | MATCHED | Scenario reads all rows, captures full `salesItemRef` sequence and version map, posts `UP` for the first item with 409, asserts `MOVE_NOT_ALLOWED`, rereads all rows, and asserts sequence and every version unchanged at `759-796`. Owner adjacency absence throws `MOVE_NOT_ALLOWED` before any update at `SalesMenuOwnerService.java:1780-1820`. |
| 8. DOWN swaps former first/second and preserves complete identity set and versions | MATCHED | Scenario moves the former first item DOWN, rereads all rows, asserts cardinality unchanged, set equality, former second at index 0, former first at index 1, and unchanged per-row versions at `797-823`. Owner item move constrains adjacency to the current section and uses temporary-order three-update swap at `SalesMenuOwnerService.java:1780-1849`. |
| 9. Only UP/DOWN, no drag/drop; no OFFSET/client slice/auto-drain/total fake closure; owner keyset/cursor identity and readback | MATCHED | Domain enum is only `UP/DOWN` in `SalesMenuMoveDirection.java:3-5`; OpenAPI move requests are `enum ["UP","DOWN"]` at `contracts/openapi-source/sales-menu.schemas.json:431-438` and `467-474`; generated wire request records only `direction` and `expectedVersion`. `rg` over inspected backend/contract source found no `OFFSET` except the `SalesMenuPageRequest` comment stating offset is not part of owner boundary. Owner draft items use keyset frontier `(display_order, sales_item_ref)` and `LIMIT ?`; section readback is owner recomputed. Acceptance helper `readAllDraftItemRows` auto-follows only as a test oracle to compare complete reachable rows; no product client auto-drain is introduced or claimed. |
| 10. Current run CONTRACT/BUSINESS/measurement/archive/resource cleanup/first failure separation | MATCHED | Latest manifest has `status=PASS`, `business=PASS`, cleanup `remoteProcess/remoteWorkspace/testcontainersContainers/testcontainersVolumes=PASS`. Latest `backend-acceptance-result.jsonl.gz` records selected operation `sales-menu.ordered-sections-and-items`, `contract=PASS`, `business=PASS`, `dbOperations=40`; `gradle.log` ends `BUILD SUCCESSFUL in 53s`. Preserved first-failure run manifest has `status=FAIL`, `business=FAIL`, cleanup PASS; its result archive records `BUSINESS_ORACLE` mismatch expected B renamed itemCount `0` but actual `1`, and `gradle.log` records the scenario failed. |

## Managed archive integrity and boundary

Latest run SHA-256 recomputed:

| Artifact | Recomputed archive/file SHA-256 | TSV raw SHA-256 when applicable |
| --- | --- | --- |
| `r5-tc-1788304965912-3745/run-manifest.json` | `77f507ed78390bc2b900bc2a032b3cd7e4b218e66761caab89ee6e922728c136` | N/A |
| `r5-tc-1788304965912-3745/evidence-artifacts.tsv` | `53850fa722f3023d7039372051f5d138a6747fd2af8633d225f0c44a65ffb5e5` | N/A |
| `r5-tc-1788304965912-3745/http-request-events.jsonl.gz` | `b7507e92f3490ca0f83bc218ead074f5acecea9c0c97786329d4394a5b522621` | `40e9350917bc06e15cab3fa8d0093e98f83401b7e63390d1197cd8496a825ff2` |
| `r5-tc-1788304965912-3745/backend-acceptance-result.jsonl.gz` | `ad9dfb95a9da424595eec47384ccfa6ffd050cf26094d5366d377aa0dfa653dd` | `5c8ce667f35f3d6afec6048ae61d4e5843fc4610bff53a2ab60eaee92f875df9` |
| `r5-tc-1788304965912-3745/db-operation-events.jsonl.gz` | `ed943b469d843c6714b946712dc448a5ac4630384d50d112f35740dcd86fec16` | `2fdc6790634955e8a182e0964099ea091ee77bb223a28f92d9b4cb73875d7c8a` |
| `r5-tc-1788304965912-3745/statement-dictionary.json.gz` | `0a2e07aa124f16725684c63eb989a741523551d4bffe2e2a5bedd55a9ba19137` | `03733c7424bb2ad4641aed8d6e6866c41632bed9cca55bac0dd6533fc2948eb5` |
| `r5-tc-1788304965912-3745/gradle.log` | `c64e22ca210dde3bfb078efbf24894263d087443b94b52029ecb19a03134b385` | N/A |

Preserved first-failure run SHA-256 recomputed:

| Artifact | Recomputed archive/file SHA-256 | TSV raw SHA-256 when applicable |
| --- | --- | --- |
| `r5-tc-1788304804685-3507/run-manifest.json` | `14876b0e0924453f44dfb40e6c15500bf9bb0b2adf837ac45f2a6502cdbaf5b2` | N/A |
| `r5-tc-1788304804685-3507/evidence-artifacts.tsv` | `6ef341f2625da97bd17bc9ea0f69a307f5c2d80c9b54a44c91982d396f0d0c61` | N/A |
| `r5-tc-1788304804685-3507/http-request-events.jsonl.gz` | `0bc3d48fa8860147b792f20637c11f5651d1ae2c12bdf1d629dfbf2223d47a7e` | `e16bd0e5d527695ddceb626cd66cde177a49638cb479374af8362390f7f9cf51` |
| `r5-tc-1788304804685-3507/backend-acceptance-result.jsonl.gz` | `54a43d8a675f01501df8fd195cd83d09a433f3049c65e1858bf7f9976d6b1752` | `687cdf5fd6c8dd724edf9569b442e837fc0412abd81b839e175e16bc7b99f544` |
| `r5-tc-1788304804685-3507/db-operation-events.jsonl.gz` | `0cf35446ae7befd67d155e8dfe9b6867bdc942ef326485f026fb1cd450e631d7` | `1a65f4d7b3ccd14b954773079a79088d2a8d1f9c15b23908ed5d65f451416c92` |
| `r5-tc-1788304804685-3507/statement-dictionary.json.gz` | `0dea4a55f029968aa6c668ec04406b127cd5ac1768ca2bfedffb4f7310eb4735` | `cb139653a874981b6147639fb8c90758f3177a0ba6de6fac8eab0d0e999757a3` |
| `r5-tc-1788304804685-3507/gradle.log` | `7465b4d516d5d8934a3bef9749f25255cc0656c113c16fd7ca688dd3c21ad57f` | N/A |

HTTP archive boundary: the latest HTTP archive has 32 sales-menu completion/measurement events with operationId/method/routeTemplate/status/outcome/DB metrics/phase checkpoints and zero unclassified SQL; it has no `body`, `requestBody`, or `responseBody` fields. Therefore it proves real request completion and measurement shape, but it is not response-body proof. Body-level tuple, cursor, problem-code and identity facts are established by the current hand-written acceptance oracle executing in the PASS run, plus owning source/contract inspection, not by replaying HTTP response bodies from the archive.

Latest sales-menu HTTP event counts: `getOperationsSalesMenuDraftItems=11`, `getOperationsSalesMenuDraftSections=7`, `createOperationsSalesMenuSection=3`, `getOperationsSalesMenuItemCandidates=2`, `addOperationsSalesMenuItems=2`, `deleteOperationsSalesMenuSection=2`, `moveOperationsSalesMenuItem=2`, `createOperationsSalesMenu=1`, `renameOperationsSalesMenuSection=1`, `moveOperationsSalesMenuSection=1`; status counts `200=24`, `201=6`, `409=2`; request-scoped DB operation sum `1077`, unclassified SQL sum `0`.

## 11 dimensions and evidence

| Dimension | Result | Evidence |
| --- | --- | --- |
| behavior | MATCHED | Current oracle and latest PASS run cover section/item ordering, typed reject/no-mutation and duplicate item identity. Exact body archive is absent, so behavior is not inferred from HTTP metadata; it is tied to `SalesMenuAcceptanceScenarios.java:571-823` assertions and source execution. |
| surface/form | MATCHED | Backend surface exposes operations-admin sales-menu section/item/candidate routes with cursor/pageSize where applicable; contract schemas require `items/cursor/nextCursor` for pages and required section/item ordering fields; no total/offset field is exposed. Backend-only stage does not claim frontend rendered form. |
| actions | MATCHED | Scenario exercises candidate reads, section create/rename/move/delete, item add/read/move. Move actions are constrained to `UP`/`DOWN` by domain enum and OpenAPI schemas; no drag/drop or target-index action exists in inspected backend contract/source. |
| relationships | MATCHED | Sections own item membership; same catalog item can appear in two sections as two distinct sales-item identities. Owner source creates a fresh `sales_item_ref` per add and readback exposes both `salesItemRef` and `catalogItemRef`. |
| placement | MATCHED_N_A_WITH_REASON | IA/UI design specifies placement, but this stage is backend-only acceptance/source reconciliation. No browser DOM/layout evidence was run or claimed; therefore UI placement is N/A for this proof. |
| user-visible copy | MATCHED_N_A_WITH_REASON | Backend typed problem codes/messages `SECTION_NOT_EMPTY` and `MOVE_NOT_ALLOWED` are verified. Row-menu labels and rendered UI copy are IA/UI obligations outside this backend-only stage; no browser L2 claim is made. |
| limits | MATCHED | Fixed page size 20 is enforced in edge/domain; candidates and draft items prove 20+1 via real continuation cursors. Owner item pagination uses query-bound opaque cursor, display-order + UUID tie-breaker frontier and `LIMIT pageSize+1`; inspected production backend source has no OFFSET and no total-count closure. |
| state/control | MATCHED | Commands use expected version/CAS/transactional owner path; rejected non-empty delete and rejected first-item UP are followed by authoritative rereads proving no mutation; successful moves are read back from owner. Item versions are asserted unchanged across ordering moves. |
| failure/recovery | MATCHED | `SECTION_NOT_EMPTY` and `MOVE_NOT_ALLOWED` return typed 409 outcomes; latest run separates CONTRACT PASS, BUSINESS PASS, archive/measurement evidence and cleanup PASS. Preserved first failure remains separate and shows the test expectation mismatch was retained rather than overwritten. |
| accessibility/focus | MATCHED_N_A_WITH_REASON | IA/UI design covers row-menu accessibility/focus, but backend-only acceptance cannot prove focus, keyboard behavior, or browser accessibility. This review explicitly does not masquerade as browser L2. |
| data source/invalidation | MATCHED | Section and item facts are owner readbacks after each mutation/reject. Cursor identity includes operation/scope/store/channel/menu/version/section/mode/filter/pageSize; invalid cursor belongs to the owner cursor decoder. Acceptance helper drains only for oracle completeness after explicit cursor reads and is not a production auto-drain/client slice. |

## OPEN findings

No OPEN findings remain in this scoped stage recheck.

## Stop condition

Stopped after current source, contract/generated boundary, previous artifact disposition, latest managed run, preserved first-failure run, archive SHA-256, and the 11 required dimensions all supported `OPEN_COUNT=0` for this stage. This permits only this focused stage to proceed to the next SM-05 failure family. It does not close all SM-05, authorize SM-06, browser L2, DEV, reset, seed, UAT, deployment, or the formal whole-batch implementation review.
