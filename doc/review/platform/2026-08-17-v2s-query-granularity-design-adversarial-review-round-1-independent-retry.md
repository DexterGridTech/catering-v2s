# Query granularity and duplicate-read remediation — independent adversarial design review, round 1

`REVIEW_CYCLE_ID=QUERY_GRANULARITY_IMPLEMENTATION_DESIGN_20260817`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## Authority and review boundary

- Reviewer authority: read-only examination plus this review artifact. No production source, contract, generated output, plan, runtime, DEV, reset, seed, HTTP, browser, L2, or formatting-bytecode execution was performed.
- This is a fresh independent review. No child agent was created or consulted.
- The report uses `M` (must fix), `S` (should fix), and `N` (note / verification obligation). A static count is a source snapshot fact only; it is never a runtime HTTP, JDBC, latency, throughput, or browser claim.

## Phase 1 — blind review declaration and inputs

**Blind-review declaration.** Before this section was written, I did not read the specified author plan, its self-review, any document named `query-granularity` or `duplicate-read`, or any prior reviewer artifact. I derived the following problem family and acceptance constraints only from the frozen inputs and current production/test source.

Inputs opened in phase 1:

- `AGENTS.md`; `PLATFORM-BLUEPRINT.md`; `doc/platform/agent-operating-model.md`; `doc/platform/README.md`; `doc/platform/roadmap-program-registry.json`; and the current roadmap `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` (program `V2S_W0_W4_EXECUTION`, `CURRENT_*` read as scheduling context only).
- `scripts/README.md`; `project-memory/index.md`; all six kernel files; `project-memory/decisions/deterministic-context-only.md`; `project-memory/decisions/http-crud-efficiency-design-redlines.md`; `project-memory/operations/business-corpus-adoption-and-read-policy.md`; and `project-memory/decisions/confirmed-business-language-corpus.md` §G-11/G-12.
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` and `doc/decisions/2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md`.
- Current production/test source for the named coordinators, owners, organization/workspace/store edge, generators, and catalog/inventory consumers and tests. The successful six-dimensional recall route was `review/platform/backend/platform/governance/task-start`; its matched memory inputs above were reopened directly. An initial non-specific `consumer-face=all` attempt failed closed and was not used.

### Independent problem-family derivation

1. The real target is removal of *unrelated or duplicate* data work, not a statement-count target. Cross-owner composition is allowed only as a task read; catalog cannot gain direct inventory, production, asset, organization, or workspace-schema access. Writes remain public typed owner commands in one `REQUIRED` transaction.
2. Candidate redundant work is concentrated in broad RTK `LIST` invalidation followed by consumer-local `refetch()`, re-fetching a small owner projection after a primary read, and wildcard projection in the organization overview CTE. These are candidates, not proof that every occurrence is redundant.
3. Correctness reads that must survive include: owner-side authorization/state/current-fact rechecks; typed idempotency receipt lookup/replay; CAS/version checks; the execute-time re-run of catalog and participating-owner copy preflight; current asset-reference/lifecycle judgment; terminal typed owner readback; and fully paged inventory references/ledger/history where the user requested those records.
4. The save coordinator's no-inventory path is already guarded. Batch redesign must not silently change existing per-item partial-success, per-item receipt/replay, typed failure, ordering, or HTTP semantics. Whether a batch is product-atomic is a Dexter decision unless an existing contract already decides it.
5. G-11/G-12 make CatalogItem, inventory target/BOM, immutable ledger, and sellability distinct facts. A tag-to-BOM relation is not authorized to become a stored cross-owner relation merely because a detail screen joins their data.

### Required static baseline reproduction

All commands below are source-only and were judged by their exit code. Their denominator is the files/matches described in the command, not an HTTP-operation denominator.

| Check | Command / denominator | Result |
| --- | --- | --- |
| Generated RTK operation shapes | `rg --files apps/frontend | rg '/generated/.*\\.rtk\\.ts$'`, then per file `rg -c 'build\\.query<'` and `rg -c 'build\\.mutation<'` | `operations-edge.rtk.ts` 43 query / 49 mutation; `public-edge.rtk.ts` 3 / 9; `catalog-inventory-edge.rtk.ts` 16 / 27; `platform-edge.rtk.ts` 21 / 29. |
| Production refetches | `rg -n '\\.refetch\\(\\)' apps/frontend/*/src --glob '!**/tests/**' --glob '!**/*.test.*'`; denominator is matching production source occurrences | 55 occurrences in 13 files. |
| Organization CTE wildcard projections | `rg -n -e 'SELECT item\\.\\*' -e 'SELECT \\* FROM filtered' -e 'SELECT target\\.\\*' -e 'SELECT \\* FROM target' .../OrganizationOverviewTaskReadService.java`; denominator is wildcard `SELECT` expressions in its CTE strings | 5: line 236 `SELECT item.*`; 251 `SELECT * FROM filtered`; 380 `SELECT target.*`; 437 `SELECT * FROM target`; 492 `SELECT target.*`. |
| Generator tag shape | `rg -n -C 5 'tagTypes|providesTags|invalidatesTags|tags' scripts/generate/edge-codegen.mjs scripts/generate/catalog-inventory-p3-frontend.mjs` | Both generators emit GET `providesTags` / mutation `invalidatesTags` as `[{type: "wire", id: request.operationId}, {type: "wire", id: "LIST"}]`. |
| Empty inventory-save guard | `rg -n -C 10 'coordinateSaveInventory|inventoryConfiguration|inventoryBom' .../CatalogInventoryCoordinator.java` | Present: `if (!configuration.path("nodes").isArray() && !draft.path("inventoryBom").isArray()) return;` (lines 483–492). |

