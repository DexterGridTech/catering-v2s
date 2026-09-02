# Sales-menu implementation evidence (Codex)

This is an append-only implementation evidence record. It distinguishes source/static proof from managed dynamic proof; an unexecuted dynamic lane is not reported as PASS.

## SM-01 / contract and generated binding foundation

Status at 2026-09-01: static source work is complete pending the fresh independent stage reconciliation.

Fresh source and generated checks:

```text
node tools/sales-menu-schema/cli.mjs --self-test
SALES_MENU_SCHEMA_SELF_TEST=PASS

scripts/check/sales-menu-schema
SALES_MENU_SCHEMA=PASS
OWNER_TABLES=14
ASSET_TARGET=PASS

node tools/sales-menu-contract/cli.mjs --self-test
SALES_MENU_CONTRACT_SELF_TEST=PASS

scripts/check/sales-menu-contract
SALES_MENU_CONTRACT=PASS
AFFECTED_OPERATIONS=31
SALES_MENU_OPERATIONS=30
SALES_MENU_COMMANDS=19

scripts/check/operation-handler-bindings
BP_U02_BINDING_CHECK=PASS
RUNTIME_INTEGRATION=IMPLEMENTED_BP_U06
CONTEXT_KIND_NEGATIVE=PASS
JSON_FILES=15
JAVA_FILES=15
FILES=30

node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --check
OPERATION_COMMAND_BINDINGS=VALIDATED
ROWS=105
EMITTED=105

V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION node scripts/generate/edge-codegen.mjs --check
R5_EDGE_CODEGEN_CHECK=PASS
FILES=359

./gradlew :apps:backend:catering-business-server:modules:sales-menu:compileJava --no-daemon
BUILD SUCCESSFUL

./gradlew :apps:backend:catering-business-server:modules:sales-menu:spotlessJavaCheck --no-daemon
BUILD SUCCESSFUL

scripts/check/module-dependency-registry
MODULE_DEPENDENCY_REGISTRY=PASS; PATH=contracts/policy/module-dependency-registry.json
```

The normal edge-codegen check was intentionally run before any claim of final verification and preserved its first failure:

```text
node scripts/generate/edge-codegen.mjs --check
exit=1
BUDGET_PROJECTION_OPERATION_MISSING: BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus
```

This is the existing CP05 calibration projection not yet refreshed by the authorized implementation/acceptance path. Calibration mode is only a bootstrap proof and does not close the normal projection. No generated file was hand-edited to suppress this failure.

The first full static verify attempt after generated binding emission was also retained:

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION scripts/verify --validate-only
exit=1
R5_VERIFY_STATIC_FIRST_FAILURE:backend-archunit
compileJava: generated BackendPerformanceM1CommandExecutionBindings.java imports
com.catering.v2s.salesmenu.application.operations.* before the SM-03 operation adapters exist
```

This is an incomplete-stage boundary failure, not a generated-file workaround candidate. The adapter classes
remain an SM-03 owning-source task; full verify will be rerun after that stage is complete and before any test
execution.

The adapter package drift found while rereading the current bytes was repaired at the owning generators. The current generated identity is `com.catering.v2s.salesmenu...`; the stale `com.catering.v2s.sales.menu...` form is not retained.

Fresh independent SM-01 reconciliation (Fermat, `reviewerKind=INDEPENDENT_SUBAGENT`, read-only) was run after the
source/static probes above. It deliberately did not run Docker, Testcontainers, DEV, or seed. Result:
`SM-01_STEP_RECONCILIATION=OPEN`, `MATCHED=13`, `OPEN=3`.

The three falsifiable OPEN rows and their current root-fix boundary are:

1. App composition wiring is not closed: generated
   `BackendPerformanceM1CommandExecutionBindings.java` imports `SalesMenuCommandApi`,
   `SalesMenuAssetCommandApi`, and 19 `com.catering.v2s.salesmenu.application.operations.*` classes that were
   absent. The owning fix is real typed APIs/adapters in the sales-menu source package; generated files must remain
   generator-owned.
2. Normal edge-codegen remains blocked by the stale CP05 projection at
   `BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus`. The owning fix is an authorized current-tree
   calibration/acceptance refresh; no static report edit or normal PASS claim is valid.
3. The current exact-source checks prove the active operation set, but no non-Git prior accepted baseline is
   available to falsify “unaffected operation bindings/denominators unchanged”. This remains a proof gap until a
   repository-native baseline comparison is available; it is not closed by the current generated exactness checks.

This artifact is an intermediate record, not a stage PASS. The stage cannot advance until the first two root
boundaries are repaired and a brand-new independent reconciliation reruns the three-dimensional comparison.

## SM-02 / owner schema foundation

The forward-only migration creates 14 `sales_menu` owner tables and one platform-asset target table. Static schema checks currently prove:

- activation uniqueness is `(collection_ref, channel_ref)`, so one channel can have multiple menu activations;
- source-draft and publication-version references include `collection_ref`, preventing cross-menu version composition;
- the old unique `(collection_ref, catalog_item_ref)` rule is absent, so repeated catalog items can become distinct stable sales-item references;
- published-version, published-child, publication append-only, and stable-item-binding triggers are present;
- sales-menu migration has no foreign key into organization, business-channel, catalog, or inventory schemas;
- the platform asset usage check includes `SALES_MENU_ITEM_IMAGE` and the target relation remains asset-owned.

Current-byte conflict recorded: the detailed-design ordering table requested `DEFERRABLE INITIALLY DEFERRED`,
but the repository's active `database-boundaries` gate rejects `DEFERRABLE` in every migration. The migration
therefore keeps immediate unique constraints. Any section/item/SKU/media move must perform its owner-transaction
lock and a two-step temporary-unused-order update before the final swap; it must not rely on deferred uniqueness.
This is an implementation constraint from the current repository standard, not a new product semantic, and the
original design wording is retained as the source conflict rather than silently treated as satisfied.

The migration integration test source is being added in the SM-02 write set and has not yet been dynamically executed. Until its managed Testcontainers run passes with cleanup, this section is static-only.

Subsequent SM-01 root-fix evidence:

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION scripts/verify --validate-only
R4_LOGGING_BOUNDARIES=PASS
R4_DATABASE_BOUNDARIES=PASS
R4_BACKEND_BOUNDARIES=PASS
R5_FRONTEND_ARCHITECTURE=PASS
R5_OPENAPI_CONTRACTS=PASS
R4_UI_WIREFRAME_TRACEABILITY=PASS
R4_BUSINESS_TERMINOLOGY_TRACEABILITY=PASS
CODE_LAYOUT=PASS
SALES_MENU_CONTRACT=PASS
SALES_MENU_SCHEMA=PASS
BUILD SUCCESSFUL
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

The first post-refactor verify failure was `R4_DATABASE_UNTYPED_ROW_OR_COMMAND` on the sales-menu owner because
its repository exposed `Map<String,Object>` rows. The owning root fix converted that seam to typed
`RowMapper<T>`/owner-local records; the rerun above proves the database boundary and all 18 static verify checks.
The service source still has narrow `catch (Exception)` blocks only around Jackson serialization/deserialization,
where the exception is converted to a typed sales-menu problem; no broad business-operation catch/fallback was
introduced.

The normal (non-calibration) edge-codegen check remains intentionally unclosed and its first failure is retained:

```text
node scripts/generate/edge-codegen.mjs --check
exit=1
R4_OPENAPI_GENERATED_DRIFT
BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus
```

This is the current CP05 projection denominator, which must be refreshed only through the authorized
implementation/managed acceptance path. The calibration verify PASS is not a substitute for that normal
projection refresh.

After Halley's source-first disposition, the confirmed publication-preview conflict was repaired at the owner
source. The post-repair focused/static proof was fresh:

```text
node tools/sales-menu-contract/cli.mjs --self-test
SALES_MENU_CONTRACT_SELF_TEST=PASS
node tools/sales-menu-schema/cli.mjs --self-test
SALES_MENU_SCHEMA_SELF_TEST=PASS
scripts/check/operation-handler-bindings
BP_U02_BINDING_CHECK=PASS
node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --check
OPERATION_COMMAND_BINDINGS=VALIDATED
./gradlew --no-daemon :apps:backend:catering-business-server:modules:sales-menu:compileJava :apps:backend:catering-business-server:modules:sales-menu:spotlessJavaCheck
BUILD SUCCESSFUL
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION scripts/verify --validate-only
R4_LOGGING_BOUNDARIES=PASS
R4_DATABASE_BOUNDARIES=PASS
R4_BACKEND_BOUNDARIES=PASS
R5_FRONTEND_ARCHITECTURE=PASS
R5_OPENAPI_CONTRACTS=PASS
R4_UI_WIREFRAME_TRACEABILITY=PASS
R4_BUSINESS_TERMINOLOGY_TRACEABILITY=PASS
CODE_LAYOUT=PASS
SALES_MENU_CONTRACT=PASS
SALES_MENU_SCHEMA=PASS
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

The normal edge-codegen command was not relabeled by this rerun; its retained first failure is still
`BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus` as recorded above.

## SM-01 reconciliation amendment B · Hegel fresh recheck

Hegel was a second fresh read-only independent reviewer after the activation-preview root fix and the
post-fix static/compile proof. It declared `reviewerKind=INDEPENDENT_SUBAGENT`, a blind-review declaration,
and `REVIEW_TARGET=IMPLEMENTATION_STEP_SM-01`; it did not run dynamic infrastructure. It independently found
all applicable SM-01 source/contract/admin/auth/generator dimensions `MATCHED`, including the 31/30/19
denominators, generated READ/COMMAND boundary, admin page/action, IAM and calibration generated outputs.

Its only stage-level OPEN was the normal CP-05 projection missing `getOperationsSalesMenus`. Source-first
reconciliation confirmed this is a real current-byte failure, but also confirmed it cannot be legally repaired
at SM-01: `project-memory/decisions/http-crud-efficiency-design-redlines.md` and the active CP-05 implementation
source require measured current-tree HTTP completion evidence before a budget projection is activated; the
current report is a 238-operation artifact while the active source denominator is 268. Adding a placeholder
row, raising a value, bypassing the normal check, or editing generated output would violate that source.

The minimum process repair is recorded in the plan's new §1a: retain this first failure as
`OPEN_GLOBAL_PREREQUISITE`, use the permitted calibration verify for SM-01, keep SM-02→SM-05 serial, and close
CP-05 only after the authorized real HTTP exact-set measurement. This does not weaken the “no OPEN stage
mismatch” rule: Hegel's three-dimensional SM-01 design rows are all `MATCHED`; the CP-05 item is a separately
named cross-stage prerequisite that remains blocking for overall test/SM-12 closure.

```text
SM-01_STEP_RECONCILIATION=STAGE_MATCHED_WITH_GLOBAL_CP05_PREREQUISITE
MATCHED=11 applicable dimensions
OPEN=0 SM-01 design/source dimensions
OPEN_GLOBAL_PREREQUISITE=CP05 normal projection for current 268-operation exact set
DYNAMIC=NOT_RUN_BY_STAGE_BOUNDARY
```

## Independent stage reconciliations

| stage | reviewer artifact | status | dynamic boundary |
| --- | --- | --- | --- |
| SM-01 | Fermat fresh independent reconciliation; three OPEN rows recorded above | OPEN | no dynamic execution required for stage closure, but normal CP05 projection is still a separately retained prerequisite |
| SM-02 | pending fresh independent reconciliation | OPEN | migration Testcontainers execution pending |

Each stage must be changed to `MATCHED` only after a fresh read-only reviewer has compared requirements, detailed design + IA, and project-memory standards across the applicable dimensions. An `OPEN` row requires root repair and a new fresh recheck before the next stage.

## SM-02 source/generation/focused proof amendment · fixed pagination and ordering repair

The SM-02 repair lane was completed before the independent stage recheck. The fixed collection boundary is now
one source value: `SalesMenuPolicy.PAGE_SIZE=20`; `SalesMenuPageRequest` and `SalesMenuCursorIdentity` reject
every other page size, the six affected edge operations in the source catalog are `minimum=20, maximum=20`, and
the sales-menu contract gate plus focused identity test reject `1, 19, 21, 100`. Cursor identities retain the
operation, workspace/group/store scope, channel/menu/version/section, mode/filter, and page-size dimensions;
owner queries use keyset frontiers and fetch `pageSize+1`, with no OFFSET or client-side slice.

The current-byte database ordering constraint was handled by the implementation amendment in detailed design
§10.3a and plan §1b. Section/item movement locks the aggregate through the REQUIRED owner mutation/CAS path,
locks current and lexicographic adjacent rows with `FOR UPDATE`, uses a temporary unused order, then performs
three single-row updates with affected-row checks under immediate uniqueness. Section/item `canMoveUp` and
`canMoveDown` are owner-wide adjacent-existence queries, so legal order holes do not change the boundary
judgment. The original deferred/single-CASE wording remains recorded as a current-byte conflict; it was not
silently claimed as implemented.

Fresh post-repair static/focused proof:

```text
node scripts/generate/r5-edge-materialize.mjs
R5_EDGE_MATERIALIZE=PASS
OPERATIONS=210
FACES=61/137/12
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION node scripts/generate/edge-codegen.mjs --write
R5_EDGE_CODEGEN_WRITE=PASS
FILES=359
node scripts/generate/operation-handler-bindings.mjs --write
BP_U02_BINDING_GENERATION=PASS
JSON_FILES=15
JAVA_FILES=15
FILES=30
node scripts/generate/r5-edge-materialize.mjs --check
R5_EDGE_MATERIALIZE_CHECK=PASS
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION node scripts/generate/edge-codegen.mjs --check
R5_EDGE_CODEGEN_CHECK=PASS
node scripts/generate/operation-handler-bindings.mjs --check
BP_U02_BINDING_CHECK=PASS
node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --check
OPERATION_COMMAND_BINDINGS=VALIDATED
scripts/check/sales-menu-contract --self-test
SALES_MENU_CONTRACT_SELF_TEST=PASS
scripts/check/sales-menu-contract
SALES_MENU_CONTRACT=PASS
AFFECTED_OPERATIONS=31
SALES_MENU_OPERATIONS=30
SALES_MENU_COMMANDS=19
scripts/check/sales-menu-schema --self-test
SALES_MENU_SCHEMA_SELF_TEST=PASS
scripts/check/sales-menu-schema
SALES_MENU_SCHEMA=PASS
OWNER_TABLES=14
ASSET_TARGET=PASS
scripts/check/module-dependency-registry
MODULE_DEPENDENCY_REGISTRY=PASS
./gradlew --no-daemon :apps:backend:catering-business-server:modules:sales-menu:compileJava :apps:backend:catering-business-server:modules:sales-menu:spotlessJavaCheck
BUILD SUCCESSFUL
./gradlew --no-daemon :apps:backend:catering-business-server:modules:sales-menu:test :apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector
15 tests successful
BUILD SUCCESSFUL
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

The first rerun of calibration verify before the line-length repair failed at the owning
`backendJavaUtf8LineLimit` task for the new `SalesMenuOwnerService` SQL fragments (the wrapper preserved the
first static failure as `R5_VERIFY_STATIC_FIRST_FAILURE:backend-spotless-check`). The root fix split all
overlong SQL string fragments; the identical verify command then passed. This is recorded as a source failure
and repair, not as a relaxed gate. Normal non-calibration edge-codegen remains intentionally blocked by the
previously recorded CP05 first failure `BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus`.

The migration integration test source remains static-only until the authorized managed Testcontainers phase;
no migration runtime, HTTP, browser L2, DEV, reset, seed, or UAT result is claimed in this amendment.

## SM-01 reconciliation amendment A · Halley fresh review and author disposition

Halley was a fresh read-only independent reviewer after the typed-row calibration rerun. It reopened the
requirements, IA, detailed design, implementation plan, routed memory, current contract/generator outputs,
and current sales-menu owner source. It did not run Docker, Testcontainers, DEV, reset, seed, browser L2, UAT,
or deployment. Its result was `SM-01_STEP_RECONCILIATION=OPEN`.

The following findings are retained as an auditable input, with source-first disposition:

| Halley finding | Disposition | Current evidence and boundary |
| --- | --- | --- |
| Generated sales-menu binding lists 11 READ adapter class names not yet present in the module | `REJECTED_WITH_EVIDENCE` as an SM-01 blocker; retained as an SM-04 implementation obligation | `scripts/generate/operation-handler-bindings.mjs:522-532` explicitly defines generated support types as marker/context types and says runtime adapters are supplied by the owning module in the implementation phase. The generated owner binding intentionally projects both READ and COMMAND slots from the route source; only the 19 command operation classes are required by the current M1 command-composition source. SM-04 remains responsible for wiring every read slot to a real edge read adapter before API closure; no fake READ classes are added to make SM-01 green. |
| Public repository exposes generic `query(sql, RowMapper, ...)`/`update(sql, ...)` | `DEFERRED_TO_SM-02` | The current typed-row repair removed `Map<String,Object>` and passed `R4_DATABASE_BOUNDARIES`; the remaining repository API shape is an owner-foundation concern covered by plan §4.3 “repository set queries、locks/CAS/cursor”. It is not a contract/admin/auth/generator mismatch in SM-01. SM-02 must either close the typed repository boundary or record a fresh source-based reason why the existing owner-local typed mapper seam is sufficient; a green static gate alone will not close that semantic check. |
| Owner list methods return the input cursor and `nextCursor=null` | `DEFERRED_TO_SM-02/SM-03` | This is a confirmed implementation gap against the cursor obligations in detailed design §5 and UI-31. The owner foundation/collection-read work is explicitly scheduled in plan §4.3 and §5.1; it must be fixed and independently rechecked before the corresponding stages advance. It does not change the SM-01 contract denominator. |
| Publication preview treated this menu's DISABLED activation as a blocker | `CONFIRMED_AND_ROOT_FIXED` | Requirements UI-24/UI-26 and detailed-design rows OP-11/OP-17 state that menu activation does not block editing or publication. The owning `SalesMenuOwnerService.publicationPreview` no longer queries `sales_collection_activation` or emits `CHANNEL_DISABLED`; only actual publication facts may supply that blocker in the later cross-owner implementation. |
| Normal CP-05 projection is missing `getOperationsSalesMenus` | `OPEN_GLOBAL_PREREQUISITE` | `node scripts/generate/edge-codegen.mjs --check` still fails with `BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus`. The performance design requires current-tree normal HTTP completion evidence before activating a budget projection; calibration mode is not a substitute. This cannot be repaired by editing generated output, inventing a budget, or marking a pending operation. It remains a retained prerequisite for the authorized CP-05/SM-05 measurement closure, and the stage process must not call it dynamically PASS before that run. |

The activation blocker fix is the only Halley finding changed in the current source during this amendment. The
READ adapter, repository seam, pagination, and CP-05 entries remain explicit downstream/global obligations so a
later stage reconciliation cannot lose them. The normal edge-codegen first failure remains preserved above; no
generated file was edited to suppress it.

## SM-02 source/focused proof amendment B · published-membership manual status repair

The fresh SM-02 review identified a real boundary defect in the manual sale-status command: it validated the
target item against the mutable draft version even though the command is exposed from the published-item view and
manual status is a current overlay on published membership. The source-first repair changed the owning
`SalesMenuOwnerService.manual` path to resolve `latest_published_version_ref` and validate
`sales_version_item(version_ref=publishedVersion, sales_item_ref=item)` before writing the channel-specific
manual status current/event facts. This preserves the independent status dimension and does not copy draft data into
the published view.

The focused regression test `manualStatusTargetsPublishedMembershipAfterDraftRemoval` stubs a menu whose draft
revision differs from its published version, captures both owner queries, and proves the membership query receives
the published version and requested sales item. The first focused attempt failed because the new test used a
nonexistent `Command.status()` accessor; the owning readback record has `readbackStatus()`. The test was corrected
against the current API, then verification was rerun before the focused proof.

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION ./scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test \
  :apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector \
  :apps:backend:catering-business-server:spotlessJavaCheck
15 tests successful
15 ArchUnit tests successful
BUILD SUCCESSFUL
```

The normal non-calibration edge-codegen CP05 first failure remains the previously retained
`BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus`; it was not weakened or relabeled by this repair.
The fresh stage reconciliation remains required, and the product/Journey rule for visibility of menu-wide
`channel_ref IS NULL` operation records in a channel-filtered log is still explicitly unresolved; no dynamic HTTP,
Testcontainers, browser L2, DEV, reset, seed, UAT, or deployment result is claimed here.

## SM-02 independent reconciliation amendment · Godel fresh recheck

Godel was a new fresh read-only verifier after the published-membership repair. It independently reopened the
requirements, IA, interaction design, implementation design and plan, routed project-memory standards, current
sales-menu owner/API/repository/migration sources, generated checks, and focused test output. It did not run HTTP,
Testcontainers, browser L2, DEV, reset, seed, UAT, or deployment. Its result is `SM-02_STEP_RECONCILIATION=PARTIAL`:

```text
TECHNICAL_MATCHED=12
TECHNICAL_OPEN=0
DEXTER_DECISION_OPEN=1
```

The 12 technical reconciliation dimensions are `MATCHED`: behavior; shape/fields; actions; relationships;
placement; user-visible backend problem copy; limits; state/control; failure/recovery; backend-stage applicability
of accessibility/focus; data source/invalidation boundaries; and static/focused proof. In particular, Godel
confirmed fixed pageSize 20/keyset lookahead with no OFFSET/client slice, selective detail item reads, set-based page
media/manual reads, published-version membership for manual status, owner transaction/receipt/CAS/lock/typed-problem
boundaries, and the current 14-table migration/index/FK/immutability shape. It also confirmed the 31st affected
operation is the existing BusinessChannel store-channel operation assigned to SM-03, not an SM-02 omission.

The remaining product/Journey OPEN is retained exactly:

| status | question | owning bytes | falsifiable boundary | minimum disposition |
| --- | --- | --- | --- | --- |
| `UNVERIFIED_REQUIRES_DEXTER_DECISION` | channel-filtered operation log 是否展示 `channel_ref IS NULL` 的菜单级记录 | `SalesMenuOwnerService.listOperationRecords`; menu-wide commands currently write NULL and the query uses `(channel_ref IS NULL OR channel_ref=?)` | channel-only expectation would make the current log over-inclusive; menu-wide-in-selected-menu expectation makes the current predicate valid | Dexter first freezes the rule; then record it in requirements/IA/design and add or retain the exact focused scenario before the next stage |

This OPEN is not closed by static/focused green, later L2, or UI wording. SM-03 remains blocked until the decision is
recorded and a fresh verifier returns `OPEN=0`. The current static/focused evidence is:

```text
scripts/check/sales-menu-contract: PASS (31/30/19)
scripts/check/sales-menu-schema: PASS (14 owner tables; asset target PASS)
scripts/check/module-dependency-registry: PASS
sales-menu focused tests: 15 successful
backend module boundary tests: 15 successful
calibration scripts/verify --validate-only: PASS (18/18; CLEANUP=NOT_APPLICABLE_STATIC_ONLY)
```

## SM-02 decision closure amendment · menu-wide operation records are visible in channel logs

On 2026-09-01 Dexter selected rule `A`: an operation-record view carrying a selected `channelRef` must show both
the selected channel's records and menu-wide records whose `channel_ref IS NULL`. A menu-wide operation affects the
menu as a whole and is therefore visible from every channel log for that menu. This batch does not add a separate
menu-level operation-record entry or a diagnostic surface.

The rule is now recorded in the requirements UI-18/§3.5, IA `IA-SM-LOG-001`, interaction design §6, and
implementation design operation 12/§10.3b. The owner query remains scoped by workspace, group, store, and menu and
uses `(channel_ref IS NULL OR channel_ref=?)`; non-null rows remain visible only for their matching channel. The
focused query test now explicitly maps and asserts one menu-wide row plus one selected-channel row for two different
channel requests, while also asserting the exact channel predicate and bind values.

Fresh post-decision proof, with verify preceding focused tests:

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION ./scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
./gradlew :apps:backend:catering-business-server:modules:sales-menu:spotlessApply
BUILD SUCCESSFUL
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test \
  :apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector \
  :apps:backend:catering-business-server:spotlessJavaCheck
15 tests successful
15 ArchUnit tests successful
BUILD SUCCESSFUL
```

The prior product OPEN is resolved. A new fresh independent stage reconciliation is still required to verify the
updated three-way source/design/test bytes and return `SM-02_STEP_RECONCILIATION=STAGE_MATCHED` before SM-03 starts.

## SM-03 current-byte owner/asset transaction focused evidence

SM-03 implementation has now added the owner-side asset command facade and whole-save claim boundary. The sales-menu
owner remains responsible for membership and current draft item-version judgment; the platform asset owner remains
responsible for staged lifecycle, grant consumption, target locking, activation, and authoritative claim readback.
`STAGED` image binding credentials are transient `assetBindings` on the owner command and are not persisted, logged, or
exposed as a durable sales-menu field. The item save rechecks the exact `(workspace, group, store, menu, item,
expectedDraftVersion, usage)` target before calling the asset owner's claim command in the same `REQUIRED` transaction.
Stage object I/O remains outside a DB transaction because the platform asset owner rejects active transactions at the
storage boundary; release and whole-save claim remain transactional.

The copy command no longer reads source activation relations or creates target activation rows. The focused assertion
proves that copy can preserve definition/schedule without copying the source menu's activation relation. The target's
default-disabled representation and the exact CUSTOM-image copy behavior remain blocked by the product boundary noted
below; no direct reuse of source-target-bound asset references has been accepted as a fix.

Fresh focused proof after the owner/facade changes:

```text
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test \
  --tests 'com.catering.v2s.salesmenu.application.SalesMenu*' --no-build-cache
BUILD SUCCESSFUL
SalesMenuOwnerServiceOwnerApiTest: 5 tests successful
SalesMenuAssetCommandFacadeTest: 1 test successful
```

The first attempt to add the staged-claim test failed at test compilation because the test omitted the
`SalesMenuAssetTarget` import. After fixing the owning test source, the next run passed. This was a test-source failure,
not a production fallback; it is retained here as the first failure. No HTTP, managed Testcontainers, browser L2, DEV,
reset, seed, UAT, or deployment result is claimed.

## SM-03 product decision boundary · CUSTOM media during menu copy

Dirac's fresh source exploration confirmed that `copyDraft` currently carries source media asset references directly,
but an asset reference is target-bound to the source menu/item. Requirements/design say copy includes `media`, while the
current platform asset API exposes stage/release/claim and no approved clone operation. Therefore both plausible choices
change observable product semantics: (A) deep-copy the bytes/metadata into new target-bound assets, which requires a
narrow new asset-owner clone capability and its contract/test surface; or (B) reset the copied item to
`INHERIT_CATALOG`, which does not literally preserve CUSTOM media. The source/design bytes do not choose between them.

This is `UNVERIFIED_REQUIRES_DEXTER_DECISION`; SM-03 must not implement either branch by inference. Directly reusing
the source asset reference is invalid because it violates the target-binding invariant. The next implementation action
after Dexter's choice is to update requirements/IA/design and the exact owner/asset test boundary, then resume the serial
SM-03 stage reconciliation.

## SM-03 decision amendment · Catalog-style shared CUSTOM asset references

On 2026-09-01 Dexter resolved the previous CUSTOM-copy product boundary: menu copy must follow the head-company
Catalog copy behavior and must not introduce a new asset-clone mechanism. The implementation-facing design and plan
were amended before this source repair. The accepted semantics are:

- `copyOperationsSalesMenu` copies the current draft media relation rows and writes the same opaque ACTIVE `assetRef`
  values under the new sales item and draft version;
- it does not copy the object, `platform_asset.staged_asset` row, content hash, Asset target row, publication,
  inventory, manual status/history, activation relation, or any Asset stage/claim/release operation;
- ACTIVE copied references are validated by the existing active asset task-read only; they are not sent through the
  STAGED claim path and are never released merely because the source or copied menu relation is replaced, removed,
  archived, or copied;
- the target-bound `sales_menu_asset_target` and bind-grant chain remains only for a newly uploaded STAGED image and
  its later claim/release lifecycle.

The owning `SalesMenuOwnerService.copyDraft` already uses relation-only inserts, so the production change was kept
small and focused on proof. `SalesMenuOwnerService.claimStagedAssets` now separates bound STAGED refs from unbound
refs: bound refs go directly to Asset-owner claim for lifecycle/target recheck, while unbound refs require an ACTIVE
task read and never claim. A CUSTOM ref with no Asset read capability fails closed instead of being accepted unchecked.
The receipt request hash excludes transient `assetBindings`, matching the Catalog precedent that transient proof is not
business intent and therefore does not create an idempotency conflict on replay.

Fresh focused proof after the source and test repairs:

```text
./gradlew :apps:backend:catering-business-server:modules:sales-menu:spotlessApply \
  :apps:backend:catering-business-server:modules:sales-menu:test \
  --tests '*SalesMenuOwnerServiceOwnerApiTest' --no-build-cache
BUILD SUCCESSFUL
SalesMenuOwnerServiceOwnerApiTest: 8 tests successful
```

The run retained two test-only first failures before the final pass: the initial varargs capture used an invalid
Mockito `getArgument(1,Object[].class)` assumption and then the corrected test omitted the existing CAS stub,
causing the expected `SALES_MENU_VERSION_CONFLICT` guard. Both were repaired in the test source; no production
assertion, generated file, or timeout was weakened. The final focused suite proves relation-only copy of a CUSTOM
assetRef without Asset lifecycle calls, ACTIVE ref update without claim, STAGED claim without active-read lookup,
and fail-closed behavior when a CUSTOM ref cannot be verified. This remains static/focused evidence only; managed
HTTP, Testcontainers, browser L2, DEV, reset, seed, UAT, and deployment are not claimed here.

## SM-03 OPEN repair evidence · enabled activation denominator and Asset owner entity proof

The fresh SM-03 reconciliation identified two OPEN items. Both owning boundaries were repaired before the next
stage: `SalesMenuOwnerService.activationChannels` now selects only `status='ENABLED'` activation relations, so a
disabled menu activation does not add a channel-owner blocker to publication; and the Asset owner now has an entity
focused Testcontainers case for the sales-menu target/grant lifecycle. The latter proves exact target matching,
capability rejection, stage target creation, claim transition/version, grant consumption, and rejection of an
ACTIVE release request. The test does not introduce a clone path: copied CUSTOM refs remain shared ACTIVE refs and
never enter this target-bound STAGED lifecycle.

The required focused proof was run after the activation repair with `--rerun-tasks`:

```text
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test \
  --tests '*SalesMenuOwnerServiceOwnerApiTest' --no-build-cache --rerun-tasks
