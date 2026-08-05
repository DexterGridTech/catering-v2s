# Whole Engineering Second Package — Implementation Independent Review Round 1

- `REVIEW_CYCLE_ID`: `WHOLE-ENGINEERING-SECOND-PACKAGE-IMPLEMENTATION-20260805`
- `REVIEW_TARGET`: `IMPLEMENTATION`
- `REVIEW_ROUND`: `1`
- `REVIEW_ROUND_LIMIT`: `2`
- `reviewerKind`: `INDEPENDENT_SUBAGENT`
- `scope`: `RP-07`, `RP-08`, `RP-10`, `RP-11`
- `verdict`: `NO-GO`
- `M/S/N`: `3 / 0 / 0`

## Blind review declaration

I reviewed the current production source, tests, generated contract/wire, active package, and run-scoped evidence from the package paths below before reading or relying on any author disposition or prior review verdict. The runtime report was used as evidence to challenge the implementation, not as an acceptance substitute.

## What is implemented correctly

- RP-07 has one `queryText` OpenAPI parameter, the edge forwards it to the organization owner, and the owner uses a single normalized operand with an OR predicate over brand name/code. The generated adapter sends one request and does not copy the value into `name` and `code`.
- RP-08's exact 13 `FORM_DRAWER` files currently bind `maskClosable`, close icon, keyboard, `onClose`, and footer cancel to `lifecycle.submitting`; the brand Drawer no longer has a second local submitting flag.
- The latest managed local L2 (`rm1p6-joint-local-l2-1785931623610-45615-0bbb7341`) reports business PASS, local process-tree readback PASS, remote database/role/asset readback PASS, and cleanup PASS. The host allowlist self-test rejects unknown/wrong/attacker pairs and accepts the legal rotation fixture.

## Findings

### M-01 — RP-11 ownership is fail-open and the production stop path bypasses the owned-tree terminator

**Status: CONFIRMED.** `scripts/dev/managed-process-tree.mjs:23-25` returns every process sharing the PGID when the PID + PGID + start-token root cannot be found. `scripts/dev/r5-dev-runner.mjs:23-33,189` then independently checks only `pidAlive/startToken` when the leader is still present, sends `SIGTERM` to the whole PGID, and polls the same fallback snapshot; `terminateOwnedProcessTree` is not used by `r5-dev-runner`, `http-diagnostic-runner`, or joint L2. If the leader has exited and the PGID is reused, an unrelated process can be classified as owned and killed. This violates the package's identity-safe, owner-only cleanup requirement and is a destructive safety blocker.

**Required disposition:** make missing/mismatched root identity fail closed (never fall back to PGID-only ownership), route every production cleanup consumer through one identity-safe helper, and add a test with a dead/reused leader and an unrelated same-PGID row proving no signal is sent to the unrelated process.

### M-02 — The claimed RP-11 red mutation is not a production-path mutation

**Status: CONFIRMED.** `scripts/dev/r5-dev-runner.mjs:194-201` constructs a plain synthetic manifest and calls the boolean evaluator; it never starts a process, kills a leader, observes a surviving child, or serializes the runner manifest. `managed-process-tree.mjs:51-60` likewise only evaluates static rows. The package design requires the leader-dead/child-alive mutation to run through the same runner cleanup evaluator and preserve `firstFailure`, `lastKnownGood`, and `brokenBoundary`. The current “PASS” self-tests therefore cannot detect a regression in signal delivery, identity continuity, or process readback.

**Required disposition:** execute a real owned process tree in the self-test (or a deterministic injected process-table/signal harness that exercises the production stop function), mutate leader-dead/child-alive, and assert the persisted cleanup report is FAIL while business remains independently visible.

### M-03 — RP-07 runtime evidence does not execute the required brand query matrix

**Status: CONFIRMED.** The current 19-spec L2 report contains only one business-entity brand scenario (head-company detail/candidate drawer and in-use removal guard); `apps/frontend/operations-admin/src/tests/l2/business-entity-management.spec.ts:26-44` does not submit a brand `queryText`. The owner test `OrganizationOwnerServiceTest.java:260-275` covers a generic name search and a code-only search, but no uppercase/trimmed query, and no browser/edge assertion that the single query is sent once or that page boundaries are owner-returned. Nevertheless `doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-business.json` declares the full name/code, uppercase/trimmed, no-match, paged, and one-request matrix as PASS. This is an evidence-to-execution gap, so the package cannot claim business closure for RP-07.

