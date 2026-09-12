# Backend 可读性整改 · CP-2 Catalog 行为钉住记录

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=IMPLEMENTATION
CP=CP-2
OWNER=CATALOG
STRUCTURE_MOVE=CATALOG_TARGETS_PRESENT_FACADE_CLEANED
BEHAVIOR_PIN=FOCUSED_PARTIAL
CURRENT_STATUS=STEP_REVIEW_MATCHED_AFTER_TARGET_CLEANUP
BUSINESS_MODE=HISTORICAL_FOCUSED_REAL_CURRENT_REMOTE_NOT_RUN
```

## 1. 写入前双读与边界

本记录写入前重新读取：

- `doc/plans/platform/2026-09-11-v2s-backend-readability-requirements-claude.md`；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-design-codex.md` 的 Catalog family、事务与测试段；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-plan-codex.md` 的 CP-1、CP-2、CP-7 与固定双读段；
- `doc/platform/backend-coding-standard.md` §2.5 的 `R-READ-01`、`R-READ-03`、`R-READ-05`、`R-READ-06`、`R-READ-07`、`R-READ-08`；
- 六维 memory 命中的 `operations.backend-readability-refactor` 与 `operations.implementation-source-reread-discipline`；
- `CatalogOwnerService`、`CatalogAcceptanceScenarios`、`P2ReadConnectionScopeScenarios` 及临时转正 operation source。

本记录证明结构移动前的业务证据，并持续记录 Catalog 各 target family 的当前结构边界。当前源码已经包含
definition、category、dictionary、item、copy 与 workbench target；文档中的早期 family 进度段只保留为历史过程证据，不能当作当前源码清单。
任何 focused run 都不能替代 CP-1 的完整风险维度闭合、当前结构边界的 fresh step review 或最终全量 acceptance。

## 2. 已完成的 focused business proof

以下 run 均通过受管 remote Testcontainers backend 入口执行，并已读取真实输出；每个 run 的
`CONTRACT`、`BUSINESS` 与资源 `cleanup` 均为 PASS。`DB_OPERATIONS` 仅作信息性结果，不作为业务 oracle。

| run | operation | 业务覆盖 | 结果 |
| --- | --- | --- | --- |
| `r5-tc-1789137686332-33682` | `createOperationsCatalogItem` | `catalog.item-create-draft-category` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789137795267-34802` | `saveOperationsCatalogItem` | 7 个 item、inventory、option、unit 语义场景 | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789137937238-35973` | `batchTransitionOperationsCatalogItemStatus` | `catalog.batch-status-partial-outcome`，部分结果与 readback | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789138420663-37753` | `transitionOperationsCatalogCategoryStatus` | `catalog.category-relation-integrity` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789138540474-38889` | `updateOperationsCatalogDictionaryEntry` | `catalog.dictionary-rename-and-void` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789138651025-39983` | `executeOperationsLocalCatalogCopy` | `catalog.local-copy-section-outcomes` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789138757970-41132` | `executeOperationsBrandCatalogCopy` | `catalog.copy-definition-semantic-conflicts` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789138874176-42313` | `releaseOperationsCatalogStagedAsset` | `catalog.asset-ref-scope-isolation` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789139043392-43601` | `getOperationsCatalogCategoryCandidates` | `catalog.category-candidate-hierarchy` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789139158102-44809` | `getOperationsCatalogDictionary` | `pagination.catalog-dictionary-real-cursor` | CONTRACT/BUSINESS/cleanup PASS |
| `r5-tc-1789139976443-53509` | `executeOperationsTemporaryCatalogItemPromotion` | `catalog.temporary-promotion-readback` | CONTRACT/BUSINESS/cleanup PASS; BUSINESS_MODE=REAL |
| `r5-tc-1789141766432-95075` | `transitionOperationsCatalogCategoryStatus` | `catalog.category-relation-integrity` | CONTRACT/BUSINESS/cleanup PASS; BUSINESS_MODE=REAL |
| `r5-tc-1789143288959-16690` | `transitionOperationsCatalogCategoryStatus` | `catalog.category-relation-integrity`，含 token 错配拒绝且不写入测试 | CONTRACT/BUSINESS/cleanup PASS; BUSINESS_MODE=REAL |
| `r5-tc-1789144967007-46801` | `pagination.catalog-dictionary-real-cursor` | dictionary real cursor readback | CONTRACT/BUSINESS/cleanup PASS; BUSINESS_MODE=REAL; DB_OPERATIONS=9 信息性 |
| `r5-tc-1789145044923-48270` | `updateOperationsCatalogDictionaryEntry` | dictionary rename/void 与权威读回 | CONTRACT/BUSINESS/cleanup PASS; BUSINESS_MODE=REAL; DB_OPERATIONS=15 信息性 |

