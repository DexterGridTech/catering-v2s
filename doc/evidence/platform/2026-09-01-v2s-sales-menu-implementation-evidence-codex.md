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

## 2026-09-03 · SM-L2-008 focused recovery after control exact-set repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The step-level independent recheck found that the previous focused join accepted a setup-only
`SALES_MENU_CHANNEL_CARDS` touch which was absent from the SM-L2-008 denominator. The source of truth and the
approved design keep that common channel-card container only in the entry and authorization cases; the other cases
declare and use their target `SALES_MENU_CHANNEL_CARD`. The repair therefore made `openSalesMenu` record the full
channel-card container only when the generated case declares it, made every sales-menu control touch reject an
undeclared key while the case runtime is active, and made the runner join/terminal gate fail closed on
`unexpectedTouchedControlKeys`. The runner self-test includes a `CONTROL_TOUCH_UNDECLARED` red mutation.

The same recheck also corrected the detailed-design table so SM-L2-008 no longer claims `SALES_MENU_PUBLISHED_PAGINATION`;
that control belongs to SM-L2-009. Blueprint, generated scenario, spec and detailed-design denominators now agree.

```text
STATIC_GENERATOR=SALES_MENU_P1:PASS; CASES=18; OPERATIONS=31
STATIC_RUNTIME_SELF_TEST=PASS; TESTS=50; PASS=50; FAIL=0
STATIC_VERIFY=R5_VERIFY_VALIDATE_ONLY:PASS; EXECUTED=21/21; CLEANUP=NOT_APPLICABLE_STATIC_ONLY
RUN_ID=l2-1788415652635-43879-f36836ba-75db-4b0c-a0d3-1ffba52898cd
READINESS=PASS; ACTIVE_CASES=18; OWNER_ITEMS=21
SOURCE_BYTE_BINDING_FINALIZE=PASS
FOCUSED_CASE=sales-menu-publish-and-front-structure
FOCUSED_DIAGNOSTIC=PASS; BUSINESS=NOT_RUN; CLEANUP=PASS
JOIN=COMPLETE; CASE=PASS; MISSING_CONTROLS=0; UNEXPECTED_CONTROLS=0; MISSING_ACTIONS=0; UNEXPECTED_ACTIONS=0
HTTP_COMPLETIONS=12; BACKEND_EXPECTED=12; DB_SECTIONS_CASE=238; BROWSER_RUNTIME_ERRORS=0
```

This focused diagnostic closes the L2-008 control/join failure boundary only. Its `BUSINESS=NOT_RUN` status does not
count as SM-05 completion and does not prove the 15 backend scenarios, the 31-operation actual execution mapping,
production owner behavior, DEV/UAT, reset/seed or deployment.

## 2026-09-03 · SM-05 BusinessChannel focused scenario

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The first SM-05 focused backend scenario was executed through the managed real-HTTP/remote-Testcontainers entry after
the static denominator review. Its fixture/source boundary contains 20 STORE-owned INTERNAL TAKEAWAY channels and one
STORE-owned INTERNAL DINE_IN channel, plus PROJECT-owned TAKEAWAY, STORE-owned GROUP_BUY and EXTERNAL TAKEAWAY negative
channels. The scenario asserts cursor identity, 20+1 pagination, unique membership, negative exclusion, query identity
validation and foreign-store scope denial.

```text
RUN_ID=r5-tc-1788416555595-65158
SCENARIO=business-channel.sales-menu-eligible-cursor
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=9
HTTP_STATUS_SHAPE=200,200,422,403; EXPECTED_NEGATIVE_REQUESTS=SEPARATE_FROM_BUSINESS_FAILURE
UNCLASSIFIED_SQL=0; EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
FIRST_FAILURE=null
INDEPENDENT_POST_PROOF=STEP-CLOSED; OPEN=0
```

This row closes only the BusinessChannel focused scenario. The compressed HTTP/DB artifacts do not carry a complete
scenarioId/caseId/actionId mapping for all events, so this evidence does not claim the 31-operation actual mapping or
SM-05 full closure. The expected 422/403 requests remain separately classified from BUSINESS and cleanup outcomes.

## 2026-09-03 · SM-05 store scope focused run and post-proof finding disposition

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The second SM-05 focused backend row was executed through the managed real-HTTP/remote-Testcontainers entry. Its
scenario-owned denominator is one store menu, two eligible store-owned INTERNAL channels (`TAKEAWAY` and `DINE_IN`),
project/external ineligible channels, a no-capability actor, and a sibling-store boundary. The separate
`business-channel.sales-menu-eligible-cursor` row already owns the 20+1 channel denominator and its cursor/query
negative cases; duplicating that 21-channel fixture into this row would change the scenario denominator rather than
close a missing fact.

```text
REVIEW_CYCLE_ID=STEP_SM05_SALES_MENU_SCOPE_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
RUN_ID=r5-tc-1788416927552-66191
SCENARIO=sales-menu.store-scope-and-channel-eligibility
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=13
HTTP_EXPECTED_NEGATIVES=422,422,403,404; DIRECT_FAILURES=0
UNCLASSIFIED_SQL=0; EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_WORKSPACE_CONTAINERS_VOLUMES_CLEANUP=PASS
FIRST_FAILURE=null
```

The run's `statement-dictionary` is the explicitly permitted local diagnostic sidecar from the accepted HTTP/DB
observability specification: it maps stable statement identifiers to parameterized templates and does not contain
bind values. The action-request join and compressed HTTP/DB/business artifacts contain only correlation/operation,
status/category, count and hashed diagnostic fields. The detailed design's logging row is clarified accordingly: the
sidecar is not a business log, HTTP/DB event stream or action-request join artifact and remains local-only.

Round-one independent review reported two OPEN findings. They are classified against the current scenario contract and
the accepted cross-cutting standards as follows; the classifications require the same-cycle round-two independent
recheck before the next focused scenario starts:

| Finding | Disposition | Evidence and boundary |
| --- | --- | --- |
| Current sales-menu scope run did not itself execute the 20+1 BusinessChannel prerequisite | `REJECTED_WITH_EVIDENCE` | The 20+1 cursor, terminal page, wrong-query rejection, GROUP_BUY/external exclusion and cross-store cursor denial are the separate `business-channel.sales-menu-eligible-cursor` scenario, already run as `r5-tc-1788416555595-65158` with CONTRACT/BUSINESS/real assertion/cleanup PASS and independent post-proof OPEN=0. The current sales-menu scenario declares and proves its narrower two-eligible-channel and store-scope boundary; it does not claim the BusinessChannel scenario's denominator. |
| `statement-dictionary` appears in the local evidence archive | `REJECTED_WITH_EVIDENCE` | The accepted observability specification §4.3 explicitly permits the local-only `statementId → parameterized template` sidecar under the §1-P1-1 security boundary. No raw bind/query body is in the action-request join or business/HTTP/DB event streams; the detailed design now names this narrow sidecar exception without relaxing any user-data or credential prohibition. |

```text
ROUND_ONE_OPEN=2
PROPOSED_DISPOSITION_OPEN=0
EVIDENCE_BOUNDARY=focused backend acceptance only; not browser L2, not DEV, not seed/reset, not UAT, not full SM-05 15/15 or 31/31 closure
ROUND_TWO_REQUIRED=YES
```

The same-cycle round-two independent verifier reopened the current requirements, scenario denominator, accepted
observability standard, implementation design clarification, and both run artifacts. It did not edit files or run
dynamic infrastructure.

```text
REVIEW_CYCLE_ID=STEP_SM05_SALES_MENU_SCOPE_POST_PROOF
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=SELF_DECIDED
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=Read-only review only; closes the two Round-1 findings for r5-tc-1788416927552-66191; not full SM-05, browser L2, seed, UAT or whole implementation review
```

