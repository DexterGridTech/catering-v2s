# TER Stage B CP-06 implementation proof

`CP=CP-06` · `STATUS=MATCHED`

This record covers CP-06 implementation and focused source proofs only. It is not a CP verdict, batch 6b, dynamic business result, or Stage B delivery verdict.

## Scope closed by the CP

- The r5 fixture contract counts the four terminal-update artifacts and eight rules as a separate domain, validates FULL/HOT pairing and scope, and keeps the group write/project read role boundary.
- The terminal-update seed plan accepts only one completed, current managed `update.artifacts` source run with the exact ten exported files under its run-owned root, matching hashes and artifact identities; malformed, changed, incomplete, or escaped input fails closed.
- The terminal-update seed executor uses the existing generated owner operations and platform/operations HTTP path to upload and read back artifacts, create and read back rules, and remove only the exact source-run `update/seed-inputs` directory after successful import.
- The complete-seed parent requires the terminal-update child receipt and role/count/readback facts after existing stages; it preserves child first failure and does not mark the full seed successful when a child fails.
- Full-only rules use a generated response field `hotArtifactRef` that is present and nullable. This matches the owner’s supported FULL-only shape; the seed readback validates `null` rather than requiring a HOT artifact. Request optionality and response nullability remain distinct.
- Stage A D-S-1 remains closed on current actor/test bytes: non-success FULL readback keeps `action.bootId ?? task.bootId`, while successful readback uses only the current authoritative `actualBootId`.

## Current focused evidence

Commands were run from the repository root on 2026-10-09. These are local tests/checks; they do not represent DEV, backend-acceptance, admin browser, seed, or device behavior.

| Command | Result |
| --- | --- |
| `yarn workspace @catering-v2s/kernel-base-terminal-update test` | PASS, PROD, 2 files / 37 tests. Includes `preserves the task boot through non-success FULL readbacks and releases the failure on the next boot`: waiting-user→failed with null action boot preserves the task boot; same boot blocks another rule; a reconstructed runtime releases it on later boot; old failed artifact remains rejected; a different repair artifact is accepted. |
| `node --test scripts/dev/r5-fixture-contract.test.mjs scripts/dev/terminal-update-seed-executor.test.mjs scripts/dev/terminal-update-seed-plan.test.mjs scripts/dev/r5-complete-seed-executor.test.mjs scripts/dev/owner-command-seed-executor.test.mjs` | PASS, 45 tests / 0 failures. Includes generated artifact wire-field readback, FULL-only explicit null HOT reference, run-root/hash/pair validation, terminal child receipt, parent count/role/readback validation, and first-failure propagation. |
| `node scripts/generate/r5-edge-materialize.mjs --check` | PASS, 264 operations; faces 66/172/12/14. |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --check` | PASS, 483 files. This is identity-only validation, not the calibrated/default budget verdict. |
| `node scripts/generate/terminal-client-api.mjs --check` | PASS, 13 JSON operations; binary download remains excluded. |
| `./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests 'com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerServiceTest' --no-daemon` | PASS, owner service focused test; authoritative persisted `createdAtEpochMillis` is returned in the rule snapshot. |
| `./gradlew :apps:backend:catering-business-server:compileJava --no-daemon` | PASS in the CP-06 invocation. |
| `node --test --test-name-pattern='backend acceptance supplies every non-production server prerequisite and selection' scripts/test/r5-remote-testcontainers.test.mjs` | PASS, 1 targeted runner regression test. It proves a no-run-ID focused Gradle task gets `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`. |
| `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:test --tests 'com.catering.v2s.app.edge.terminal.TerminalUpdateRuleWireTest' --tests 'com.catering.v2s.app.edge.operations.audit.OperationsAuditHistoryControllerTest'` | PASS, managed run `r5-tc-1791517209977-4747`, 2026-10-09 03:40:09–03:41:33 UTC. `compileJava`, `compileTestJava`, selected app `test`, classpath verification and remote evidence capture completed; `REMOTE_GRADLE_STATUS=0`; Testcontainers containers/volumes and runner cleanup PASS. This was focused compilation/test execution, not backend-acceptance BUSINESS and not a full suite. The runner did not retain JUnit XML/counts, so no test-count claim is made. |

### Preserved first failure and root-cause repair

- Earlier managed run `r5-tc-1791517066679-1643` stopped at `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact`; its Testcontainers resource and runner cleanup were PASS. It was a runner environment-selection defect, not a product/business test failure.
- Root cause: `backendAcceptanceEnvironment(null)` inferred `operation='all'` even for a focused Gradle command without an acceptance run ID, and therefore omitted `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY` while compilation evaluated generated budget projections.
- Minimal repair: `scripts/test/r5-remote-testcontainers.mjs` now supplies `IDENTITY_ONLY` whenever `runId===null`. The targeted runner regression test above passed, followed by the successful managed compile/test run. No timeout or business assertion was changed.

## Evidence boundary and next gate

- No `update.artifacts` managed run, current full `r5-full` seed dry-run, reset, DEV start, actual seed, backend-acceptance, focused admin browser, or single-machine dual-screen device run has occurred in this CP proof.
- The schema-generation checks and Node/unit proofs do not establish the real upload/parse/save UI chain, actual Android update, CBS report persistence, or cleanup of a managed run.
- The focused app test task is now green on the managed remote runner. Its JUnit case count is unavailable in the archived output; do not infer a count from task success.
- No `update.artifacts` managed run, current full `r5-full` seed dry-run, reset, DEV start, actual seed, backend-acceptance BUSINESS, focused admin browser, or single-machine dual-screen device run has occurred in this CP proof.
- Fresh independent CP-06 three-dimensional reconciliation: `MATCHED`, no OPEN gaps. Reviewer verified the current requirements/design/plan, seed source chain, generated nullable response contract, focused proof, managed run manifest, and preserved failure/fix record. The reviewer confirmed the managed run cannot establish business acceptance or a test count because JUnit XML was not retained.
- Differential reconciliation required for batch-level 6b/13c: include the Stage A terminal-update actor fix, FULL-only nullable `hotArtifactRef` source/generation change, and no-run-ID `IDENTITY_ONLY` managed-runner fix. They have focused evidence here but are not silently treated as earlier-CP unchanged inputs.
- After all CPs are MATCHED, batch-level 6b remains a separate required reconciliation before overall acceptance.
