# Sales Menu measurement boundary independent review

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=2026-09-04-sales-menu-measurement-boundary-microstep
REVIEW_ROUND=1/2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-A code extraction
VERDICT=GO
M/S/N=0/0/0

## Blind review declaration

I reviewed from current repository bytes and read-only generated/test evidence. I did not modify production or test implementation files, did not start DEV/Testcontainers/L2/UAT, did not run seed/reset, and did not request repository-control action. The only write made by this review is this review artifact.

Scope is the measurement boundary micro-step only:

1. `BackendAcceptanceTest.ScenarioContext` default measurement behavior and per-request `postCoverageOnly`.
2. `SalesMenuAcceptanceScenarios.copyCurrentDraftBoundary` and `calibrationCopyBoundedDraft`.
3. `BackendPerformanceOperationCoverage` consumption of the bounded recipe and its relation to the generated 268-operation denominator.

UI behavior is out of scope for this review.

## Input checklist

Read inputs:

- `AGENTS.md` sha256 `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6`
- `.agents/skills/cs-review/SKILL.md` sha256 `371ba910004f55c417c832a060f6b64edef2eccc845ce4f8882d3ecda37cb95c`
- `.agents/skills/cs-failure-recall/SKILL.md` sha256 `4f856bdd25ad767618b0c15b150fc6c2560a200f35daea5542c84bc9b95620d3`
- `.agents/skills/cs-memory-recall/SKILL.md` sha256 `d9e4b8ca8b7ee5bdbe41037338fe3815ae024ce61c42bcb62e6684d8e4648b0f`
- `doc/platform/review-standard.md` sha256 `631e2900d9ed96baf130ad67bc84fbff9eddca673ee706122ad2b01a92506dba`
- `project-memory/operations/verification-governance.md` sha256 `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005`
- `project-memory/operations/test-closed-loop.md` sha256 `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7`
- `project-memory/operations/execution-economics-and-failure-family-closure.md` sha256 `c2c476266fc3ade536bdafe2277bccae5ea048dd33f6cc34c4f878fbf2e129e2`
- `project-memory/decisions/http-crud-efficiency-design-redlines.md` sha256 `f0a075710211cbd62147d53a4bac6f7f9404755bf9d5b52f206e66c15f8ec34e`
- `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-serial-plan-codex.md` sha256 `7af59b330df646306584ae2383da58b94fc44d2d1338a529630d93b853248680`
- `doc/review/platform/2026-09-02-v2s-sales-menu-execution-diagnosis-claude.md` sha256 `1e67a691fdc37901a8102f603c8fa869142e4207363776c45a20c6a6b0f6ab4a`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` sha256 `0a200ba1e0c8487ba4ebbd0818a33a04b1082f7c2b8d08dc691ab23ace8a52fe`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java` sha256 `e82025a387e3dde8315b2964cc85856081073aed4dd6503229e3c7d3834cf37d`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendPerformanceOperationCoverage.java` sha256 `9d33cafe8cb188c11242f141d80985fac1693ec79579591f06361343bff5d1a2`
- `scripts/test/backend-performance-operation-reconciliation.mjs` sha256 `2c994ca0858f20348da909631c7a38d02fc13f5ed5e2a8389079bf61cf482d92`
- `scripts/test/backend-performance-event-verifier.mjs` sha256 `739cf43a64756c42339a9d4bcd1f75d750db390559d4b566560dd08358bf6cc9`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/HttpRequestMetricsInterceptor.java` sha256 `9cc6ac4b9791ca60322a99e41a240d58417b8e63c2db8e6e1562312b96cb549f`
- `contracts/policy/backend-performance-operation-counts.json` sha256 `e04fe15bdd7d5cd274f952f9f9adab431c1c5a33ff0acc4f66e5b064319f7ac6`
- `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` sha256 `bc9d96adf929912c6f75061f2308a5a75b68b18ba31dbf42a015eb6582b80140`
- `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json` sha256 `b64aaf0bd381cfd1d0c7708d45870318b4d43ebb0277b9334d2d8102e48052fb`

Memory route:

- Read all six `project-memory/kernel/*` kernel files from `project-memory/index.md`.
- Ran `scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact evidence --trigger review`; output was too large for direct `jq` parsing in this tool session, so I reopened the directly relevant returned/source-ref paths listed above.
- Ran `scripts/context/recall-failure --query 'performance.coverage-only normal-path measurementScenarioId copy 268 BackendPerformanceOperationCoverage'` and reopened the relevant failure discipline and prior evidence paths.

## Review-standard action 1-A: extracted code facts

No UI-rendered facts were extracted because this is a backend measurement test scope. Backend measurement facts extracted from current code:

1. `BackendAcceptanceTest.ScenarioContext(AcceptanceScenario)` defaults every ordinary business scenario context to `performance.normal-path` at `BackendAcceptanceTest.java:1474-1479`.
2. The two-value measurement guard accepts only `performance.normal-path` and `performance.coverage-only` at `BackendAcceptanceTest.java:1481-1487`.
3. `postCoverageOnly` is a separate helper that passes `"performance.coverage-only"` only to the final `send(... requestMeasurementScenarioId)` argument at `BackendAcceptanceTest.java:1504-1517`.
4. All ordinary `send(...)` overloads flow through the context-level `measurementScenarioId` at `BackendAcceptanceTest.java:1685-1696`.
5. The HTTP header is written from per-request `requestMeasurementScenarioId`, not by mutating `ScenarioContext`, at `BackendAcceptanceTest.java:1698-1724`.
6. `backendPerformanceOperationCoverage()` remains outside `@AcceptanceScenario` and receives separate normal and coverage contexts at `BackendAcceptanceTest.java:633-645`.
7. `copyCurrentDraftBoundary` is still the annotated business scenario for `copyOperationsSalesMenu` at `SalesMenuAcceptanceScenarios.java:369-373`.
8. Inside `copyCurrentDraftBoundary`, only the high-cardinality copy request uses `context.postCoverageOnly(...)` at `SalesMenuAcceptanceScenarios.java:562-567`; surrounding setup/readback requests use the unchanged `context` ordinary methods.
9. `calibrationCopyBoundedDraft` has no `@AcceptanceScenario` annotation, prepares a single plain menu via `preparePlainMenu`, calls `OPERATIONS_SALES_MENU_COPY` with ordinary `context.post(...)`, asserts the command, and asserts independent identity at `SalesMenuAcceptanceScenarios.java:848-865`.
10. `BackendPerformanceOperationCoverage` states that normal recipes prove successful requests for the finite missing subset, while coverage-only recipes only expose deliberately non-normal boundaries at `BackendPerformanceOperationCoverage.java:18-23`.
11. `BackendPerformanceOperationCoverage` states its explicit coverage-only recipes are not the denominator and that generated registry plus successful normal-path completion events are the completeness proof at `BackendPerformanceOperationCoverage.java:75-80`.
12. `BackendPerformanceOperationCoverage.runNormalRecipes` invokes `new SalesMenuAcceptanceScenarios(host).calibrationCopyBoundedDraft(context)` on the normal context at `BackendPerformanceOperationCoverage.java:647-675`.
13. The run-level reconciler skips `performance.coverage-only` for normal samples, rejects unknown measurement IDs, and requires `performance.normal-path` for the normal matrix at `scripts/test/backend-performance-operation-reconciliation.mjs:98-130` and `:300-358`.
14. The run-level budget path requires generated `databaseOperationBudget.measurementScenarioIds` to include the event's measurement ID after normal filtering at `scripts/test/backend-performance-operation-reconciliation.mjs:132-140`.
15. The event verifier closes measurement IDs to `performance.normal-path` and `performance.coverage-only` at `scripts/test/backend-performance-event-verifier.mjs:21-25`.
16. The interceptor uses the same two-value measurement set at `HttpRequestMetricsInterceptor.java:35-36`, records the measurement id only for backend acceptance at `HttpRequestMetricsInterceptor.java:186-190`, and marks invalid measurement ids as failed observations at `HttpRequestMetricsInterceptor.java:236-246`.

## Review-standard action 2: reconciliation

### Requirement 1: ScenarioContext default and per-request coverage-only

GO. Ordinary business scenarios instantiate `new ScenarioContext(definition.annotation())`, which uses the one-argument constructor and therefore defaults to `performance.normal-path` (`BackendAcceptanceTest.java:648-649`, `:1474-1479`). The coverage-only override is per request because the context field is not reassigned; the final header source is a method parameter (`BackendAcceptanceTest.java:1698-1724`).

### Requirement 2: copy business scenario and bounded normal recipe

GO. `copyCurrentDraftBoundary` keeps the same business scenario annotation and context (`SalesMenuAcceptanceScenarios.java:369-373`). Only the actual high-cardinality copy command is marked coverage-only (`:562-567`); contract/business assertions remain in the same method and continue after the request (`:568-846`).

GO. `calibrationCopyBoundedDraft` is ordinary normal-path calibration: it is not annotated, uses `context.post`, and has a minimal single-menu/single-item recipe with command and independent-identity assertions (`SalesMenuAcceptanceScenarios.java:848-865`).

### Requirement 3: generated denominator and no global coverage-only regression

GO for static source boundary. Current generated registries have 268 unique operations (`edge=210`, `catalog=58`) and `contracts/policy/backend-performance-operation-counts.json` declares `operations=268` (`contracts/policy/backend-performance-operation-counts.json:1-13`). A read-only registry script confirmed all 268 `databaseOperationBudget.measurementScenarioIds` are exactly `["performance.normal-path"]`, with zero `performance.coverage-only` in generated budget metadata.

GO for copy budget declaration. `copyOperationsSalesMenu` is present in the generated edge registry with `FIXED max=39` and `measurementScenarioIds=["performance.normal-path"]` at `edge-route-face-registry.json:365-383`.

GO for normal recipe wiring. `BackendPerformanceOperationCoverage.runNormalRecipes` calls the bounded sales-menu copy recipe on the normal context at `BackendPerformanceOperationCoverage.java:647-675`. Because the reconciler requires a successful normal-path event per operation (`backend-performance-operation-reconciliation.mjs:98-130`, `:300-358`), the bounded recipe is the static route by which `copyOperationsSalesMenu` can satisfy the normal sample denominator while the high-cardinality business scenario request remains coverage-only.