The verifier confirmed that the 20+1 BusinessChannel owner denominator is correctly owned by the separate focused
scenario `business-channel.sales-menu-eligible-cursor` (`r5-tc-1788416555595-65158`), while the current SalesMenu row
has a narrower declared denominator and does not need a duplicate run or code change. It also confirmed that the
statement dictionary is the accepted local-only parameterized-template diagnostic sidecar, distinct from the
business/HTTP/DB/action-request join artifacts, and that cleanup, direct failures, real business mode and
`firstFailure=null` are closed. The absence of a cryptographic current-checkout hash in this older runner manifest
is retained as an existing evidence limitation, not a blocker for this focused step.

The scope focused stage is now closed with `OPEN=0`; only the next focused SM-05 scenario may start. The 15-row
SM-05 ledger, 31-operation actual completion mapping, CP-05 normal measurement/verify, whole-batch reconciliation,
SM-06+, browser L2 closure, DEV, reset, seed, UAT and deployment remain open.

## 2026-09-03 · SM-05 collection lifecycle and multi-activation focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The collection lifecycle scenario was first statically reconciled against the accepted requirement, IA, detailed
design, scenario plan and owning controller/service. The prior run was intentionally not accepted because it enabled
menus on different channels, did not read back the schedule, and did not prove that a disabled activation can still be
edited and published. The scenario source was corrected at its owning acceptance boundary: one first-channel menu is
enabled together with a second distinct menu on that same channel; the first menu is then disabled on that channel,
while its edit, schedule, publish and exact schedule readback are asserted; the second menu remains enabled on that
channel and the first menu remains independently enabled on the second channel.

```text
RUN_ID=r5-tc-1788418710711-77016
SCENARIO=sales-menu.collection-lifecycle-and-multi-activation
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=13
HTTP_STATUS_SHAPE=200,201,422; HTTP_EVENTS=66
DB_EVENTS=1505; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; FIRST_FAILURE=null
```

The run is valid focused backend evidence for this scenario only. Its business result is real hand-written acceptance
assertion output, not a stub and not an exit-code proxy. It proves the corrected same-channel multi-activation,
disabled-channel edit/publish and schedule readback assertions in the scenario source, while the broader 21-menu,
20+1 cursor and archive denominator remains owned by the appropriate scenario assertions and is not inferred from the
HTTP count. Independent post-proof for this row is required before the next focused scenario starts.

The fresh independent verifier reopened the current requirements, IA, detailed design, scenario plan, owning
controller/service and the run artifacts. It verified the same-channel multi-activation, independent second-channel
activation, disabled-channel edit/schedule/publish path, exact schedule readbacks, cursor boundary, archive/history,
real hand-written business assertion, source sync and cleanup. The verifier found no OPEN finding for this focused
step and explicitly retained the backend-only and non-production proof boundaries.

```text
REVIEW_CYCLE_ID=STEP_SM05_COLLECTION_LIFECYCLE_POST_PROOF_V2
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=NOT_REQUIRED_OPEN_ZERO
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, 31-operation mapping, browser L2, DEV, seed/reset, UAT or production proof
```

The independent review also noted that measurement-level discovered/succeeded counts use a different denominator from
the focused acceptance result. This is retained as a reporting boundary; the closure decision relies on the selected
scenario's real business result, source oracle, HTTP completion shape and cleanup evidence, not on a broad measurement
count. The next focused scenario may now start.

## 2026-09-03 · SM-05 copy current draft boundary focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Before this run, the copy oracle was statically reconciled against the current requirements, IA, UI interaction
design, implementation design/plan, owner copy implementation and the existing Catalog relation-copy precedent. The
static pass found that the oracle asserted only the copied schedule kind, while the approved boundary requires the
current draft schedule values to be copied exactly. The oracle was narrowed by adding exact `09:00` and `22:00`
readbacks; no production owner or contract semantics were changed.

```text
RUN_ID=r5-tc-1788419305914-78277
SCENARIO=sales-menu.copy-current-draft-boundary
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=20
HTTP_STATUS_SHAPE=200,201,404; HTTP_EVENTS=48
DB_EVENTS=997; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; FIRST_FAILURE=null
```

The real hand-written acceptance oracle exercised source current-draft mutation after publication, manual-sale state,
two staged/claimed CUSTOM assets, copy command, copy detail/draft/records/publication reads and source preservation.
The run's HTTP completion summary includes `copyOperationsSalesMenu=1`, `getOperationsSalesMenuPublishedSections=1`
with the expected typed 404, and all required post-copy reads. The focused result is valid for this copy-boundary row
only; it is not evidence for full SM-05, browser L2, DEV/UAT or production owner closure.

Independent post-proof is pending for this row. The previous first-failure run remains preserved in the earlier
copy-boundary evidence section; this PASS is the post-repair run after the nullable activation oracle and exact schedule
readback were present. This row cannot be treated as step-closed until a fresh independent verifier records its
verdict.

## 2026-09-03 · SM-05 copy expanded fixture first-failure diagnosis

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The copy fixture was then expanded, as required by the independent review, to include a SKU-selection item, a second
section/item, explicit display-name overrides, prices and ordering constraints. The first focused rerun failed before
the copy command, while adding the second item. The preceding add of the SKU and creation of the second section both
succeeded. The failure was therefore not a copy-owner assertion, catalog fixture rejection or cleanup problem.

```text
RUN_ID=r5-tc-1788420554065-81344
SCENARIO=sales-menu.copy-current-draft-boundary
FIRST_FAILURE=REMOTE_GRADLE_EXIT_NONZERO
FAILURE_CATEGORY=HTTP_CONTRACT
FAILURE=addOperationsSalesMenuItems returned typed VERSION_CONFLICT (expected 201, received 409)
BUSINESS=FAIL; DB_OPERATIONS=25; HTTP_EVENTS=48; UNCLASSIFIED_SQL=0
TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS; EVIDENCE_ARCHIVE=PASS
REMOTE_PROCESS_CLEANUP=PASS
```

The request sequence and owning source identify a fixture version-cursor omission: after
`createSection(..., "SM05 copy second section", version)` returned the new section and advanced the aggregate
version, the next `addItems` call reused the previous `version` instead of `secondSection.menuVersion()`. The 409 is the
owner's correct CAS rejection of that stale test expectation. The minimal test-only correction writes
`version = secondSection.menuVersion()` before the second-item add; no production code, contract, timeout, retry or
assertion was changed. A new focused run and the same-cycle round-two independent post-proof remain required.

## 2026-09-03 · SM-05 copy expanded fixture repaired focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

After the first failure was diagnosed, the fixture's version cursor was corrected at the owning acceptance source by
assigning the command readback from the newly created second section before adding its item. No production owner,
contract, timeout, retry or assertion semantics changed.

```text
RUN_ID=r5-tc-1788420981606-82076
SCENARIO=sales-menu.copy-current-draft-boundary
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=20
HTTP_STATUS_SHAPE=200,201,404; HTTP_EVENTS=48
DB_EVENTS=1322; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; FIRST_FAILURE=null
```

The expanded fixture now exercised the SKU-selection relation, a second section/item, current-draft display-name
overrides, prices, ordering constraints, CUSTOM media order/primary asset, publication and source preservation. The
real hand-written BUSINESS oracle passed, and the managed cleanup/evidence chain passed. This run closes the dynamic
failure introduced by the expanded fixture; the same-cycle Round-2 independent verifier must still confirm the
expanded denominator and copy boundary before this focused step is marked closed.

## 2026-09-03 · SM-05 copy Round-2 finding intake and author disposition

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The Round-2 verifier returned one `UNVERIFIED_REQUIRES_EVIDENCE` finding because its explicitly requested input set
did not include the preserved first-failure run or this evidence ledger. The missing evidence is present and was
reopened by the author before disposition: the failed managed manifest reports `status=FAIL`, `sourceSync=PASS`,
`cleanup.status=PASS`, and the real acceptance result reports `HTTP_CONTRACT` on the third add request with typed
`VERSION_CONFLICT`; its route sequence shows the first item add and second-section create succeeded before that add
failed. The current source at lines 388-390 contains the one-line cursor correction between the section create and
second-item add, and the subsequent compile plus repaired real run passed.

