# SM-05 business-channel.sales-menu-eligible-cursor 阶段对账

REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION  
REVIEW_TARGET=IMPLEMENTATION  
SCOPE=business-channel.sales-menu-eligible-cursor  
BLIND_REVIEW=true  
FINAL_STAGE_VERDICT=OPEN  
OPEN_COUNT=1  
first_failure_disposition=NO_UNEXPECTED_FIRST_FAILURE; managed manifest `firstFailure=null`; HTTP 422/403 are expected negative assertions for cursor identity and scoped-store denial.  
STAGE_ALLOWED=false  
SM-05_ALLOWED=false  
SM-06_ALLOWED=false

## 输入清单

本轮只读重开并读取了以下输入；未信任作者 summary 或既有 verdict：

- `AGENTS.md` — 98 lines, sha256 `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6`
- `PLATFORM-BLUEPRINT.md` — 77 lines, sha256 `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7`
- `scripts/README.md` — 226 lines, sha256 `2b950eaf6e508c67406d7a012610a8763b743553c1438e7fb6f300f4a4462a6a`
- `doc/platform/README.md`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` — 535 lines, sha256 `c679d22647247ff1c2279cce5a9ec234b3b21dd7fda2cb155463567dc3ad462e`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md` — 359 lines, sha256 `886799bd95580dc8e4524e826a800cf2736ee2662699c17e83a935e69b313906`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md` — 216 lines, sha256 `edaf732b970da39e49d118aeb85a68e0c84c81074c30a0742db5eb8537df2fb3`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` — 995 lines, sha256 `ee8b2d0d083908126781b86718a29791dbeabf64e87c952bf94f7b0cf96f8cd7`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` — 565 lines, sha256 `2aeaf39fc8fe4f36c8fcae745514fa4ba2cedf00d054b5424d5007af589989b1`
- `project-memory/index.md` and all six kernels listed there.
- `scripts/context/recall-memory` routed project-memory originals:
  - `project-memory/decisions/deterministic-context-only.md`
  - `project-memory/operations/backend-acceptance.md`
  - `project-memory/operations/test-closed-loop.md`
  - `project-memory/practices/collection-boundary-modes.md`
  - `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`
  - `project-memory/practices/business-channel-list-scope-and-validity-display.md`
  - `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
  - `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
- Current owner/edge/contract/generated sources:
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`
  - `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java`
  - `contracts/openapi/paths/operations-admin/business-channel.paths.json`
  - `contracts/openapi-source/business-channel.schemas.json`
  - `contracts/openapi/components/business-channel/business-channel.schemas.json`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/BusinessChannelPage.java`
  - `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`
  - `contracts/registry/generated/operation-handler-bindings/business-channel.json`
- Managed run archive:
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/run-manifest.json`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/evidence-artifacts.tsv`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/backend-acceptance-result.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/http-request-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/db-operation-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/statement-dictionary.json.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788306791709-44961/gradle.log`

Route note: `scripts/context/recall-memory` has no accepted `owner=business-channel` route in the current catalog (`PROJECT_MEMORY=FAIL REASON=unknown or non-specific route: owners:business-channel`). I therefore used the valid backend/platform review routes and reopened the concrete memory originals they returned.

## Acceptance target reconstructed from originals

