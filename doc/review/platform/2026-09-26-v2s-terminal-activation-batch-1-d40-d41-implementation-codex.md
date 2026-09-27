# Terminal activation batch 1 — D-40 / D-41 implementation evidence

## Scope and current state

This record covers the D-40 credential decision change, D-41 repository-owned input closure, and the current Step 3 generated binding-readback contract repair authorized within batch 1. It does not claim batch completion, a `GO`, runtime acceptance, L2 admission, reset, or seed. D-41 has a fresh independent read-only three-dimensional `MATCHED` result recorded below. D-40 module proof and the binding-readback source/generation proof are local only; the current Step 3 reconciliation and backend HTTP/WebSocket acceptance remain open.

## D-40 · ended binding no longer retains or compares deviceId

The implementation follows requirement D-40 without changing Claude-owned requirements or the accepted service-shape decision. For the current generation, secret digest is checked first; a matching digest on an ended binding returns `ACTIVATION_CANCELLED` before device comparison. An active binding still rejects a mismatched `deviceId` as `CREDENTIAL_INVALID`. The shared `TerminalCredentialDecision` is used by both TDS verification and device cancellation, so device cancellation maps the ended/matching-secret case to `ALREADY_CANCELLED` without mutation.

`latest_binding.bound_device_id` is nullable at rest only for the ended state: the migration check requires a 1–128 character non-null id for `ACTIVE` and `NULL` for `ENDED`; `endActive` clears the id in the same update that records the end and copies the secret digest/generation into the existing latest-ended columns. Reactivation writes the new active device id. No device digest was added. The database migration has not yet been exercised against PostgreSQL; that proof is deferred to the authorized managed backend-acceptance step.

Focused source cases now cover: matching ended secret with a different device id → `ACTIVATION_CANCELLED`; wrong ended secret → `CREDENTIAL_INVALID`; active device mismatch → `CREDENTIAL_INVALID`; device cancel of the ended matching-secret case → `ALREADY_CANCELLED` with no end/write/audit/receipt/notification; and unchanged lower/future-generation and owner-invariant cases. Detailed design §8 and §10.1 and V-B4/V-S2 row wording were synchronized.

Focused build/test history, including the preserved compile and test-fixture first failures plus the Spotless diagnostics, is in [the debugging record](2026-09-26-v2s-terminal-activation-batch-1-debugging-codex.md). Current local focused result: `./gradlew :apps:backend:catering-business-server:modules:terminal-binding:test --console=plain`, run `D40-FOCUSED-2026-09-26T1541Z`, 2026-09-26 15:41:01Z, `BUILD SUCCESSFUL`, 18 tests across four test classes, XML reports 0 failures, errors, or skips. `D40-SPOTLESS-CHECK-2026-09-26T1540Z` passed the module byte-line and Spotless checks. This is focused module proof only; it is not database migration, real HTTP, TDS, backend-acceptance, or WebSocket proof. A fresh independent three-dimensional reconciliation for the current implementation step is still required.

## D-41 repository-owned inputs

The former 17 R5 schema inputs are now under `contracts/openapi-source/r5-baseline/contracts/openapi/`. Their catalog SHA-256 values remain the input pins and were checked against all 17 local files (`LOCAL_R5_BASELINE_HASHES=17;PASS`). Before those files became the accepted local source, an isolated old-source/local-source materialization compared every relative output path and every byte: 57 generated artifacts, 235 operations, face counts 61/162/12. Both sorted output-manifest SHA-256 values were identical:

```text
former source: a0efaa5189cb7c514623163d1d4034db405923d60e5130edb892e01dbf19e727
local source:  a0efaa5189cb7c514623163d1d4034db405923d60e5130edb892e01dbf19e727
```

No tool read the former sibling project after that comparison. The only retained provenance is inert prose. The old source-path fields were removed or made local. The two heritage registries now enumerate the same 31 repository-local frozen assets and local expected hashes; all 31 assets matched when the local inventory was created. The `heritage-registry` checker remains active and only reads those local paths.

