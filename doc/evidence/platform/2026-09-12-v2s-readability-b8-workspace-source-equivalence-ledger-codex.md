# B8 Workspace source/data-flow equivalence ledger

## Evidence identity

- Scope: B8 workspace execution relocation only.
- Evidence kind: `SOURCE_DATA_FLOW_EQUIVALENCE_LEDGER`.
- Historical runtime before-capture: `NOT_AVAILABLE`; no synthetic database trace, mtime claim or hash-chain receipt is used.
- Historical source anchor: read-only pre-B8 source at `/Users/dexter/.codex/worktrees/2172/catering-v2s`, whose workspace files still contain the pre-relocation JDBC calls listed in §1.
- Current after-capture run: `r5-tc-1789289396521-76275`.
- Current after-capture artifact: `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789289396521-76275/sql-captures/apps/backend/catering-business-server/modules/workspace/workspace-effective-sql-capture-after.xml`.
- Current after-capture facts: 15 points, all effective SQL non-blank, sink order and parameter counts are `[10,10,1,2,8,5,2,10,5,2,2,3,6,4,1]`; the JUnit XML reports `tests=1`, `failures=0`, `errors=0`.
- The capture is a mocked-`JdbcTemplate` source/sink proof. It is not a historical database-result comparison. The source/data-flow rows below are the permitted equivalence alternative and remain subject to fresh independent step review.

## 1. Before boundary recorded before B8 writes

The pre-write source was opened read-only from the historical worktree above. The line numbers in this section are locations in that pre-write source, not claims about the current tree. The old SQL holder values were already in the module persistence segment; B8 moves execution to typed persistence and leaves the SQL text/shape in that owner segment.

| Stable execution point | Before source sink and SQL owner | Before argument expression/order |
| --- | --- | --- |
| `workspace/administration/create/01` | `application/WorkspaceAdministrationService.java:88-99`; `WorkspaceAdministrationServiceSql.CREATE` | `workspaceUuid`, normalized key, `name.trim()`, normalized name, required title, required logo ref, optional notes, `now`, `now`, `now` |
| `workspace/administration/page/01` | `application/WorkspaceAdministrationService.java:123-135`; `PAGE_PREFIX + orderBy + PAGE_SUFFIX` | name twice, group-workspace key twice, operations title twice, status twice, page size, offset |
| `workspace/administration/find/01` | `application/WorkspaceAdministrationService.java:145-151`; `WorkspaceAdministrationServiceSql.REQUIRE` | prepared slot 1 = required group-workspace key |
| `workspace/administration/status/01` | `application/WorkspaceAdministrationService.java:165-174`; `WorkspaceAdministrationServiceSql.STATUS` | prepared slot 1 = workspace UUID; slot 2 = group-workspace key |
| `workspace/administration/update/01` | `application/WorkspaceAdministrationService.java:260-270`; `WorkspaceAdministrationServiceSql.UPDATE` | trimmed name, normalized name, required title, optional notes, target logo ref/null, current time, required key, expected version |
| `workspace/administration/status-transition/01` | `application/WorkspaceAdministrationService.java:306-312`; `WorkspaceAdministrationServiceSql.TRANSITION_STATUS` | status, `now`, `now`, required key, expected version |
| `workspace/administration/legacy-id/01` | `application/WorkspaceAdministrationService.java:340-344`; `WorkspaceAdministrationServiceSql.LEGACY_ID` | workspace UUID, group-workspace key |
| `workspace/administration/audit/insert/01` | `application/WorkspaceAdministrationService.java:355-366`; `WorkspaceAdministrationServiceSql.AUDIT` | random event ID, workspace UUID, group-workspace key, legacy ID text, actor type, actor ID, actor display snapshot, action, occurred-at time, canonicalized changes JSON |
| `workspace/audit-history/read/01` | `application/PlatformWorkspaceAuditHistoryService.java:53-62`; `PlatformWorkspaceAuditHistoryServiceSql.PAGE` | prepared slot 1 = group-workspace key; 2 = scope workspace UUID; 3 = scope workspace UUID; 4 = scope group-workspace key; 5 = fetch size |
| `workspace/receipt/lock/01` | `application/WorkspaceCommandReceiptService.java:36`; `WorkspaceCommandReceiptServiceSql.LOCK` | group-workspace key, validated idempotency key |
| `workspace/receipt/find/01` | `application/WorkspaceCommandReceiptService.java:37-43`; `WorkspaceCommandReceiptServiceSql.FIND` | prepared slot 1 = group-workspace key; slot 2 = validated idempotency key |
| `workspace/receipt/upgrade/01` | `application/WorkspaceCommandReceiptService.java:48-52`; `WorkspaceCommandReceiptServiceSql.UPGRADE_LEGACY_RESPONSE` | serialized replay response, group-workspace key, validated idempotency key |
| `workspace/receipt/insert/01` | `application/WorkspaceCommandReceiptService.java:61-68`; `WorkspaceCommandReceiptServiceSql.INSERT` | group-workspace key, result workspace UUID, validated idempotency key, request hash, serialized response, current time |
| `workspace/task-read/list/01` | `adapter/JdbcGroupWorkspaceRepository.java:26-35`; `JdbcGroupWorkspaceRepositorySql.LIST` | `blankToNull(name)` twice, `blankToNull(groupWorkspaceKey)` twice |
| `workspace/task-read/detail/01` | `adapter/JdbcGroupWorkspaceRepository.java:40-43`; `JdbcGroupWorkspaceRepositorySql.DETAIL` | group-workspace key |

