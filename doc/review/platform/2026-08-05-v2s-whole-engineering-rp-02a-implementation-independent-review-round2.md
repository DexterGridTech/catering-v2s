# RP-02a Implementation Round 2 — directed final independent review

```yaml
REVIEW_CYCLE_ID: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
reviewerInputChecklist: embedded-in-this-artifact; per-entry hashes are recorded below
blindReviewDeclaration: Directed final round reopened the repaired production sources, the original implementation design, and the required static commands before any author intake, package-exit, focused-proof, or Claude implementation material was read.
authorMaterialReadAfterIndependentVerdict: false
runtimeAuthority: false
seedResetAuthority: false
dynamicEvidence: NOT_RUN_BY_AUTHORIZATION
verdict: NO-GO
severityCounts: M0/S1/N0
```

## Scope and boundary

This final round rechecked only the Round 1 M-01 and S-01 findings against current source. The original implementation design explicitly forbids changing `contracts/openapi`, generated wire, backend/controller/service, database, runtime, seed/reset, or dynamic evidence (`doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md:50-55`). I did not read Codex intake, package-exit, focused-proof, or Claude implementation documents. No DEV, HTTP, browser L2, Testcontainers, seed, reset, UAT, or Git action was performed.

## Static recheck

| Command | Result |
| --- | --- |
| `node --test scripts/test/http-diagnostic-scenarios.test.mjs` | 5/5 PASS |
| `node --test scripts/test/http-diagnostic-workload.test.mjs` | 11/11 PASS |
| `node --test scripts/test/rm1-http-diagnostic.test.mjs` | 9/9 PASS |
| `node --test scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs` | 2/2 PASS |
| `scripts/check/r5-edge-materialize --self-test` | PASS; path/component red mutations detected |
| `scripts/check/standards-coverage --phase R5` | PASS; 150 rules |
| `scripts/check/r5-edge-materialize --check` | **FAIL** — `R5_EDGE_GENERATED_OUTPUT_DRIFT:components/contract/contract.schemas.yaml` |

## Round 1 finding dispositions

### M-01 — forbidden command-body field

```yaml
status: REJECTED_WITH_EVIDENCE
severity: M
disposition: CLOSED
```

The repaired workload no longer places `expectedContextVersion` in command bodies. Current occurrences in `scripts/test/http-diagnostic-workload.mjs` are query-context construction and query calls only (lines 344, 532, 593, 603, 646); the repaired update/invitation/revoke bodies contain only their declared fields and `expectedVersion` where applicable. The focused workload test now reads the catalog's `componentOverrides.forbiddenProperties` and asserts that no request body contains any forbidden property (`scripts/test/http-diagnostic-workload.test.mjs:269-271`), and the user-revoke focused assertion explicitly proves `expectedContextVersion` is absent (`:301-303`). The 11 workload tests pass. M-01 is therefore closed with evidence; it is not a remaining implementation blocker.

### S-01 — generated-output drift control and the out-of-scope existing artifact mismatch

```yaml
status: CONFIRMED
severity: S
controlFix: PRESENT
disposition: OUT_OF_SCOPE_DEFERRED
```

The control weakness is repaired: `generatedOutputSnapshot`, `assertGeneratedOutputSnapshots`, and `compareGeneratedOutputs` now compare the complete generated `contracts/openapi` path/component file set and bytes (`scripts/generate/r5-edge-materialize.mjs:28-50`); `check()` invokes that comparison (`:342-351`); and the self-test has real path and component mutations (`:384-392`). The self-test passes.

The repaired control exposes an existing generated artifact mismatch, so it is not honest to call the static check PASS. A scratch materialization differs from the current `contracts/openapi/components/contract/contract.schemas.yaml` by adding the required `projectId` property to `StoreContractCreateRequest` (current SHA `19ed2f73619366e935b7eb4371fdc71cb29c68006b2e85d084eac76cd7970911`; deterministic materialized SHA `547092d02328a69672475e6c2a0a44f3f8fcca9d8c6d849a7ae666c521c50961`). The failing path is exactly the one printed by `r5-edge-materialize --check`.

This mismatch is outside RP-02a's authorization: the design explicitly says not to modify `contracts/openapi` or generated wire. It must remain `CONFIRMED + OUT_OF_SCOPE_DEFERRED`, not be converted to PASS and not be “fixed” by this review unit. No further RP-02a source/test/materializer changes are required for S-01; the current gate is functioning as intended and stopping on the external drift.

## Final verdict

**NO-GO (M0 / S1 / N0).** M-01 is closed. The implementation control for S-01 is repaired, but the mandatory materialization check now fails on a pre-existing generated-contract drift that this unit is forbidden to change. Therefore the package cannot receive an implementation GO within the current authorization boundary.

Minimum external decision for resumption: Dexter must either (a) authorize a separate, explicitly scoped contract/OpenAPI/generated-wire reconciliation and then rerun the materialization check, or (b) create an explicitly accepted deferred/waiver package boundary that removes this check from the current exit denominator and records the unresolved generated drift. Until one of those decisions is made, no additional RP-02a implementation edits are justified.

Business and cleanup remain `NOT_APPLICABLE_WITH_REASON`: this round performed static verification only and did not start a managed runtime or allocate remote resources.

## Reviewed input hashes

```text
doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md 1b59e62ba838886e12c2eb2d22ac644ec58c23204e38f3349fa87ac310f09fd7
doc/decisions/2026-08-05-v2s-rp-02a-implementation-activation.md 2b006003fff18b91cbb6927eb3abd2a1f5797eeea08ac13c8e36faa7edac8eaa
scripts/test/http-diagnostic-workload.mjs d5b965eaffbb411e87eae70053b4ceb10dc8920e4d9f62f8025f7143711e7722
scripts/test/http-diagnostic-workload.test.mjs 0a1e0dadd8bf4a667a2fb7adb92bba8c2e04c0b76d3c96601a1d044d24ec7022
scripts/generate/r5-edge-materialize.mjs a69b5733eabd1592e821c5c152cb1d8cee9cfaa2332e7041b3ee02e8525c86f1
scripts/test/http-diagnostic-scenarios.test.mjs f317b42a95948f324b61d3ebd313eede034a7ee24b94885bd8210a99ab8f94e0
scripts/test/rm1-http-diagnostic.test.mjs 6f725e9398641b822c52670453f05d45226bdd8d04ebe79e98ec9caf9d848d93
scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs 9362e62ccf6eb871574690f2a1ffbc050ea29aadec6ab07cdd600982f9286481
contracts/openapi/components/contract/contract.schemas.yaml 19ed2f73619366e935b7eb4371fdc71cb29c68006b2e85d084eac76cd7970911
```