### PHASE_1_BLIND_VERDICT

**NO-GO pending phase-2 comparison — 0 M / 0 S / 5 N.** This is not a judgment of an unseen author design and is not an allegation that the current source is incorrect. The five `N` items are independent conditions that any acceptable remediation design must explicitly preserve:

- **N-1 — static baseline classification.** The reproduced counts above may identify a source change surface only. Consequence of omission: the design could wrongly claim fewer HTTP calls or better runtime performance. Minimal alternative: label each number as a static source denominator and name the separate dynamic evidence class, if any. Evidence boundary: no runtime was executed.
- **N-2 — execute-time copy freshness.** `CatalogInventoryCoordinator.executeLocalCopy` / `executeBrandCopy` currently reconstruct current preflight, recomputes a combined digest, and rejects `STALE_COPY_PREFLIGHT`. Consequence of omission: a preflight response can be replayed after source/target/owner facts changed. Minimal alternative: retain the current execute-time owner preflight chain and digest comparison; consolidate only duplicate parsing/composition around it. Evidence boundary: source inspection, including copy-authority tests; no execution.
- **N-3 — paged fact completeness.** Inventory target history, consumption references and ledger are distinct owner reads with page requests. Consequence of omission: replacing them with a summary can hide records needed for a user task or owner-scoped audit trail. Minimal alternative: keep the typed paged endpoint/read model and optimize only a proven duplicate projection. Evidence boundary: source and page-query/CAS tests.
- **N-4 — command correctness reads.** Catalog/inventory/production owner commands contain receipt, current-state, expected-version, scope and asset/reference checks. Consequence of omission: a superficial read reduction breaks replay, CAS, authorization, asset lifecycle, or final readback. Minimal alternative: classify those reads as non-removable before considering query consolidation. Evidence boundary: owner source and typed mutation tests.
- **N-5 — no unapproved relation/atomicity change.** G-11/G-12 do not authorize materializing tag↔BOM ownership or changing batch behavior. Consequence of omission: a performance refactor becomes a data-model or product change. Minimal alternative: preserve owner-native references and existing per-item semantics; escalate a proposed relation/atomicity/HTTP change to Dexter. Evidence boundary: business corpus plus current contracts/source only.

Phase 1 is now complete and written. The following phase may read only the explicitly authorized author design for adversarial comparison.

## Phase 2 — adversarial comparison

**Comparison declaration.** Only after the phase-1 section above was written, I opened `doc/plans/platform/2026-08-17-v2s-query-granularity-implementation-design-codex.md`. I did not open the prohibited author self-review, an earlier reviewer artifact, or any other author material. I then tested the plan against the same production/test source with a falsification stance.

### What remains sound

- The plan correctly classifies the four generated RTK counts and the 55 `.refetch()` occurrences as static source facts, not runtime HTTP conclusions (plan §0.4 and §1.2).
- QG-01 correctly records the already-present `coordinateSaveInventory` guard as a zero-code disposition; it should not be “fixed” again.
- QG-03 preserves the existing individual submission/partial-success/CAS model, explicitly rejects a new atomic HTTP batch, and therefore does not make an unauthorized product decision.
- QG-09 correctly preserves execute-time owner preflight, combined-digest recomputation and `STALE_COPY_PREFLIGHT`; QG-12 correctly stops at evidence rather than materializing a tag↔BOM relation; QG-07 correctly avoids a new regular tag-list surface for the small current store.
- QG-11 preserves independently cursor-paged references and ledger zones, and makes OpenAPI → generated Java/TypeScript → edge → consumer → acceptance design a prerequisite to a response-shape change. This is the right evidence boundary, not an asserted dynamic result.

### Findings

#### M-1 — QG-15 uses a false closed wildcard denominator

- **Location:** author plan §1.2 line 61, QG-15 lines 269–279, and delivery checklist line 314.
- **Fact:** the plan declares exactly three CTE wildcard projections. The reproduced source-only query finds five: `SELECT item.*` and `SELECT * FROM filtered` in `platformOverviewTaskPage` (`OrganizationOverviewTaskReadService.java:236,251`), `SELECT target.*` in `platformHierarchyBaseDetail` (`:380`), `SELECT * FROM target` in `platformBusinessEntityBaseDetail` (`:437`), and `SELECT target.*` in `platformStoreBaseDetail` (`:492`). The two omitted projections are still CTE-output wildcards; neither is a direct base-table wildcard, but that does not remove them from the stated denominator.
- **Consequence:** QG-15 can pass its proposed “only these three” static check while two same-family projections remain. The plan would then report a false complete cleanup and fails its own requirement that the current static number be independently reproducible.
- **Minimal alternative:** either (a) expand QG-15’s closed denominator, recall inputs, explicit-column mapping and focused tests to all five projections, or (b) explicitly exclude the hierarchy/store detail projections with a reason, rename the CP/check to its three-location subset, and stop claiming the global three-projection baseline. Do not infer any runtime performance conclusion from either choice.
- **Evidence boundary:** exact source text and static `rg` reproduction only; no database plan, HTTP, or browser result was run.