The pre-write scan therefore has 13 application JDBC sinks plus two M-08 adapter sinks. The five B8 application candidates and the adapter are not silently merged into a different denominator.

## 2. Current after boundary

The current production typed boundary is split by existing business responsibility:

- `WorkspaceAdministrationPersistence` is `@Repository` and owns administration create/page/find/status/update/status-transition/legacy-id/audit execution at `application/persistence/WorkspaceAdministrationPersistence.java:26-148`.
- `PlatformWorkspaceAuditHistoryPersistence` is `@Repository` and owns the workspace audit projection query at `application/persistence/PlatformWorkspaceAuditHistoryPersistence.java:24-39`.
- `WorkspaceCommandReceiptPersistence` is `@Repository` and owns lock/find/legacy-upgrade/insert at `application/persistence/WorkspaceCommandReceiptPersistence.java:19-62`.
- The M-08 `JdbcGroupWorkspaceRepository` implementation is now `application/persistence/JdbcGroupWorkspaceRepository.java:17-45`; the old production adapter implementation is absent. Its application port remains `GroupWorkspaceRepository`.
- The three application services retain the owner validation, transaction annotations, receipt/audit orchestration and authoritative readback. A current scan finds no `JdbcTemplate`, SQL holder, `.query(...)`, `.update(...)`, `queryForList`, `queryForObject`, `RowMapper` or raw-SQL method parameter in those three services.
- The SQL holders are in the same module persistence segment. Their SQL-bearing values are unchanged from the pre-write holders except for ownership comments and the administration order constants moved from the service into the holder. The old order mapping (`NAME`, `WORKSPACE_KEY`, `UPDATED_AT`, then direction and stable key) is preserved by `WorkspaceAdministrationService.java:426-435` in the historical source and `WorkspaceAdministrationPersistence.java:166-175` in the current source.

## 3. Before-to-after execution ledger

The after XML has one record for each row below in the same order. `after line` is the current source anchor; `after sink/params` is independently read from the archived XML. The SQL shape column names the exact holder expression; the artifact contains the full effective SQL text.

