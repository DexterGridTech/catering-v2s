# Backend 可读性整改 · CP-3 Inventory 当前结构与行为证据

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=IMPLEMENTATION
CP=CP-3
OWNER=INVENTORY
STRUCTURE_MOVE=INVENTORY_TARGETS_AND_ROUTERS_PRESENT_FACADE_CLEANED
BEHAVIOR_PIN=FOCUSED_PARTIAL
CURRENT_STATUS=STEP_REVIEW_MATCHED_REMOTE_FOCUSED_TESTS_PASS_BACKEND_ACCEPTANCE_OPEN
BUSINESS_MODE=REMOTE_FOCUSED_TESTS_PASS_BACKEND_ACCEPTANCE_NOT_RUN
```

## 1. 写入前双读与范围

本记录写入前重新读取：

- `doc/plans/platform/2026-09-11-v2s-backend-readability-requirements-claude.md`；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-design-codex.md` 的 Inventory family、事务边界、跨 owner 与测试段；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-plan-codex.md` 的 CP-3、CP-7 与固定双读段；
- `doc/platform/backend-coding-standard.md` §2.5 的 `R-READ-01`、`R-READ-03`、`R-READ-05`、`R-READ-06`、`R-READ-07`、`R-READ-08`；
- `project-memory/operations/backend-readability-refactor.md`、`project-memory/operations/implementation-source-reread-discipline.md`；
- 结构移动前的 `InventoryOwnerService`、`InventoryOwnerApi`、Inventory 测试与 `CatalogInventoryReadTransactionTopologyTest`；
- 当前 Inventory target/router 源码及 CP-2 当前证据的动态边界。

本 CP 只重组 Inventory owner application 的职责边界，不改变公开 `InventoryOwnerApi`、HTTP operation、契约、数据库结构、跨 owner 写入、测试文件拓扑或前端。当前所有目标类仍位于既有 application 包；本记录不把源码行数、public 数量或 `JdbcTemplate` 数量当作行为证据。

## 2. 当前源码结构

| source | current shape | responsibility | current evidence |
| --- | --- | --- | --- |
| `InventoryOwnerService.java` | 506 lines; `InventoryOwnerApi` facade | stable public API forwarding, compatibility static entry points, target/router wiring | local compile PASS; static only |
| `InventoryAvailabilityService.java` | 422 lines | sales-menu inventory availability read and projection | local compile PASS; static only |
| `InventoryTargetService.java` | 2150 lines | target read, typed mutation, target ledger/config/CAS/readback and shared inventory target facts | local compile PASS; static only |
| `InventoryCatalogLifecycleService.java` | 1115 lines | catalog unit/item lifecycle validation, void dependency and inventory retirement | local compile PASS; static only |
| `InventoryBomService.java` | 2830 lines | inventory target/BOM and option-value BOM relations | local compile PASS; static only |
| `InventoryCopyService.java` | 2395 lines | local/brand copy preflight, preparation, execution and copy readback | local compile PASS; static only |
| `InventoryReadRouter.java` | 49 lines | generic inventory read operation-id dispatch and read transaction boundary | local compile PASS; static only |
| `InventoryCommandRouter.java` | 96 lines | generic inventory write operation-id dispatch and write transaction boundary | local compile PASS; static only |

`wc -l` over the eight current sources returned `9563` total lines. This is a source-shape fact only; it is not a claim that all copied helper types belong to one domain or that behavior is covered.

## 3. Facade and transaction boundary proof

`InventoryOwnerService` retains the public owner surface and delegates each public operation to the corresponding target or router. Its Spring constructor injects the seven concrete collaborators at lines 31-47. The compatibility constructor at lines 49-57 still supports existing direct tests without changing the public API shape; it composes the same targets and routers explicitly.

The facade's operation methods are forwarding calls at lines 59-469. The only remaining static compatibility methods at lines 471-505 delegate pure validation/value helpers to `InventoryTargetService`; they do not perform JDBC, locking, receipt persistence, transaction management or owner writes. The facade has no `@Transactional` method, no `jdbc.query/update` implementation and no `executeWrite` implementation. Its only `JdbcTemplate` occurrence is the preserved compatibility constructor parameter and construction wiring.

`InventoryReadRouter.read` at lines 20-47 owns the generic read operation switch and `@Transactional` boundary. `InventoryCommandRouter.write` at lines 26-96 owns both generic write overloads and their `@Transactional` boundaries. The routers call `InventoryTargetService` for target facts and do not write catalog or organization owner facts.

Concrete target services retain their original JDBC/transaction implementation families. For example, `InventoryTargetService` retains `JdbcTemplate` at lines 66-74 and its typed target helpers; `InventoryCatalogLifecycleService`, `InventoryBomService` and `InventoryCopyService` retain their own concrete persistence and transaction families. The classes are Spring `@Service` beans, so the production constructor uses bean-to-bean invocation rather than relying on the facade's old self-invocation path.

## 4. Compatibility and current static checks

- `InventoryOwnerService implements InventoryOwnerApi` still compiles, so every API method remains implemented with the same signature.
- Existing package-visible/static compatibility helpers used by `InventoryPageQueryContractTest`, `InventoryOwnerContractTest` and `InventoryOwnerBehaviorTest` remain on the facade and delegate to the target implementation.
- `CatalogInventoryReadTransactionTopologyTest` now checks the generic read transaction boundary on `InventoryReadRouter.read`, matching the moved owner of that boundary; facade read methods remain non-transactional.
- No target contains `InventoryOwnerService` construction or a reverse target-to-facade reference. The only explicit target construction is the preserved direct-test compatibility constructor in `InventoryOwnerService`.
- All seven concrete targets/routers are Spring-managed `@Service` classes; the production facade constructor is explicitly `@Autowired`.

## 5. Compile and test command evidence

The following commands completed successfully after the CP-3 source move:

```text
./gradlew :apps:backend:catering-business-server:modules:inventory:compileJava :apps:backend:catering-business-server:modules:inventory:compileTestJava --no-daemon
BUILD SUCCESSFUL