## Review-standard action 3: same-root scan

1. `postCoverageOnly(` complete scan under `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance` found two hits: the helper definition at `BackendAcceptanceTest.java:1504` and one caller at `SalesMenuAcceptanceScenarios.java:562`. No other acceptance scenario or recipe uses it.
2. `calibrationCopyBoundedDraft(` complete scan under the same acceptance package found two hits: the method definition at `SalesMenuAcceptanceScenarios.java:848` and the normal-recipe caller at `BackendPerformanceOperationCoverage.java:672`. No business scenario annotation references it.
3. `@AcceptanceScenario` scan in `SalesMenuAcceptanceScenarios.java` found 13 annotations at lines 70, 205, 369, 867, 1139, 1288, 1871, 2093, 2319, 2561, 2847, 2956, and 3037. The bounded calibration method at `:848` is not in the annotated set.
4. `performance.coverage-only` scan over acceptance tests, diagnostic tests, main interceptor, and scripts found acceptance production-shape use only in separate coverage contexts (`BackendAcceptanceTest.java:630`, `:645`) and the single high-cardinality copy request (`SalesMenuAcceptanceScenarios.java:562`). Other hits are verifier/interceptor/test coverage of the two-value measurement protocol, not business-scenario global defaults.
5. Generated registry scan found `badCount=0`: all 268 budget metadata entries are normal-path only; `coverageCount=0` in generated registries.
6. Anti-pattern scan with `rg` for empty catch, `System.out.println`, obvious hardcoded key/password/secret/token assignments, and silent `return null` / `Optional.empty()` in the three scoped Java files found no matches. AST-grep backend was unavailable; see validation notes.

## Review-standard action 4: unverified inventory

Static facts proven in this review:

- ScenarioContext ordinary default is normal-path.
- Coverage-only can be applied to one POST without changing the owning ScenarioContext.
- `copyCurrentDraftBoundary` has exactly one `postCoverageOnly` request in this package scan.
- `calibrationCopyBoundedDraft` is not an `@AcceptanceScenario` and uses normal `context.post`.
- `BackendPerformanceOperationCoverage` calls the bounded recipe from `runNormalRecipes`.
- Current generated registry/count source statically declares a 268-operation denominator and normal-path-only budget metadata.
- `copyOperationsSalesMenu` statically declares `FIXED max=39` and normal-path-only measurement metadata.

Test/tool facts attempted:

- `lsp_diagnostics` was invoked for all three modified scoped Java files, but the available diagnostic backend only ran TypeScript discovery and returned `tsc skipped: no tsconfig found`; this is not Java type proof.
- `ast_grep_search` was attempted for empty catch and console output patterns, but ast-grep is not installed. I used `rg` as fallback for the scoped files.

Dynamic proof not run in this review:

- `268/268` successful normal-path completion event projection.
- `copyOperationsSalesMenu` observed `databaseOperationCount <= 39`.
- backend-acceptance CONTRACT/BUSINESS PASS.
- managed runner cleanup PASS.
- Any DEV/L2/UAT/browser evidence.

L3_UNVERIFIED=空 for UI because this scope has no UI-rendered behavior. Dynamic measurement proof is explicitly listed above and must not be inferred from this static GO.

## Findings

No M/S/N findings in the requested measurement-boundary scope.

## Minimal fixes

None for this scoped static review.

If a future dynamic run fails `PERFORMANCE_NORMAL_SAMPLE_MATRIX_MISSING_NORMAL_SAMPLE:copyOperationsSalesMenu`, the minimum repair is not to mark the business scenario copy request normal-path again. Keep the high-cardinality request coverage-only, repair the bounded normal recipe or its invocation so it emits one successful normal-path completion event for `copyOperationsSalesMenu`, then rerun the managed acceptance evidence with business and cleanup reported separately.

If a future dynamic run observes `copyOperationsSalesMenu > 39`, the minimum repair is to preserve the normal-path event and inspect the owner transaction/readback path for the added cost. Do not silence it with coverage-only, do not raise the budget without the existing report-bound exception rules, and do not weaken owner facts to reduce count.

## Verdict block

REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A code extraction
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS; static measurement boundary matches the requested shape; Java diagnostics not proven because Java LSP backend was unavailable
L2_USER_VISIBLE=NOT_APPLICABLE_TO_MEASUREMENT_TEST_SCOPE
L3_UNVERIFIED=空 for UI; dynamic measurement evidence listed separately as NOT_RUN
SAME_ROOT_SCAN=PASS; `postCoverageOnly`, `calibrationCopyBoundedDraft`, `@AcceptanceScenario`, measurement-id strings, and generated budget metadata were scanned as described above
DESIGN_GAPS=空
EVIDENCE_TIER=STATIC_SOURCE_AND_GENERATED_REGISTRY_ONLY; DYNAMIC_MANAGED_PROOF_NOT_RUN