这些结果对下列风险维度提供当前证据：scope 与 task-read shape、item/SKU/option/unit owner readback、category
关系与层级失败、dictionary 顺序与状态、inventory owner dependency、copy preflight/compatibility/readback、
asset reference scope、batch partial outcome。它们仍是 focused proof，不是对所有 Catalog public family 的覆盖声明。

## 3. 风险维度对账

| Catalog family | 当前证据 | 状态 | 仍需证明/注意 |
| --- | --- | --- | --- |
| definition attribute/unit/order-option | attribute、unit、option 的 acceptance 场景存在并已在 `saveOperationsCatalogItem` 或 definition operation focused run 中读回 owner facts | PARTIALLY_CONFIRMED | 须在结构移动前按 family 回读 CAS/status、scope、typed problem 与 readback；不能只凭场景名汇总 |
| category | category relation、hierarchy candidate 与 status path 有真实正反业务断言 | CONFIRMED_FOR_CURRENT_PROOF | 结构移动后仍需 fresh step review 验证 lock/order/CAS 位置未漂移 |
| dictionary | rename/void 与 real cursor 有真实 readback | CONFIRMED_FOR_CURRENT_PROOF | reorder/entry status 的每个 overload 仍按方法族检查 |
| item/SKU/status | item create/save、SKU identity/removal、batch partial outcome 已有真实断言 | PARTIALLY_CONFIRMED | batch 的逐 item `REQUIRES_NEW`、已知失败与未知失败 rollback、锁顺序需逐点复核 |
| temporary promotion | 已新增并注册 `catalog.temporary-promotion-readback`；真实 HTTP preflight/execute 与 formal/source owner readback 均通过 | CONFIRMED_FOR_CURRENT_PROOF | 结构移动后仍需 fresh step review 验证 receipt、版本绑定与 owner readback 顺序未漂移 |
| local/brand copy | local section outcomes、brand semantic conflict、copy preflight/execute 读回已通过 | PARTIALLY_CONFIRMED | replay/conflict、CAS、target facts 与跨 owner command 顺序需在结构前逐 family 复核 |
| reference/asset read | asset scope isolation 与 item/SKU asset readback 证据存在 | PARTIALLY_CONFIRMED | global reference union、production tag/reference negative path 需保留当前 owner 语义 |
| workbench/task-read | workbench/category/dictionary/SKU/candidate focused read 已通过 | PARTIALLY_CONFIRMED | 不得由 `CatalogWorkbenchReadService` 反向调用 facade 形成环；read transaction/readback 需结构后再核 |

## 4. temporary-promotion 缺口关闭记录

此前缺口与当前关闭事实：

1. `P2ReadConnectionScopeScenarios` 的 `catalogInventory` 方法仍是 calibration recipe，类注释仍明确它不是
   business scenario catalog 的注册项；它没有被当作本次关闭证据。
2. `CatalogAcceptanceScenarios` 新增的 `catalog.temporary-promotion-readback` 已被当前 catalog
   scenario catalog 发现，并由 run `r5-tc-1789139976443-53509` 选中执行。
3. 该场景使用真实 temporary fixture、preflight request、stale digest 的 typed negative execute、正式商品 owner
   readback 与源商品 identity readback。`backend-acceptance-result.jsonl.gz` artifact 证明 `CONTRACT=PASS`、
   `BUSINESS=PASS`、`businessMode=REAL` 与 `HAND_WRITTEN_BUSINESS_ORACLE`；run manifest 证明选中 operation、run
   business 状态与 cleanup PASS。信息性 `DB_OPERATIONS=20` 未被当作业务 oracle；`REAL_BUSINESS_ASSERTIONS` 不是
   run manifest 字段。

最小处理已完成：没有新增 HTTP operation、测试文件拓扑或基类。结构移动前仍需按 CP-2 事务矩阵逐项复核
receipt replay/conflict、版本边界、锁与跨 owner 调用顺序；本次场景只关闭了 temporary-promotion 的真实业务钉住，
不能单独证明结构移动后的语义。

## 5. 结构移动前禁止事项

- 不得因为当前 focused 结果为绿就继续移动尚未完成的 `CatalogOwnerService` family；
- 不得把 `P2ReadConnectionScopeScenarios` 的 calibration 产物冒充全量 business acceptance；
- 不得以 method/class token、异常类型、状态码、数据库操作数或旧 run 关闭 transaction、receipt、lock、CAS、rollback 与 readback 缺口；
- 不得改变 `CatalogInventoryCoordinator` 的跨 owner coordinator 边界，不得在新 service 中直接写 Inventory/ProductionTag/Asset owner 事实；
- 不得在本 CP 顺手修改 contract、generated、migration、frontend、L2 spec 或测试文件拓扑。