**Required disposition:** add source-bound owner/edge/runtime assertions for name-only, code-only, uppercase/trimmed input, no-match, page boundary, and exactly one request; retain the request URL and owner total/page readback in the fresh business evidence.

## Evidence and controls inspected

The required context controls were rerun: `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start` and `scripts/check/standards-coverage --phase RM1-P6-3` (`STANDARDS_COVERAGE=PASS`, `RULES=150`). Pure self-tests for remote-host trust, managed process tree, r5-dev-runner, HTTP diagnostic runner, and joint local L2 all exited zero; their limitations are covered by M-01/M-02.

### Input manifest (path + SHA-256)

```text
.runtime/compliance-control/active-package.json bbf1274c9afa0c7ef14c1271dbf60b46a88045dcd688fa80f13fae7a7d1b5304
doc/plans/platform/2026-08-05-v2s-whole-engineering-second-package-implementation-design.md 1ff44d644894b786d34269694b15f97da10dee4ef0ffebabd3f0d78efb90ee9c
doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-delivery-manifest.json b04fa4a79e7376c19abcd2205e6a234cb57a982ef4aa59c4cddf3b13d9ec2bbd
doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-focused-proof.json 359210b6da07a0318dd8e7e4b715dbb0d3cb7af9d6e40f766f78f41617890036
doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-business.json d7d7d03e0055e24155a7945da72191d89c679b6fd647ea7e894cfe306076a8da
doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-cleanup.json 0ea097277ab55ffb26672fbb87d5ce6b733611313d970ecafb07e8008fd15439
doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-exit.json d434ac216381d25b933a409a55212bf8263c49807242ca31fa72697e82efc9eb
contracts/openapi/paths/operations-admin/brand-management.paths.yaml 973ed608d025a77f70eb12dbeca210832f84e5a8d1956fbb8ee9d5aca7308bad
apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java da6e182ffeefefa50cf22b7e2384cd71cbb4904e6c8c49fbb05abd52f57cd06e
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java ed87dc1c413fde749d91dae6aea721a5f0b907e7c75b55d9428ba0468f1ed90f
apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts c67bece4e76f32e11edbde825d161f2bd521c6531c8d625110c2550cf5aba1c3
apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx f50982e55b1e04f3014d5e7166b42bd3423b1af714c5e8a3a89c8a5fbd2f422b
apps/frontend/operations-admin/src/tests/architecture/rp07-rp08-second-package.test.mjs 5be2679aa0b28a25f292f9015f4dad331099c5a84fbabbc7ef5a66f29f64c0ad
apps/frontend/operations-admin/src/tests/l2/business-entity-management.spec.ts e592e6a565f8c474d80347e543e6aefc197e2abc9806ace54bd83232866e8d90
scripts/dev/r5-remote-host-trust.mjs ce180867097bdd76a218e7d2d4facb1acb7a887e69172f50a31b08c6f39290f2
scripts/dev/managed-process-tree.mjs 611c9b4d6ba808e1fcea5bfa49bd6f11aba6d278084bebf936c0d4c0807466fb
scripts/dev/r5-dev-runner.mjs 48de9189329048b1dc2add54661acacb34cd332ab9e25a58015d46cb7b0150c7
scripts/dev/http-diagnostic-runner.mjs 361804fc053cb8df2668cc8a7abd4ef7498fc80bff55d6fe834d52cc9287b3e4
scripts/test/r5-joint-remote-l2.mjs 4196a41d3cf8ae56cfe731b15780c9feb1301f7a6662170b08b93ed023ffcaa0
.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785931623610-45615-0bbb7341/evidence/terminal-report.json f01636dba95178fb96adef6b9224733e761ac4e80b5fd81c2d8506a560609cbc
```

## Final decision

`NO-GO` for this round. The latest green L2 and cleanup evidence are useful and remain separately credited, but M-01 is an ownership/safety defect in the production cleanup path, M-02 leaves the required red gate unproven, and M-03 leaves the RP-07 business matrix unexecuted. A second independent round may be used only after these findings are dispositioned with fresh source and evidence; this round does not authorize implementation or package closure.