- Requirements fix the current channel scope to `access_kind=INTERNAL` and `order_kind ∈ (DINE_IN, TAKEAWAY)`; the menu-to-channel relation is the only menu entry connection, and project-level entries must be rejected rather than silently ignored (`requirements.md:96`, `:165-166`, `:174-183`, `:444`).
- IA/UI require fixed cursor collections: page size 20, no total/jump/page-size switch, no auto-drain to `nextCursor=null`, 21st item reachable by explicit next page, and identity changes reset/reject old cursor (`IA.md:90-95`; `UI interaction.md:147-168`).
- Implementation design says `getOperationsStoreBusinessChannels` is the modified owner read for `usage=SALES_MENU`, returns 20/page cursor collection, filters STORE + INTERNAL + DINE_IN/TAKEAWAY, rejects cross-query/cross-store cursor, and retires the LIMIT101/null fake bound (`implementation-design.md:193`, `:381`, `:395`, `:491-492`, `:766-783`, `:800`, `:920-921`).
- Implementation plan says BusinessChannel owner must add one 21-channel sales-menu eligible cursor owner scenario, with owner semantics staying in the owner file; SM-06 is not allowed until focused/all SM-05 evidence and fresh SM-05 reconciliation close with OPEN=0 (`implementation-plan.md:83-108`, `:255`, `:330-369`, `:537`).
- Project memory requires true cursor boundary proof, not ignored cursor/fake null/LIMIT 100/101; fixture must exceed a page and assert second page, terminal, no dup/miss, and cross-scope invisibility. Backend acceptance must be real HTTP + hand-written business oracle with contract/business/log/cleanup separated.

## Source and dynamic evidence

- Owner implementation is a real keyset cursor, not LIMIT101/fake null:
  - `BusinessChannelOwnerService.listSalesMenuEligibleChannels` builds cursor identity from `sales-menu-eligible-channel-page`, workspace, group, store, page size, sort key and sort direction; decodes cursor against that identity; SQL filters `c.target_node_type='STORE'`, `c.target_node_ref=?`, `target_store.id IS NOT NULL`, `t.access_kind='INTERNAL'`, `t.operator_kind='STORE'`, `t.order_kind IN ('DINE_IN','TAKEAWAY')`; applies cursor predicate; queries `LIMIT size + 1`; emits `nextCursor` only when there is a following row (`BusinessChannelOwnerService.java:265-332`).
  - Statement archive contains first-page statement `2EwhXOBp-0nF1n22` with the same STORE/INTERNAL/STORE/DINE_IN-or-TAKEAWAY predicate and `LIMIT ?`, and second-page statement `ImcFh0l_0eYL6lid` adding `AND c.channel_ref > ?`.
- Edge/contract/generated align to the owner collection:
  - `OperationsBusinessChannelController.storeChannels` exposes `GET /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels`, requires `usage=SALES_MENU`, requires selected store scope before owner call, normalizes sales-menu page size, and passes cursor/pageSize/sort to the owner (`OperationsBusinessChannelController.java:149-175`).
  - OpenAPI requires `usage=SALES_MENU`, optional `cursor`, fixed `pageSize` min=max 20, response `BusinessChannelPage` (`business-channel.paths.json:1147-1250`).
  - `BusinessChannelPage` generated shape is `items`, `cursor`, `nextCursor`; no `total` (`business-channel.schemas.json:621-647`; `BusinessChannelPage.java:4-8`; `operations-edge.ts:1284-1288`, `:3637-3652`).
- Current BusinessChannel acceptance scenario proves several cursor mechanics dynamically:
  - The helper default creates STORE-owned INTERNAL TAKEAWAY channels (`BusinessChannelAcceptanceScenarios.java:900-950`).
  - `business-channel.sales-menu-eligible-cursor` creates 21 channels, requests first page with `usage=SALES_MENU&pageSize=20`, asserts first page size 20 and nonblank `nextCursor`, requests the same query with cursor, asserts second page size 1 and terminal `nextCursor == null`, asserts 21 distinct refs and all created refs retained, changes `sortKey` with old cursor and expects 422 `VALIDATION_ERROR`, then uses a sibling store path with old cursor and expects 403 ACCESS/SCOPE (`BusinessChannelAcceptanceScenarios.java:953-1009`).
- Complementary SalesMenu scope scenario is correctly placed outside the BusinessChannel cursor owner scenario:
  - It excludes project-owned and external channels from the sales-menu channel list, then creates an explicit DINE_IN eligible channel through the BusinessChannel helper and asserts both TAKEAWAY and DINE_IN refs are eligible (`SalesMenuAcceptanceScenarios.java:128-169`).
  - It also exercises sibling-store menu invisibility for the sales-menu owner scope (`SalesMenuAcceptanceScenarios.java:183-197`).
