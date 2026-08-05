# RP-02a Implementation Round 1 — independent blind review

```yaml
reviewCycleId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
reviewTarget: IMPLEMENTATION
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
reviewerInputWhitelist: true
authorMaterialReadAfterIndependentVerdict: false
authorMaterialReadBeforeIndependentVerdict: false
runtimeAuthority: false
seedResetAuthority: false
dynamicEvidence: NOT_RUN_BY_AUTHORIZATION
verdict: NO-GO
severity: M
```

## Blind-review declaration

This was a fresh source-first review. I read only the repository instructions and blueprint, the active program registry and current Roadmap block, required deterministic-context and review-governance memory, `scripts/README.md`, the RP-02a implementation activation decision, the edge catalog/projection/materializer and wrapper, the generated diagnostic registry and source-bound scenario/workload/fixture/RM1 scripts and tests, and the explicitly named owner controllers. I did not read any implementation author self-assessment, Claude review/request, focused-proof/evidence, problem-family, package-exit, implementation-intake, delivery-manifest, or other author review material. No DEV, HTTP, L2, Testcontainers, seed, reset, or Git action was performed.

## Scope and expected behavior

The activation decision authorizes only static RP-02a-U01 materialization/projection identity and source-bound diagnostic consumer repairs. The catalog is the normative operation denominator (154 operations; platform-admin 50, operations-admin 92, public 12). The catalog's `componentOverrides.forbiddenProperties` includes `expectedContextVersion`; the materializer recursively removes that property from generated schemas. Read operations may carry `expectedContextVersion` as a query parameter where their operation row declares it; command request bodies must conform to the generated schemas.

## Independently verified checks

All of the following exited zero:

| Check | Result |
| --- | --- |
| `node --test scripts/test/http-diagnostic-scenarios.test.mjs` | 5/5 PASS |
| `node --test scripts/test/http-diagnostic-workload.test.mjs` | 11/11 PASS |
| `node --test scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs` | 2/2 PASS |
| `node --test scripts/test/rm1-http-diagnostic.test.mjs` | 9/9 PASS |
| `scripts/check/r5-edge-materialize --check` | PASS; 154; 50/92/12 |
| `scripts/check/r5-edge-materialize --self-test` | PASS with real red mutations |
| `scripts/check/standards-coverage --phase R5` | PASS; 150 rules |
| `scripts/check/codex-self-review --self-test` | PASS |
| Node syntax checks for reviewed JS/MJS sources | PASS |

The projected catalog and generated route-face registry independently compare as an exact 154-operation identity set with no missing, registry-only, or method/path/face/owner mismatches.

## Findings

### M-01 — source-bound workload sends a globally forbidden command field

```yaml
status: CONFIRMED
severity: M
owner: scripts/test/http-diagnostic-workload.mjs
```

`scripts/test/http-diagnostic-workload.mjs` still places `expectedContextVersion` in command request bodies for `updateOperationsOrganizationBrand` (line 471), `updateOperationsOrganizationTenant` (line 476), `updateOperationsOrganizationHeadCompany` (line 481), each operations invitation create/reissue/cancel path (lines 553, 561, 566), and user-assignment revoke (line 608). The reviewed catalog explicitly lists `expectedContextVersion` in `componentOverrides.forbiddenProperties`, and `scripts/generate/r5-edge-materialize.mjs` removes every forbidden property recursively when materializing components (lines 210-216 and 229-233). Therefore these source-bound recipes do not emit requests matching the generated command schemas; a real run can be rejected as an unknown field or have the intended context precondition discarded. The current mock workload tests do not validate request bodies against the materialized schemas, so their PASS does not close this mismatch.

Recommended repair: remove `expectedContextVersion` from command bodies and keep context-version assertions only in the operation's declared query/request field that survives materialization (or use the operation-specific `expectedVersion`/session field). Add a focused static test that enumerates every command body and fails if a catalog-forbidden property is present.

### S-01 — materialization drift check does not compare generated path/component files

```yaml
status: CONFIRMED
severity: S
owner: scripts/generate/r5-edge-materialize.mjs
```

`materialize()` writes the root document, every generated component file, every generated path file, and the resolution report (lines 311-315). `check()` regenerates into a scratch copy but compares only `contracts/openapi/edge.openapi.yaml` and the resolution report (lines 323-330). A stale or manually altered generated path/component file can therefore survive `scripts/check/r5-edge-materialize --check` while the gate reports PASS; extra stale generated files are not checked either. This leaves the generated contract set weaker than the operation-denominator/materialization claim.