| Stable point | Before source anchor | After line / SQL shape | Sink / params | Slot mapping and equivalence result |
| --- | --- | --- | --- | --- |
| `workspace/administration/create/01` | Administration service `:88-99` | `WorkspaceAdministrationPersistence.java:26-46`; `CREATE` | `update / 10` | Same insert columns, literal `ENABLED`, revision/version constants and three time slots; same 10 values. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/page/01` | Administration service `:123-135` | `WorkspaceAdministrationPersistence.java:49-66`; `PAGE_PREFIX + orderBy + PAGE_SUFFIX` | `query / 10` | Same eight nullable filter slots followed by page size/offset; `orderBy` preserves the three-column allowlist and stable suffix. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/find/01` | Administration service `:145-151` | `WorkspaceAdministrationPersistence.java:69-74`; `REQUIRE` | `queryExtractor / 1` | Same `group_workspace_key=?` predicate; prepared slot 1 is the same validated key. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/status/01` | Administration service `:165-174` | `WorkspaceAdministrationPersistence.java:76-84`; `STATUS` | `queryExtractor / 2` | Same workspace UUID then group-workspace-key predicates and slot order. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/update/01` | Administration service `:260-270` | `WorkspaceAdministrationPersistence.java:86-107`; `UPDATE` | `query / 8` | Same five display fields, current time, key and expected-version slots; same `RETURNING` readback projection. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/status-transition/01` | Administration service `:306-312` | `WorkspaceAdministrationPersistence.java:109-118`; `TRANSITION_STATUS` | `update / 5` | Same status, two time slots, key and expected-version predicate. Service still rejects zero affected rows and reads back. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/legacy-id/01` | Administration service `:340-344` | `WorkspaceAdministrationPersistence.java:120-126`; `LEGACY_ID` | `queryForObject / 2` | Same workspace UUID/key lookup and typed `Long` result. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/administration/audit/insert/01` | Administration service `:355-366` | `WorkspaceAdministrationPersistence.java:128-148`; `AUDIT` | `update / 10` | Same audit columns, actor/display/action values and canonicalized JSON expression; same 10 slots. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/audit-history/read/01` | Audit service `:53-62` | `PlatformWorkspaceAuditHistoryPersistence.java:27-39`; `PAGE` | `queryExtractor / 5` | Same five setter bindings and same CTE/exists/entity predicates; merge, ordering and page slicing remain in the service. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/receipt/lock/01` | Receipt service `:36` | `WorkspaceCommandReceiptPersistence.java:21-26`; `LOCK` | `queryForList / 2` | Same advisory xact-lock expression and two key slots. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/receipt/find/01` | Receipt service `:37-43` | `WorkspaceCommandReceiptPersistence.java:28-36`; `FIND` | `queryExtractor / 2` | Same receipt key predicates and validated key order. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/receipt/upgrade/01` | Receipt service `:48-52` | `WorkspaceCommandReceiptPersistence.java:38-45`; `UPGRADE_LEGACY_RESPONSE` | `update / 3` | Same JSON response, group-workspace-key and idempotency-key slots; legacy upgrade remains replay-only. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/receipt/insert/01` | Receipt service `:61-68` | `WorkspaceCommandReceiptPersistence.java:47-62`; `INSERT` | `update / 6` | Same receipt scope, hash, serialized response and timestamp order. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/task-read/list/01` | Adapter `:26-35` | `application/persistence/JdbcGroupWorkspaceRepository.java:24-36`; `LIST` | `query / 4` | Same two optional filters duplicated in the same order; mapping remains summary-only. `SOURCE_DATA_FLOW=MATCHED` |
| `workspace/task-read/detail/01` | Adapter `:40-43` | `application/persistence/JdbcGroupWorkspaceRepository.java:38-45`; `DETAIL` | `query / 1` | Same key predicate and detail projection; mapping keeps optional commercial-group readback. `SOURCE_DATA_FLOW=MATCHED` |

The 15 rows reconcile the complete pre-write sink inventory to the complete after capture inventory. No point is matched only by method name: each row identifies the old SQL owner, new typed method, effective SQL holder expression, sink kind, parameter count and slot order.

## 4. Transaction, receipt, lock, audit and readback invariants

| Invariant | Before anchor | After anchor | Current evidence |
| --- | --- | --- | --- |
| Owner transaction boundary | Historical service annotations around the 13 application sinks; receipt support was called inside the existing command transaction | Current service annotations are retained; persistence classes have no transaction annotation; `WorkspaceAdministrationService` still calls receipt, asset, persistence and audit in the same command flow | Static source mapping; existing focused behavior proof; not upgraded to full acceptance |
| Receipt lock and replay | Receipt service locked before find, replay-upgraded legacy response, and inserted only after command success | `WorkspaceCommandReceiptService.java:35-56` calls typed persistence in the same order; lock/find/upgrade/insert are the four typed methods | Current focused test plus source order; no DB-operation-only claim |
| CAS and authoritative readback | Update/status-transition used expected version, zero-row conflict and subsequent require/readback | `WorkspaceAdministrationService.java:225-244` and `:267-279` keep the same checks and readback; persistence only returns typed row/result | Current focused test and source mapping |
| Audit and cross-owner merge | Administration audit looked up legacy ID and inserted; history query merged organization audit in service | `WorkspaceAdministrationService.java:293-317` keeps legacy-ID lookup and JSON canonicalization; audit history service still merges organization projection after typed own read | Current focused test and source mapping |
| Task-read port boundary | Adapter implemented `GroupWorkspaceRepository` and exposed list/detail | `application/persistence/JdbcGroupWorkspaceRepository.java:17` implements the same port; no application service receives raw JDBC | Current task-read focused test and static boundary |
| SQL effective shape and slots | The pre-write sources above show the old SQL holder expression and argument order | After XML proves all 15 current sinks are nonblank and records exact sink/parameter counts; the table supplies before/after source/data-flow alignment | `AFTER_CAPTURE=PASS`; historical runtime capture remains unavailable |

## 5. Evidence limits and closure state

- `r5-tc-1789288965214-75216` is retained as the first capture attempt: its test failed at `WorkspaceEffectiveSqlCaptureTest.java:34` with a varargs `ClassCastException`; cleanup was PASS. It is a diagnostic first failure, not evidence.
- `r5-tc-1789289226615-75751` passed after the varargs fix but did not archive the relative output file. It is retained as evidence of the test execution repair, not as the current capture artifact.
- `r5-tc-1789289314445-76013` passed after explicit absolute output path; it proves the capture artifact path/collection boundary.
- `r5-tc-1789289396521-76275` passed after `PreparedStatementSetter` binding capture was added. Its manifest records source sync, remote compile/test, remote process/workspace, Testcontainers container/volume cleanup all `PASS`, `devLifecycle.wasRunning=false`, and `business=NOT_APPLICABLE` because this is a module-focused proof.
- No local Spring, PostgreSQL tunnel, DEV, reset, seed, browser L2 or full backend acceptance was used for these B8 focused runs.
- The current XML is after-only mocked-JDBC evidence. The before side is read-only historical source/data-flow evidence from the pre-write worktree. A fresh independent B8 step reviewer must decide whether this ledger is complete enough under the implementation plan; until then:

  `B8_EFFECTIVE_SQL_EQUIVALENCE=OPEN_UNTIL_FRESH_INDEPENDENT_REVIEW`

  `B8_ENTRY=BLOCKED`
