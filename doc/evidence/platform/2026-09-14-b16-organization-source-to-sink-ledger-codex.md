# B16 organization current-byte source-to-sink ledger

## Evidence boundary

- CP: B16 `organization` execution relocation.
- Checkpoint: 2026-09-14, before the first B16 production-source write.
- Scope: `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/` files whose top-level filename ends in `Service.java` or `Coordinator.java`, plus the non-suffix application services that are direct consumers of the same SQL holders.
- Candidate scan: direct directory enumeration; nested types are not candidates. Transaction count is a case-sensitive count of `@Transactional`; sink count is a case-sensitive count of `jdbc.query`, `jdbc.queryForObject`, `jdbc.queryForList`, `jdbc.update`, `jdbc.execute` and `jdbc.batchUpdate` followed by `(`. These are structural counts, not acceptance denominators.
- No code, contract, generated source, migration, seed, DEV, reset, backend acceptance or browser L2 was executed for this checkpoint.

## Current candidate inventory

The current suffix candidate set is 19 classes, with 145 `@Transactional` annotation tokens and 143 direct JDBC sink source sites. Sixteen suffix candidates contain direct JDBC sinks; three suffix candidates have no direct sink and remain task-read, facade or coordinator boundaries. The current organization test inventory contains 19 module/edge Java test files whose path contains `organization`.

| class | tx tokens | direct sink sites | classification | B16 disposition |
| --- | ---: | ---: | --- | --- |
| BusinessBrandService | 6 | 8 | KEEP_SINGLE_AGGREGATE | typed persistence execution |
| BusinessEntityCommandReceiptService | 0 | 4 | KEEP_ADAPTER_SUPPORT | typed receipt persistence execution |
| BusinessEntityService | 0 | 0 | KEEP_FACADE | retain public owner facade |
| BusinessEntityTaskReadService | 20 | 22 | KEEP_TASK_READ | typed task-read persistence execution |
| BusinessTenantService | 6 | 8 | KEEP_SINGLE_AGGREGATE | typed persistence execution |
| CommercialGroupCommandReceiptService | 0 | 3 | KEEP_ADAPTER_SUPPORT | typed receipt persistence execution |
| HeadCompanyService | 12 | 11 | KEEP_SINGLE_AGGREGATE | typed persistence execution |
| OperationsOrganizationTaskReadService | 9 | 0 | KEEP_TASK_READ | retain task-read composition |
| OrganizationAssignmentCandidateService | 4 | 6 | KEEP_TASK_READ | typed candidate persistence execution |
| OrganizationAuditHistoryService | 4 | 8 | KEEP_ADAPTER_SUPPORT | typed audit persistence execution |
| OrganizationCommandService | 9 | 0 | KEEP_SINGLE_AGGREGATE | retain command router/owner boundary |
| OrganizationGroupWorkspaceInitializationTaskReadService | 2 | 2 | KEEP_TASK_READ | typed initialization persistence execution |
| OrganizationHierarchyCommandReceiptService | 0 | 3 | KEEP_ADAPTER_SUPPORT | typed receipt persistence execution |
| OrganizationHierarchyService | 38 | 18 | KEEP_SINGLE_AGGREGATE | typed hierarchy persistence execution |
| OrganizationOverviewTaskReadService | 8 | 12 | KEEP_TASK_READ | typed overview persistence execution |
| OrganizationTaskPathService | 12 | 18 | KEEP_TASK_READ | typed path persistence execution |
| OrganizationVisibilityService | 4 | 8 | KEEP_TASK_READ | typed visibility persistence execution |
| StoreCandidateTaskReadService | 5 | 1 | KEEP_TASK_READ | typed candidate persistence execution |
| StoreService | 6 | 11 | KEEP_SINGLE_AGGREGATE | typed store persistence execution |

The 143 sink total is `8+4+22+8+3+11+6+8+2+3+18+12+18+8+1+11`; the zero-sink classes are not silently omitted. The current package also has 18 existing `*ServiceSql.java` holders (including the resolver/technical holders represented by the B3 inventory); they are SQL text owners only, not typed execution boundaries.

## Boundary and implementation obligations