Recommended repair: compare the complete expected generated-file set (relative path plus bytes), fail on missing, changed, or extra files, and add one red mutation against a path file and one against a component file to the materializer self-test.

## Disposition summary

| ID | Status | Severity | M/S/N disposition |
| --- | --- | --- | --- |
| M-01 | CONFIRMED | M | M — must repair before implementation GO |
| S-01 | CONFIRMED | S | S — repair before package exit; it weakens deterministic artifact proof |

No other confirmed findings were found in the reviewed projection identity, source-bound scenario denominator, workload replay/private-state isolation, fixture body assertions, RM1 correlation/completion logic, explicitly named owner-controller facts, or static gates. That statement is limited to the whitelist and static-only boundary above; it is not a runtime/business/cleanup PASS.

## Verdict

**NO-GO (M1 / S1 / N0).** The implementation is not ready for an implementation GO because M-01 directly conflicts with the materialized command contract and affects the source-bound operations workload. S-01 must also be repaired before package exit so generated path/component drift cannot pass the materialization gate.

## Reviewed input hashes

The following source paths were read in this blind pass; hashes are recorded for deterministic handoff.

```text
doc/decisions/2026-08-05-v2s-rp-02a-implementation-activation.md 2b006003fff18b91cbb6927eb3abd2a1f5797eeea08ac13c8e36faa7edac8eaa
doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json bd4880eea59fc97d69a09cf136581ad54bb4d1e0d362a95ec09362118d2e6656
scripts/generate/edge-operation-projections.mjs fa68132a2710a46e8ff24e4b9a6b789a5678c2b14c3d04ee31bc9f41e3388270
scripts/generate/r5-edge-materialize.mjs 89b5d3197d1a2d327f95ebd3e1684dafb9bede8ffddc625da788394dfb02dbb4
scripts/check/r5-edge-materialize d5b485428d6b2f59e465768bc358ebb8fa1a4ee6b7f0cd06c771b47300bc1a57
scripts/test/http-diagnostic-inventory.mjs 1a10013d4f0904063cb46caf790621d2912fa05ffed00f74ced361437f3e991b
scripts/test/http-diagnostic-scenarios.mjs 13a6e9ac16df24af852bee877e2064c8263b9e36c477ea557a03b2f9baed932e
scripts/test/http-diagnostic-scenarios.test.mjs f317b42a95948f324b61d3ebd313eede034a7ee24b94885bd8210a99ab8f94e0
scripts/test/http-diagnostic-workload.mjs 7002540d7a3ad6f786a6f191b6d00b314c8a8fd938aadb135a12c318ab400bfe
scripts/test/http-diagnostic-workload.test.mjs bfb4fbc394aaa1a85e2dad54c1580a47707ca05f0c95bec5211cb8083d2c9c8d
scripts/test/r5-platform-admin-l2-fixture-seed.mjs 0851f3cf17e667c72431afbcc56be157238faec70a17660cf1dbadd076253413
scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs 9362e62ccf6eb871574690f2a1ffbc050ea29aadec6ab07cdd600982f9286481
scripts/test/rm1-http-diagnostic.mjs 0a69ed6469f4f2d1d8e6cbaa8b034d4139701afc86d185c6d0bbc9e8fbdef172
scripts/test/rm1-http-diagnostic.test.mjs 6f725e9398641b822c52670453f05d45226bdd8d04ebe79e98ec9caf9d848d93
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationExtensionController.java 4818653a7aebf2162b87fc89619eab5c97849e86bec7b08d179ccd265649ae5b
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java 4d4e37679dc643fee7651f5095371958948203c552dcd7fe92df86b5eae54515
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationCandidateController.java cfd4184afe3f638d09f317274de91f3498eac2a42d6686c6d3ac392e22635fe7
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java f0220937eeca840f5efc9570ca3c63cc58298a6a14145ea8efb461bf0ef07ee1
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java 909e8e6877cf57e14b0843e8f9d5243c2e391303dc2c6b6e059f189dc961f633
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java 9f2286ed561bb16c0136319faeeff042078a5385ab725d90c27b7c0d233617bb
```