- Managed run is reproducible and archived:
  - Manifest `runId=r5-tc-1788306791709-44961`, task `:apps:backend:catering-business-server:test`, verificationMode `ACCEPTANCE`, backendAcceptance operation `business-channel.sales-menu-eligible-cursor`, `testExecution.status=PASS`, `business=PASS`, `status=PASS`, `firstFailure=null`.
  - Backend acceptance result archive has discovery `discovered=99`, `selected=1`, and operation result `status=PASS`, `businessAssertion=HAND_WRITTEN_BUSINESS_ORACLE`, `businessMode=REAL`, `contract=PASS`, `business=PASS`, `module=BUSINESS_CHANNEL`, `dbOperations=9`.
  - HTTP archive has 39 total request events and 4 `getOperationsStoreBusinessChannels` events for this operation: 200 first page, 200 second page, expected 422 changed-sort cursor, expected 403 sibling-store cursor. It also contains 21 `createOperationsBusinessChannel` fixture requests.
  - DB archive has 584 total DB events and 42 `getOperationsStoreBusinessChannels` DB events across those 4 requests; first and second page use the archived statements above. `unclassifiedSqlOperations=0`.
  - Evidence archive PASS includes raw/archive SHA-256 for `http-request-events.jsonl`, `backend-acceptance-result.jsonl`, `db-operation-events.jsonl`, and `statement-dictionary.json`.
  - Cleanup PASS: `remoteProcess=PASS`, `remoteWorkspace=PASS`, `testcontainersContainers=PASS`, `testcontainersVolumes=PASS`; resource preflight containers/volumes were empty. Gradle log ends `BUILD SUCCESSFUL in 50s`.

The manifest `measurementEvidence.failed=2` is not a scenario failure: the selected operation result is PASS, and the two failed HTTP outcomes correspond to the expected 422 and 403 negative requests recorded by the archive.

## 11 维逐项对账