## 6. 状态

`CP-2_STATUS=CATALOG_TARGETS_PRESENT_STATIC_RECHECK_OPEN`

`NEXT_GATE=FRESH_CP2_STEP_REVIEW_AFTER_TARGET_CLEANUP`

## 7. Structure-move process note and first compile proof

The first definition-family target classes were written before the final CP-2 provenance recheck had returned. This is a
process-order deviation from the intended `NEXT_GATE`; it is recorded rather than hidden. No claim is made that CP-2
structure is complete, and no additional Catalog family is moved until the fresh recheck closes this boundary.

The first post-move focused run `r5-tc-1789140563774-68327` failed at remote Catalog compilation because the facade had
two constructors with the same effective signature. The failure was a structural compile failure, not a business result;
the managed containers and volumes cleaned up PASS. The duplicate constructor was removed. The re-run
`r5-tc-1789140625226-71728` compiled the Catalog and full deployable, selected
`createOperationsCatalogAttributeDefinition`, and produced `CONTRACT=PASS`, `BUSINESS=PASS`,
`businessMode=REAL`, `HAND_WRITTEN_BUSINESS_ORACLE`; its run manifest reports business and all cleanup dimensions PASS.
This focused result only proves the moved attribute-definition path for that input; it does not close CP-2 structure or
the remaining Catalog families.

## 8. Category-family structure proof

`CatalogCategoryService` now owns the category-definition, hierarchy-lock, generic and typed update/move, status
transition, receipt, CAS and authoritative category readback paths. `CatalogOwnerService` keeps the existing public owner
facade and forwards the four typed category commands. `CatalogCommandRouter` is the generic operation-id protocol boundary:
it routes the four category operation IDs to `CatalogCategoryService` while retaining the legacy facade dispatcher for
other Catalog families. Category-specific generic write/precheck/receipt helpers have been removed from the facade; the
facade still retains only category coordination helpers required by item creation and copy. No claim is made that the
facade is already a pure forwarder for every Catalog operation.

The first category focused attempt `r5-tc-1789141655739-92933` selected a non-existent acceptance operation and failed at
the test-factory discovery assertion (`BACKEND_ACCEPTANCE_OPERATION_NOT_DISCOVERED`). Remote compilation and resource
cleanup were PASS, but business was NOT_RUN. The operation was corrected from the route-like create name to the actual
registered scenario operation `transitionOperationsCatalogCategoryStatus`, confirmed by the annotation in
`CatalogAcceptanceScenarios`, and was not counted as business evidence.

The corrected run `r5-tc-1789141766432-95075` compiled the Catalog module and full deployable on the remote host, selected
`catalog.category-relation-integrity`, and reported `CONTRACT=PASS`, `BUSINESS=PASS`, `businessMode=REAL`, and a real
hand-written business oracle. Its run manifest reports `business=PASS`, remote Testcontainers/container/volume/workspace
cleanup PASS, and no first failure. The subsequent run `r5-tc-1789143288959-16690` occurred after the router and negative
test changes, again compiled the Catalog module and full deployable, selected the same real scenario, and reported
`CONTRACT=PASS`, `BUSINESS=PASS`, `businessMode=REAL`, with container/volume/workspace cleanup PASS. The source-level
integration test in that run invokes `createCategory` with an `updateOperationsCatalogCategory` token, proves typed
`SCOPE_FORBIDDEN`/403, and reads back zero inserted rows. These runs prove the current category relation/status behavior and
the exact-token negative path for the covered inputs; they do not yet prove every Catalog overload or close the independent
structure-boundary review.

## 9. Dictionary-family focused proof

`CatalogDictionaryService` now owns the dictionary read cursor, create/update/reorder/transition commands, receipt replay,
version/generation recheck, parent/reference validation and authoritative readback paths. `CatalogOwnerService` retains the
public owner facade and forwards the typed dictionary methods; generic dictionary operation IDs are routed by
`CatalogCommandRouter`. The facade no longer retains the dictionary-only command, receipt, CAS and read helper family. Pure
dictionary projection types still used by Catalog copy flows remain in the facade because they are value/projection support,
not dictionary owner mutation facts.