```text
REVIEW_CYCLE_ID=STEP_SM05_COPY_CURRENT_DRAFT_POST_PROOF
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=SELF_DECIDED
F-R2-001=REJECTED_WITH_EVIDENCE
EVIDENCE=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788420554065-81344/run-manifest.json
EVIDENCE=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788420554065-81344/backend-acceptance-result.jsonl.gz
EVIDENCE=apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:388-390
EVIDENCE=apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:389
EVIDENCE=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788420981606-82076/run-manifest.json
AUTHOR_DISPOSITION=the finding's premise is false because the failed run and exact one-line source correction are now directly recorded and verified
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

This author disposition does not create a third review round. It closes only the copy focused step and permits the
next serial SM-05 scenario; full SM-05 and all later stages remain open.

## 2026-09-03 · SM-05 ordered sections/items static step admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent static reconciliation reopened the requirements, IA, UI interaction constraints, project-memory
ordering/acceptance rules, detailed design/plan, current owner source, current acceptance source, contract/generated
boundary, fixture truth table and prior managed artifacts. It verified the complete ordered-stage denominator and
found no OPEN mismatch: 21 candidates as `20+1`, 21 draft rows as `20+1`, complete section tuples, duplicate catalog
membership with independent sales-item identities, typed delete/move rejection with no mutation, empty-section
deletion, authoritative UP/DOWN order and unchanged item versions, and keyset/opaque cursor boundaries. The
backend-only scope does not claim UI DOM/focus proof.

```text
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
SCOPE=SM-05 sales-menu.ordered-sections-and-items
FINAL_STAGE_VERDICT=PASS
OPEN_COUNT=0
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static step admission only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The static gate permits exactly one serial focused run for `sales-menu.ordered-sections-and-items`.

## 2026-09-03 · SM-05 ordered sections/items focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The ordered scenario was executed only after the fresh static step admission above. It used the real HTTP owner
fixture and hand-written BUSINESS oracle; expected negative requests remain typed failures separated from the
successful business result.

```text
RUN_ID=r5-tc-1788421762713-89496
SCENARIO=sales-menu.ordered-sections-and-items
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=21
HTTP_EVENTS=177; HTTP_STATUS_SHAPE=200,201,409; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; FIRST_FAILURE=null
```

The real scenario passed the 21-candidate and 21-draft-item `20+1` cursor paths, section tuple/order/delete
boundaries, duplicate catalog membership with independent sales-item identities, typed no-mutation rejects, and
authoritative item move readbacks. The managed manifest and acceptance artifact confirm BUSINESS/CONTRACT/cleanup
separation; measurement reports two expected negative HTTP outcomes and zero unclassified SQL, which are not treated
as business failures. Fresh independent post-proof is required before the next SM-05 scenario.

The fresh independent post-proof reopened the current source, design/contract boundary and this run's artifacts. It
found no OPEN finding and confirmed that the two 409 responses are the expected non-empty-section-delete and first-item
UP boundary negatives, not failures of the real BUSINESS oracle.

```text
REVIEW_CYCLE_ID=STEP_SM05_ORDERED_SECTIONS_ITEMS_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=NOT_REQUIRED_OPEN_ZERO
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

Only the next serial SM-05 focused scenario is permitted; SM-05-wide closure remains open.

## 2026-09-03 · SM-05 shape-specific sale definition static step admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent static reconciliation reopened the current requirements, IA/UI interaction constraints, project
memory, detailed design/plan, current Catalog and SalesMenu owner sources, contract/generated schemas, fixture truth
table and prior focused evidence. It found no OPEN mismatch for the five real Catalog-backed sale definitions:
ordinary/direct, weighted, composite, service and SKU selection. The check confirmed Catalog is the source for shape,
weighted five-field sales-unit readback and SKU identity/name/code/status facts; weighted ordering bounds remain
nullable; SKU has no public parent price and uses per-SKU listed price; the update request carries no sales-unit
definition; and each update uses the current aggregate version.

```text
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
SCOPE=SM-05 sales-menu.shape-specific-sale-definition
FINAL_STAGE_VERDICT=PASS
OPEN_COUNT=0
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static step admission only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The static gate permits exactly one serial focused run for `sales-menu.shape-specific-sale-definition`.

## 2026-09-03 · SM-05 shape-specific sale definition focused run

The shape-specific scenario was executed only after the static admission above. It used five fresh Catalog-owned
fixtures and a real HTTP hand-written acceptance oracle; weighted unit facts and SKU facts were read from Catalog
owner responses and then checked against SalesMenu readback.

```text
RUN_ID=r5-tc-1788422668057-91873
SCENARIO=sales-menu.shape-specific-sale-definition
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=21
HTTP_EVENTS=72; HTTP_STATUS_SHAPE=200,201; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; FIRST_FAILURE=null
```

The real BUSINESS oracle passed the ordinary/direct, weighted, composite, service and SKU-selection definitions,
including nullable weighted ordering bounds, five-field Catalog sales-unit readback, SKU parent-price nullability,
per-SKU listed price and aggregate-version advancement. This focused run closes only the shape-specific SM-05 row;
fresh independent post-proof is required before the next serial scenario.

The fresh independent post-proof reopened the current real-path source, Catalog owner boundary, generated schemas and
this run's managed artifacts. It confirmed the five-shape fixture/readback chain, current-version sequencing,
CONTRACT/BUSINESS/real assertion separation, archive integrity, cleanup PASS and the metadata-only boundary of the
HTTP/DB event streams; it found no OPEN finding.

```text
REVIEW_CYCLE_ID=STEP_SM05_SHAPE_SPECIFIC_SALE_DEFINITION_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=NOT_REQUIRED_OPEN_ZERO
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

Only the next serial SM-05 focused scenario is permitted.

## 2026-09-03 · SM-05 display-media owner transaction static step admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The first independent static verifier identified three OPEN denominator/oracle gaps: incomplete asset target
readback, missing no-partial-write proof on rejected target/grant paths, and missing published-bound draft-replacement
coverage in the scoped SalesMenu scenario. The author then re-opened the current owner source, contract, detailed
design and the Asset owner companion before changing only the acceptance oracle. The scenario now asserts every
contract target field for stage and release; checks menu/item versions and sales-menu asset-row counts after each
cross-store/menu/item rejection; checks asset lifecycle plus menu/item readback after wrong-usage, invalid-grant,
claimed/released/version and capability rejections; and proves original publication immutability across a valid draft
media replacement and archive. No production owner, contract, generated output or product semantic was changed.

```text
REVIEW_CYCLE_ID=STEP_SM05_DISPLAY_MEDIA_OWNER_TRANSACTION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=SELF_DECIDED
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
STATIC_SPOTLESS=PASS
STATIC_COMPILE_TEST_JAVA=PASS
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static step admission only; not focused backend run, full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The static gate permits exactly one serial managed focused run for `sales-menu.display-media-owner-transaction`.

## 2026-09-03 · SM-05 display-media owner transaction focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The scoped scenario ran only after the Round-2 static admission. It used the real HTTP owner, fresh STORE fixtures,
real staged asset bytes and a hand-written BUSINESS oracle. The run manifest has no first failure; the expected
negative target, lifecycle, capability and bind-grant responses remain part of the scenario and are not treated as
runner failures.

```text
RUN_ID=r5-tc-1788424209192-97432
SCENARIO=sales-menu.display-media-owner-transaction
SOURCE_SYNC=PASS; REMOTE_GRADLE=0; CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=22
HTTP_EVENTS=88; HTTP_STATUS_SHAPE=200,201,403,404,409,422; UNCLASSIFIED_SQL=0; SQL_EVENTS=1756
FIRST_FAILURE=null
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; MUTATION_VERDICT=NOT_APPLICABLE
```