| Dimension | Result | Evidence / falsification result |
| --- | --- | --- |
| behavior | OPEN | Cursor mechanics PASS: 21 rows, 20+1, terminal null, no dup/miss, changed sort 422, sibling store 403 are asserted in `BusinessChannelAcceptanceScenarios.java:963-1009` and archived in managed run. But the selected BusinessChannel scenario only creates default TAKEAWAY fixtures (`:903-912`, `:963-964`) and does not itself dynamically prove DINE_IN eligibility or explicit ineligible exclusion in the same owner scenario. |
| surface/form | MATCHED | Contract/edge/generated expose only `GET .../stores/{storeRef}/business-channels?usage=SALES_MENU&cursor&pageSize&sort`, `BusinessChannelPage(items,cursor,nextCursor)`, pageSize fixed 20, no total (`business-channel.paths.json:1147-1250`; `business-channel.schemas.json:621-647`; `BusinessChannelPage.java:4-8`; `operations-edge.ts:1284-1288`). |
| actions | MATCHED | Current scope is read action only. Edge requires `usage=SALES_MENU`; managed HTTP archive records two 200 reads and two expected negative reads for the same operation. Fixture mutations are setup, not the scoped read behavior. |
| relationships | OPEN | Static owner SQL correctly relates channel instance + template + real store target and excludes PROJECT/EXTERNAL/non-DINE/TAKE (`BusinessChannelOwnerService.java:303-307`). SalesMenu scenario separately proves project/external exclusion and DINE_IN+TAKEAWAY (`SalesMenuAcceptanceScenarios.java:128-169`). The BusinessChannel owner acceptance scenario, however, does not include mixed DINE_IN/TAKEAWAY plus ineligible counterexamples, so the owner scenario’s dynamic oracle is narrower than the design row “21 eligible + ineligible channels”. |
| placement | MATCHED | Cursor owner semantics live in `BusinessChannelAcceptanceScenarios.java`; SalesMenu business scope behavior lives in `SalesMenuAcceptanceScenarios.java`. That division matches the implementation plan’s “owner 语义不得集中塞入 SalesMenu 文件” requirement. |
| user-visible copy | NOT_APPLICABLE_WITH_REASON | This backend owner read scenario has no approved end-user label/copy surface. It asserts typed problem codes for cursor identity/scope. The SalesMenu-specific ineligible message from implementation design is outside this operation and is not claimed as proven by this run. |
| limits | MATCHED | Requirements/IA/UI fixed page size 20/no total/no auto-drain; owner uses `size + 1`, not 101, and only emits terminal null when exhausted (`BusinessChannelOwnerService.java:277-332`; contract min/max 20 at `business-channel.paths.json:1217-1224`; component has no total at `business-channel.schemas.json:621-647`). |
| state/control | MATCHED | Cursor identity binds workspace/group/store/pageSize/sort (`BusinessChannelOwnerService.java:293-301`); changed sort with old cursor returns 422 (`BusinessChannelAcceptanceScenarios.java:991-997`); cross-store cursor is denied by selected store scope before owner read (`OperationsBusinessChannelController.java:162-164`; scenario `:998-1009`). |
| failure/recovery | MATCHED | Managed manifest has `firstFailure=null`, operation result PASS, archive PASS, and cleanup PASS. Expected negative 422/403 are represented as HTTP failed outcomes but business assertions pass. |
| accessibility/focus | NOT_APPLICABLE_WITH_REASON | Current scope is backend owner acceptance, not browser/UI. IA/UI focus and visible cursor controls remain obligations for UI/browser proof; they are not falsifiable from this selected backend run. |
| data source/invalidation | MATCHED | Data source is owner DB read through BusinessChannel owner service; no frontend client slice or auto-drain is involved in this backend run. Query identity and cursor invalidation are owner-enforced; changed sort and sibling store are rejected. |

## Key falsification checklist

- Real STORE + INTERNAL + TAKEAWAY eligible channel: PASS. Fixture helper creates STORE-owned INTERNAL TAKEAWAY channels and scenario creates 21 of them (`BusinessChannelAcceptanceScenarios.java:903-950`, `:963-964`).
- Real STORE + INTERNAL + DINE_IN eligible channel in this selected BusinessChannel owner scenario: OPEN. Helper supports DINE_IN (`:915-930`) and SalesMenu scenario uses it (`SalesMenuAcceptanceScenarios.java:151-169`), but `business-channel.sales-menu-eligible-cursor` does not create or assert a DINE_IN row.
- 21 items first page 20 + second 1: PASS (`BusinessChannelAcceptanceScenarios.java:967-979`; managed operation result PASS).
- Cursor terminal semantics: PASS; second `nextCursor` asserted null only after second page (`BusinessChannelAcceptanceScenarios.java:978-979`).
- Same query cursor: PASS; second request reuses `usage=SALES_MENU&pageSize=20` and adds only encoded cursor (`BusinessChannelAcceptanceScenarios.java:972-977`).
- Changed sort/query cursor 422: PASS for changed `sortKey=CHANNEL_CODE`; there is no free-text `query` parameter in this operation’s contract (`BusinessChannelAcceptanceScenarios.java:991-997`; `business-channel.paths.json:1196-1241`).
- Cross-store cursor 403: PASS at edge selected-store scope (`OperationsBusinessChannelController.java:162-164`; `BusinessChannelAcceptanceScenarios.java:998-1009`).
- No LIMIT101/fake null: PASS. Owner source and archived SQL use `LIMIT size+1` / `LIMIT ?`, second page cursor predicate, no `total`, and dynamic 20+1 terminal assertion.
- HTTP/DB/cleanup/first-failure/archive reproducible: PASS. Manifest/result/http/db/statement archives are present with SHA-256, operation result PASS, `firstFailure=null`, cleanup PASS.
- BusinessChannel owner scenario vs SalesMenu scope scenario boundary no duplicate/omission: PARTIAL. Placement is correct and avoids duplicating full SalesMenu behavior in the BusinessChannel file, but the BusinessChannel owner scenario omits dynamic DINE_IN and explicit ineligible counterexamples required to prove the owner read predicate’s complete eligibility boundary.