1. Application services retain validation, owner facts, transaction annotations, lock/CAS, idempotency, audit ordering, rollback semantics, readback and response shaping. They must not retain direct JDBC execution or pass SQL text, SQL fragments, wrappers, mappers or generic executor arguments to persistence.
2. Each moved execution point receives a named typed persistence method whose arguments are business values: read filters/sort/page/target, or aggregate/command/field values for writes. Dynamic SQL fragment selection and combination remains inside persistence.
3. `BusinessEntityService` remains the stable public facade. `OrganizationCommandService` remains an owner command boundary and `OperationsOrganizationTaskReadService` remains task-read composition. Neither is excluded from source review merely because it has no direct sink.
4. `ExternalCollaborationBusinessChannelCoordinator` is outside this module/application candidate set and remains outside B16; no cross-owner coordinator is pulled into organization by filename.
5. The exact CP-0 matrix must be expanded before B16 closure: every public overload, caller/receiver path, transaction/self-call/outer propagation, lock/CAS/receipt/readback obligation, and named focused behavior oracle. Existing test-file presence or status assertions cannot close a row.

## Pre-write cost baseline

- Cost unit: `changed production files + added/modified focused behavior-fixture files + unresolved execution-point count after CP-0 scan`.
- Baseline time: 2026-09-14 before B16 production writes.
- Baseline record: this ledger and the B16 CP-0 matrix; the baseline is not reused for any other module.
- Baseline estimate: `UNVERIFIED_REQUIRES_EVIDENCE` until the exact B16 execution-point matrix and test-oracle mapping are complete. A threefold result triggers a report to Dexter; it is not an implementation-side scope decision.

## Status

`B16_CP0=RECORDED_BEFORE_WRITE`; `B16_ENTRY=OPEN_UNTIL_CP0_AND_BEHAVIOR_PROOF`. This ledger is an implementation evidence document, not a compliance ledger and does not use hash-chain, receipt, package entry/exit or retired compliance controls.

## Post-write current-byte reconciliation (2026-09-14)

The pre-write inventory above is retained as the historical checkpoint. During the post-write scan, the original `OrganizationCommandService` receiver was found to be `jdbcTemplate`, while the pre-write command counted only `jdbc.` receivers. That was a scanner blind spot, not an implementation exemption. The service's 11 JDBC execution sites were therefore moved into the new typed `OrganizationCommandPersistence` before B16 closure.

The current-byte scan was rerun over every Java file in the organization application package, including both `jdbc` and `jdbcTemplate` receiver names and excluding only `application/persistence` from the application-side result:

- application direct JDBC execution: `0` source sites;
- application SQL-holder references: `0` service-side `*ServiceSql` references;
- typed persistence direct JDBC execution: `149` source sites across the current `*Persistence.java` files;
- application service `@Transactional` annotations: `145` tokens across the 19 candidate classes.

The scan is receiver-qualified and checks `query`, `queryForObject`, `queryForList`, `update`, `execute` and `batchUpdate`; imports and compatibility constructors are not execution sites. The 19 candidate classes remain present, including zero-sink task-read, facade and coordinator boundaries. No application method accepts or forwards SQL text, a SQL fragment, a SQL wrapper, a mapper or a generic executor argument to persistence.

The following managed focused proofs were run after the corresponding source edits:

- `r5-tc-1789337798141-47708`: Overview persistence compile failure (`Query.empty/validated` package visibility); remote containers, volumes, workspace and process cleanup `PASS`. Retained as first-failure evidence.
- `r5-tc-1789337848974-48697`: Overview visibility repair; Gradle organization test `PASS`, cleanup `PASS`.
- `r5-tc-1789338171420-54621`: OrganizationCommandPersistence migration; Gradle organization test `PASS`, cleanup `PASS`.
- `r5-tc-1789338374610-58378`: final organization facade SQL-holder cleanup; Gradle organization test `PASS`, cleanup `PASS`.

Focused module runs report `business=NOT_APPLICABLE`; they are compile/Gradle behavior support only and are not full backend acceptance. B16 behavior and step reconciliation remain subject to the fresh whole-delivery implementation reviewer and the unique final full backend acceptance.

`B16_CURRENT_APPLICATION_SINKS=0`; `B16_CURRENT_SQL_HOLDER_REFERENCES=0`; `B16_FOCUSED_PROOF=r5-tc-1789338374610-58378`; `B16_STATUS=READY_FOR_FINAL_WHOLE_DELIVERY_RECONCILIATION`.