#### M-2 — QG-08 does not define a safe owner-local display-read boundary

- **Location:** author plan QG-08 lines 185–195.
- **Fact:** QG-08 requires the Inventory page to obtain only `itemRef`, name, SKU name, material role and category display through `CatalogOwnerApi.readItems`, but the current generic JSON API is also used for different consumer projections. In the coordinator alone, `readItems` serves page enrichment (`CatalogInventoryCoordinator.java:1404–1435`), inventory-target detail including shape/SKU facts (`:1471–1490`), and consumption-reference name/status enrichment (`:1512–1533`), in addition to the normal Catalog item page. The plan names no distinct typed display readback, request mode/selector, exact caller migration, or “generic response remains unchanged” rule.
- **Consequence:** an implementer can reduce the common `readItems` payload to meet QG-08 and silently break inventory detail, reference enrichment, or Catalog consumers; keeping it broad, conversely, fails the declared QG-08 objective. This is an owner-API/consumer compatibility ambiguity, not permission to read Catalog schema from Inventory.
- **Minimal alternative:** specify one owner-native, non-HTTP display projection boundary (for example a typed `readInventoryDisplayFacts` API with an ordered ref input and the exact five returned fields), its sole coordinator caller, missing-ref/order behavior, and tests. Alternatively define an explicit closed request mode on the existing API and prove all non-display callers retain their current projection. In both cases, Inventory must continue to page/filter its own facts first and Catalog must remain the only reader of Catalog facts.
- **Evidence boundary:** static public-API and coordinator call-site inspection; no generated/HTTP contract change is authorized or claimed by this review.

#### M-3 — QG-13 defers its essential tag semantics to implementation

- **Location:** author plan QG-13 lines 245–255 and implementation order line 286.
- **Fact:** both generators currently emit the same `wire/{operationId,LIST}` pair, while the two app APIs admit only the `wire` tag type. QG-13 states the desired principle but supplies no closed operation-group → read-model-fact → tag → mutating-operation invalidation table, no declared source of that metadata, and no explicit disposition for operations that must retain their current tag. Line 286 explicitly makes completion of that input table a future B4 activity before the actual refresh disposition.
- **Consequence:** the core change cannot be independently implemented or source-asserted from this design. A later implementer can make one tag per endpoint (forbidden), omit a dependent query, invalidate a read-only/non-mutating operation, or change generator/API tag shape without a reviewable fact boundary. QG-14’s decision whether a particular explicit refresh duplicates invalidation is therefore not yet decidable. The “no new HTTP surface” classification is only true if the missing tag metadata changes generated cache metadata alone; the design does not yet make that boundary auditable.
- **Minimal alternative:** before implementation authorization, add the bounded metadata table (the operation groups affected by this remediation, their stable fact/read-model keys, GET providers, mutating invalidators, intentionally untagged operations, and no-new-route assertion), identify the generator input and the exact generated/API tag-type impact, and add one red mutation per mapping class. Leave runtime request-set conclusions for separately authorized observation.
- **Evidence boundary:** static generator and app-API source only. No RTK subscription, HTTP, browser, or performance claim is made.

#### N-6 — the “not more than 20 tags” observation needs provenance but is not a reason to overdesign now

- **Location:** author plan §1.2 line 62 and §1.3 line 70.
- **Fact:** neither the frozen business corpus G-11/G-12 nor the inspected source establishes a durable product cardinality constraint; the plan describes it as an expectation and already excludes a new regular tag-list interface.
- **Consequence:** if the observation later drifts, it must trigger a fresh task/read-budget review, not silently legitimize candidate-page semantics or a data-model change.
- **Minimal alternative:** record the source/date/owner of the operational observation or label it explicitly as a non-binding current observation. Retain the existing exclusion: no new HTTP surface, polling, tag↔BOM materialization, or premature batching merely for this note.
- **Evidence boundary:** absence of an authoritative cardinality rule in the permitted frozen inputs; no live-data measurement was performed.

### Phase-2 verdict

**NO-GO — 3 M / 0 S / 1 N.** The design is directionally careful about freshness, owner boundaries, CAS, idempotency, audit/readback, pagination, dynamic-evidence limits, and the BOM data-model boundary. It is not yet implementation-ready because M-1 leaves its own static denominator false, M-2 leaves the safe Catalog display-read interface unresolved, and M-3 leaves the central RTK fact/tag mapping to a future implementation decision. The minimal alternatives above can close those gaps without changing owner, transaction, CAS, idempotency, authorization, audit, readback, HTTP surface, or the G-11/G-12 data model.

No production code, contract, generated artifact, plan, environment, or test was changed by this review. The only created artifact is this authorized report.