The pre-repair executable/provenance hit set and complete current path treatment are recorded under design §12 Q16. Reproduction commands there search executable/config input surfaces (`scripts`, `tools`, `contracts`) for the bare former project name, absolute workspace project paths and provenance keys; the current hit set is empty. A separate current-path scan resolves all 89 declared paths across the two R5 catalogs, the error-disposition catalog, and both heritage catalogs; all exist and their canonical targets stay in the repository. The second error-disposition source was corrected from the stale `.yaml` description to the existing `.json` file; its retained SHA-256 matches the local file. No unread source/path field points to another checkout.

Both data-driven readers fail closed for invalid, absolute, lexical root-escape, and symlink-escape paths. Their self-tests now exercise all three escape forms independently:

```text
R5_EDGE_MATERIALIZE_SELF_TEST=PASS
FIXTURE=root-traversal-path; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=R5_EDGE_INPUT_PATH_OUTSIDE_ROOT
FIXTURE=absolute-external-path; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=R5_EDGE_INPUT_PATH_INVALID
FIXTURE=symlink-mediated-escape; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=R5_EDGE_INPUT_PATH_OUTSIDE_ROOT
HERITAGE_REGISTRY_SELF_TEST=PASS
FIXTURE=repository-root-escape-path; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=HERITAGE_INPUT_PATH_OUTSIDE_ROOT
FIXTURE=absolute-external-path; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=HERITAGE_INPUT_PATH_INVALID
FIXTURE=symlink-mediated-escape; EXPECTED=FAIL; ACTUAL=FAIL; MARKER=HERITAGE_INPUT_PATH_OUTSIDE_ROOT
HERITAGE_REGISTRY=PASS
```

The D-41 self-tests now run before the materializer check in both `scripts/verify --validate-only` and the default static lane, and all D-41 entries precede `openapi-contracts`. This keeps both reader fixture families observable when the subsequent materializer check is currently red. The R5 entry reports its measured child duration. `node --test scripts/test/standards-enforcement-verify.test.mjs` passed 6/6, including the duration marker and gate ordering assertions. The current executable/provenance scan remains empty, and the 17 local source pins remain `PASS`.

The third fresh independent read-only three-dimensional step reconciliation (`d41_final_reconcile`) returned `STEP_RECONCILIATION=MATCHED` for D-41. It independently confirmed the current Q16 hit treatment, all 89 declared local paths, the corrected local error-schema source/hash, six fail-closed path fixtures, and static gate ordering. It did not rerun generators or read the former sibling checkout; the recorded 57/57 old/local byte comparison remains historical evidence from before local-source acceptance. Its only remaining note is the already-preserved materializer nullable drift below, which belongs to the next generation-closure step.

## Preserved first materializer failure

The first current-byte `r5-edge-materialize --check` failure is preserved as:

```text
R5_EDGE_GENERATED_OUTPUT_DRIFT:components/sales-menu/sales-menu.schemas.json
```

Scratch-only expected output inspection located two pre-existing `nullable` differences in that generated file. This is not attributed to the D-41 source copy: the old/local isolated comparison proved byte identity. No generated file has been written by the main agent during D-41 closure. This record does not claim independent historical provenance for all current generated bytes; source/output closure will be established by the owning materializer in the next step, not by hand editing.

## R5 materializer and edge-codegen closure after D-41

The preserved first R5 materializer failure was repaired by its owning generator, not by hand-editing outputs. `node scripts/generate/r5-edge-materialize.mjs --write` reported 235 operations and face counts 61/162/12. Exactly three of the 76 snapshotted output files changed:

| Output | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `contracts/openapi/components/sales-menu/sales-menu.schemas.json` | `6fd0374e0a66c43e95d5846470c286195b20ce047ea9da0616ed2c87458d8225` | `18bdcaa478f76178c25551b01c9407cac939730dbd207e27e48224d3286fd078` |
| `contracts/openapi/components/store-terminal/store-terminal.schemas.json` | `84e7079dab50262d80dc478be4023318b6202cf42d44f14bc08119af38423f3e` | `e8f3533a00aadb1a1ccdd343470a073aa625d54219ee3f6b55fa682c28f1c35f` |
| `contracts/openapi/paths/operations-admin/audit-history.paths.json` | `7558649f006ae4b4125cebbd092ab17d95ebf31e8509fc37ff90f056008f427b` | `7134c1f2d216f5fe9cb4a2e37dd6c76af3d0d5384debcff945a4df6f11a074b9` |

The immediate owner check `node scripts/generate/r5-edge-materialize.mjs --check` passed (14.323 s). The first subsequent identity-only `scripts/check/edge-codegen --check` failure was preserved as `R5_EDGE_TS_GENERATED_DRIFT:apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`. The cause was a stale generated contract: the current store-terminal OpenAPI source and newly materialized schema exclude `deviceType` from `StoreTerminalReplaceRequest`, while the Java/TypeScript generated outputs still required it. The evidence was a three-part contract mismatch: source schema, materialized schema and generated wire type.

After taking `/tmp/catering-v2s-edge-codegen-before-20260926T1506Z.json` (441 files across the seven generator-owned output roots), the owner `edge-codegen` ran with `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY` and `--write`. It generated 429 expected files and changed exactly six existing outputs:

| Output | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuManualSoldOutRequest.java` | `7a29ebe981bee103621ef9d31a607ec612641bdb0c7bd1791981b198c594d1f0` | `d4000c8b1a73bbdf304aaff28647f6d82065c4f4bb6af0794bebf7c962b9f971` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalReplaceRequest.java` | `2a4ed3040c9abdb772dde5173a12163fed20c71f06d66b9ad3fa275ce8d5b6f2` | `347e52ef2dd19c0a783ba254b2527ab9eecb2869f86be262ec61a40e468e5f26` |
| `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` | `1531aeeea192b3986a89ca7200ab8d1aab383645fc0fb280d727e440fe91d613` | `73286947a999ea4dd6e8186085c222da8647ef4b550a449bc5741bff7ce02667` |
| `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | `40a27d2dac401c005f382bcd738304060f113d8fc295ecba4832378f844301e6` | `83dd50a522f5da89746d1503ebe8b28971e95b618639418149c6f1264dd09b8e` |
| `apps/frontend/operations-admin/src/app/api/generated/public-edge.ts` | `0720fa9c6ea6934e2c9cb95b5a2f0796ba35b4a0deb7b168005093773faf7c35` | `a4e2cca7557cee6250f662238fa7df5c4fe05fff6170bde618025ef09c588870` |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts` | `5bed3b21a80ac3aae5c92f4958c59476c0479d9ee4e1acdbe5b1e8fa2e71466f` | `bf779cf3d8eaa61a582605d0901e322cfa6d2ed91d7fe5fd9a0d9370f2b0faaa` |

`V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/check/edge-codegen --check` then passed (`FILES=429`). This pre-CP-05 writer intentionally emits identity-only route and TypeScript projections without database budgets; they are an intermediate state, not a complete budget projection. The normal projection remains deferred until the three authorized all-operation calibrations. No generated output was edited directly.

For D-18, `replaceStoreTerminal` now sends only `name`, `configuration`, and `expectedVersion`; its content-idempotency projection has the same fields. The focused command test asserts the update request does not have `deviceType`, while create still sends it. Its first run failed because the test expected `configuration: {}` although the existing `configurationInput` serializes both empty `printers` and `functions` arrays. The first failure is retained here; only the incorrect test expectation changed, and the focused test passed 1/1 on the corrected assertion. `yarn format:check` passed before and after that change.