./gradlew :apps:backend:catering-business-server:compileTestJava --no-daemon
BUILD SUCCESSFUL
```

An attempted direct local selected-test command was intentionally rejected by the repository fail-closed guard:

```text
./gradlew :apps:backend:catering-business-server:modules:inventory:test \
  --tests com.catering.v2s.inventory.application.InventoryPageQueryContractTest \
  --tests com.catering.v2s.inventory.application.InventoryOwnerContractTest \
  --tests com.catering.v2s.inventory.application.InventoryOwnerBehaviorTest \
  --tests com.catering.v2s.inventory.application.InventoryOwnerScopeGrantTest --no-daemon
V2S_TESTCONTAINERS_REMOTE_REQUIRED
```

This is a topology guard result, not a test failure and not a business result. The selected Gradle task is part of the Docker-backed test suite and must be invoked through `scripts/test/r5-remote-testcontainers.mjs` (or the repository's owner focused wrapper), which places JVM and Testcontainers on the approved remote host. No local Docker, local Spring or local PostgreSQL was started.

## 6. Behavior and dynamic evidence boundary

The current CP-3 source has local compile proof only. No current remote Testcontainers run has been accepted for this CP, so the following remain open until a managed run is completed and its artifact is read:

- target read, typed count/increase/adjust/configuration mutation and authoritative readback;
- receipt replay/conflict, idempotency and rollback behavior;
- lock order and concurrent/CAS behavior;
- `REQUIRES_NEW` or equivalent failure-isolation behavior where applicable;
- catalog lifecycle void dependency/retirement and BOM relation behavior;
- local/brand copy mapping, digest, preflight, execution and readback;
- sales-menu availability projection and the generic read/write operation sets;
- runtime Spring bean injection and behavior after the facade-to-target bean boundary changes.

The historical CP-2 remote artifacts are not reused as CP-3 evidence. A future focused run must report `CONTRACT` and `BUSINESS` separately, use real business oracles, and report resource cleanup separately. `DB_OPERATIONS` may be information only and cannot close a behavior gap.

## 7. Implementation constraints for the next step

- Do not add public HTTP operations, contracts, migrations, generated sources, frontend changes, L2 spec changes or test-file splitting in CP-3.
- Keep `InventoryOwnerApi` and all existing FQCN/static compatibility entry points stable unless a compiler- or behavior-proven necessity requires a narrowly scoped adjustment.
- Keep target facts and their transactions in the target owner; keep generic operation dispatch in the routers; do not put business mutation back into the facade.
- Do not turn the direct-test compatibility constructor into the production wiring path or add `primary`/fallback beans to hide injection ambiguity.
- Before the next CP, reread the same requirements, implementation design, plan, memory and owning source and compare every changed behavior, transaction boundary, failure path and readback path.

## 8. Current status

`CP-3_STRUCTURE=STATIC_COMPILED`

`CP-3_BEHAVIOR=REMOTE_FOCUSED_TESTS_PASS_FULL_BUSINESS_ACCEPTANCE_OPEN`

`CP-3_STEP_REVIEW=FRESH_INDEPENDENT_MATCHED`

`NEXT_GATE=CP3_EVIDENCE_RECONCILIATION_THEN_CP4`

No full backend-acceptance business PASS is claimed by this record. The direct-local Testcontainers guard failure remains
recorded as the reason the behavior proof used the managed remote runner.

## 9. Fresh independent review intake and repair

The first CP-3 fresh independent step review returned:

```text
REVIEW_TARGET=IMPLEMENTATION_STEP
reviewerKind=INDEPENDENT_SUBAGENT
CP=CP-3
STEP_REVIEW=OPEN
M/S/N=0/2/1
```

The confirmed structural finding was re-opened against the current source. `InventoryCopyService` had retained a second,
unreachable target-page query/validator chain at its old copied location even though `InventoryTargetService` was the actual
owner of `readTargets`; the current source search found no caller for that chain. The same mechanical extraction had left
private record declarations with no source references in the target classes. The duplicate query chain, its private helpers,
and the now-unreferenced copied record declarations were removed. The pure `requireCatalogBusinessName` validation used by
the copy display projection was reintroduced in `InventoryCopyService`, where its callers remain, and no behavior was
rewritten.

The non-blocking transaction-test finding was also re-opened. `CatalogInventoryReadTransactionTopologyTest` now resolves the
`TransactionAttribute` and asserts `PROPAGATION_REQUIRED` instead of checking annotation presence alone. It also adds a
narrow proxy test that calls the actual `InventoryReadRouter` target through the same annotation transaction interceptor
and asserts an active transaction at the target invocation. This test remains a topology/transaction proof, not a
replacement for remote business behavior.

Post-repair compile proof:

```text
./gradlew :apps:backend:catering-business-server:modules:inventory:compileJava \
  :apps:backend:catering-business-server:modules:inventory:compileTestJava \
  :apps:backend:catering-business-server:compileTestJava --no-daemon