The current structure was compiled and exercised by `r5-tc-1789144706300-42366`, which ran the Catalog module test task
after the dictionary target and router changes: remote `compileJava`, `compileTestJava`, `testClasses` and `test` all
completed with `REMOTE_GRADLE_STATUS=0`; container, volume and workspace cleanup were PASS. This is structural/module
evidence only and reports `BUSINESS=NOT_APPLICABLE`.

The focused acceptance run `r5-tc-1789144967007-46801` selected `pagination.catalog-dictionary-real-cursor` and reported
`CONTRACT=PASS`, `BUSINESS=PASS`, `businessMode=REAL`, `HAND_WRITTEN_BUSINESS_ORACLE`, and information-only
`DB_OPERATIONS=9`; remote Testcontainers cleanup was PASS. The focused acceptance run
`r5-tc-1789145044923-48270` selected `catalog.dictionary-rename-and-void` and reported
`CONTRACT=PASS`, `BUSINESS=PASS`, `businessMode=REAL`, `HAND_WRITTEN_BUSINESS_ORACLE`, and information-only
`DB_OPERATIONS=15`; remote Testcontainers cleanup was PASS. These runs provide current read/write dictionary proof but do
not close the dictionary overload matrix, all CP-2 transaction self-call risks, or the CP-2 structure-boundary review.

## 10. Fresh independent CP-2 boundary recheck

```text
STEP_REVIEW_ID=STEP_CP2_CURRENT_STRUCTURE_BOUNDARY_RECHECK_3
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=STEP_RECHECK_3_NOT_FORMAL_BATCH_REVIEW_ROUND
reviewerKind=INDEPENDENT_SUBAGENT
STEP_RESULT=MATCHED
M/S/N=0/0/0
```

The independent reviewer initially reported one M concern: typed category update/move always use an empty string as the
receipt key when the caller supplies no idempotency key. A direct comparison against the pre-split `HEAD` source rejected
that as a CP-2 regression. Before the split, `CatalogOwnerService.updateCategory` and `moveCategory` already called the
same typed implementations, which already normalized a null key to `""`, queried the receipt, and inserted the receipt.
The current target preserves those method bodies and their `@Transactional` entry points; the facade only forwards. The
finding is therefore `REJECTED_WITH_EVIDENCE`, not a reason to expand this readability change into a behavior fix.

The recheck also verified that the category generic operation set is closed and routed by `CatalogCommandRouter`, that
non-category operations retain the legacy facade supplier, that `CatalogOwnerScopeSupport` performs exact operation-token
matching, and that dictionary, temporary-promotion, item, and copy families remain present in the facade until their own
CP-2 moves. `STEP_RESULT=MATCHED` allows the next Catalog family to start; CP-2 as a whole remains open.

## 11. Fresh independent dictionary-family boundary recheck

```text
STEP_REVIEW_ID=STEP_CP2_DICTIONARY_STRUCTURE_BOUNDARY_RECHECK_1
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=STEP_RECHECK_NOT_FORMAL_BATCH_REVIEW_ROUND
reviewerKind=INDEPENDENT_SUBAGENT
STEP_RESULT=MATCHED
M/S/N=0/0/0
```

Fresh reviewer `McClintock` found no item-level `OPEN`. The review re-read the current requirements, implementation design
and plan, backend readability rules, current facade/router/target source, pre-split source and current focused artifacts.
It verified that the facade retains the public API/FQCN surface, `CatalogCommandRouter` keeps the dictionary operation set
closed and exact-token routed, the target preserves dictionary read/write/receipt/CAS/lock/readback structure, and copy
flows retain only the pure dictionary projections they still consume. It also verified that module-test evidence is
reported as `BUSINESS=NOT_APPLICABLE` and the two dictionary focused acceptance runs remain focused evidence rather than
full CP-2 or full backend acceptance.

The reviewer explicitly noted that it did not rerun commands and therefore did not upgrade any current artifact beyond its
recorded evidence tier. With no `OPEN`, the dictionary family boundary is eligible to proceed; CP-2 remains open until the
remaining Catalog families and the final CP-2 whole-scope reconciliation are complete.

## 12. Current-byte recheck after target cleanup

The previous sections are historical family checkpoints. The current source was re-read after the later item/copy/workbench
facade cleanup and the fresh step review findings. The current static shape is:

| source | current fact |
| --- | --- |
| `CatalogOwnerService.java` | 841 lines; public owner API methods forward to target services/router; pure compatibility entry points delegate to `CatalogOwnerValueSupport` |
| `CatalogOwnerValueSupport.java` | 185 lines; package-private, pure value transformations only; no JDBC, transaction, lock, receipt or owner command |
| `CatalogItemService.java` | 6625 lines; item/SKU/reference/status/promotion owner; no sibling target service construction |
| `CatalogCopyService.java` | 4663 lines; copy candidate/preflight/prepare/execute owner; no sibling target service construction |
| `CatalogWorkbenchReadService.java` | 2410 lines; workbench/task-read projection owner; no sibling target service construction |