The real oracle passed complete stage/release target identity, cross-store/menu/item no-write boundaries, wrong-usage
and invalid-grant atomicity, claimed/released/stale lifecycle rejection, capability denial, valid draft replacement,
published image immutability and archive preservation. The managed artifact reports `SELECTED=1`,
`REAL_BUSINESS_ASSERTIONS=1`, `STUB_ONLY=0` and `DIRECT_FAILURES=0`; this closes only the focused backend scenario,
pending independent post-proof. It is not full SM-05, browser L2, DEV, seed/reset, UAT or production proof.

## 2026-09-03 · SM-05 display-media focused post-proof and finding disposition

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent post-proof re-read the current display-media source, detailed design, contract, managed manifest,
compressed HTTP/SQL/result artifacts, archive index and Gradle log. It confirmed source synchronization, real HTTP
execution, hand-written business assertions, expected negative response families, owner readbacks, transaction
rollback/no-partial-write evidence, request-to-SQL correlation, zero unclassified SQL and complete resource cleanup.
The archive SHA/byte receipts matched the manifest and archive index.

```text
REVIEW_CYCLE_ID=STEP_SM05_DISPLAY_MEDIA_OWNER_TRANSACTION_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
F-R1-001=REJECTED_WITH_EVIDENCE
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
```

The verifier proposed a direct/stub consistency artifact. That premise is outside the active backend-acceptance
standard: the finite business proof is one real HTTP/Testcontainers scenario with a hand-written oracle; the runner
accepts `REAL`/`STUB` as a result shape but fail-closes any `STUB` business result. The current result's
`businessMode=REAL`, `REAL_BUSINESS_ASSERTIONS=1`, `STUB_ONLY=0` and `DIRECT_FAILURES=0` therefore satisfy the
applicable model; no second stub execution or new artifact is authorized or required. This disposition does not
weaken the boundary: the run proves only `sales-menu.display-media-owner-transaction`, not full SM-05, browser L2,
DEV, seed/reset, UAT or production completion.

The focused display-media step is closed and the next serial SM-05 static admission may begin.

## 2026-09-03 · SM-05 publish-frozen effective view static admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The first independent static review found four publish-frozen/readback gaps. The author re-opened the detailed
design, active backend-acceptance standard, SalesMenu and Catalog owner sources, generated schema and existing
whole-save helper before making the minimum test-only changes. The scenario now uses the real Catalog owner rename
and authoritative readback after the first publication; captures and compares the complete published section,
published item and detail tuples; proves a distinguishable DAILY_TIME_RANGE to ALL_DAY draft schedule change while
the first publication remains unchanged; and compares the full menu readback before and after malformed-price,
disabled-channel and disabled-store failed publication attempts. No production owner, contract, generated output or
product semantic was changed.

```text
REVIEW_CYCLE_ID=STEP_SM05_PUBLISH_FROZEN_EFFECTIVE_VIEW
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND_FINAL_DECISION=SELF_DECIDED
ROUND2_FINDINGS=OPEN=1; malformed-price failed publish no-write readback
AUTHOR_DISPOSITION=F-R2-001 CONFIRMED_AND_REPAIRED; exact pre/post readMenu equality added; no third review because cycle limit is 2
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
STATIC_SPOTLESS=PASS
STATIC_COMPILE_TEST_JAVA=PASS
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static step admission only; not focused backend run, full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The Round-2 verifier rejected the other four findings with current-source/schema evidence. The remaining finding was
limited to the malformed-price branch; the author then added the same owner readback invariant already used for the
disabled channel/store branches and re-ran Spotless plus test compilation successfully. This closes static admission
for one serial managed focused run of `sales-menu.publish-frozen-effective-view`; it does not claim the dynamic
scenario, full SM-05, browser L2, DEV, seed/reset, UAT or production behavior.

## 2026-09-03 · SM-05 display-media post-proof finding intake

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The post-proof verifier's direct/stub comparison finding was re-opened against the active owner standard and managed
runner. It is `REJECTED_WITH_EVIDENCE`: the active model deliberately has one real HTTP/Testcontainers business
scenario, `businessMode=REAL`, and a hand-written business oracle; the runner rejects any `STUB` business result
(`scripts/test/r5-remote-testcontainers.mjs`), while the active standard explicitly retires the old provider/stub
model. No second stub execution or consistency artifact is an applicable completion condition. This does not expand
the focused proof to SM-05-wide, browser L2, DEV, seed/reset, UAT or production completion.

## 2026-09-03 · SM-05 publish-frozen effective view focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The publish-frozen scenario ran only after its static admission. It used a fresh Catalog-owned item, a real Catalog
whole-save rename and readback, real SalesMenu HTTP commands, and a hand-written real BUSINESS oracle. The run
manifest and compressed artifacts were read after completion; the first failure is null and expected negative
branches are not part of this focused run.

```text
RUN_ID=r5-tc-1788425944893-17122
SCENARIO=sales-menu.publish-frozen-effective-view
SOURCE_SYNC=PASS; REMOTE_GRADLE=0; CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=14
HTTP_EVENTS=52; HTTP_STATUS_SHAPE=200,201; SQL_MEASUREMENT=760; UNCLASSIFIED_SQL=0
FIRST_FAILURE=null
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; STUB_ONLY=0; DIRECT_FAILURES=0
```

The HTTP artifact contains first preview/publish and published section/page/detail reads, Catalog read/write/readback,
draft price mutation and preview, old publication reads, DAILY_TIME_RANGE to ALL_DAY schedule mutation/readback,
second publish and latest reads. The business result reports `SELECTED=1`, `REAL_BUSINESS_ASSERTIONS=1`,
`CONTRACT=PASS`, `BUSINESS=PASS`; the archived HTTP/result/DB/statement artifacts have manifest/index byte and SHA
receipts, and the SQL measurement has zero unclassified operations. This closes only this focused scenario, not
full SM-05, browser L2, DEV, seed/reset, UAT or production verification; the publish-blockers negative scenario was
not selected by this run.

## 2026-09-03 · SM-05 publish-frozen effective view focused post-proof

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent post-proof re-opened the current SalesMenu/Catalog acceptance source, owner/readback source,
OpenAPI/generated schema, detailed design, managed manifest, compressed backend result, HTTP/SQL artifacts and
archive index. It confirmed the real Catalog owner mutation/readback, first/old/latest publication sequence,
complete published section/item/detail tuple checks, distinguishable schedule mutation, no first failure, HTTP/SQL
correlation, zero unclassified SQL and complete resource cleanup/archive.

```text
REVIEW_CYCLE_ID=STEP_SM05_PUBLISH_FROZEN_EFFECTIVE_VIEW_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The verifier noted that `publish-blockers` was not selected by this run; its malformed/disabled no-write assertions
remain covered by the separate static admission above and are not silently counted as dynamic evidence here.

## 2026-09-03 · SM-05 publish blockers static admission and Round-2 disposition

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Round 1 independently identified two static gaps: preview assertions accepted any matching blocker, and the
scenario's primary operation identity did not make a focused publish-command selection executable. The author
re-opened the current scenario, runner selection, publication validator, owner status paths and schema, then changed
only the acceptance oracle: all four preview checks now require exactly one blocker with exact kind, nullable/item
identity and message key; the blocker scenario primary operation is `publishOperationsSalesMenu`, while the real
preview request remains exercised inside the scenario. No runner, production owner, contract or product semantic was
changed.

