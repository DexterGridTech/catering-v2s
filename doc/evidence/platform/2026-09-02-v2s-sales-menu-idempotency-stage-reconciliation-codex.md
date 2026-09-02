# V2S Sales Menu SM-05 idempotency/CAS stage reconciliation

REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION  
REVIEW_TARGET=IMPLEMENTATION  
SCOPE=SM-05 focused reconciliation for `sales-menu.command-idempotency-and-cas`, covering sales-menu create replay/conflict/new-key/list-dedupe and stale rename CAS/no-mutation behavior in current source and managed run `r5-tc-1788305805412-5282`.  
BLIND_REVIEW=true; author summaries, prior verdicts, and this task prompt were treated only as routing hints.  
FINAL_STAGE_VERDICT=PASS  
OPEN_COUNT=0  
PREVIOUS_FIRST_FAILURE_DISPOSITION=current managed run has `firstFailure=null`; prior SM-05 all-run failures remain preserved as diagnostic input in `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` lines 61-65 and are not overwritten by this focused run.  
STAGE_ALLOWED=YES_FOR_THIS_FOCUSED_IDEMPOTENCY_CAS_STAGE  
SM-05_ALLOWED=YES_CONTINUE_WITHIN_SM_05_FOCUSED_RECOVERY  
SM-06_ALLOWED=NO_NOT_PROVEN_BY_THIS_FOCUSED_STAGE

## Input list actually read

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `scripts/README.md`
- `doc/platform/review-standard.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
  - Requested exact path `doc/plans/platform/2026-08-31-v2s-sales-menu-interaction-codex.md` is absent in the current tree. I resolved to the actual interaction authority by `rg --files doc/plans/platform | rg 'sales-menu|interaction'`; the implementation design and plan also reference the `ui-interaction-design` path.
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- `project-memory/kernel/03-transaction-data-and-dependencies.md`
- `project-memory/kernel/04-contract-consumer-and-admin.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/practices/backend-capability-lookup.md`
- `project-memory/practices/set-interaction-not-n-times-single.md`
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
- Current owning source / edge / contract / generated / scenario:
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuCommandFailureRecorder.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuWireMapper.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/infrastructure/JdbcSalesMenuRepository.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/operations/CreateOperationsSalesMenuOperation.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/operations/RenameOperationsSalesMenuOperation.java`
  - `contracts/openapi/paths/operations-admin/sales-menu.paths.json`
  - `contracts/registry/generated/operation-handler-bindings/sales-menu.json`
  - `contracts/registry/generated/operation-handler-bindings/java/com/catering/v2s/generated/operationbindings/salesmenu/SalesMenuOperationBindings.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuCreateRequest.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuRenameRequest.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuCommandReadback.java`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