BUILD SUCCESSFUL
```

The current source scan reports no remaining duplicate target-page query or `validateTargetPageQuery` declaration in
`InventoryCopyService`, no target-to-facade reference, and no remaining `CatalogVoidInboundKey` or
`VoidDependencyAccumulator` declaration/reference in the non-lifecycle targets. `BomOwnerRow` remains only in
`InventoryCopyService` because its 21 non-declaration references and constructor call are part of the live copy closure;
the same type is absent from `InventoryAvailabilityService`, `InventoryTargetService` and `InventoryBomService`. The
only `CatalogVoidInboundKey` and `VoidDependencyAccumulator` declarations retained outside that copy closure are in
`InventoryCatalogLifecycleService`, where `new VoidDependencyAccumulator` and its readback path are reachable from
catalog retirement. No `BomOwnerRow` declaration remains in that lifecycle service. The next step review must inspect
this repaired byte set; the first review cannot be reused as a match.

## 10. Current recheck boundary

`CP-3_REPAIR_STATUS=TARGET_RESIDUALS_REMOVED_TRANSACTION_TEST_STRENGTHENED`

`CP-3_REMOTE_BEHAVIOR=REMOTE_FOCUSED_TESTS_PASS_FULL_BUSINESS_ACCEPTANCE_OPEN`

`CP-3_STEP_REVIEW=FRESH_INDEPENDENT_MATCHED`

The current remote focused test run is recorded below. No full backend acceptance, DEV, reset or seed claim is made by
this update.

## 11. Second independent review finding re-opened and repaired

The fresh Bohr CP-3 recheck identified one remaining dead-code family in the non-lifecycle target services:
`CatalogVoidInboundKey`, `VoidDependencyAccumulator` and `BomOwnerRow` declarations had survived mechanical extraction.
The finding was re-opened against current bytes rather than accepted from the report. A call/instantiation scan showed:

- `InventoryAvailabilityService`, `InventoryTargetService` and `InventoryBomService` had no callers, constructors or
  projections for any of the three clusters; all three clusters were removed.
- `InventoryCopyService` had no `CatalogVoidInboundKey` or `VoidDependencyAccumulator` caller and those two clusters
  were removed, but `BomOwnerRow` is live: it is constructed by `loadBomOwnersByItemRefs` and consumed by the source
  copy closure, BOM rewriting and copy readback projections. It was retained.
- `InventoryCatalogLifecycleService` still constructs `VoidDependencyAccumulator` at line 705 and uses
  `CatalogVoidInboundKey` in its inbound dependency readback; those are lifecycle-owned and were not removed. Its
  former unreferenced `BomOwnerRow` declaration was removed.

The targeted source scan after repair therefore has no residual dead cluster in the non-lifecycle targets, while retaining
the live copy and lifecycle paths. Compile proof was rerun successfully after the repair. A new fresh independent CP-3
step review returned `STEP_REVIEW=MATCHED` with `M/S/N=0/0/1`; its only N is the already explicit absence of current
remote business evidence. This closes the static step review only and does not claim remote business proof.

## 12. Managed remote focused test proof

After the structural step review matched and after the final Lifecycle cleanup, the approved wrapper
`node scripts/test/catalog-inventory-backend-unit.mjs` completed with `status=PASS` and
`firstFailure=null`:

| phase | runId | task | test execution | cleanup |
| --- | --- | --- | --- | --- |
| Catalog owner module | `r5-tc-1789168713290-13846` | `:apps:backend:catering-business-server:modules:catalog:test` | `PASS` (`remoteGradleStatus=0`) | `PASS`：remoteProcess、remoteWorkspace、Testcontainers containers/volumes 均 PASS |
| Inventory owner module | `r5-tc-1789168886272-16792` | `:apps:backend:catering-business-server:modules:inventory:test` | `PASS` (`remoteGradleStatus=0`) | `PASS`：remoteProcess、remoteWorkspace、Testcontainers containers/volumes 均 PASS |
| Application focused tests | `r5-tc-1789168959925-18104` | `:apps:backend:catering-business-server:test` with the two approved application test selectors | `PASS` (`remoteGradleStatus=0`) | `PASS`：remoteProcess、remoteWorkspace、Testcontainers containers/volumes 均 PASS |

The wrapper report is `.runtime/r5/results/catalog-inventory-backend-unit-tests.json` with
`business=PASS` for this focused test gate and `cleanup=DELEGATED_TO_MANAGED_RUN_MANIFESTS`; each referenced manifest
was independently read and has `status=PASS`, `testExecution.status=PASS`, `cleanup.status=PASS`, and
`devLifecycle.wasRunning=false`. The module/application run manifests set `backendAcceptance=null` and
`business=NOT_APPLICABLE`, so this evidence is a managed focused test/compile proof, not a full HTTP backend-acceptance
business verdict. Full backend acceptance remains open for the overall implementation closeout.