BUILD SUCCESSFUL
SalesMenuOwnerServiceOwnerApiTest: 9 tests successful
```

The test result XML recorded `tests="9" skipped="0" failures="0" errors="0"`. The new behavioral cases include
`disabledMenuActivationDoesNotBlockPublish`, `copyReusesExistingCustomAssetRefWithoutCallingAssetLifecycle`,
`updateItemReusesActiveCustomAssetRefWithoutClaimingIt`, and
`updateItemFailsClosedWhenCustomAssetCannotBeVerified`.

The Asset owner source/test compilation and the authorized managed Testcontainers execution were also completed:

```text
./gradlew :apps:backend:catering-business-server:modules:asset:spotlessApply \
  :apps:backend:catering-business-server:modules:asset:testClasses --no-build-cache
BUILD SUCCESSFUL

node scripts/test/r5-remote-testcontainers.mjs \
  :apps:backend:catering-business-server:modules:asset:test
R5_REMOTE_TESTCONTAINERS=PASS
REMOTE_GRADLE_STATUS=0
REMOTE_TESTCONTAINERS_CONTAINERS=PASS
REMOTE_TESTCONTAINERS_VOLUMES=PASS
RESOURCE_CLEANUP=PASS
EVIDENCE=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788251015461-7177
firstFailure=null
```

This focused module run is not backend-acceptance, so its manifest correctly reports `business=NOT_APPLICABLE`;
that is not a business acceptance PASS. It is entity-level Testcontainers proof with remote process, workspace,
container, volume, and evidence cleanup all PASS. DEV was not running before the run (`wasRunning=false`), so no
DEV stop or restart was performed. The first harness invocation was retained separately as
`permission denied` because the file was not executable; the repository wrapper's actual `node` invocation then
ran the same managed entry successfully. The first Asset test compile failure (`missing java.util.List`) was
repaired in the test source before this managed run.

## SM-03 step reconciliation closure · fresh verifier `STAGE_MATCHED`

After the two OPEN repairs and their focused/managed proof, a new independent verifier (`Kuhn`,
`reviewerKind=INDEPENDENT_SUBAGENT`) reread the requirements, IA/interaction, implementation design/plan,
routed project-memory standards, current owner sources/tests, and the run manifest. It returned:

```text
SM-03_STEP_RECONCILIATION=STAGE_MATCHED
11 dimensions: MATCHED=11, OPEN=0
```

The verifier explicitly confirmed relation-only Catalog-style CUSTOM `assetRef` copy, active-read versus STAGED
claim separation, transient binding exclusion from receipt hashing, ENABLED-only activation blocking, and the Asset
owner exact-target/capability/stage-target/claim-version/grant/ACTIVE-release proof. It also kept the boundary
explicit: no HTTP, backend-acceptance, browser L2, DEV, reset, seed, UAT, or deployment PASS was inferred.

SM-03 is therefore closed for the serial plan. SM-04 may now begin with a fresh double-read of its requirements,
IA/design rules, project-memory constraints, and edge/generator owning sources.

## SM-04 focused static closure · edge, error/auth and generated handler boundary

SM-04 added the operations-admin sales-menu edge adapters, the target-bound image stage/release adapter, the single
existing contract problem advice handler, the store-scoped business-channel eligible-channel adapter, and generated
route/handler coverage tests. The edge continues to expose read scope through the selected store without adding a
VIEW capability; writes resolve `EDIT_STORE_SALES_MENU`, then re-read the sales-menu owner target before invoking a
command. The asset release adapter accepts only `expectedAssetVersion`; its owner-local target draft version is not
accepted from or guessed by the client. The business-channel adapter rejects non-`SALES_MENU` usage and any page size
other than the product-management-compatible fixed 20 before owner read.

Focused/static proof after these changes:

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION node scripts/generate/edge-codegen.mjs --check
R5_EDGE_CODEGEN_CHECK=PASS
FILES=359

node scripts/generate/operation-handler-bindings.mjs --check
BP_U02_BINDING_CHECK=PASS
RUNTIME_INTEGRATION=IMPLEMENTED_BP_U06
CONTEXT_KIND_NEGATIVE=PASS
JSON_FILES=15
JAVA_FILES=15
FILES=30

node scripts/generate/r5-edge-materialize.mjs --check
R5_EDGE_MATERIALIZE_CHECK=PASS
OPERATIONS=210
FACES=61/137/12

./gradlew :apps:backend:catering-business-server:spotlessCheck \
  :apps:backend:catering-business-server:compileTestJava --no-daemon
BUILD SUCCESSFUL

./gradlew :apps:backend:catering-business-server:compileTestJava --no-daemon
BUILD SUCCESSFUL
```

The first format runs exposed only UTF-8 line-limit/Spotless differences in the newly changed edge and test files;
the owning Java sources were formatted and the checks then passed. No generated source was hand-edited. The focused
source tests now include exact route/method/face assertions for the 30 sales-menu operations plus the two asset
routes, store scope rejection, eligible-channel mapping, fixed page size, and invalid usage rejection. Their test
classes compile successfully. A local Gradle test execution is intentionally not claimed: the repository guard
requires Docker-backed tests to use the managed remote Testcontainers runner.

The current normal edge-codegen check remains an intentional global prerequisite failure until SM-05 real
backend-acceptance refreshes the current exact operation denominator:

```text
node scripts/generate/edge-codegen.mjs --check
BUDGET_PROJECTION_OPERATION_MISSING: BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus
```

This is the same owning-generator boundary recorded in the plan: calibration mode is only a pre-acceptance static
bootstrap, while normal CP05 remains OPEN until the serial SM-05 acceptance run observes the new operation set. The
earlier managed run `r5-tc-1788254109647-63666` stopped at this first generator failure before business tests;
`BUSINESS=NOT_APPLICABLE`, and its Testcontainers container/volume cleanup was PASS. It is not used as SM-04
business evidence.

## SM-03 documentation amendment · Catalog relation-only image-copy source of truth

Dexter's latest product clarification requires the sales-menu copy to follow the head-company product-copy
implementation and forbids a second asset-copy mechanism. The implementation design and serial plan were amended
with exact current-source anchors:

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
  `executeCopy` collects the new owner refs and invokes owner-local facts writers inside the Catalog copy flow;
- `.../catalog/application/CatalogItemMediaFacts.java` `insertForCopy` writes the source opaque `assetRef` values
  into the new item relation in display order, without Asset-owner lifecycle calls or object copying;
- `.../catalog/application/CatalogSkuMediaFacts.java` `insertForCopy` applies the same relation-only rule to SKU
  media.

The sales-menu design now explicitly requires `SalesMenuOwnerService.copyDraft` to copy only
`sales_version_item_media` relation rows to new sales-item/version refs, retaining the same active opaque
`assetRef`; it must not clone an Asset, object, staged row, content hash, target row, publication, inventory,
manual-status history, activation relation, or add a copy operation. The plan and seed oracle require a real
command-based proof that source/copy media refs are equal while Asset row/object/lifecycle counts remain unchanged
and no stage/claim/release call occurs. This amendment changes no new operation or data model and is the direct
Catalog precedent requested by Dexter.

## SM-04 repair amendment · receipt ordering, authoritative command readback and rejection consumer

The first fresh SM-04 verifier found two implementation gaps: command receipt behavior/readback was not sufficiently
provable from the persisted owner fact, and a known channel business rejection could be thrown by edge before the
failure recorder consumer. The root repairs were kept within the approved operations and APIs:

- `SalesMenuOwnerService` now serializes the idempotency key with the owner-local receipt advisory lock, locks and
  rechecks the actual menu/target, then reads replay/conflict state; it does not pre-write `IN_PROGRESS`.
- `updateItem` performs menu CAS before staged-asset claim. Every successful menu command reconstructs its command
  readback from a fresh `SalesMenuRepository.find` of the persisted aggregate, then writes the success operation
  record and only then the `SUCCEEDED` receipt in the same `REQUIRED` transaction.
- `SalesMenuCommandFailureRecorder` wraps the command supplier for known business Problems. The create, activation,
  manual sold-out and manual-restore channel eligibility checks are inside that supplier; transport/authorization and
  unknown failures remain outside the business rejection set.
- `BusinessChannelOwnerApi.salesMenuChannelBelongsToStore` is a narrow owner read used only while recording
  `SALES_MENU_CHANNEL_INELIGIBLE`: it proves the persisted STORE target without applying sales-menu eligibility, so a
  same-store but ineligible channel can be recorded and a cross-store/non-target channel cannot produce a FAILED row.

Fresh focused/static proof after the repair:

```text
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION ./gradlew ... --no-daemon --rerun-tasks
BUILD SUCCESSFUL for compilation and focused module tasks

SalesMenuOwnerServiceOwnerApiTest: tests=12 skipped=0 failures=0 errors=0
BusinessChannelSalesMenuOwnerTest: tests=4 skipped=0 failures=0 errors=0
```

The first normal rerun stopped at the known pre-SM-05 owning-generator boundary before tests:
`BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus`. It is retained as the first failure and is not counted
as a semantic test failure. The root application test task was then stopped by the repository's Docker boundary before
executing tests: `V2S_TESTCONTAINERS_REMOTE_REQUIRED`; therefore no local root test result is claimed. No generated
source was manually edited. A fresh independent SM-04 verifier must still read the current bytes and return
`STAGE_MATCHED` before SM-05 starts; no dynamic Docker, backend-acceptance, browser L2, DEV, reset, seed, UAT, or
deployment evidence is inferred from this amendment.

## SM-04 step reconciliation closure · fresh verifier STAGE_MATCHED

After the receipt/readback and pre-recorder repairs, fresh independent verifier Poincare
(`reviewerKind=INDEPENDENT_SUBAGENT`) reread the requirements, both IA documents, implementation design and plan,
routed project-memory constraints, current edge/owner/generator sources, focused tests, and this evidence. It did not
trust the author or either previous verifier, did not edit files, and did not run dynamic environments. Its verdict:

```text
SM-04_STEP_RECONCILIATION=STAGE_MATCHED
11 dimensions: MATCHED=11, OPEN=0
```

The verifier specifically confirmed: target lock/scope recheck followed by receipt replay/conflict and business
preflight; no `IN_PROGRESS` write; persisted `SalesMenuRepository.find` command readback; `updateItem` CAS before
staged claim; create/activation/manual sold-out/manual-restore channel checks inside the failure-recorder supplier;
STORE-only ownership proof for recording an ineligible channel; Catalog-style relation-only active `assetRef` copy;
and the normal `getOperationsSalesMenus` generator failure as a separate SM-05/CP05 prerequisite rather than an
SM-04 semantic finding.

SM-04 is closed for the serial plan. This closure remains static/focused evidence only: no backend-acceptance,
browser L2, DEV, reset, seed, UAT, or deployment PASS is inferred. The next allowed step is SM-05.

## Execution-path audit · 2026-09-01 · SM-05 recovery required

Dexter requested a review of the execution path before any further implementation or dynamic rerun. Two fresh
independent read-only auditors separately reopened the current requirements, IA, implementation design, serial plan,
routed project-memory constraints, owning source and run evidence. Both returned the same correction: the sales-menu
direction is not a reason to restart the design, but the current whole-suite debugging algorithm is rejected;
`SM-05` remains the only active stage and `SM-06` onward is not reached.

Audited facts:

- The 2026-09-01 audit window contains 21 related manifests under
  `.runtime/r5/evidence/remote-testcontainers/`; 14 first failures are `REMOTE_GRADLE_EXIT_NONZERO`, 4 remain
  `BUDGET_PROJECTION_OPERATION_MISSING`, and one is
  `LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE`. The evidence supports repeated coarse reruns and one orchestration
  overlap, not one business run lasting the whole reported period.
- The latest run is
  `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788271073909-91073`. It ran
  `backend-acceptance --operation all --calibration`; Gradle reported 101 tests and 10 failures, spanning 405,
  403, 409, 422, 500, publication-revision and P2 proof families. It is diagnostic failure evidence only:
  `BUSINESS=FAIL`, resource cleanup `PASS`, and it is not an SM-05 closure.
- The latest prior evidence file had a genuine serial closure only through SM-04 at the time of this audit
  (`SM-04_STEP_RECONCILIATION=STAGE_MATCHED`, 11 dimensions `MATCHED=11`, `OPEN=0`). The latest SM-05 run had not
  yet been recorded as a 15-row scenario ledger with separate CONTRACT/BUSINESS/DB_OPERATIONS/business-cleanup/
  resource-cleanup results or the actual 31-operation mapping.
- The worktree contains unrelated terminal/remediation changes. They are preserved as existing workspace context and
  are excluded from sales-menu stage closure; the audit does not attribute them to this implementation.

Correction recorded in the serial plan's `1b` section:

1. Stop whole-suite and overlapping managed runs; do not rerun an unchanged failure signature/source digest.
2. Keep `CURRENT_STAGE=SM-05`; handle one failure family at a time, beginning with the 405 route/method family,
   while independently reopening the matching request, generated route, edge/controller, owner and oracle sources.
3. For every source/generator change, generate fresh output and run `scripts/verify` before any focused or full test;
   then run only the smallest necessary focused scenario, read the run-scoped logs/evidence, and separate business
   from cleanup results.
4. After each family, perform same-material post-read and fresh independent three-dimensional reconciliation; an OPEN
   must be fixed and freshly rechecked before the next family.
5. Only after all 15 scenarios are individually focused-PASS with cleanup PASS may one full `--operation all` run
   establish the actual 31-operation completion mapping. CP-05 normal projection and final normal generated/verify
   checks remain separate gates and cannot be replaced by calibration PASS.

No business source, generated output, runtime environment, reset, seed, browser L2 or UAT action was performed during
this audit. The next authorized implementation action is a read-first, single-failure-family SM-05 recovery round.

## SM-05 focused recovery · identity-only build projection and version-chain closure

The first focused recovery exposed an orchestration/source boundary rather than a product failure:
`BUDGET_PROJECTION_OPERATION_MISSING:getOperationsSalesMenus` stopped the managed focused compile because the
normal CP-05 projection still has the pre-sales-menu 238-row report. The measured full-run denominator remains
fail-closed; focused compilation must not be misreported as CP-05 calibration. The minimal repair introduced the
build-only `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY` path for focused managed runs, reusing the
existing identity-only generator projection while leaving the `all` run on normal/calibration projection rules.

Static proof for that repair:

```text
node --test scripts/test/backend-performance-budget.test.mjs scripts/test/r5-remote-testcontainers.test.mjs
tests=41 pass=41 fail=0
V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/catalog-inventory-p1.mjs
CATALOG_INVENTORY_P1_GENERATION=PASS
V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --write
R5_EDGE_CODEGEN_WRITE=PASS FILES=359
V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS EXECUTED=18/18 CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

The first post-repair focused run was
`r5-tc-1788273975945-52739`: business was `FAIL`, resource cleanup was `PASS`, and the first semantic failure was
`PUT .../draft/items/{salesItemRef}` returning 409 after a successful manual-sold-out command. The archived
completion event showed the owner had executed the manual command and returned an authoritative aggregate version,
but three acceptance paths discarded that version before their next aggregate command. The root repair writes
`version = assertCommand(...)` for sold-out/restore readbacks in the affected copy, manual-status, and generated-route
scenarios. No CAS, owner, contract, or product rule was weakened.

After fresh formatting, generation, and the same 18/18 validate-only gate, the second focused run was
`r5-tc-1788274253720-62458`:

```text
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.manual-sale-status-and-restore MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=44
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
R5_REMOTE_TESTCONTAINERS=PASS BUSINESS=PASS RESOURCE_CLEANUP=PASS
```

Its manifest records `remoteGradleStatus=0`, `testcontainersContainers=PASS`, `testcontainersVolumes=PASS`, and
evidence archive `PASS`; `measurementEvidence` is `PASS` for the focused run (`discovered=42`, `sqlOperations=601`,
`unclassifiedSqlOperations=0`), but it is not a full-run CP-05 measurement. This is one fresh SM-05
scenario closure only, not the 15-scenario/31-operation closure. The next gate is a fresh independent SM-05
three-dimensional reconciliation before starting another scenario family.

## SM-05 focused recovery · inventory/manual cross-owner oracle closure

The first fresh SM-05 step reconciliation found one evidence gap in the manual-sale scenario: it proved manual
status, channel isolation, republish non-restoration, explicit restore and reason preservation, but its fixture had no
real inventory owner fact. That left the requirement "inventory availability is derived and inventory changes do not
auto-restore manual status" unproven. Re-reading the requirements, detailed design, current owners and existing
Catalog acceptance helpers confirmed this was an evidence gap, not a product-rule defect.

The minimum repair stayed inside existing owner boundaries:

- `CatalogAcceptanceScenarios.acceptanceCreateInventoryBackedPlainItem` delegates to the existing Catalog
  `createItemWithAttributes` → `saveDirectItem` chain, producing the normal catalog item's real `ITEM` inventory
  target before the item is enabled;
- `CatalogAcceptanceScenarios.acceptanceCountInventoryTarget` delegates to the existing Inventory owner's HTTP
  `count` helper, including a fresh target version and the normal idempotency header; it does not write the database;
- only this scenario's fixture receives `EDIT_STORE_INVENTORY`; no production operation, contract, schema or owner
  API was added;
- the scenario now performs real target balance transitions `0→1`, manual sold-out, `1→0`, and `0→1`, then reads
  the same published item on the target channel and asserts `AVAILABLE/AUTO_UNAVAILABLE/AVAILABLE` independently
  from `MANUAL_SOLD_OUT` and its preserved reason. The second channel remains `NORMAL`, republish remains
  non-restoring, and only explicit confirmation restores sale.

Static and focused proof after the repair:

```text
./gradlew :apps:backend:catering-business-server:spotlessApply --no-daemon
./gradlew :apps:backend:catering-business-server:compileTestJava --no-daemon
BUILD SUCCESSFUL

V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION \
V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY \
scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18

scripts/test/backend-acceptance --operation sales-menu.manual-sale-status-and-restore
RUN_ID=r5-tc-1788275163430-83407
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.manual-sale-status-and-restore MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=44
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=55 SQL_OPERATIONS=782 UNCLASSIFIED_SQL=0 UNCLASSIFIED_SQL_RATIO=0
R5_REMOTE_TESTCONTAINERS=PASS BUSINESS=PASS RESOURCE_CLEANUP=PASS
```

The run manifest at
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788275163430-83407/run-manifest.json` records source sync,
remote Gradle, evidence archive, Testcontainers containers/volumes and all cleanup fields as `PASS`; `wasRunning=false`
and no DEV stop/restore was required. The archived HTTP events contain three successful
`countOperationsInventoryTarget` requests, the expected successful and typed-rejection manual commands, and the
successful menu update/publication chain. This closes the previously identified oracle gap only; a fresh independent
SM-05 three-dimensional reconciliation is still required before the next scenario family.

## SM-05 manual scenario reconciliation · fresh independent verifier

Fresh independent verifier Rawls (`reviewerKind=INDEPENDENT_SUBAGENT`) reread the requirements, detailed design, IA,
routed project-memory constraints, current owner sources, acceptance sources and the new managed run artifacts. It did
not edit files, run environments, or trust the author’s conclusion. Its scope decision is deliberately narrow:

```text
MANUAL_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=11, OPEN=0
STAGE_ALLOWED=YES  (close manual scenario; enter the next SM-05 failure family)
STAGE_ALLOWED=NO   (close all SM-05; enter SM-06; claim 15/15 or 31/31)
```

The verifier confirmed that the current code uses the actual Catalog `saveDirectItem` predecessor chain and the
actual Inventory target-read/count HTTP chain; it also confirmed the real `0→1`, manual stop, `1→0`, `0→1`, republish
and explicit restore sequence. The 11-dimension table was all `MATCHED`; accessibility/focus is `N/A_WITH_REASON`
for this backend-only scenario and is not evidence for browser L2. The verifier separately noted that the full SM-05
ledger, actual 31-operation completion mapping, CP-05 normal measurement/verify and later L2/DEV/seed gates remain
open. Therefore this reconciliation permits only the next focused failure family in SM-05.

This closes the prior step-level OPEN without changing the production owner implementation. The next serial action is
the smallest focused scenario for the next recorded failure family (`sales-menu.shape-specific-sale-definition`, the
SKU/shape-definition family); its source, generated-output and verify preconditions must be reread before running it.

## SM-05 focused recovery · display-media owner exception boundary

The prior display-media run was not accepted as a product failure. Its first failure was
`r5-tc-1788281363000-36305`: the scenario expected a claimed-asset release to return typed `409`, but the edge returned
`422 PLATFORM_COMMON_VALIDATION_FAILED`. The run cleanup passed. Fresh source and evidence inspection located the
owning defect in `SalesMenuAssetCommandFacade`: the facade implemented the sales-menu command API while importing the
platform Asset service, so an unqualified `AssetClaimRejectedException` catch resolved to the nested sales-menu API
exception instead of `PlatformAssetService.AssetClaimRejectedException`. The platform exception escaped the typed
mapping and reached the generic validation response. This was a facade exception-boundary defect, not an Asset owner,
database, contract, or product-rule defect.

The minimum root fix was applied only at that boundary:

- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacade.java`
  now catches the fully qualified `PlatformAssetService.AssetOwnerScopeForbiddenException` and
  `PlatformAssetService.AssetClaimRejectedException` on both release and claim paths, mapping them to the sales-menu
  typed exceptions expected by the edge;
- `apps/backend/catering-business-server/modules/sales-menu/src/test/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacadeTest.java`
  has regression tests for platform release/claim rejection mapping;
- no contract, generated operation, Asset owner schema, lifecycle rule, transaction, or fallback was changed.

Source/focused proof after the fix:

```text
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test \
  --tests '*SalesMenuAssetCommandFacadeTest' --no-daemon
BUILD SUCCESSFUL

V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION \
V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY \
scripts/verify --validate-only
R5_VERIFY_VALIDATE_ONLY=PASS for the 18/18 requested validation gates;
the enclosing full verify still stops at the pre-existing unrelated terminal-static targeted-mutation failure
(`owner-kind status drifted during targeted mutation`), after all sales-menu gates, compile, Spotless and PMD passed.
```

The fresh managed run was `r5-tc-1788282552930-61706`:

```text
scripts/test/backend-acceptance --operation sales-menu.display-media-owner-transaction
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.display-media-owner-transaction MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=10
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=43 SQL_OPERATIONS=552 UNCLASSIFIED_SQL=0 UNCLASSIFIED_SQL_RATIO=0
R5_REMOTE_TESTCONTAINERS=PASS BUSINESS=PASS RESOURCE_CLEANUP=PASS
```

Run-scoped evidence is under
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788282552930-61706/`. Its manifest records `status=PASS`,
`business=PASS`, `firstFailure=null`, remote process/workspace cleanup `PASS`, Testcontainers container/volume cleanup
`PASS`, and evidence archive `PASS`; `REMOTE_GRADLE_STATUS=0`. Business and resource cleanup are separate results;
the expected negative business cases do not turn the run into a failed run. Object-valued HTTP completion events show:

| Observed request | Result | Business meaning |
| --- | --- | --- |
| `stageOperationsSalesMenuAsset` | `201 SUCCEEDED` (valid target; repeated for a second staged asset) | authoritative STAGED asset readback |
| `updateOperationsSalesMenuItem` | `200 SUCCEEDED` | valid draft claim/CAS path |
| `releaseOperationsSalesMenuStagedAsset` | `409 FAILED` | expected rejection for already claimed/lifecycle-conflict asset |
| `releaseOperationsSalesMenuStagedAsset` | `200 SUCCEEDED` | valid STAGED release readback |
| `updateOperationsSalesMenuItem` | `422 FAILED` | expected cross-target/wrong-grant rejection, with rollback |
| `stageOperationsSalesMenuAsset` | `403 FAILED` | expected no-capability rejection |

## SM-05 display-media scenario reconciliation · fresh independent verifier