The recheck commands found no `CatalogOwnerService.` reference in Catalog target services and no remaining
`CatalogAttributeDefinitionService`, `CatalogUnitDefinitionService`, `CatalogOrderOptionDefinitionService`,
`CatalogCategoryService`, `CatalogDictionaryService` or `CatalogCommandRouter` field/instance construction in the item,
copy or workbench targets. The facade has no `@Transactional`, `TransactionTemplate`, `jdbc.` call, SQL implementation or
legacy `executeWrite`; its `JdbcTemplate` occurrence is limited to the preserved compatibility constructor parameter.

The fresh reviewer findings were handled as follows:

1. The stale progress header and status text was corrected by this section and the metadata at the top of this record. The
   old category/dictionary step results remain explicitly historical and are not reused as current whole-CP proof.
2. Unused sibling target fields and direct instances were removed from item, copy and workbench. Catalog compile,
   test-compile and test-classes were then rerun and completed `BUILD SUCCESSFUL`.
3. The pure helper reverse dependency was removed. `CatalogDictionaryService` now uses
   `CatalogOwnerValueSupport.dictionaryObjectType`; the facade's existing package-private compatibility method and copy
   target delegate to the same support implementation. The remaining target-local `firstText` helper is retained only
   because copy-specific logic still uses it, not as a second implementation of the SKU fingerprint support.

Additional local proofs after the repair:

- `node scripts/test/catalog-inventory-backend-unit.mjs --self-test`: `PASS`;
- `node --test scripts/test/r5-remote-testcontainers.test.mjs`: 18 tests passed;
- `./gradlew :apps:backend:catering-business-server:modules:catalog:compileJava :apps:backend:catering-business-server:modules:catalog:compileTestJava :apps:backend:catering-business-server:modules:catalog:testClasses --no-daemon`: `BUILD SUCCESSFUL`.

These are static/runner/compile proofs only. The current remote Testcontainers evidence remains open and is not upgraded:

- `r5-tc-1789157404998-52304`: remote Gradle output reached `BUILD SUCCESSFUL`, then artifact collection timed out; manifest
  has `testExecution.status=NOT_RUN`, `business=NOT_APPLICABLE`, and cleanup `FAIL`.
- `r5-tc-1789158523680-72762`: `REMOTE_RUNNER_UNAVAILABLE` (`Can't assign requested address`/broken pipe); manifest has
  `testExecution.status=NOT_RUN`, `business=NOT_APPLICABLE`, artifact collection `FAIL`, and cleanup `FAIL`.
- The second run's exact runner-owned remote root was later removed after a guarded existence/path precheck. The recovery
  result is `RECOVERY_CLEANUP=PASS`; it is cleanup hygiene only and does not rewrite either original manifest or create
  business evidence. The remote host had zero Testcontainers containers and zero labeled volumes before and after recovery.

Therefore the current CP-2 state is `STATIC_STRUCTURE_REPAIRED`, `REMOTE_DYNAMIC_EVIDENCE=OPEN`,
`STEP_REVIEW=MATCHED` with fresh reviewer Dalton reporting `M/S/N=0/0/0`. No current remote run is represented as a
business PASS, and CP-2 whole-scope completion remains open until a later authorized managed run binds evidence to the
final source bytes.

## 13. Fresh independent step review after target cleanup

```text
STEP_REVIEW_ID=STEP_CP2_CURRENT_STRUCTURE_BOUNDARY_RECHECK_4
REVIEW_TARGET=IMPLEMENTATION_STEP
reviewerKind=INDEPENDENT_SUBAGENT
STEP_REVIEW=MATCHED
M/S/N=0/0/0
```

Fresh reviewer Dalton re-read the current Catalog source, this record, the implementation design/plan and the applicable
readability constraints. It verified that the facade public API and package-visible compatibility surface remain intact,
the value support has no owner/transaction/JDBC behavior, the moved targets do not construct unused sibling beans or
reference the facade, and the router operation set remains closed. It separately retained both latest remote Testcontainers
attempts as `NOT_RUN`/`BUSINESS=NOT_APPLICABLE` with cleanup failure in their original manifests; no dynamic business claim
was upgraded. This closes the current CP-2 structure-boundary step only; it does not close CP-2 whole-scope behavior or
permit final acceptance/reset/DEV/seed.