```text
REVIEW_CYCLE_ID=STEP_SM05_PUBLISH_BLOCKERS
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
ROUND2_FINDINGS=OPEN=0
ROUND2_VERDICT=PARTIAL_STATIC_SOURCE_PASS_COMPILE_EVIDENCE_MISSING_DYNAMIC_RUN_NOT_YET_ALLOWED
AUTHOR_DISPOSITION=compile evidence re-opened and confirmed PASS; no third review because cycle limit is 2
STATIC_SPOTLESS=PASS
STATIC_UTF8_LINE_LIMIT=PASS
STATIC_COMPILE_TEST_JAVA=PASS
STAGE_ALLOWED=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static step admission only; not focused backend run, full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The Round-2 verifier found no OPEN implementation finding and its only condition was that it had not read the current
compile evidence before being asked to stop expanding the read. The author then re-ran the current Spotless, UTF-8
line-limit and `compileTestJava` command successfully. This permits one serial managed focused run selected by the
scenario ID `sales-menu.publish-blockers`; selecting by `publishOperationsSalesMenu` would intentionally include the
other publish scenario as well and is not used for this focused run.

## 2026-09-03 · SM-05 publish blockers focused first-failure diagnosis and oracle repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The first managed focused run was not retried blindly. Its archived scenario result was read together with the
manifest, HTTP events, DB events and owner source. HTTP contract requests all completed successfully; the scenario
failed only in the hand-written business oracle. The owner publication validator emits an item-level
`LISTED_PRICE_MISSING` blocker with the `sales_version_item.sales_item_ref`, while the fixture asserted the Catalog
`itemRef`. The observed expected/actual identity mismatch is therefore a test oracle identity error, not a product
owner failure, transport failure or data-store cleanup failure.

```text
RUN_ID=r5-tc-1788426966229-33774
SCENARIO=sales-menu.publish-blockers
RUN_STATUS=FAIL; REMOTE_GRADLE=1; RUNNER_FIRST_FAILURE=REMOTE_GRADLE_EXIT_NONZERO
SCENARIO_CONTRACT=PASS; SCENARIO_BUSINESS=FAIL; failureCategory=BUSINESS_ORACLE; businessMode=REAL
SCENARIO_FAILURE=unconfigured_direct_pricing expected Catalog itemRef but actual sales-menu salesItemRef
HTTP_EVENTS=26; DB_EVENTS=427; UNCLASSIFIED_SQL=0
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS
```

The minimum test-only repair is in `SalesMenuAcceptanceScenarios`: after `addItems`, the malformed fixture now uses
the existing `findDraftItem` owner read model and passes `malformedItem.ref()` to the exact blocker assertion. The
owner service, contract, generated output and product semantics were not changed. The exact oracle remains strict on
one violation, blocker kind, nullable/item target and message key, and the failed publish still requires no-write
readback.

## 2026-09-03 · SM-05 publish blockers oracle repair static step admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent read-only verifier Poincare re-opened the active design/contract, SalesMenu and Catalog sources,
the current scenario and the failed run artifacts. It confirmed that the repaired identity follows the same
`addItems -> findDraftItem -> salesItemRef` pattern already used by the generated-route scenario, found no remaining
old Catalog-ref blocker assertion, and confirmed that the failed run's cleanup was independently PASS. The author
then ran the current backend Spotless, UTF-8 line-limit and `compileTestJava` checks successfully.

```text
REVIEW_CYCLE_ID=STEP_SM05_PUBLISH_BLOCKERS_ORACLE_FIX
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
STATIC_SPOTLESS=PASS
STATIC_UTF8_LINE_LIMIT=PASS
STATIC_COMPILE_TEST_JAVA=PASS
ALLOW_DYNAMIC_RUN=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static repair admission only; not focused dynamic PASS, full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

This closes the static repair step and authorizes exactly one next managed focused run of
`sales-menu.publish-blockers`; it does not convert the failed run into PASS evidence.

## 2026-09-03 · SM-05 publish blockers repaired focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

After the static repair admission, the scenario was executed alone through the managed remote Testcontainers
runner. The repaired fixture first reads the SalesMenu draft item and uses its stable `salesItemRef`; the owner,
contract and generated sources were unchanged. The run passed the real preview and publication negative branches,
including exact blocker identity and no-write/readback assertions. Its disabled-activation branch also proved that a
valid draft remains publishable when the menu activation is disabled; this scenario's malformed-price branch is
specifically the missing listed-price case, not a claim about every malformed-price variant.

```text
RUN_ID=r5-tc-1788427854993-46602
SCENARIO=sales-menu.publish-blockers
SOURCE_SYNC=PASS; REMOTE_GRADLE=0; CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=14
HTTP_EVENTS=133; HTTP_STATUS_SHAPE=200,201,404,422; SQL_EVENTS=2323; UNCLASSIFIED_SQL=0
FIRST_FAILURE=null
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; STUB_ONLY=0; DIRECT_FAILURES=0
```

The result artifact reports `DISCOVERED=99`, `SELECTED=1`, `HTTP_SUCCESS=1`, `REAL_BUSINESS_ASSERTIONS=1`,
`CONTRACT=PASS` and `BUSINESS=PASS`. The HTTP/DB archives and statement dictionary have manifest/index byte and SHA
receipts; the SQL measurement is fully classified. This is one focused scenario only and does not prove full SM-05,
browser L2, DEV, seed/reset, UAT or production behavior.

## 2026-09-03 · SM-05 publish blockers focused post-proof

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent post-proof re-opened the active scenario/owner/schema sources, the failed baseline and the repaired
run's manifest, result, HTTP/DB events and archive index. It confirmed that only the intended scenario was selected,
the real business result is separate from operation measurement, the exact-one blocker oracle and typed target rules
are exercised, the failed branches preserve readback state, and cleanup/archive are independently PASS.