Russell (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the requirements, information architecture,
implementation design and plan, routed project-memory constraints, current edge/facade/owner/generated/acceptance
sources, and the fresh run artifacts. It did not edit files, run environments, or inherit the author’s verdict.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 display-media only
DISPLAY_MEDIA_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=11, OPEN=0
STAGE_ALLOWED=YES (only continue the next SM-05 failure family)
STAGE_ALLOWED=NO (close SM-05 or enter SM-06; 15/15, 31/31, CP-05, normal verify and whole-batch reconciliation remain open)
```

| 三维对账维度 | 结果 | 复核证据（当前字节与新鲜 run） |
| --- | --- | --- |
| behavior | MATCHED | path target → STORE grant → owner recheck → Asset stage/release/claim；facade typed mapping；stage 201、claim/update 200、claimed release 409、valid release 200、wrong grant 422、no capability 403 |
| surface/form | MATCHED | stage target is path/multipart; release body only carries `expectedAssetVersion`; no body target override |
| actions | MATCHED | valid stage, bind/claim through item update, claimed release rejection, second stage, valid release, wrong grant and no-capability rejection |
| relationships | MATCHED | full store/menu/item/usage/version target; sales-menu and Asset owners each recheck their own facts; no cross-owner shortcut |
| placement | MATCHED | generated operations and edge routes remain under the store/menu/item Asset resource boundary |
| user-visible copy | MATCHED | typed sales-menu problem mapping is preserved for target/lifecycle failures; acceptance asserts the typed codes rather than status-only success |
| limits | MATCHED | contract and Asset owner media type, digest and size limits remain active; no limit was weakened |
| state/control | MATCHED | STAGED → claimed/ACTIVE and STAGED → RELEASED transitions use owner CAS/readback; published-bound active assets are not released |
| failure/recovery | MATCHED | the unqualified exception boundary is fixed; wrong-target rejection rolls back without menu/media/Asset partial command write; manifest `firstFailure=null` |
| accessibility/focus | MATCHED_N/A_WITH_REASON | this is a backend-only failure family; there is no frontend focus, keyboard or ARIA surface to validate here, and this is not browser L2 evidence |
| data source/invalidation | MATCHED | active image relation reuses the existing asset reference; draft claim/readback updates the target relation, while failed wrong-grant leaves the original relation unchanged |

First failure/last known good/broken boundary for this family:

- first failure: the old run’s unexpected 422 described above; it is closed by the explicit platform exception mapping;
- last known good: `r5-tc-1788282552930-61706`, with fresh CONTRACT/BUSINESS and cleanup PASS;
- broken boundary: closed for this scope at `OperationsSalesMenuAssetController → SalesMenuOwnerService →
  SalesMenuAssetCommandFacade → PlatformAssetService`; no remaining OPEN was found by the fresh verifier.

This evidence closes only the display-media failure family. It does not claim SM-05 closure, the 31-operation actual
mapping, CP-05 normal measurement, browser L2, DEV, seed, UAT, or deployment. The next serial action is the smallest
focused run for `sales-menu.publish-blockers`, after rereading its current request, generated route, edge, owner and
business-oracle sources.

## SM-05 focused recovery · disabled-store publish blocker and route-source closure

The first fresh run for this family was `r5-tc-1788283047879-79126`. Its first failure was the disabled-store preview
request returning `403 PLATFORM_COMMON_ACCESS_DENIED` instead of the design-required readable preview. Fresh source
reconciliation showed the failure happened before the sales-menu owner: `OrganizationVisibilityService.storeContext`
discarded a persisted `DISABLED` store, while the sales-menu owner already had the correct typed `STORE_DISABLED`
publish blocker. The smallest fix was to keep a persisted disabled store readable in the selected scope while leaving
enabled-only selection candidates and new entry authorization unchanged. A focused regression was added for this
boundary.

The next combined run, `r5-tc-1788283768981-94843`, proved that preview was fixed but exposed two independent source
issues. Publish reached edge scope authorization and was still rejected with `403` before the owner could return the
typed blocker; the existing resolver already provides the required `resolveIncludingDisabledStoreTarget` path, so the
publish edge was changed to use that path only for publish. All other sales-menu commands remain on the normal
enabled-target path. The same run also exposed a route focused-test method-name mismatch (`candidates` versus the
implementation's `itemCandidates`); the method was renamed without changing the generated HTTP path. This run's
business and test status was `FAIL`, while remote process/workspace and Testcontainers cleanup were `PASS`; its exact
acceptance record remains in the run directory as the failure-family evidence.

Owning-source changes:

- `OrganizationVisibilityService.storeContext` accepts persisted `ENABLED` and `DISABLED` stores for readable scope;
  candidate selection and enterability rules remain enabled-only.
- `SalesMenuEdgeSupport` reuses the existing `WorkspaceCapabilityScopeResolver.resolveIncludingDisabledStoreTarget`
  only through `grantForPublish`; normal commands retain `resolveGeneratedOperation`.
- `OperationsSalesMenuController.publish` passes the publish-only target policy; no new operation, contract or data
  model was introduced.
- `OperationsSalesMenuControllerRouteTest` now names the existing item-candidate route method correctly.

After those root fixes, the fresh managed run `r5-tc-1788284063577-557` completed:

```text
V2S_BACKEND_ACCEPTANCE_OPERATION=sales-menu.publish-blockers
BUILD SUCCESSFUL
REMOTE_GRADLE_STATUS=0
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.publish-blockers MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=40
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
R5_REMOTE_TESTCONTAINERS=PASS BUSINESS=PASS RESOURCE_CLEANUP=PASS
```

The same run included `SalesMenuEdgeSupportScopeTest` and
`OperationsSalesMenuControllerRouteTest`; the managed Gradle task passed. Its manifest records source sync, Gradle,
business, evidence archive, remote process/workspace and Testcontainers container/volume cleanup as `PASS`, with
`firstFailure=null`. Business and cleanup remain separately reported. Run-scoped artifacts are under
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788284063577/`.

The full requested static verify was rerun after the source-format first failures were repaired. The first two fresh
attempts are preserved in `/tmp/v2s-sales-menu-verify-20260902.log` and
`/tmp/v2s-sales-menu-verify-20260902-r2.log`:

```text
attempt 1: R5_VERIFY=FAIL; R5_VERIFY_STATIC_FIRST_FAILURE=backend-spotless-check;
  OrganizationVisibilityServiceTest format violation
attempt 2: R5_VERIFY=FAIL; R5_VERIFY_STATIC_FIRST_FAILURE=backend-spotless-check;
  OperationsSalesMenuController.java and SalesMenuEdgeSupport.java format violations
```

After those owning-source formatting corrections, the third fresh attempt is
`/tmp/v2s-sales-menu-verify-20260902-r3.log`:

```text
SALES_MENU_CONTRACT=PASS
SALES_MENU_SCHEMA=PASS
ASSET_TARGET=PASS
R5_VERIFY_VALIDATE_ONLY=PASS
EXECUTED=18/18
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
VERIFY_EXIT=0
```

This section records closure of only the disabled-store publish-blocker and route focused failure family. It does not
claim all 15 acceptance scenarios, all 31 operations, CP-05 normal measurement, browser L2, DEV, reset, seed, UAT or
deployment. The next serial action remains fresh independent SM-05 reconciliation, followed by the next unclosed
focused scenario.

## SM-05 publish-blockers scenario reconciliation · fresh independent verifier

Kant (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the requirements, IA, interaction design,
implementation design and plan, routed project-memory standards, current organization/auth/resolver/edge/controller/
owner/generated/acceptance sources, and all failure/PASS run artifacts. It did not edit files or run the environment.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 publish-blockers failure family
PUBLISH_BLOCKERS_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=11, OPEN=0
STAGE_ALLOWED=YES (only continue the next SM-05 failure family)
SM-06_ALLOWED=NO (SM-05 15/15, 31/31, CP-05, normal verify and whole-batch reconciliation remain open)
```

| 三维对账维度 | 结果 | 复核证据 |
| --- | --- | --- |
| behavior | MATCHED | disabled activation does not block publish; disabled Store/channel return typed blockers; latest acceptance CONTRACT/BUSINESS PASS |
| surface/form | MATCHED | candidates and publish routes/operations/faces remain unchanged; route test method-name repair does not alter HTTP path |
| actions | MATCHED | only publish uses disabled-store target resolution; copy/edit/activation retain enabled-target path |
| relationships | MATCHED | persisted disabled Store stays readable for existing scope while candidate selection/login/switch remain enabled-only |
| placement | MATCHED | store-scoped route and generated route set remain in the approved operations-admin boundary |
| user-visible copy | MATCHED | approved blocker message keys and read-only/front-entry copy remain unchanged; no diagnostic surface was added |
| limits | MATCHED | typed blocker closed set remains STORE_DISABLED/CHANNEL_DISABLED; menu activation disabled is not incorrectly added |
| state/control | MATCHED | publish preserves current draft and activation relation; validator and owner CAS/readback ordering remain intact |
| failure/recovery | MATCHED | first preview and pre-owner publish failures are repaired at their owning boundaries; failed business commands roll back and record separately |
| accessibility/focus | MATCHED_N/A_WITH_REASON | this is a backend-only failure family; UI focus is unchanged and not claimed as browser L2 evidence |
| data source/invalidation | MATCHED | owner re-reads Organization/BusinessChannel/Catalog/Asset facts; publish uses authoritative owner readback rather than stale preview |

The verifier independently confirmed `first failure → last known good → broken boundary`: preview 403 was fixed in
`OrganizationVisibilityService.storeContext`; publish 403 was fixed by reusing the existing disabled-target resolver
only for publish; the controller route-test mismatch was fixed by aligning the internal method name. The latest
`r5-tc-1788284063577-557` has `firstFailure=null`, BUSINESS/CONTRACT/Gradle/evidence/archive/remote-resource cleanup
all PASS. The verifier found no OPEN within this failure-family scope and explicitly did not authorize SM-06 or any
whole-batch claim.

## SM-05 focused recovery · publication revision and draft-source identity

The first focused run for this family was `r5-tc-1788284651135-14302`. The scenario's first business failure was
precise: both publish requests returned HTTP 201, the first published item remained frozen at its original price, and
the second publication exposed the new draft price, but `latestPublishedRevision` remained `1` instead of advancing to
`2`. The run manifest recorded `testExecution=FAIL`, `business=FAIL`, and remote process/workspace plus Testcontainers
cleanup `PASS`; its exact acceptance result is archived in the run directory.

Source inspection found a second coupled defect in the same publication identity boundary. `SalesMenuOwnerService`
computed `revision` from the current draft revision (`draftRevision + 1`), which is not the publication sequence, and
`insertVersion` derived `source_draft_revision` as `revision - 1` rather than carrying the actual current draft
revision. The approved design requires publication revision to advance independently and both the published version
and `sales_publication` to identify the exact draft revision that was frozen.

The minimum owning-source repair was:

- compute the next publication revision from `latestPublishedRevision` (`1` when no publication exists, otherwise the
  persisted latest revision plus one);
- pass the locked menu's `draftRevision` explicitly to `insertVersion` and persist that same value in
  `sales_publication.source_draft_revision`;
- keep DRAFT creation and menu copy calls explicit with a null source revision; no schema, operation, contract, or
  publication model expansion was introduced.

The initial managed owner focused run `r5-tc-1788284982823-20529` exposed a test-only `ClassCastException` while
capturing Mockito varargs. That first failure is preserved; the test capture was corrected to use the invocation's
flattened arguments. The next managed focused run was `r5-tc-1788285093645-22666`:

```text
SalesMenuOwnerServiceOwnerApiTest: PASS
BUILD SUCCESSFUL
REMOTE_GRADLE_STATUS=0
R5_REMOTE_TESTCONTAINERS=PASS
BUSINESS=NOT_APPLICABLE
RESOURCE_CLEANUP=PASS
```

The regression asserts a second publication writes revision `2`, while both the published-version source revision and
publication source revision remain the current draft revision `0`. This is an owner-source focused proof, not an
acceptance or browser claim.

The fresh managed acceptance rerun was `r5-tc-1788285138781-23599`:

```text
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.publish-frozen-effective-view MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=28
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=41 SQL_OPERATIONS=610 UNCLASSIFIED_SQL=0 UNCLASSIFIED_SQL_RATIO=0
R5_REMOTE_TESTCONTAINERS=PASS
BUSINESS=PASS
RESOURCE_CLEANUP=PASS
```

Its manifest records `firstFailure=null`, source sync/Gradle/business/evidence archive/remote process/workspace and
Testcontainers container/volume cleanup `PASS`; run-scoped artifacts are under
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788285138781-23599/`. The acceptance scenario proves first
publication freeze, draft-after-publish dirty preview, old publication immutability, second publication latest value,
revision `2`, and authoritative versions. The full static verify was rerun before these focused tests; sales-menu
contract/schema/asset/Spotless/PMD gates passed, but the unrelated pre-existing terminal static model-test targeted
mutation remains the full-script first failure (`R5_VERIFY_STATIC_FIRST_FAILURE:terminal-static`) in
`/tmp/v2s-sales-menu-verify-20260902-r4.log` and `-r5.log`. It is outside the authorized sales-menu scope and is
reported separately rather than weakened or repaired here.

This section closes only the publication-revision failure family after independent reconciliation; it does not claim
the remaining SM-05 scenarios, 31-operation mapping, CP-05 normal measurement, browser L2, DEV, reset, seed, UAT or
deployment.

## SM-05 publish-frozen scenario reconciliation · Mill fresh independent recheck

Mill (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the current requirements, IA, interaction design,
implementation design and plan, routed project-memory standards, the publication owner/migration/acceptance sources,
and the latest managed run artifacts. It did not edit files, run infrastructure, or inherit the author verdict.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.publish-frozen-effective-view
PUBLISH_FROZEN_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=10, MATCHED/N_A_WITH_REASON=1, OPEN=0
STAGE_ALLOWED=YES (only continue the next SM-05 failure family)
SM-05_ALLOWED=NO (remaining scenario ledger, actual 31-operation mapping, CP-05 normal measurement/verify and whole-batch reconciliation remain open)
SM-06_ALLOWED=NO
```

The verifier confirmed the first publication freezes the published rows, a later draft mutation advances the draft
revision and makes `draftDirty=true`, the second publication uses revision `2` and the current
`source_draft_revision`, and the published rows remain unchanged until that second publication. The current
acceptance source and managed run
`r5-tc-1788289558360-16249` independently show the same chain:

```text
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.publish-frozen-effective-view MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=28
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
R5_REMOTE_TESTCONTAINERS=PASS; BUSINESS=PASS; RESOURCE_CLEANUP=PASS
MEASUREMENT=PASS discovered=43 succeeded=43 failed=0 sqlOperations=637 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
```

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | first publication freeze, draft mutation dirty, second publication latest value and revision `2` are asserted by `SalesMenuAcceptanceScenarios` and the managed result |
| surface/form | MATCHED | published/front read remains a read-only published snapshot; draft controls are not mixed into the published shape |
| actions | MATCHED | preview → publish → published read → draft update → second publish is exercised by one business scenario |
| relationships | MATCHED | DRAFT/PUBLISHED version, publication and `source_draft_revision` remain linked to the same menu target |
| placement | MATCHED | behavior remains in operations-admin Store sales-menu owner/edge boundary |
| user-visible copy | MATCHED | publication result does not claim terminal acquisition; acceptance checks the approved response boundary |
| limits | MATCHED | no live published-view rebuild, terminal/POS sync or published mutation was introduced |
| state/control | MATCHED | `draftDirty` compares current draft revision with latest publication source draft revision |
| failure/recovery | MATCHED | focused business run has `firstFailure=null`, Gradle/measurement/archive/remote cleanup PASS |
| accessibility/focus | MATCHED_N/A_WITH_REASON | this is a backend-only failure family; browser L2 is a later separate gate |
| data source/invalidation | MATCHED | published reads use the persisted latest PUBLISHED version; later draft changes do not mutate old published rows |

This fresh reconciliation closes only this SM-05 failure family and permits only the next focused SM-05 family. It does
not close SM-05, establish the 15-scenario ledger or actual 31-operation mapping, refresh CP-05, or authorize SM-06,
browser L2, DEV, reset, seed, UAT or deployment.

## SM-05 shape-specific scenario reconciliation · Plato fresh independent recheck

Plato (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the current requirements, IA, interaction design,
implementation design and plan, the active backend-acceptance standard, routed project-memory standards, Catalog and
SalesMenu owner sources, generated contract/route sources, and the fresh managed run. It did not edit files or run
dynamic infrastructure.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.shape-specific-sale-definition
SHAPE_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=9, MATCHED_N_A_WITH_REASON=2, OPEN=0
STAGE_ALLOWED=YES (only continue the next SM-05 failure family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The verifier confirmed the five real Catalog shapes `ORDINARY/WEIGHTED/COMPOSITE/SERVICE/SKU`; weighted sales use the
structured Catalog-derived `salesUnit` (`unitRef/code/name/unitDimension/precision`) and nullable ordering bounds;
SKU sales omit the public parent `listedPriceCents`, preserve the owner SKU identity, and use per-SKU prices. Each
update carries the latest aggregate version and exercises the owner CAS/readback path. The previous weighted
`unitLabel` and SKU-fact 500 failures remain retained as first-failure diagnostics; the current source/oracle boundary
is closed without reverting to the old field or weakening validation.

Fresh run evidence:

```text
RUN_ID=r5-tc-1788290138383-26994
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.shape-specific-sale-definition MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=40
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=72 succeeded=72 failed=0 sqlOperations=1068 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
RUN_EXIT=0
```

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | five Catalog shapes are created, attached, updated and read back with shape-specific sale content |
| surface/form | MATCHED | update contract accepts `kind/listedPriceCents/skuPrices`; `salesUnit` is a read fact, not a client-written unit label |
| actions | MATCHED | real HTTP item updates use the authoritative version returned by the prior command |
| relationships | MATCHED | Catalog owner creates the item/SKU facts; SalesMenu resolves those facts and preserves owner SKU identity |
| placement | MATCHED | scenario is bound to the approved `updateOperationsSalesMenuItem` edge and shape proof points |
| user-visible copy | MATCHED_N/A_WITH_REASON | this backend-only family does not prove UI wording; UI terminology remains an independent browser-L2 obligation |
| limits | MATCHED | weighted min/step are null; SKU parent price is null; per-SKU price and shape-specific validation remain enforced |
| state/control | MATCHED | every item update passes expected version and owner CAS advances the aggregate version |
| failure/recovery | MATCHED | current run has `firstFailure=null`, CONTRACT/BUSINESS PASS, Gradle PASS and cleanup PASS |
| accessibility/focus | MATCHED_N/A_WITH_REASON | no UI surface is exercised in this backend scenario; no browser/L2 claim is made |
| data source/invalidation | MATCHED | draft weighted unit reads current Catalog facts; published data uses the approved frozen snapshot boundary |

This closes only the shape-specific SM-05 failure family. It does not close the remaining scenario ledger, actual
31-operation mapping, CP-05 normal measurement/verify, whole-batch reconciliation, SM-06, browser L2, DEV, reset,
seed, UAT or deployment.

## SM-05 asset owner lifecycle scenario reconciliation · Pascal fresh independent recheck

Pascal (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the current requirements, IA, interaction design,
implementation design and plan, the active backend-acceptance standard, routed project-memory standards, the Asset and
SalesMenu owner/controller/migration sources, the acceptance scenario, and the fresh managed run artifacts. It did not
edit files or run dynamic infrastructure.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 asset.sales-menu-image-lifecycle
ASSET_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=10, MATCHED_N_A_WITH_REASON=1, OPEN=0
STAGE_ALLOWED=YES (only continue the next focused SM-05 family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The verifier confirmed that the lifecycle is path-targeted and owner-scoped: valid STAGED media is accepted only for
the selected store/menu/item and expected draft version; no-capability, cross-store, cross-menu, cross-item and
wrong-usage requests are typed rejects; CUSTOM media uses the Asset owner's claim path, claimed assets cannot be
released as STAGED, and a replacement STAGED asset has its own release lifecycle. The copy boundary remains relation
only: an existing active CUSTOM `assetRef` is reused as an opaque relation and is not cloned or re-claimed.

Fresh run evidence:

```text
RUN_ID=r5-tc-1788291291973-49278
BACKEND_ACCEPTANCE_RESULT SCENARIO=asset.sales-menu-image-lifecycle MODULE=ASSET CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=28
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=55 succeeded=48 failed=7 expected_negative_business_outcomes=7 sqlOperations=639 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
RUN_EXIT=0
```

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | STAGED/CUSTOM target lifecycle, claim, replacement and release rules are exercised by the real Asset-owned scenario |
| surface/form | MATCHED | generated stage/release contracts expose path-targeted target identity and expected version, without raw upload or diagnostic fields |
| actions | MATCHED | edge scope/grant resolution precedes owner stage/release; SalesMenu CAS and Asset claim/release remain separate owner commands |
| relationships | MATCHED | target binds workspace/store/menu/item/usage/draft version; Asset target storage has no SalesMenu cross-schema FK; copy keeps relation-only assetRef reuse |
| placement | MATCHED | acceptance remains in `AssetAcceptanceScenarios`; lifecycle storage and owner logic remain in the platform Asset boundary |
| user-visible copy | MATCHED | typed target, usage, claim and version errors are asserted; no terminal or diagnostic promise is exposed |
| limits | MATCHED | one primary plus at most five additional refs and the 2MB sales-menu image limit remain enforced by domain/Asset owners |
| state/control | MATCHED | stage/claim use expected draft version; release uses stored target version and Asset lifecycle state; focused owner test covers release readback |
| failure/recovery | MATCHED | negative HTTP cases show zero owner writes; valid Catalog-owned asset release remains independent; current business, archive and cleanup are PASS |
| accessibility/focus | MATCHED_N/A_WITH_REASON | this is a backend Asset lifecycle family only; no browser/UI/L2 claim is made |
| data source/invalidation | MATCHED | target identity comes from the server path and selected STORE scope; Asset owner reads/locks target state; active CUSTOM refs are not re-claimed |

This closes only the asset owner lifecycle SM-05 failure family. It does not close the remaining scenario ledger, actual
31-operation mapping, CP-05 normal measurement/verify, whole-batch reconciliation, SM-06, browser L2, DEV, reset,
seed, UAT or deployment.

## SM-05 generated-route scenario reconciliation · Laplace fresh independent recheck

Laplace (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the current requirements, IA, interaction design,
implementation design and plan, the active backend-acceptance standard, routed project-memory standards, the generated
contract and route/controller/owner sources, the acceptance scenario, and the fresh run artifacts. It did not edit files
or run dynamic infrastructure.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.generated-route-contract
GENERATED_ROUTE_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=9, MATCHED_N_A_WITH_REASON=2, OPEN=0
STAGE_ALLOWED=YES (only continue the next SM-05 failure family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The verifier confirmed the current generated route/contract boundary no longer reproduces the prior 405: the real
scenario reaches menu list/detail, candidate page, draft section/item reads, preview, draft update/schedule/publish,
published section/item reads, activation, manual sold-out/restore and operation records. The route test keeps the
approved store-scoped base path and the explicit 30-route identity/method/path set. The business fixture, HTTP requests
and hand-written oracle are real and remain separate from the performance measurement and resource cleanup verdicts.

Fresh run evidence:

```text
RUN_ID=r5-tc-1788290770111-38472
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.generated-route-contract MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=26
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=43 succeeded=43 failed=0 sqlOperations=597 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
RUN_EXIT=0
```

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | current generated route chain returns the created identity, business preview violation, published identity and operation history |
| surface/form | MATCHED | generated contract and controller keep the approved store-scoped paths, methods, query parameters and typed responses |
| actions | MATCHED | read, write, publish, activation and manual-status requests are issued through the generated route identities |
| relationships | MATCHED | menu, section, item, channel and publication targets stay in the owner-scoped route chain |
| placement | MATCHED | all routes remain under the operations-admin Store sales-menu edge and owner boundary |
| user-visible copy | MATCHED_N/A_WITH_REASON | this is a backend route scenario; it does not prove UI copy or browser behavior |
| limits | MATCHED | route/page query and typed response limits remain enforced; prior 405 is not bypassed by a fallback route |
| state/control | MATCHED | requests use authoritative command versions through the generated route chain; preview and publication state are read back |
| failure/recovery | MATCHED | current run has `firstFailure=null`, CONTRACT/BUSINESS PASS, Gradle/measurement/archive/resource cleanup PASS |
| accessibility/focus | MATCHED_N/A_WITH_REASON | no UI surface is exercised; browser L2 remains a separate later gate |
| data source/invalidation | MATCHED | generated reads return owner authoritative identities and publication rows; no client-side synthetic route/readback is used |

This closes only the generated-route SM-05 failure family. It does not close the remaining scenario ledger, actual
31-operation mapping, CP-05 normal measurement/verify, whole-batch reconciliation, SM-06, browser L2, DEV, reset,
seed, UAT or deployment.

## SM-05 operation-record cursor scenario reconciliation · Herschel fresh independent recheck

Herschel (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the current requirements, IA, interaction
design, implementation design and plan, the active backend-acceptance and routed project-memory standards, the
operation-record controller/owner/policy/migration/contract/focused-test sources, and the fresh managed run artifacts.
It did not edit files or run dynamic infrastructure.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.operation-record-cursor
OPERATION_RECORD_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=8, MATCHED_N_A_WITH_REASON=3, OPEN=0
STAGE_ALLOWED=YES (only continue the next focused SM-05 family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The verifier confirmed the repaired business oracle builds the exact expected multiset of 21 records: one menu create,
one item add, eighteen section creates, and one rejected non-empty-section delete with `SECTION_NOT_EMPTY`. It asserts
the first page is exactly 20 records, the second page is exactly one record, the terminal cursor is blank, there are no
duplicate records, and the complete observed fact multiset has no omission or unexpected record. The second page uses
the real opaque descending keyset cursor, not an offset or client-side slice. The selected channel view includes the
menu-level and selected-channel record boundary defined by the owner query.

Fresh run evidence:

```text
RUN_ID=r5-tc-1788292606557-73933
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.operation-record-cursor MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=26
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=62 succeeded=61 failed=1 expected_negative_business_outcomes=1 sqlOperations=787 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
RUN_EXIT=0
```

The `failed=1` measurement is the expected HTTP 409 business rejection used to create the FAILED operation record; the
scenario's `CONTRACT=PASS / BUSINESS=PASS` and the managed cleanup verdict remain separate. The run's HTTP/DB evidence
shows one menu create, one item add, eighteen section creates, one rejected delete, and two operation-record page reads;
the second read uses the occurred-at/record-ref descending keyset frontier and terminal `LIMIT` boundary.

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | `SalesMenuAcceptanceScenarios.java:1505-1611` asserts the exact 21-record expected multiset, page sizes 20 and 1, terminal blank cursor, no duplicate and no omission/unexpected fact |
| surface/form | MATCHED | generated operation-record page contract and fixed `pageSize=20` route query are closed; `sales-menu.paths.json:1846-1935`, `sales-menu.schemas.json:851-930` |
| actions | MATCHED | acceptance issues real create/add/section/delete and two operation-record GET requests; fresh HTTP events observe the expected action counts |
| relationships | MATCHED | controller and owner query bind workspace/group/store/menu and `(channel_ref IS NULL OR channel_ref=?)`; `OperationsSalesMenuController.java:239-251`, `SalesMenuOwnerService.java:389-395` |
| placement | MATCHED_N_A_WITH_REASON | backend route placement is verified under the operations-admin menu route; UI placement is outside this backend-only SM-05 scenario and remains a later frontend/L2 obligation |
| user-visible copy | MATCHED_N_A_WITH_REASON | backend returns typed operation facts only; UI copy/rendering is not claimed at this stage |
| limits | MATCHED | policy and edge enforce fixed page size 20, owner lookahead is `pageSize+1`, and the exact 20+1 oracle is now present |
| state/control | MATCHED | opaque cursor identity binds operation/scope/channel/menu/mode/filter/pageSize and mismatches are rejected; `SalesMenuCursorIdentity.java:6-42`, `OpaqueCollectionCursor.java:18-47` |
| failure/recovery | MATCHED | typed `SECTION_NOT_EMPTY` is persisted as a FAILED record while the original problem is rethrown; expected negative measurement is separated from scenario BUSINESS PASS |
| accessibility/focus | MATCHED_N_A_WITH_REASON | this is backend-only evidence; browser DOM, keyboard/focus and screen-reader behavior are not claimed |
| data source/invalidation | MATCHED | owner reads `sales_menu.sales_operation_record` with the approved descending keyset index; no client-side slicing or raw diagnostic payload is used |

The old verifier's OPEN was the preserved first failure for the incomplete `>20`/`>0` oracle and is closed by the
owning acceptance-source repair plus this fresh run and fresh recheck. This closes only the operation-record cursor
failure family. The remaining SM-05 scenario ledger, 31-operation actual mapping, CP-05 normal measurement/verify,
whole-batch reconciliation, SM-06, browser L2, DEV, reset, seed, UAT and deployment remain open.

## SM-05 inventory availability scenario reconciliation · Zeno fresh independent recheck

Zeno the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the requirements, IA, interaction design,
implementation design and plan, routed project-memory and backend-acceptance standards, the Inventory and SalesMenu
owner sources, the nullable generated contract, the test-only acceptance decorator, the acceptance scenario and the
fresh managed run artifacts. It did not edit files, run dynamic environments or inherit the author verdict.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.inventory-availability-matrix
INVENTORY_AVAILABILITY_SCENARIO_RECONCILIATION=PASS
11 dimensions: MATCHED=8, MATCHED_N_A_WITH_REASON=3, OPEN=0
STAGE_ALLOWED=YES (only continue the next focused SM-05 failure family)
SM-05_ALLOWED=NO (15/15 scenario ledger, 31/31 operation mapping, CP-05 normal measurement/verify and whole-batch reconciliation remain open)
```

The verifier confirmed the six real HTTP-backed states: no target → `NOT_APPLICABLE`, low stock → `AVAILABLE`, out of
stock → `AUTO_UNAVAILABLE/OUT_OF_STOCK`, negative stock with `allowNegative=true` → `AVAILABLE`, negative stock with
`allowNegative=false` → `AUTO_UNAVAILABLE/NEGATIVE_NOT_ALLOWED`, and an injected owner read failure →
`UNKNOWN/READ_UNAVAILABLE`. It also confirmed that `manualSaleStatus` remains a separate fact, that the test-only
decorator fails exactly one real Inventory owner read, that repeated published reads have equal response facts and no
write DB events, and that the fixture explicitly includes `EDIT_STORE_INVENTORY` without changing production scope.

Fresh managed evidence:

```text
RUN_ID=r5-tc-1788297112249-57570
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.inventory-availability-matrix MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=44
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=120 succeeded=120 failed=0 databaseOperations=2540 connectionBorrows=356 transactionBegins=210 sqlOperations=1764 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

The manifest is
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788297112249-57570/run-manifest.json`; the archived result,
HTTP events, DB events and statement dictionary are under the same run directory. The fresh verifier specifically
checked the result gzip, three published list/detail/repeat-read HTTP 200 events, the absence of DML in the published
read DB-event subset, Gradle success and the manifest's remote process/workspace/container/volume cleanup. Because the
HTTP artifact intentionally carries metrics rather than response bodies, field-level facts are proved by the current
hand-written real HTTP oracle plus this run's CONTRACT/BUSINESS PASS, not by a body replay.

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | requirements `:205-216`; `InventoryOwnerService.java:6504-6519`; acceptance field oracle `SalesMenuAcceptanceScenarios.java:1314-1404` |
| surface/form | MATCHED | independent nullable `inventoryAvailability` and `manualSaleStatus` objects in `sales-menu.schemas.json:518-655`; no merged availability boolean |
| actions | MATCHED_N_A_WITH_REASON | backend scenario only performs published list/detail reads; inventory recovery/edit UI actions are later frontend/L2 scope |
| relationships | MATCHED | Inventory owner supplies derived fact; SalesMenu aggregates it and keeps manual status independent; `InventoryOwnerApi.java:49-96`, `SalesMenuOwnerService.java:275-309,2026-2048` |
| placement | MATCHED_N_A_WITH_REASON | IA/interaction columns and detail sections are recorded, but browser placement is not claimed by backend acceptance |
| user-visible copy | MATCHED_N_A_WITH_REASON | backend contract emits enum/fact; real UI labels remain a later browser-L2 obligation |
| limits | MATCHED | real target configuration/count/adjust HTTP helpers cover low threshold, zero confirmation and negative-stock switch boundaries |
| state/control | MATCHED | `state`/`reason` nullable contract; UNKNOWN keeps manual status NORMAL; acceptance `:1335-1372,1401-1404` |
| failure/recovery | MATCHED | test-only `BackendAcceptanceInventoryFailureProbe` injects one owner-read failure; production maps it to UNKNOWN/READ_UNAVAILABLE without a recovery action |
| accessibility/focus | MATCHED_N_A_WITH_REASON | no browser DOM, keyboard or focus execution in this backend scenario |
| data source/invalidation | MATCHED | owner read is read-only; repeated response equality is asserted and published-read DB events contain no DML |
```

The prior red chain is retained rather than erased: contract nullability first failed; a local Docker test hit the
managed-runner boundary; focused orchestration initially hit the CP-05 projection boundary; then the scenario exposed
missing inventory capability, an incorrect adjustment response level and an incorrect balance path. Each was repaired
at its owning contract/runner/fixture/oracle boundary and followed by fresh proof. No product rule, owner boundary,
fallback, timeout or generated file was weakened. This fresh recheck closes only the inventory failure family; the
remaining SM-05 ledger, actual 31-operation mapping, CP-05 normal measurement/verify, whole-batch reconciliation,
SM-06, browser L2, DEV, reset, seed, UAT and deployment remain open.

## SM-05 store scope and eligible channels · Carver fresh recheck and finding disposition

Carver the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) performed a fresh, read-only, falsification-first reconciliation
after the DINE_IN fixture correction. It reopened the requirements, IA, interaction design, implementation design and
plan, routed project-memory standards, the current BusinessChannel and SalesMenu owner sources/tests, the acceptance
source, and the new managed run artifacts. It did not edit files or run dynamic environments. The requested
`doc/requirements/...` path in its input list does not exist in this repository; the actual approved requirements file
is `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`, which it read.

The dynamic run itself is valid and is recorded here so the evidence index does not lag the run:

```text
RUN_ID=r5-tc-1788299392929-4960
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.store-scope-and-channel-eligibility MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=26
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=74 succeeded=70 failed=4 databaseOperations=1086 connectionBorrows=125 transactionBegins=117 sqlOperations=727 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

The authoritative manifest is
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788299392929-4960/run-manifest.json`; archived HTTP events,
DB events, backend result and statement dictionary are in that same run directory. The HTTP archive contains real
`getOperationsStoreBusinessChannels` 200 completion events for both eligibility reads, and real channel/template
creation completions. Response bodies are intentionally not stored in the archive; the dual `TAKEAWAY`/`DINE_IN`
eligible-ref assertion is therefore owned by the hand-written HTTP business oracle and the run's CONTRACT/BUSINESS
result, not by replaying an archived body. The preserved earlier DINE_IN template 422 remains at
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788299158060-679` and is not overwritten.

Carver initially reported three OPEN findings. They were independently re-opened against the approved sources and
classified as follows:

| Finding | Disposition | Evidence and boundary |
| --- | --- | --- |
| Disabled channel should be excluded from `usage=SALES_MENU` | `REJECTED_WITH_EVIDENCE` | Approved design SM-23 and the closed error catalog explicitly say business-channel `DISABLED` only blocks publish; menu activation `DISABLED` does not. `BusinessChannelOwnerService` intentionally returns the existing STORE/INTERNAL/DINE_IN-or-TAKEAWAY channel facts without a status predicate, while `SalesMenuPublicationValidator` handles `CHANNEL_DISABLED` at publish time. Project-memory `business-channel-list-scope-and-validity-display.md:31-43` separately requires existing channels to remain readable and distinguishes candidate creation from existing-channel reads. Adding `status='ENABLED'` would silently turn a real disabled channel into absence and violate edit/publish-blocker semantics. The dedicated `sales-menu.publish-blockers` scenario is the approved disabled-channel proof boundary, not this scope-list scenario. | 
| This focused scenario must prove disabled-channel exclusion | `REJECTED_WITH_EVIDENCE` | The premise is false under SM-23: the scope scenario proves store/owner/order-kind eligibility and typed scope rejection; disabled-channel publish behavior belongs to `sales-menu.publish-blockers`, already closed by its focused run and fresh reconciliation. No source or acceptance change is authorized by this finding. |
| Current focused run is absent from this evidence document | `CONFIRMED_THEN_CLOSED` | This section records the exact run, result, manifest path, operation evidence, first failure and cleanup/archive boundary. |

The resulting stage reconciliation is:

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.store-scope-and-channel-eligibility
INITIAL_REVIEWER_OPEN_COUNT=3
DISPOSITION_OPEN_COUNT=0
11 dimensions: behavior=MATCHED; surface/form=MATCHED; actions=MATCHED; relationships=MATCHED;
placement=MATCHED_N_A_WITH_REASON; user-visible copy=MATCHED_N_A_WITH_REASON; limits=MATCHED;
state/control=MATCHED; failure/recovery=MATCHED; accessibility/focus=MATCHED_N_A_WITH_REASON;
data source/invalidation=MATCHED
STAGE_ALLOWED=PENDING_FRESH_RECHECK
SM-05_ALLOWED=NO
```

Russell the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) then performed the required new fresh, read-only,
falsification-first recheck of the current bytes and this disposition. It did not edit files, run dynamic environments,
or inherit the prior verdict. It confirmed that the approved SM-23 rule is not disabled-channel exclusion: an existing
disabled business channel remains readable for management, while `CHANNEL_DISABLED` is a publish/preview blocker;
the scope scenario's STORE/INTERNAL/DINE_IN-or-TAKEAWAY and cross-scope proof is therefore correctly separated from
the `sales-menu.publish-blockers` scenario. It also confirmed that the previous evidence gap is closed by the exact
run record above.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.store-scope-and-channel-eligibility
ROUND=post-disposition fresh recheck (not a formal implementation review round)
11 dimensions: MATCHED=8, MATCHED_N_A_WITH_REASON=3, OPEN=0
PREVIOUS_FINDING_1=REJECTED_WITH_EVIDENCE
PREVIOUS_FINDING_2=REJECTED_WITH_EVIDENCE
PREVIOUS_FINDING_3=CONFIRMED_THEN_CLOSED
OPEN_COUNT=0
STAGE_ALLOWED=YES (only continue the next focused SM-05 scenario)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

This closes only the scope scenario reconciliation and permits the next focused SM-05 scenario. The remaining
focused scenario ledger, actual 31-operation mapping, CP-05 normal measurement/verify, whole-batch reconciliation,
SM-06, browser L2, DEV, reset, seed, UAT and deployment remain open.

## SM-05 collection lifecycle and multi-activation · Aquinas fresh recheck

Aquinas the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reopened the approved requirements, IA,
interaction design, implementation design/plan, routed lifecycle and cursor standards, current SalesMenu owner/edge/
repository/controller sources, the hand-written scenario and this run's archived artifacts. It did not edit files,
run dynamic environments or inherit an earlier conclusion. Its first read found one evidence-ledger OPEN because the
run had not yet been recorded; the run itself and the implementation behavior were already successful.

The canonical run record is:

```text
RUN_ID=r5-tc-1788300273590-22158
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.collection-lifecycle-and-multi-activation MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=26
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
MEASUREMENT=PASS discovered=61 succeeded=60 failed=1 databaseOperations=1537 connectionBorrows=242 transactionBegins=209 sqlOperations=877 unclassifiedSqlOperations=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

Manifest: `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788300273590-22158/run-manifest.json`.
Archive index: `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788300273590-22158/evidence-artifacts.tsv`.
The archived HTTP, DB, result and statement-dictionary files are in that same directory; their manifest/archive
hashes are the authoritative integrity record. The expected single failed measurement is the typed cursor-mismatch
business rejection, while the scenario CONTRACT/BUSINESS result is PASS. The HTTP archive stores completion metadata,
not response bodies; body-level semantics are proved by the current real HTTP business oracle and the run result, not
by replaying an archived body.

Observed HTTP completion counts include 21 `createOperationsSalesMenu`, 3 `getOperationsSalesMenus` successes, 1
cursor-mismatch `getOperationsSalesMenus` rejection, 2 `setOperationsSalesMenuActivation`, and real schedule,
rename, section/item, publish, archive and detail reads. The scenario's oracle asserts first-page 20, continuation
page 1 with disjoint refs, query-identity rejection, simultaneous channel activation, schedule/rename/item/publish
readback, and archived-list retention. It does not claim SM-05-wide closure or any UI/browser behavior.

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | `SalesMenuAcceptanceScenarios.java:204-312` and the real run assert 21 menus, 20+1 pages, query-bound cursor rejection, multi-activation, edit/publish after activation changes and archive retention |
| surface/form | MATCHED | generated menu page/detail expose per-channel activation and `items/cursor/nextCursor`; no selected/effective-one field; current generated sources and owner API |
| actions | MATCHED | real HTTP creates, renames, activates two channels, updates schedule/item, publishes, archives, and reads list/detail/sections/items |
| relationships | MATCHED | activation relation is keyed by `(collection_ref, channel_ref)`; owner scope binds workspace/group/store and cursor identity binds channel/query/page size |
| placement | MATCHED_N_A_WITH_REASON | backend route is operations-admin sales-menu owner surface; UI placement is a later browser/L2 obligation |
| user-visible copy | MATCHED_N_A_WITH_REASON | this backend scenario does not claim UI copy rendering |
| limits | MATCHED | fixed page size 20, owner lookahead `pageSize+1`, keyset cursor, no total/offset/client slicing/automatic drain; 20+1 oracle is real |
| state/control | MATCHED | command expectedVersion/CAS, owner recheck, transaction and authoritative readback; current draft/publication source revision remains distinct |
| failure/recovery | MATCHED | typed cursor mismatch is an expected negative and measurement failure count is separated from BUSINESS PASS; archive keeps historical menu readable |
| accessibility/focus | MATCHED_N_A_WITH_REASON | no UI DOM/keyboard/focus execution in this backend-only scenario |
| data source/invalidation | MATCHED | owner/repository authoritative reads and persisted activation/version/publication facts; no client-side reconstruction or effective-one inference |

The first evidence-ledger OPEN is now `CONFIRMED_THEN_CLOSED` by this section. A subsequent fresh recheck must verify
that disposition before the next focused scenario; until then this scenario is not treated as stage-cleared.

Dewey the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) performed that required fresh, read-only, falsification-first
recheck. It independently re-read the current source, approved materials, routed memory and all relevant run/archive
files. It verified the manifest/TSV SHA-256 integrity entries against the archived artifacts, the 21 real HTTP menu
creates, the 20+1 list behavior and typed cursor mismatch, and the separate business/cleanup boundaries. It found no
remaining scoped mismatch.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.collection-lifecycle-and-multi-activation
PREVIOUS_FINDING=evidence ledger missing run
PREVIOUS_FINDING_DISPOSITION=CONFIRMED_THEN_CLOSED
11 dimensions: MATCHED=8, MATCHED_N_A_WITH_REASON=3, OPEN=0
STAGE_ALLOWED=YES (only the next focused SM-05 scenario)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The collection lifecycle focused stage is closed with OPEN=0. This permits only the next focused SM-05 scenario;
full SM-05, the 15-scenario ledger, actual 31-operation mapping, CP-05 normal measurement/verify, whole-batch
reconciliation, SM-06, browser L2, DEV, reset, seed, UAT and deployment remain open.

## SM-05 copy current draft boundary · Pauli fresh independent reconciliation

The copy oracle now exercises the clarified Catalog-style image rule as well as the menu copy exclusions. The source
menu first receives a publication and channel manual-sold-out fact, then receives a newer dirty draft with a changed
price and two newly staged/claimed CUSTOM images. The copy command reads only the source current draft and creates
new collection/version/section/item identities. It copies the current daily schedule, current draft price, ordered
CUSTOM media relation and primary ref; it does not read or create the source activation relation, publication,
inventory, manual-sale history or Asset lifecycle. A missing activation relation is represented by the required
nullable `activation` field as JSON `null`, which is the approved default-disabled state and is not a fabricated
`DISABLED` relation.

The implementation-facing source and the Catalog precedent were re-read together:

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemMediaFacts.java:62-75`
  writes the source opaque image refs into new owner-local relation rows without copying Asset rows or objects;
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java:469-506,1370-1453`
  creates the new menu/current draft and copies only menu-owned section/item/SKU/media relation rows, with no
  activation or Asset-owner lifecycle call;
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:316-563`
  is the hand-written real HTTP oracle. It compares the two ordered source/copy `assetRef` values, the primary ref,
  current draft price, schedule, independent item/menu refs, null activation, absent publication and copy operation
  records, while re-reading the source manual-sale fact unchanged.

The first post-oracle run failed at the business assertion because the nullable JSON field was tested as a Java
missing node rather than JSON null. That first failure is retained and was fixed at the contract/oracle boundary;
the production copy behavior was not changed to create a disabled activation row:

```text
RUN_ID=r5-tc-1788302105529-57450
FIRST_FAILURE=REMOTE_GRADLE_EXIT_NONZERO
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.copy-current-draft-boundary MODULE=SALES_MENU CONTRACT=PASS BUSINESS=FAIL DB_OPERATIONS=28
FAILURE=BUSINESS: copy has no activation relation and is therefore default disabled; expected true but was false
REMOTE_TESTCONTAINERS_CONTAINERS=PASS
REMOTE_TESTCONTAINERS_VOLUMES=PASS
RESOURCE_CLEANUP=PASS
EVIDENCE_ARCHIVE=PASS
```

After the contract source was made nullable, owning generated output was regenerated and the acceptance oracle was
re-run through the managed Testcontainers boundary:

```text
RUN_ID=r5-tc-1788302703361-68736
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.copy-current-draft-boundary MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=44
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=48 SUCCEEDED=47 FAILED=1 DATABASE_OPERATIONS=1248 CONNECTION_BORROWS=238 TRANSACTION_BEGINS=143 SQL_OPERATIONS=724 UNCLASSIFIED_SQL_OPERATIONS=0
R5_REMOTE_TESTCONTAINERS=PASS
REMOTE_GRADLE_STATUS=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

Authoritative manifest and archive index:

- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/run-manifest.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/evidence-artifacts.tsv`
- archived `backend-acceptance-result.jsonl`, `http-request-events.jsonl`, `db-operation-events.jsonl` and
  `statement-dictionary.json` in that same run directory

The manifest records the following archive integrity values: HTTP raw/archive SHA-256
`a343a34529482e0ae2ddbc5160b8153647068f9e1d50867e8aa9338617cf99aa` /
`33f9c0c0ef7e9aa9a67dcff54772d58a3ab7ba6360c505074727d81882d628ab`; result
`b2d33830fbb02eff0af93e4b05d0927f5ecd9d5d711552efc0afbedee6b15766` /
`ff88eef8de231d1a07887d932f66fa10abd61cd22117ee9d64a3528eef083140`; DB
`3a6d491cff35987cf46fe6f3d2e5b27c9a8991617b0ee19e517d5e229af3ac73` /
`592a4c649caac2e2bcbf20df194fd1ff8ee0913bdbb28395e80df306eecc34c5`; statement dictionary
`5ab067354e4f4140686937114826ca16a39cd0c7c8966a40cc75a08362fed325` /
`12c839c6492f0cc729afdb661b1d373c73b14e7612eabb40804348666e8ca625`.

The fresh HTTP completion archive has 48 events, including two successful `stageOperationsSalesMenuAsset` calls,
three `updateOperationsSalesMenuItem` calls, one `copyOperationsSalesMenu` 201, two post-copy `getOperationsSalesMenu`
reads, the expected post-copy `getOperationsSalesMenuPublishedSections` 404, and the draft section/item and
operation-record reads used by the oracle. The copy request is `requestId=req-267d36ba-211b-4096-9415-313318a56b15`.
Its 39 DB events contain the source current-draft/media relation reads, new menu/version/section/item writes, two
`sales_version_item_media` relation inserts, authoritative readback, operation record and receipt. The copy request
contains no `sales_collection_activation`, `platform_asset.staged_asset`, `platform_asset.sales_menu_asset_target`,
Asset stage, Asset claim, Asset release or clone statement. The two `sales_version_item_media` inserts are the expected
owner-local relation-only reuse of the two source refs. The current source method and this request-scoped DB evidence
jointly prove that copy cannot create an Asset object/lifecycle row or copy the source activation relationship.

The focused stage boundary is therefore explicit: the current managed copy business and cleanup results are PASS;
the preserved first failure is closed by the nullable contract/oracle repair; the normal CP-05 denominator refresh,
15/15 scenario ledger, 31/31 operation execution mapping, whole-batch reconciliation, SM-06+, browser L2, DEV,
reset, seed, UAT and deployment remain open. A fresh independent stage reconciliation must still verify all 11
dimensions before the next SM-05 failure family is started; that required recheck is recorded below.

Pauli the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) then performed the required fresh, read-only,
falsification-first reconciliation after this run and evidence update. It reopened the current requirements, IA,
interaction design, implementation design/plan, routed project-memory standards, current contract/generated output,
Catalog and SalesMenu owner sources, the acceptance oracle, the latest managed archive and the preserved first
failure. It did not run dynamic infrastructure or edit implementation/contract/generated/test/plan/evidence-ledger
files. Full artifact:
`doc/evidence/platform/2026-09-02-v2s-sales-menu-copy-stage-reconciliation-codex.md`.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.copy-current-draft-boundary
11 dimensions: MATCHED=10, MATCHED_N_A_WITH_REASON=1, OPEN=0
OPEN_COUNT=0
FINAL_STAGE_VERDICT=PASS
STAGE_ALLOWED=YES (only the next focused SM-05 family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The fresh reconciler confirmed the Catalog-style relation-only CUSTOM `assetRef` copy, current-draft and schedule
boundary, independent target identities, nullable JSON-null default-disabled activation, exclusion of publication/
inventory/manual/source activation facts, request-scoped absence of Asset lifecycle writes, typed publication 404,
separate business/cleanup results and preserved first failure. It explicitly kept browser/accessibility as
`MATCHED_N_A_WITH_REASON` for this backend-only stage and did not infer browser L2, DEV, reset, seed, UAT or deployment.
Copy is now stage-cleared; only the next focused SM-05 family may start.

## SM-05 ordered sections and items · managed focused run and fresh reconciliation

This focused run proves the owner-authoritative ordering and cursor boundary for the draft structure. The oracle
creates three named sections and twenty-one real catalog candidates, reads candidates as 20+1 pages, adds all twenty-one
items to the first section, reads draft items as 20+1 pages, adds the same catalog item to a second section to prove
independent `salesItemRef` identities, then exercises section rename/move, typed non-empty-section delete rejection,
empty-section deletion, typed first-item `UP` rejection and a successful `DOWN` move with authoritative readback.
The scenario uses only the two explicit move directions; it does not introduce drag/drop or a client-side ordering
authority.

The current source and approved design were re-read after the run:

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:571-746`
  is the hand-written real HTTP oracle for the 21 candidates, 20+1 candidate and item pages, duplicate catalog item,
  section/item mutations, typed boundaries and readbacks.
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
  remains the owner of ordered section/item facts, adjacent-row locking, version/CAS and authoritative collection
  reads; the focused test does not infer order by slicing a client array.
- The implementation design operation rows `OP-19` through `OP-26` and the IA cursor rules require fixed 20-row
  keyset pages, continuation cursors and explicit reachable tails; they do not permit `OFFSET`, totals, automatic
  draining or an operation-column substitute for row behavior.

The canonical managed run record is:

```text
RUN_ID=r5-tc-1788303723535-86967
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.ordered-sections-and-items MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=40
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=166 SUCCEEDED=164 FAILED=2 DATABASE_OPERATIONS=3009 CONNECTION_BORROWS=330 TRANSACTION_BEGINS=240 SQL_OPERATIONS=2199 UNCLASSIFIED_SQL_OPERATIONS=0
R5_REMOTE_TESTCONTAINERS=PASS
REMOTE_GRADLE_STATUS=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

Authoritative manifest and archive index:

- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/run-manifest.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/evidence-artifacts.tsv`
- archived `backend-acceptance-result.jsonl`, `http-request-events.jsonl`, `db-operation-events.jsonl` and
  `statement-dictionary.json` in that same run directory

The manifest records archive integrity values: HTTP raw/archive SHA-256
`d70a646b6d5fd760b27b8021049cb1f3d94eb57736b27880aaaaa583cc8760db` /
`64ddd618f358452720c81531e464e1e90b3462611a6d562e330a07d0eba862db`; result
`423a92f9ac8977cb0b3e6748dd77d9860625d834c6c4735ce687ac7eb9badf05` /
`aea6d8910d57429845f4813026258c882a3d520fca6c05dc5a07b6903cacfadf`; DB
`897657b87518b2cca3dcae7208a3842b68727f41d5923f9ad05fc64b876162d1` /
`8061ef3503a5c61b04390ace514e74dd0f44c4c773f280cc7f8e31c529fd2838`; statement dictionary
`71deabeb8f5d57aa3a6348113c69bc0cff5703e24069bfae6aa21c7191041059` /
`70c8455e079662ef17c1b4627a990675e8bff197d38685155bf5c35fb0e53872`.

The fresh HTTP archive has 166 completion events, including the following sales-menu requests and outcomes:

| operationId | HTTP outcomes | focused oracle meaning |
| --- | --- | --- |
| `getOperationsSalesMenuItemCandidates` | 2 × 200 | candidate pages 20 + 1 |
| `getOperationsSalesMenuDraftSections` | 5 × 200 | section order before/after mutations |
| `getOperationsSalesMenuDraftItems` | 6 × 200 | first-section 20 + 1, second-section duplicate and final readback |
| `createOperationsSalesMenuSection` | 3 × 201 | three explicit sections |
| `addOperationsSalesMenuItems` | 2 × 201 | 21 first-section items and one duplicate occurrence |
| `renameOperationsSalesMenuSection` | 1 × 200 | section rename readback path |
| `moveOperationsSalesMenuSection` | 1 × 200 | explicit `DOWN` section move |
| `deleteOperationsSalesMenuSection` | 1 × 409, 1 × 200 | non-empty typed rejection, then empty-section deletion |
| `moveOperationsSalesMenuItem` | 1 × 409, 1 × 200 | first-item `UP` boundary rejection, then `DOWN` |

The HTTP archive intentionally stores completion metadata rather than response bodies. Body-level facts are proved by
the current real HTTP BUSINESS oracle and the run result. The 25 sales-menu request IDs account for 833 request-scoped
DB events. The owner write/read distribution includes the expected create/add/rename/move/delete paths, and the two
negative mutations each have a rollback event; the run's measurement has zero unclassified SQL. No generated fixture
or client-only slice is used to assert the result.

| 三维对账维度 | 结果 | 当前源码/证据边界 |
| --- | --- | --- |
| behavior | MATCHED | `SalesMenuAcceptanceScenarios.java:571-746` and the managed run prove three sections, 21 candidates/items, duplicate catalog occurrence, ordered mutations and typed boundaries |
| surface/form | MATCHED | generated cursor page shapes expose `items`, `cursor` and `nextCursor`; the owner route accepts explicit page size/cursor and does not expose a total/offset contract |
| actions | MATCHED | real HTTP invokes candidate/section/item reads, section create/rename/move/delete, batch item add and item move; only `UP`/`DOWN` are exercised |
| relationships | MATCHED | section rows own ordered item membership; repeated catalog identity yields two distinct sales-item identities; item/section adjacency is resolved by owner scope |
| placement | MATCHED_N_A_WITH_REASON | this is backend owner proof; operations-admin table/left-navigation placement is a later frontend/browser obligation |
| user-visible copy | MATCHED_N_A_WITH_REASON | no UI copy rendering is claimed by this backend-only scenario |
| limits | MATCHED | 20+1 candidate and draft-item pages are reached through real continuation cursors; no auto-drain, `OFFSET`, client slicing or total-count assertion |
| state/control | MATCHED | expected-version/CAS and owner transaction control are exercised; rejected deletion/move does not mutate the ordered facts, and successful mutations are read back authoritatively |
| failure/recovery | MATCHED | `SECTION_NOT_EMPTY` and `MOVE_NOT_ALLOWED` are typed 409 outcomes; the subsequent reads and successful operations prove the boundary remains recoverable |
| accessibility/focus | MATCHED_N_A_WITH_REASON | no UI DOM, keyboard or focus execution occurs in this backend-focused stage |
| data source/invalidation | MATCHED | section/item order is read from the owner after each mutation; the oracle does not treat its pre-mutation arrays as server truth |

The ordered focused stage currently has managed CONTRACT/BUSINESS/resource cleanup PASS and no run first failure.
A fresh independent stage reconciliation is required before the next focused SM-05 scenario; until that recheck is
recorded this scenario is not treated as stage-cleared.

### Ordered oracle repair and second managed run

The first run after adding the stronger oracle was intentionally retained as a first failure. The failure was in the
acceptance expectation, not in the production ordering behavior: the scenario had already added one duplicate item to
the second section but expected that section's `itemCount` to remain `0` in the post-rename/move snapshot. The real
response reported `itemCount=1`. The owning acceptance source was corrected to expect the actual duplicate membership,
without weakening any assertion.

```text
RUN_ID=r5-tc-1788304804685-3507
FIRST_FAILURE=REMOTE_GRADLE_EXIT_NONZERO
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.ordered-sections-and-items MODULE=SALES_MENU CONTRACT=PASS BUSINESS=FAIL DB_OPERATIONS=22
FAILURE=BUSINESS_ORACLE: section rename/move snapshot expected second-section itemCount=0 but real response was 1
REMOTE_TESTCONTAINERS_CONTAINERS=PASS
REMOTE_TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS
RESOURCE_CLEANUP=PASS
```

After that owning-test repair, the scenario was recompiled and rerun through the same managed boundary:

```text
RUN_ID=r5-tc-1788304965912-3745
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.ordered-sections-and-items MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=40
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=173 SUCCEEDED=171 FAILED=2 DATABASE_OPERATIONS=3253 CONNECTION_BORROWS=412 TRANSACTION_BEGINS=266 SQL_OPERATIONS=2309 UNCLASSIFIED_SQL_OPERATIONS=0
R5_REMOTE_TESTCONTAINERS=PASS
REMOTE_GRADLE_STATUS=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

For the final run, the manifest/archive integrity pairs are: HTTP raw/archive SHA-256
`40e9350917bc06e15cab3fa8d0093e98f83401b7e63390d1197cd8496a825ff2` /
`b7507e92f3490ca0f83bc218ead074f5acecea9c0c97786329d4394a5b522621`; result
`5c8ce667f35f3d6afec6048ae61d4e5843fc4610bff53a2ab60eaee92f875df9` /
`ad9dfb95a9da424595eec47384ccfa6ffd050cf26094d5366d377aa0dfa653dd`; DB
`2fdc6790634955e8a182e0964099ea091ee77bb223a28f92d9b4cb73875d7c8a` /
`ed943b469d843c6714b946712dc448a5ac4630384d50d112f35740dcd86fec16`; statement dictionary
`03733c7424bb2ad4641aed8d6e6866c41632bed9cca55bac0dd6533fc2948eb5` /
`0a2e07aa124f16725684c63eb989a741523551d4bffe2e2a5bedd55a9ba19137`.

The final HTTP archive contains 173 completion events and 32 sales-menu requests: 2 candidate-page reads, 11
draft-item reads, 7 section reads, 3 section creates, 2 batch item adds, one section rename, one section move, one
successful and one rejected section delete, and one successful and one rejected item move. The 1077 request-scoped
DB events include owner reads/writes for those operations; the two expected negative mutations are represented by the
two measurement failures and rollback boundaries, while the real scenario BUSINESS result remains PASS. The archive
stores completion metadata rather than response bodies; the stronger body semantics are therefore established by the
current hand-written oracle and the run result, not by replaying an archived body.

The post-repair source now explicitly captures the complete section facts before mutation, asserts the exact
identity/name/order/item-count/move-capability tuple after rename and move, asserts that a rejected non-empty delete
leaves that tuple unchanged, and asserts that deleting the empty section removes only its identity while preserving the
remaining order. It captures every reachable item identity/version before the boundary move, proves the rejected
`UP` leaves the full sequence and versions unchanged, and proves `DOWN` swaps the first two identities while retaining
the same set and versions. The duplicate Catalog membership now also requires two nonblank distinct `salesItemRef`
values. This is a focused acceptance-oracle repair; no production owner or contract semantics were changed.

The final managed run is ready for a new fresh independent stage reconciliation; ordered remains blocked until that
recheck produces `OPEN=0`.

Galileo the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) performed the required fresh, read-only, falsification-first
recheck after the oracle repair, the preserved first failure and the final managed run. Full artifact:
`doc/evidence/platform/2026-09-02-v2s-sales-menu-ordered-stage-reconciliation-recheck-codex.md`.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.ordered-sections-and-items
FINAL_STAGE_VERDICT=PASS
OPEN_COUNT=0
STAGE_ALLOWED=YES (only the next focused SM-05 family)
SM-05_ALLOWED=NO
SM-06_ALLOWED=NO
```

The fresh recheck independently confirmed that all three previous OPEN findings are closed by the current
acceptance source and fresh run: section full tuples and post-reject/post-delete readbacks are exact; rejected first
item `UP` preserves the complete sequence and versions and `DOWN` swaps the first two identities while preserving
the complete set; and repeated Catalog membership returns two nonblank distinct `salesItemRef` values. It also
reconfirmed the 20+1 candidate/item cursor paths, UP/DOWN-only boundary, owner keyset/no-offset source, separate
business/cleanup/archive evidence and the backend-only UI N/A boundary. Ordered is now stage-cleared; only the next
focused SM-05 family may start.

## SM-05 command idempotency and CAS · Bacon fresh independent reconciliation

The final focused run for `sales-menu.command-idempotency-and-cas` was executed after the source/contract/generated
state was compiled and synchronized through the managed Testcontainers boundary:

```text
RUN_ID=r5-tc-1788305805412-5282
BACKEND_ACCEPTANCE_RESULT SCENARIO=sales-menu.command-idempotency-and-cas MODULE=SALES_MENU CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=28
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=99 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1 STUB_ONLY=0 DIRECT_FAILURES=0
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=22 SUCCEEDED=20 FAILED=2 DATABASE_OPERATIONS=403 CONNECTION_BORROWS=58 TRANSACTION_BEGINS=54 SQL_OPERATIONS=237 UNCLASSIFIED_SQL_OPERATIONS=0
R5_REMOTE_TESTCONTAINERS=PASS
REMOTE_GRADLE_STATUS=0
EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
DEV_WAS_RUNNING=false
FIRST_FAILURE=null
RUN_EXIT=0
```

The manifest reports `status=PASS`, `business=PASS`, `testExecution.status=PASS`,
`cleanup.status=PASS` for remote process/workspace/Testcontainers containers/volumes, empty preflight resources,
and `evidenceArchive.status=PASS`. The four archived artifacts are indexed with raw and archive SHA-256 pairs in
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788305805412-5282/evidence-artifacts.tsv`:

```text
http-request-events.jsonl       8d56d6a2e3f26d4942bc207e772687f35ed18e58d4e9b102c9b080236b3838e1 -> ce56788ed5e1ada692d2e998a1fecd0a073791c4f4e69e76c6a25ff0f65d2370
backend-acceptance-result.jsonl d3ae68ce86e86cfb8a07ea715690e20d131b78865c59b06a85e7dc4a04bb7df6 -> db37e09faee177ed8c6a86850a6ea990c231341161ee822bd61a812d8f33a469
db-operation-events.jsonl        1aed06723f9eb2e0f6604333f0ca4aa3800624be607edb16b08f005c2d32cbb9 -> 28d8f8483668be567364ce57f7b049a26c4944552d2c3ef564fe50e410582b60
statement-dictionary.json        a0138317b789c5c1e9d913c639fc15f6f521f78807088351ca7aeaa166492fe8 -> 041981e38b566bd5931e34ae1e01b279cf3a5416221ac668c427e6998b4b3953
```

The owner completion sequence is: create `201` with owner writes, same-key replay `201` with `OWNER_WRITE=0`,
same-key different-intent `409` with `IDEMPOTENCY_CONFLICT`, new-key create `201`, list `200` with two collections,
stale rename `409`, and authoritative detail `200`. The hand-written oracle asserts exact replay JSON and identity,
typed conflict, distinct new collection, list de-duplication, stale-CAS no mutation, and command readback operation,
menu, target and positive version facts. The DB/statement archive corroborates owner recheck before receipt lookup,
transactional write/operation/receipt ordering, rollback for rejected commands, and zero unclassified SQL; response
body contents are not claimed from the metadata-only HTTP archive.

Bacon the 2nd (`reviewerKind=INDEPENDENT_SUBAGENT`) independently reread the requirements, actual interaction
authority (`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`), implementation design/plan,
transaction/idempotency/CAS project memory, current owner/edge/contract/generated sources, acceptance oracle and the
managed evidence above. Full artifact:
`doc/evidence/platform/2026-09-02-v2s-sales-menu-idempotency-stage-reconciliation-codex.md`.

```text
REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.command-idempotency-and-cas
FINAL_STAGE_VERDICT=PASS
OPEN_COUNT=0
STAGE_ALLOWED=YES (only continue within SM-05 focused recovery)
SM-05_ALLOWED=YES (continue within SM-05; full closure is not claimed)
SM-06_ALLOWED=NO
```

The independent reconciliation marked all 11 dimensions `PASS` or the backend-only UI dimension
`NOT_APPLICABLE_FOR_THIS_BACKEND_ONLY_STAGE`; it found no OPEN mismatch. It explicitly does not close the 15-row
SM-05 ledger, 31-operation completion-event mapping, CP-05 normal projection, frontend/browser L2, DEV, reset/seed,
UAT or deployment.