The R5 materialize/codegen closure subsequently regenerated the D-18 request as the schema defines it: `StoreTerminalReplaceRequest` omits `deviceType` in both generated Java and TypeScript; the controller's `strictBody` allowlist is `name`, `configuration`, and `expectedVersion`; the seed executor's replacement request also omits the field. This supersedes the earlier step-2 note that temporarily supplied `terminal.deviceType` while generated wire still required it. That note and its earlier `MATCHED` verdict are not evidence for current bytes. After removing the stale static assertion that required `deviceType` in the replacement consumer, current focused verification is:

| Proof | Run id / time (UTC) | Result |
| --- | --- | --- |
| `storeTerminalCommands.test.ts` | 2026-09-26 15:10:12 | PASS, 1/1 |
| `StoreTerminalPage.static.test.ts` | `D18-STATIC-2026-09-26T151700Z` | PASS, 14/14 |
| `yarn workspace @catering-v2s/operations-admin typecheck` | `D18-TYPECHECK-2026-09-26T151801Z` | PASS, exit 0 |
| `yarn format:check` | `D18-FORMAT-2026-09-26T151953Z` | PASS, all matched files formatted |

Current D-18 source readback confirms create still sends `deviceType`; update body and content-idempotency input contain only the replacement fields; edit UI renders owner readback as `Typography.Text`; C01/C02 remain selectable. A fresh independent step-level reconciliation is required against these current generated bytes and proofs before Step 3.

Memory/readback used for this step: backend route `implementation/backend/backend/backend/database/implementation` returned 21 memory paths; route manifest SHA-256 `096afa4105240161b1e26b1e6b07c1b75e9f43f65d4c590d3ad6a155b7763e0f`. Frontend route `implementation/admin-ui/operations-admin/frontend-platform/contract/implementation` returned 28 memory paths; route manifest SHA-256 `9d84b8c720c25a7bf17246214ed3556bc85b180c5a5c26abf247d96a74dc22ff`. Returned memory paths were opened and hashed. Applicable anchors re-opened include `doc/platform/frontend-coding-standard.md` §3-K-1/2, `doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md` “Dexter-authorized generated edge route consumer closure”, and `project-memory/decisions/http-crud-efficiency-design-redlines.md` `GENERATED_OPERATION_PATH_ONLY_FOR_CONSUMERS` / `BACKEND_SOURCE_HASH_CHAIN_CLOSURE` (SHA-256 `f0a075710211cbd62147d53a4bac6f7f9404755bf9d5b52f206e66c15f8ec34e`).

## D-18 post-change source/readback

The current requirement R-8.4 and the two existing store-terminal IA/interaction D-18 covers still say: create keeps its selectable type; edit displays the owner detail as plain read-only text; the replacement contract has no `deviceType`; an old raw property is rejected; and no owner mutation occurs. The generated Java request record, generated TypeScript request type and edit consumer now agree with that shape. `configurationInput` retains both empty arrays, so the focused test checks them rather than weakening the assertion to mere request existence. No user-visible behavior or product meaning changed in this synchronization.

## Review state