## OPEN findings

### OPEN-1 — BusinessChannel owner acceptance oracle does not dynamically prove the full STORE+INTERNAL+DINE_IN/TAKEAWAY eligibility boundary

- Owning source:
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:903-912`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:953-1009`
- Evidence:
  - The helper overload can create arbitrary `orderKind`, but the no-orderKind helper defaults to `"TAKEAWAY"` (`:903-912`).
  - `salesMenuEligibleCursor` calls the default helper for all 21 expected rows (`:963-964`), so every dynamically asserted eligible row in this owner scenario is TAKEAWAY.
  - The scenario asserts all 21 created refs are present, changed sort returns 422, and sibling store returns 403, but it does not create/assert a DINE_IN eligible row and does not create project-owned, EXTERNAL, or unsupported-order rows as explicit ineligible counterexamples within this owner read oracle.
  - Static owner source and archived SQL do include `t.order_kind IN ('DINE_IN','TAKEAWAY')`; SalesMenu scope scenario separately asserts DINE_IN + TAKEAWAY and project/external exclusion. That lowers implementation risk but does not close this selected owner scenario’s dynamic proof gap.
- Falsifiable failure condition:
  - If `listSalesMenuEligibleChannels` or the edge mapping accidentally returned only TAKEAWAY eligible rows, the current `business-channel.sales-menu-eligible-cursor` scenario would still pass because it never creates a DINE_IN expected row.
  - If project-owned/external/unsupported-order channels leaked only under this owner read, the current scenario may still pass because its expected set contains only 21 TAKEAWAY rows and it does not create same-query ineligible counterexamples to assert absent.
- Minimum fix:
  - In `business-channel.sales-menu-eligible-cursor`, build the 21 eligible rows as a mixed fixture that includes at least one STORE + INTERNAL + DINE_IN row and at least one STORE + INTERNAL + TAKEAWAY row while preserving the 20+1 cursor denominator.
  - Add explicit same-store ineligible counterexamples in the same scenario fixture, reusing existing owner helpers where possible: project-owned channel, EXTERNAL channel, and an unsupported order kind if the current BusinessChannel template policy permits creating one for a red fixture. Assert those refs are absent from the combined first+second page result.
  - Keep the existing same-query second page, changed-sort 422, and sibling-store 403 assertions.
- Why a smaller alternative is insufficient:
  - A unit SQL assertion alone proves the predicate text, not the real HTTP/fixture/business oracle boundary required by backend acceptance memory.
  - Relying on `sales-menu.store-scope-and-channel-eligibility` proves the SalesMenu consumer scope, but it does not make the BusinessChannel owner cursor scenario itself cover the full eligibility denominator required by the SM-05 BusinessChannel row.
  - Adding only a DINE_IN positive without ineligible counterexamples still fails to prove the “only STORE+INTERNAL+DINE_IN/TAKEAWAY” exclusion boundary.

## Gate decision

FINAL_STAGE_VERDICT=OPEN because OPEN-1 leaves the selected BusinessChannel owner acceptance scenario short of the full dynamic eligibility-boundary proof required by the sales-menu requirements/IA/implementation design. Existing source and managed run prove cursor mechanics and the current static owner predicate, but the stage cannot close while the owner acceptance oracle can pass without DINE_IN or explicit ineligible leakage coverage.

STAGE_ALLOWED=false  
SM-05_ALLOWED=false  
SM-06_ALLOWED=false