```text
REVIEW_CYCLE_ID=STEP_SM05_PUBLISH_BLOCKERS_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The `publish-blockers` step is closed. The next serial step remains `inventory-availability-matrix`; no result from this
scenario is counted as completion evidence for the remaining SM-05 scenarios or later modules.

## 2026-09-03 · SM-05 inventory availability current-byte static admission

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent verifier Lagrange re-opened the current requirements, IA, implementation design/plan, inventory and
SalesMenu owner APIs, the Catalog inventory HTTP bridges, the test-only one-read failure decorator and the current
acceptance scenario. It re-derived the six fixture rows instead of relying on the older run: absent target,
normal stock, low stock, out of stock, negative stock allowed and negative stock denied, plus one controlled owner-read
failure. It found no current static OPEN finding and confirmed that the recent shared acceptance changes do not alter
this scenario's source or semantics.

```text
REVIEW_CYCLE_ID=STEP_SM05_INVENTORY_AVAILABILITY_STATIC_CURRENT
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
STATIC_TRUTH_TABLE=PASS
ALLOW_DYNAMIC_RUN=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static current-byte admission only; historical dynamic PASS not counted as this run's dynamic proof
```

The scenario is admitted for one serial managed focused run. The later result must independently prove the real HTTP
business oracle, the controlled `UNKNOWN/READ_UNAVAILABLE` branch and cleanup/archive; it must not be expanded to
full SM-05, browser L2, DEV, seed/reset, UAT or production behavior.

## 2026-09-03 · SM-05 inventory availability current focused run

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The current-byte-admitted inventory scenario ran alone through the managed remote Testcontainers runner. It used the
real Catalog and Inventory HTTP bridges for six independently configured fixture rows, published the menu, read the
published list/detail, armed the test-only one-read decorator and consumed it through a real published-item HTTP read.
The business oracle passed without altering the SalesMenu or Inventory production owner.

```text
RUN_ID=r5-tc-1788428536148-57981
SCENARIO=sales-menu.inventory-availability-matrix
SOURCE_SYNC=PASS; REMOTE_GRADLE=0; CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; DB_OPERATIONS=20
HTTP_EVENTS=120; HTTP_STATUS_SHAPE=200,201; SQL_EVENTS=2186; UNCLASSIFIED_SQL=0; PUBLISHED_READ_DML=0
FIRST_FAILURE=null
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; STUB_ONLY=0; DIRECT_FAILURES=0
```

The result artifact reports `DISCOVERED=99`, `SELECTED=1`, `HTTP_SUCCESS=1`, `REAL_BUSINESS_ASSERTIONS=1`,
`CONTRACT=PASS` and `BUSINESS=PASS`. HTTP events include the six Catalog predecessor chains, six inventory
configuration updates, three count commands, two adjustments, one publish, published list/detail reads and the
repeat-read path. DB events are fully classified; published read subsets contain no DML. This closes only the
inventory focused scenario, not full SM-05, browser L2, DEV, seed/reset, UAT or production verification.

## 2026-09-03 · SM-05 inventory availability focused post-proof

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent post-proof re-opened the current inventory scenario, Catalog/Inventory/SalesMenu owner sources,
the failure decorator, the applicable design and the complete run artifacts. It confirmed the six state matrix,
separate manual status, real HTTP consumption of `UNKNOWN/READ_UNAVAILABLE`, repeat readback, zero unclassified SQL,
no DML on published reads, and independent resource/archive cleanup.

```text
REVIEW_CYCLE_ID=STEP_SM05_INVENTORY_AVAILABILITY_POST_PROOF
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=YES
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
EVIDENCE_BOUNDARY=focused backend acceptance only; not full SM-05, browser L2, DEV, seed/reset, UAT or production proof
```

The inventory failure family is closed for this current run. The next serial step is manual-sale status and restore.

## 2026-09-03 · SM-05 manual-sale confirmation error contract drift repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh independent verifier Bacon completed Round 2 of the same static review cycle and found one OPEN finding:
`SalesMenuOwnerService` already rejects an unconfirmed manual restore with the existing `CONFIRMATION_REQUIRED`
problem, but that existing wire behavior was absent from the error disposition catalog, the operation error
augmentation, the manual-restore OpenAPI error closed set and the generated `EdgeProblemCode`. The cycle had reached
its hard two-round limit, so no third reviewer was called. The author re-opened the owner branch, operation catalog,
OpenAPI path and generator inputs, and confirmed this is contract synchronization for an existing behavior rather than
a new business branch or product semantic.

```text
REVIEW_CYCLE_ID=STEP_SM05_MANUAL_SALE_STATIC_CURRENT
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
F-R2-001=CONFIRMED_AND_REPAIRED
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED
```

The repair adds `CONFIRMATION_REQUIRED` to the accepted V2S error disposition catalog and its closure counts, adds it
to `restoreOperationsSalesMenuItemSale` in the edge operation error augmentation and the manual-restore OpenAPI
closed set, then regenerates the outputs. No generated file was hand-edited. The current static chain is:

```text
node scripts/generate/edge-codegen.mjs --write => R5_EDGE_CODEGEN_WRITE=PASS; FILES=361
node scripts/generate/edge-codegen.mjs --check => R5_EDGE_CODEGEN_CHECK=PASS; FILES=361
scripts/check/sales-menu-contract => SALES_MENU_CONTRACT=PASS; AFFECTED_OPERATIONS=31; SALES_MENU_OPERATIONS=30; SALES_MENU_COMMANDS=19
scripts/check/operation-handler-bindings => BP_U02_BINDING_CHECK=PASS; FILES=30
scripts/check/openapi-contracts => R5_OPENAPI_CONTRACTS=PASS
./gradlew :apps:backend:catering-business-server:spotlessApply :apps:backend:catering-business-server:spotlessCheck :apps:backend:catering-business-server:compileTestJava --no-daemon => BUILD SUCCESSFUL
```

```text
ALLOW_DYNAMIC_RUN=YES
SM-05_ALLOWED=NO
EVIDENCE_BOUNDARY=static contract repair only; manual focused business/cleanup, full SM-05, browser L2, DEV, seed/reset, UAT and production proof remain open
```

This closes the static contract finding and admits exactly one serial managed focused run of
`sales-menu.manual-sale-status-and-restore`. The next result must prove the real HTTP business oracle, exact
confirmation and reason failures, no-write readback, channel isolation, inventory independence, operation history and
cleanup separately.

## 2026-09-03 · SM-05 manual-sale replay target recheck repair and focused proof

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The second round of the independent `STEP_SM05_MANUAL_SALE_POST_PROOF` review was `NO-GO` before this repair because
`SalesMenuOwnerService.receipt` read an existing receipt before rechecking the actual menu/store/channel/item target.
The finding was confirmed against the detailed design §10.3f and the owner capability lookup practice. The author did
not call a third reviewer: the review cycle had reached its hard two-round limit.

The minimum source repair keeps the workspace/operation/idempotency advisory lock, then locks and rechecks the actual
menu/store/channel target before receipt lookup. It deliberately does not compare `expectedVersion` on that pre-replay
path; the existing CAS remains after a non-replay receipt decision. Section and item mutation targets are also checked
before receipt lookup. The manual receipt request now includes group workspace, store, menu, channel and item identity,
in addition to state, reason and expected version, so a path change cannot share a manual intent hash.

The acceptance scenario adds one falsifiable negative: it reuses the successful sold-out idempotency key against a
random non-existent sales-menu path and asserts typed `SALES_MENU_NOT_FOUND`, then compares the original published
item readback byte-for-byte. The owner unit test also verifies the new lock → target → receipt → CAS/write order.

```text
REVIEW_CYCLE_ID=STEP_SM05_MANUAL_SALE_POST_PROOF
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INDEPENDENT_ROUND2_VERDICT=NO-GO_BEFORE_REPAIR
F-R2-001=CONFIRMED_AND_REPAIRED
POST_ROUND2_AUTHOR_DISPOSITION=SELF_DECIDED_AFTER_REPAIR
FINDINGS=OPEN=0
VERDICT=STEP-CLOSED_AFTER_REPAIR
```

Static and unit proof:

```text
./gradlew :apps:backend:catering-business-server:modules:sales-menu:spotlessCheck :apps:backend:catering-business-server:compileTestJava --no-daemon => BUILD SUCCESSFUL
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test --tests com.catering.v2s.salesmenu.application.SalesMenuOwnerServiceOwnerApiTest --no-daemon => BUILD SUCCESSFUL; 14/14
```

The single serial managed dynamic proof was:

```text
RUN_ID=r5-tc-1788437993677-16491
SCENARIO=sales-menu.manual-sale-status-and-restore
CONTRACT=PASS; BUSINESS=PASS; businessMode=REAL; REAL_BUSINESS_ASSERTIONS=1; DB_OPERATIONS=13
HTTP_EVENTS include setOperationsSalesMenuItemSoldOut statuses 200,200,404,409,422,409
HTTP_EVENTS include restoreOperationsSalesMenuItemSale statuses 422,200,200
WRONG_TARGET_REPLAY=HTTP_404; BUSINESS_ORACLE=SALES_MENU_NOT_FOUND; ORIGINAL_READBACK_UNCHANGED=PASS
BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=68 SQL_OPERATIONS=990 UNCLASSIFIED_SQL=0
FIRST_FAILURE=null; LAST_KNOWN_GOOD=CLEANUP; BROKEN_BOUNDARY=null
REMOTE_PROCESS_CLEANUP=PASS; REMOTE_WORKSPACE_CLEANUP=PASS; TESTCONTAINERS_CONTAINERS=PASS; TESTCONTAINERS_VOLUMES=PASS
EVIDENCE_ARCHIVE=PASS; MANIFEST_FINISHED_AT=2026-09-03T12:20:53.552Z
```

Authoritative artifacts are under
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1788437993677-16491/`, including `run-manifest.json`, archived
HTTP/DB/acceptance results, statement dictionary and `evidence-artifacts.tsv`. This closes only the manual-sale
focused backend step and its confirmed replay finding; full SM-05, browser L2, all 31-operation execution coverage,
SM-06–SM-12, DEV/seed/reset, UAT and production-owner verification remain open.

## 2026-09-03 · L2 scope control denominator repair and static recheck

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

Fresh static review found one confirmed pre-admission issue: the sales-menu L2 binding/touch path represented the
shared scope trigger, selectors, dynamic options and confirmation metadata as one `STORE_SCOPE` control. The source
review confirmed that the UI already owns stable test IDs, but the execution denominator could not distinguish the
real action nodes. The repair did not change product semantics or the fixed STORE/STORE-readonly Journey. It:

- keeps the existing shared `DataScopeSelector` and foundation interaction;
- makes the existing `roleHomeTestIds` option vocabulary type-specific while preserving owner `dataNodeRef` identity;
- makes the shared scope helper report `TRIGGER`, `SELECTOR`, `OPTION`, `CONFIRM` and `CANCEL` as distinct touch phases;
- adds separate scope binding keys to the hand-authored sales-menu blueprint and regenerates all P1 outputs;
- changes all 18 active sales-menu cases from aggregate `STORE_SCOPE` to the actual fixed-role `STORE_SCOPE_TRIGGER` touch.

The fixed STORE role disables scope mutation selectors, options and confirmation/cancel in this Journey, so those nodes
are binding vocabulary but are not falsely declared as touched by these 18 cases. A future scope-changing Journey must
declare the exact selector/option/confirm/cancel keys in its own case denominator.

```text
node scripts/generate/sales-menu-p1.mjs --write --self-test => SALES_MENU_P1_SELF_TEST=PASS; CASES=18; OPERATIONS=31
yarn workspace @catering-v2s/operations-admin typecheck => PASS
yarn workspace @catering-v2s/operations-admin test:unit => PASS; 217/217
yarn workspace @catering-v2s/operations-admin test:architecture => PASS; 40 pass; 4 TODO; 0 fail
yarn format:check => PASS
./scripts/verify --validate-only => static gates PASS; Gradle BUILD SUCCESSFUL
```

```text
SCOPE_BINDING_KEYS=11
ACTIVE_SCOPE_TRIGGER_CASES=18
OLD_AGGREGATE_STORE_SCOPE_CASES=0
CASE_COUNT=18
OPERATION_COVERAGE=31
L2_PRE_ADMISSION=GO
DYNAMIC_BROWSER_L2=UNPROVEN
BUSINESS_AND_CLEANUP=UNPROVEN
```

Independent static recheck verdict: `L2_PRE_ADMISSION=GO`, `UI_DESIGN_REVIEW=PASS_STATIC`,
`TESTID_REVIEW=PASS_STATIC`, `L2_SCRIPT_ADMISSION=PASS`, `M/S/N=0/0/1`. The single N is documentation-only:
the implementation design summary now records the corrected 254 declared control entries (the previous 240 figure had
no stated exclusion basis). The verifier confirmed no semantic, UI, binding, touch or denominator finding; browser
L2, HTTP, business and cleanup remain unproven and are not included in this GO.

```text
INDEPENDENT_REVIEWER=INDEPENDENT_SUBAGENT
INDEPENDENT_VERDICT=L2_PRE_ADMISSION=GO
N-1=CONFIRMED_AND_REPAIRED_DOCUMENTATION_COUNT
FINDINGS=OPEN=0

## 2026-09-03 · L2 full-run HMR attribution and isolated owner-fact repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The interrupted full browser-L2 run `l2-1788442213920-99841-c845af9d-aacc-4226-b7a4-990837690d4c` was not accepted as
stable UI evidence. Its readiness manifest recorded `frontendMode=dev`; the operations-admin Vite refresh log recorded
289 HMR/update/invalidate events between 22:36:06 and 22:39:08 KST, including repeated invalidation of
`SalesMenuPage.tsx` because its exported helper was incompatible with Fast Refresh. The run was stopped after the
second `SALES_MENU_L2_CHANNEL_REF_NOT_VISIBLE` failure; business was `NOT_RUN` and cleanup was `PASS`.

The HMR occurrence is confirmed, but the writer is not. Reading files does not produce a Vite HMR update. The Vite
watch boundary only allows the operations-admin `src`/`public` trees and the shared foundation `src`; `apps/terminal`
and other unrelated project directories are ignored. The other active terminal task's latest turn began at 22:39:55
KST, after this run's last case event at 22:39:02 KST, so the available task timeline does not support attributing this
run's HMR to that task. No historical filesystem event log identifies a particular writer. The next dynamic attempt
must therefore use `R5_L2_FRONTEND_MODE=preview` and must not use this dev/HMR run to decide a UI or owner-code repair.

The same run independently confirmed a separate L2 fixture/helper defect: isolated `MENU-07` items were materialized
in `menuFactsByFixture` and emitted as `salesItemRefs` in the case, while the spec searched only the primary
`ownerFacts.salesItems`. The repair emits the case-scoped `salesItems`, validates exact ordered ref agreement without
rejecting legal empty sets, and resolves item codes only by the exact case-scoped `salesItemRef`. This follows the
existing Catalog per-case owner-fact boundary and does not add a fixture DSL, fallback, item-code lookup or product
semantic.

```text
STATIC_TYPECHECK=PASS
STATIC_FORMAT=PASS
RUNTIME_NODE_SYNTAX=PASS
INDEPENDENT_REVIEWER=Boyle; reviewerKind=INDEPENDENT_SUBAGENT
STEP_REVIEW=GO; M/S/N=0/0/0; FINDINGS=OPEN=0
HMR_WRITER=UNVERIFIED
DYNAMIC_PREVIEW_FOCUSED=NOT_YET_RUN
SM05_FULL_BROWSER_L2=OPEN
```

This closes only the confirmed isolated owner-fact repair and its static step review. It does not close the HMR
environment question, channel visibility, menu-schedule interaction, full SM-05, browser business/cleanup proof,
SM-06–SM-12 or final implementation review.

## 2026-09-03 · L2 channel read-model settle race repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The preview focused run `l2-1788444877422-25037-78ce4203-89ed-40b1-be40-7195ee2b44f4` had no operations-admin HMR
events. Its first failure was `SALES_MENU_L2_CHANNEL_REF_NOT_VISIBLE:d82aebd8-0bed-4e7d-8b42-8fe8a440e2c9` in
`findChannelCard`. The trace shows the channel HTTP response completed with status 200, while the next Playwright
snapshot still had an empty channel-card body and a disabled next cursor; the later failure snapshot contained the
20 rendered channel cards, including the target's visible name. The one-shot test read therefore raced the RTK Query
`currentData` response-to-render boundary. This is a test read-model readiness defect, not evidence of another agent
refreshing the frontend and not a production owner-logic finding.

The repair keeps the exact dynamic `salesMenuTestIds.channelCard(channelRef)` as the action locator. Before deciding
that the target is absent, it waits for either that exact target to appear or the existing next-cursor control to
become enabled, then records `SALES_MENU_CHANNEL_PAGE_READ_MODEL_SETTLED` with target count, page index and cursor
state. It does not wait on HTTP event counts, add a fallback locator, alter product semantics, or widen a business
assertion.

```text
STATIC_TYPECHECK=PASS
STATIC_FORMAT=PASS
RUNTIME_NODE_SYNTAX=PASS
HMR_IN_PREVIEW=ABSENT
HMR_WRITER=UNVERIFIED
INDEPENDENT_STEP_REVIEW=Ptolemy; reviewerKind=INDEPENDENT_SUBAGENT; STEP_REVIEW=GO; M/S/N=0/0/2
DYNAMIC_PREVIEW_FOCUSED=OPEN_AFTER_REPAIR
SM05_FULL_BROWSER_L2=OPEN
```

The independent step review confirmed that the exact `salesMenuTestIds.channelCard(channelRef)` remains the action
locator, that the DOM-only settle condition addresses the recorded response-to-render race, and that no HTTP
observation count, fallback locator, wide locator, or control-denominator drift was introduced. The two N findings
are limited to the 5-second settle-window sufficiency and the still-unproven post-repair dynamic result; they do not
authorize treating this step or SM-05 as complete.
```

## 2026-09-04 · L2 operation-coverage declaration closure

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

The post-focused independent review found that `operationCoverage[].l2Cases` could claim an operation for a case that
did not declare it as either direct `parameter.operationIds` or explicit `backgroundAllowed`. The concrete entry was
`deleteOperationsSalesMenuItem -> sales-menu-draft-order-and-pagination`: the focused case only moves an item and its
fresh run had no delete completion. A whole-denominator scan found the same root across the 31 operation × 18 case
matrix: six false case claims and seven missing direct-operation claims. This was a declaration/generator defect, not a
production-owner, UI-control, fixture, HMR or timeout defect.