- Managed run evidence directory:
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/run-manifest.json`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/backend-acceptance-result.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/http-request-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/db-operation-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/statement-dictionary.json.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/evidence-artifacts.tsv`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/gradle.log`

## Acceptance target derived from inputs

This stage is not full SM-05 and not SM-06. The implementation plan states current execution as `SM-05_FOCUSED_RECOVERY_REQUIRED` and requires focused scenarios before broader all-run closure. For this focused stage, the acceptance target is:

1. same idempotency key + same create intent replays exact owner command readback after owner recheck;
2. same key + different create intent returns typed `IDEMPOTENCY_CONFLICT`;
3. new key creates a distinct sales-menu collection;
4. list after replay counts two real collections, not replay duplicates;
5. stale rename CAS returns typed conflict and does not mutate the menu name;
6. command readback is authoritative owner readback;
7. transaction, receipt, operation-record/audit, and logs/evidence ordering are reproducible;
8. managed run has CONTRACT/BUSINESS PASS, cleanup PASS, preserved/null first failure, archive evidence, and HTTP + DB evidence.

## Focused falsification checks

| Check | Evidence | Result |
| --- | --- | --- |
| Same-key replay exact readback | Scenario source posts `createBody` twice with the same `Idempotency-Key` and asserts `first.json()` equals `replay.json()` plus same `salesMenuRef` (`SalesMenuAcceptanceScenarios.java` lines 1951-1975). Managed result reports `operation=sales-menu.command-idempotency-and-cas`, `contract=PASS`, `business=PASS`. HTTP archive shows the replay `createOperationsSalesMenu` returns `201` with `OWNER_WRITE=0`. | PASS |
| Same-key different intent typed conflict | Scenario source posts the same key with `"SM05 conflicting intent"` and asserts problem code `IDEMPOTENCY_CONFLICT` (`SalesMenuAcceptanceScenarios.java` lines 1977-1987). Owner replay path compares request hash and throws `IDEMPOTENCY_CONFLICT` (`SalesMenuOwnerService.java` lines 1342-1357). HTTP archive shows a `createOperationsSalesMenu` `409` failed event. | PASS |
| New key distinct collection | Scenario source posts `"sm05-create-new-" + suffix()` and asserts `secondRef != firstRef` (`SalesMenuAcceptanceScenarios.java` lines 1989-1997). HTTP archive has a later `createOperationsSalesMenu` `201` with normal `OWNER_WRITE=6`. | PASS |
| List de-dupe | Scenario source calls list with `pageSize=20` and asserts exactly two items after first create, replay, conflict, and second create (`SalesMenuAcceptanceScenarios.java` lines 1998-2003). HTTP archive has `getOperationsSalesMenus` `200` with `OWNER_WRITE=0`. | PASS |
| Stale CAS no mutation | Scenario source sends rename with `expectedVersion=0`, accepts only version conflict codes, then reads the menu and asserts name remains `"SM05 idempotent menu"` (`SalesMenuAcceptanceScenarios.java` lines 2005-2017). Rename mutation source is behind `mutate`; `lockAndCheckMenu` checks version before the update (`SalesMenuOwnerService.java` lines 510-518, 994-999, 1203-1218, 2675-2679). HTTP archive has `renameOperationsSalesMenu` `409` followed by `getOperationsSalesMenu` `200`. | PASS |
| Command readback authoritative | Owner `command(...)` builds the returned command readback only after `repository.find(new SalesMenuTarget(...))` succeeds (`SalesMenuOwnerService.java` lines 2749-2758), and wire mapper copies operation/menu/target/version/status directly (`SalesMenuWireMapper.java` lines 139-145). Scenario asserts operation, scoped menu identity, exact target identity, positive version, and explicit status (`SalesMenuAcceptanceScenarios.java` lines 2018-2021 and 2550-2566). | PASS |
| Owner recheck before replay/conflict | Owner receipt flow locks the receipt key, then executes the supplied `lock.get()` before receipt lookup/replay (`SalesMenuOwnerService.java` lines 1283-1306). Create supplies `preflightCreate` as the lock step before replay (`SalesMenuOwnerService.java` lines 421-464); rename supplies `lockAndCheckMenu`, which calls `requireOwnerCommand` and not-archived checks before replay (`SalesMenuOwnerService.java` lines 994-999, 1203-1209). `requireOwnerCommand` rechecks store/channel owner facts (`SalesMenuOwnerService.java` lines 2592-2649). DB evidence confirms store and channel owner reads before the receipt query statement for replay/conflict. | PASS |
| Transaction and operation/receipt ordering | Create and rename owner commands are `@Transactional(REQUIRED)` (`SalesMenuOwnerService.java` lines 421-423, 510-512); operation bindings declare `transactionMode=REQUIRED` and `commandBoundary=OWNER_COMMAND` for create (`sales-menu.json` lines 61-74) and rename (`sales-menu.json` entry for `renameOperationsSalesMenu`). On new create, source writes collection/version/activation, then reads authoritative command, then writes operation record, then receipt insert (`SalesMenuOwnerService.java` lines 435-464 and 1283-1323). Rejected conflicts are recorded only through the failure recorder after the owner command throws (`SalesMenuCommandFailureRecorder.java` lines 52-64, 67-85; `SalesMenuOwnerService.java` lines 1033-1082). | PASS |
| Contract/edge/generated alignment | OpenAPI path declares `createOperationsSalesMenu` as operations-admin owner sales-menu with required `Idempotency-Key` length 16-128 (`sales-menu.paths.json` lines 126-192); rename declares `renameOperationsSalesMenu`, required idempotency header, and version/idempotency conflict codes (`sales-menu.paths.json` lines 2101-2185). Edge controller maps create/rename to those operation IDs and generated request records (`OperationsSalesMenuController.java` lines 254-309). Generated request/readback records match fields (`SalesMenuCreateRequest.java` lines 1-7; `SalesMenuRenameRequest.java` lines 1-7; `SalesMenuCommandReadback.java` lines 1-10). Generated binding exposes typed create/rename methods (`SalesMenuOperationBindings.java` lines 132-165). | PASS |
| Managed run business/cleanup/archive | `run-manifest.json` has `status=PASS`, `business=PASS`, `testExecution.status=PASS`, `firstFailure=null`, `cleanup.status=PASS` with remote process/workspace/Testcontainers container/volume PASS, `resourcePreflight.containers=[]`, `resourcePreflight.volumes=[]`, and `evidenceArchive.status=PASS`. `backend-acceptance-result.jsonl.gz` reports one selected scenario, `status=PASS`, `contract=PASS`, `business=PASS`, `businessMode=REAL`, `businessAssertion=HAND_WRITTEN_BUSINESS_ORACLE`. `evidence-artifacts.tsv` indexes archived HTTP/result/DB/statement evidence with hashes. | PASS |
| First-failure disposition | Current focused run has `firstFailure=null`. The known prior all-run failure is not erased: plan lines 61-65 preserve the previous `r5-tc-1788271073909-91073` diagnostic state with 101 tests and 10 failures. This artifact does not claim that prior all-run is now green. | PASS |

## 11-dimensional reconciliation

| Dimension | Result | Evidence |
| --- | --- | --- |
| behavior | PASS | Requirements allow store sales menus and independent repeated sales-menu entities; focused scenario proves replay, conflict, new-key distinct entity, de-duped list, stale rename no mutation. |
| surface/form | PASS | Backend surface is POST `/sales-menus`, PATCH `/{salesMenuRef}/name`, GET list/detail; OpenAPI, edge controller, generated request/readback, and scenario all use the same forms and `Idempotency-Key` contract. |
| actions | PASS | Create, create replay, create conflict, second create, list, stale rename, detail read are all exercised by the single focused scenario and visible in HTTP events. |
| relationships | PASS | Store and channel relationship is checked at edge and owner: `requireEligibleChannel` / `requireChannel` enforce INTERNAL + STORE + DINE_IN/TAKEAWAY and same store; DB evidence includes organization store and business-channel owner reads. |
| placement | PASS | Runtime implementation remains in `sales-menu` owner module with operations-admin edge adapter; no cross-owner write path was observed for create/rename. |
| user-visible copy | PASS_FOR_BACKEND_STAGE | Backend stage exposes typed problem codes and Chinese owner messages for idempotency/CAS/channel errors; no browser/UI copy is claimed by this focused run. |
| limits | PASS_FOR_STAGE | Idempotency header bounded 16-128 in OpenAPI/support; list page size is fixed to 20 in support and scenario; this stage does not prove broader 21-record cursor traversal. |
| state/control | PASS | Replay has no owner write in HTTP evidence; conflict and stale CAS return 409; stale CAS readback keeps original name; new key creates separate collection. |
| failure/recovery | PASS | `IDEMPOTENCY_CONFLICT` and version conflicts are typed; rejected operation record path is closed-set and owner-recorded after rollback; current run has null first failure and cleanup PASS. |
| accessibility/focus | NOT_APPLICABLE_FOR_THIS_BACKEND_ONLY_STAGE | IA/interaction include UI focus/a11y obligations, but this focused backend acceptance run does not exercise browser UI. This is not a blocker for the idempotency/CAS backend stage and does not authorize UI closure. |
| data source/invalidation | PASS_FOR_STAGE | Command readback is owner DB readback through `repository.find`; list/detail are HTTP owner reads in the managed run. No frontend cache invalidation or browser freshness is claimed. |

## Managed run evidence summary

- Command inspected: `jq ... run-manifest.json`; `gzip -dc .../backend-acceptance-result.jsonl.gz`; `gzip -dc .../http-request-events.jsonl.gz | jq -c 'select(.owner=="sales-menu") ...'`; `gzip -dc .../db-operation-events.jsonl.gz`; `gzip -dc .../statement-dictionary.json.gz`.
- Run identity: `r5-tc-1788305805412-5282`, backend acceptance operation `sales-menu.command-idempotency-and-cas`, started `2026-09-01T23:36:45.412Z`, completed `2026-09-01T23:38:09.592Z`.
- Scenario result: selected `1`, discovered `99`, module `SALES_MENU`, operation `sales-menu.command-idempotency-and-cas`, `status=PASS`, `contract=PASS`, `business=PASS`, `businessMode=REAL`.
- HTTP sequence for sales-menu owner:
  1. `createOperationsSalesMenu` POST `201`, `OWNER_WRITE=6`;
  2. replay `createOperationsSalesMenu` POST `201`, `OWNER_WRITE=0`;
  3. conflict `createOperationsSalesMenu` POST `409`;
  4. new-key `createOperationsSalesMenu` POST `201`, `OWNER_WRITE=6`;
  5. `getOperationsSalesMenus` GET `200`;
  6. stale `renameOperationsSalesMenu` PATCH `409`;
  7. `getOperationsSalesMenu` GET `200`.
- Archive: manifest lists archived `http-request-events.jsonl`, `backend-acceptance-result.jsonl`, `db-operation-events.jsonl`, and `statement-dictionary.json` with raw and archive SHA-256; `evidence-artifacts.tsv` indexes the same artifacts.
- Cleanup: manifest reports `cleanup.status=PASS`, `remoteProcess=PASS`, `remoteWorkspace=PASS`, `testcontainersContainers=PASS`, `testcontainersVolumes=PASS`; DEV was not running and was not restarted.

## Gaps and risks

- No OPEN finding for this focused idempotency/CAS stage.
- This PASS is intentionally narrow. It does not prove full SM-05 closure, all 15 sales-menu scenarios, the exact 31-operation completion-event denominator, CP-05 normal projection, browser L2, DEV, seed, UAT, or frontend a11y/focus behavior.
- The managed manifest `measurementEvidence.failed=2` belongs to run-level measurement/projection evidence, not to the selected business scenario. It is not used here as business PASS proof and should not be silently reclassified as full performance closure.
- HTTP archive does not store full response bodies in the inspected summary; exact JSON readback equality is therefore proven by the checked-in hand-written business oracle plus its PASS result, with owner source and DB/HTTP evidence corroborating the path.