```text
D41_INPUT_PATH_SCAN=PASS
D41_R5_LOCAL_SOURCE_HASHES=17/17 PASS
D41_GENERATED_OUTPUT_COMPARISON=57/57 BYTE IDENTICAL
D41_HERITAGE_LOCAL_ASSETS=31/31 PASS
D41_PATH_ESCAPE_FIXTURES=PASS (6 explicit lexical/absolute/symlink cases across 2 readers)
D41_VERIFY_GATE_WIRING_TEST=6/6 PASS
D41_STEP_RECONCILIATION=MATCHED; FRESH_INDEPENDENT_READ_ONLY_RECONCILIATION=d41_final_reconcile
R5_FIRST_FAILURE=PRESERVED; R5_MATERIALIZE_WRITE=PASS; R5_MATERIALIZE_CHECK=PASS
EDGE_CODEGEN_FIRST_FAILURE=PRESERVED; EDGE_CODEGEN_IDENTITY_ONLY_WRITE=PASS; EDGE_CODEGEN_IDENTITY_ONLY_CHECK=PASS
D18_UPDATE_REQUEST_DEVICE_TYPE=OMITTED; COMMAND_TEST=PASS 1/1; PAGE_STATIC_TEST=PASS 14/14; TYPECHECK=PASS; FORMAT=PASS
D18_PRIOR_STEP2_RECONCILIATION=STALE_AFTER_CODEGEN_REGENERATION; CURRENT_STEP2_RECONCILIATION=MATCHED; FRESH_INDEPENDENT_READ_ONLY_RECONCILIATION=d18_step2_current
CP05_FULL_BUDGET_PROJECTION=DEFERRED_UNTIL_THREE_ALL_OPERATION_CALIBRATIONS
D40_SOURCE_AND_FOCUSED_TESTS=PASS (18/18; local module proof only); D40_STEP_RECONCILIATION=PENDING; D40_BACKEND_HTTP_AND_TDS_ACCEPTANCE=NOT_RUN
D18_STEP_RECONCILIATION=MATCHED; FRESH_INDEPENDENT_READ_ONLY_RECONCILIATION=d18_step2_current
STEP3_BINDING_READBACK_SCHEMA_GENERATION=PASS; APP_COMPILE=PASS; OPERATIONS_ADMIN_TYPECHECK=PASS; STEP3_INDEPENDENT_RECONCILIATION=MATCHED; FRESH_READ_ONLY_RECONCILIATION=step3_reconcile_binding_contract
REMOTE_SSH_TUNNEL_TESTCONTAINERS_DEV_BACKEND_ACCEPTANCE_L2_RESET_SEED=NOT_STARTED_IN_THIS_STEP
```

## Current Step 3 · binding readback contract and generated consumers

The current Step 3 schema repair, first failure, owning-source correction, generator outputs, focused checks and UTC run IDs are recorded in [the debugging record](2026-09-26-v2s-terminal-activation-batch-1-debugging-codex.md#step-3-contract-generation-repair). The implementation source changed the canonical local store-terminal schema and the R5 baseline catalog only; the requirement and store-terminal requirement were not modified. The OpenAPI response now requires `binding` and describes `INACTIVE` without activation details or `ACTIVE` with nonnegative epoch milliseconds and generation ≥ 1. Both Java and operations-admin generated consumers now contain the named binding types.

The first business app compile failure (`STORE_TERMINAL_BINDING_WIRE_SCHEMA_OUTPUT_MISSING`) was repaired at the owning OpenAPI source and regenerated through R5 materializer and edge-codegen. The first materializer `R5_EDGE_HERITAGE_HASH_DRIFT` was preserved and repaired by refreshing the local source pin while retaining the checker. Current local proof includes both owner `--check` commands, module dependency registry, Flyway layout, M1 command bindings, app `compileJava`, and operations-admin `typecheck`. Fresh independent three-dimensional Step 3 reconciliation `step3_reconcile_binding_contract` returned `MATCHED`. No full `scripts/verify`, managed process, remote SSH/tunnel, Testcontainers, DEV, backend-acceptance, L2, reset, or seed was run for this contract repair.

## Independent current Step 3 reconciliation

The fresh read-only reviewer `step3_reconcile_binding_contract` returned `STEP_RECONCILIATION=MATCHED` for the current Step 3 terminal binding readback contract closure. It read the requirement, design/plan and routed memories before comparing current sources and outputs. It confirmed R-3.7's inactive/active response shape and no-device-id/credential rule; source and materialized schemas agree, the local source hash matches the catalog pin, both named generated types exist, owner detail enforces each state shape, persistence selects only binding status/time/generation, and the controller maps only those fields. It also checked the D-40 active/ended classifier boundary.

The independent reviewer ran no tests, generators, builds, scripts, remote commands, DEV, Testcontainers, acceptance, L2, reset, or seed. The result is source/design/memory reconciliation only; real HTTP serialization, PostgreSQL migration, and WebSocket behavior remain unproven until their separately gated batch steps.