The unique hand-authored source remains `contracts/policy/sales-menu-l2-case-blueprint.json`. It now removes the false
claims (published-item/manual restore, create/auth, schedule/copy, section delete/failure recovery, section
move/failure recovery, item delete/draft pagination), adds every missing direct L2 link, and preserves the three
legitimate shared/background differences. In particular, copy still asserts that the copied detail has the source
`draftSchedule`; it does not falsely claim to invoke `updateOperationsSalesMenuSchedule`. No product semantic, UI
action, fixture identity, timeout or generated file was manually changed.

`scripts/generate/sales-menu-p1.mjs` now rejects both directions: every coverage claim must be declared by the mapped
case as direct or background network, and every direct operation inside the 31-operation sales-menu denominator must
be mapped back to that case. `runSelfTest()` carries two in-memory red mutations for those two violations. This is the
smallest durable control at the existing P1 source boundary, not a new runner, fixture DSL or test platform.

```text
node scripts/generate/sales-menu-p1.mjs --write --self-test => PASS; CASES=18; OPERATIONS=31
yarn exec prettier --check scripts/generate/sales-menu-p1.mjs contracts/policy/sales-menu-l2-case-blueprint.json doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md => PASS
yarn workspace @catering-v2s/operations-admin typecheck => PASS
node --check scripts/generate/sales-menu-p1.mjs => PASS
COVERAGE_OUTSIDE_DECLARED_NETWORK=0
DENOMINATOR_DIRECT_OPERATION_WITHOUT_COVERAGE=0
INDEPENDENT_STEP_REVIEW=Ohm; reviewerKind=INDEPENDENT_SUBAGENT; STEP_REVIEW=GO; M/S/N=0/1/0
S-1=getOperationsCatalogNavigation is direct for the candidate case but outside the sales-menu 31-operation denominator; its own case network declaration remains required and budgeted
FULL_SM05_BROWSER_L2=OPEN_FRESH_RUN_REQUIRED
```

The independent verdict authorizes only a fresh 18-case browser-L2 run. It does not upgrade the previous single-case
focused diagnostic (`BUSINESS=NOT_RUN`) to business proof and does not close SM-05, SM-06–SM-12, DEV, seed/reset,
UAT, deployment or the final implementation review.

## 2026-09-04 · post-review repair and fresh full browser-L2 closure

This section records the evidence after the independent implementation review's S-2/N-1 findings. It does not rewrite
the earlier history: the prior `l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583` run remains historical
evidence from before the persisted-runtime-state repair.

The confirmed N-1 consistency gap was repaired at the existing foundation boundary. The five query-backed sales-menu
list surfaces now use the existing `adminListState` capability with explicit list prefixes and mutually exclusive
loading/failed/empty handling: candidate list, menu-manager list, draft-item list, published-item list and operation-log
list. The manager, draft, published and operation-log read failures retain their existing Alert/retry paths; the
candidate failure path also remains explicit. The two SKU tables inside already-hydrated item editors are local editor
tables, not query-backed cursor list surfaces, and were deliberately left unchanged. No new foundation abstraction,
business semantic, operation, data-model field or locator was introduced.

```text
yarn workspace @catering-v2s/operations-admin vitest run src/features/sales-menu/ui/SalesMenuPage.static.test.ts src/features/sales-menu/ui/SalesMenuPage.test.tsx => PASS; 2 files; 23 tests
yarn workspace @catering-v2s/operations-admin typecheck => PASS
yarn workspace @catering-v2s/operations-admin lint:architecture => PASS
node scripts/generate/sales-menu-p1.mjs --write --check => PASS; CASES=18; OPERATIONS=31
scripts/verify --validate-only => R5_VERIFY_VALIDATE_ONLY=PASS; EXECUTED=21/21; CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

Fresh independent step review after this repair: `INDEPENDENT_REVIEWER=Planck`, `reviewerKind=INDEPENDENT_SUBAGENT`,
`VERDICT=GO_WITH_UNVERIFIED_UI`, `M/S/N=0/0/0`. The reviewer confirmed the five query-backed table surfaces are the
applicable N-1 scope, the existing foundation helper is used, error retry remains available, and the two SKU editor
tables are out of scope for this finding. The browser result below is the separate dynamic proof; it is not replaced by
this static review.

The authorized fresh full browser-L2 run is:

```text
RUN_ID=l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b
TOPOLOGY=LOCAL_SPRING_LOCAL_VITE_LOCAL_PLAYWRIGHT_REMOTE_DB_ASSET_TUNNEL
EXECUTION=PASS; DISCOVERED=18; SELECTED=18; RESULTS=18; EXECUTED=18; NOT_RUN=0
BUSINESS=PASS; CLEANUP=PASS; FIRST_FAILURE=null; LAST_KNOWN_GOOD=L2_18_CASES_PASS; BROKEN_BOUNDARY=null
ACTION_START=18; ACTION_COMPLETE=18; CONTROL_TOUCHES=342; JOIN_STATUS=COMPLETE
MISSING_DECLARED_CONTROL_KEYS=0; UNEXPECTED_TOUCHED_CONTROL_KEYS=0; INVALID_CASE_SCOPED_EVENTS=0
EXPECTED_OPERATION_HTTP_EVENTS=466; EXPECTED_OPERATION_IDS=31/31
EXPECTED_OPERATION_STATUS=410x200; 54x201; 1x404 and 1x409 are expected negative-path responses covered by passing oracles
SOURCE_BINDING_FINALIZE=PASS; FILES=1451; BYTES=12555992; OUTSIDE_SCOPE=0
BINDING_SCOPE=apps/backend + apps/frontend input files, excluding managed runtime/build output
```

The fresh execution evidence is held at
`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-execution-manifest.json`,
`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-join-artifact.json`,
`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-cleanup-manifest.json`,
`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/http-request-events.jsonl` and
`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/repository-byte-binding.json`.
The 31-operation denominator is the unique `operationCoverage[].operationId` set in
`contracts/policy/sales-menu-l2-case-blueprint.json`; comparing that set with the fresh HTTP event stream yields no
missing ID and no unexpected ID within the denominator. Bootstrap/reference operations are outside this comparison.

The persisted runtime-state repair is also covered by the existing `browser-l2-runtime.test.mjs` regression (`65/65`
static cases PASS). A read-only key scan of the fresh execution, join, cleanup, binding and runtime-state JSON found no
`secret` or `hmac` field. The runtime state retains only credential-path metadata and process identity fields; credential
values are not part of the persisted state. The debug event stream contains expected aborted-navigation/negative-path
diagnostic records, but every case has `browserRuntimeErrorCount=0` and the authoritative execution manifest has
`firstFailure=null`; those diagnostic records do not change the business verdict.

Existing supporting evidence remains separately bounded: the remote Testcontainers acceptance regression is 99/99
business/contract PASS with cleanup PASS and exact 268/268 operation-set closure; the fresh reset/seed parent and
sales-menu child are business PASS with cleanup preserving the managed DEV state. These are not substituted for the
fresh browser-L2 result. Seed-after-DEV page visibility remains outside this authorized review boundary.

```text
SM05_BROWSER_L2=PASS
SM05_BROWSER_L2_CLEANUP=PASS
SM05_L2_OPERATION_COVERAGE=31/31
SM05_L2_SOURCE_BINDING=PASS; SCOPE=apps/backend,apps/frontend
SM05_L2_DYNAMIC_ARTIFACT_HYGIENE=PASS_FOR_FRESH_ARTIFACTS; STATIC_REGRESSION=65/65
S1_LARGE_PAGE_SPLIT=DEFERRED_TO_SM06; NOT_A_CURRENT_FUNCTIONAL_BLOCKER
N2_BACKEND_SCENARIO_ENUMERATION=UNVERIFIED_REQUIRES_EVIDENCE; NO_FINDING_OPENED
DEV_PAGE_VISIBILITY=OUT_OF_SCOPE_BY_DEXTER_DECISION
SM06_TO_SM12=NOT_CLAIMED
UAT_DEPLOYMENT_CUTOVER=NOT_CLAIMED
```
