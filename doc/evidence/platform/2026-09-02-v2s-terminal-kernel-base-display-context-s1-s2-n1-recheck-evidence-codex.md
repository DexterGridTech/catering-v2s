# TER `kernel.base.display-context` S-1/S-2/N-1 recheck evidence

## 1. Scope and authority

- `REVIEW_TARGET=IMPLEMENTATION`
- Scope: close the implementation-review findings S-1 (multi-display `switchDisplayRole` proof),
  S-2 (production resource-drain debt), and N-1 (bridge comment accuracy).
- Authorized changes: display-context test/supporting documentation only; no runtime public type,
  production teardown, adapter/native, device, DEV, seed, reset, browser L2, UAT, deployment, or
  repository-wide normal verify.
- Existing DC-P0～DC-P5 design, plan, source, and previous evidence remain the baseline. This is a
  follow-up addendum; it does not rewrite the previous evidence record.

## 2. Source changes

### S-1 focused behavior case

`apps/terminal/kernel/base/display-context/test/behavior.test.ts:79-105` now extends the existing
A-3 test with a second, direct command-path scenario:

1. Build a runtime and move it to `SLAVE` on a `PRIMARY` route.
2. Set the live fake device's `displayCount` to `2` after startup.
3. Dispatch `switchDisplayRoleCommand` targeting `VICE`.
4. Assert the command and actor are `error`, the stable public `LedgerError` key is the display
   transition error, the final slice remains `CHIEF`, and `getDisplayInfo` was called again with
   the display timeout.
5. On the exact same input, assert the policy result is
   `{allowed: false, reasonCode: 'multiple-physical-displays'}`.

The test deliberately does not add `reasonCode` to the runtime public `LedgerError`: the runtime
contract projects `AppError` to the stable ledger shape and does not expose `AppError.details`.
The reason code is therefore asserted at the policy boundary while the command assertion proves the
actual actor path consumes the live count and refuses the write.

The test directory now contains exactly two `multiple-physical-displays` occurrences:

- `test/derivation.test.ts:115` (existing `switchInstanceMode` pure-policy case);
- `test/behavior.test.ts:104` (new `switchDisplayRole` actor/command case).

The focused test denominator remains 55 because this is a second subcase in the existing A-3 test,
not a new test declaration. No package public export or runtime contract changed.

### S-2 debt registration

`apps/terminal/kernel/base/display-context/HANDOFF.md:11-12` now states the exact boundary:
`registerResource` is currently drained only by test-only `releaseRuntimeForTest`; production has no
`Runtime` stop/dispose lifecycle, so native subscription reclamation depends on process exit. The
entry explicitly says test release proves only local deactivation and unsubscribe invocation, not
production teardown.

No production lifecycle API was invented. This follows the current authorization and the reviewer’s
minimum-stage option; a production stop/dispose design remains a future Dexter-scoped decision.

### N-1 comment correction

`apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts:150-153`
now says the registry is drained only by test-only release, production has no stop/dispose yet, and
the native subscription is reclaimed at process exit. The unused disposer is intentionally retained
until a production lifecycle exists. The old false claim that a closure keeps the disposer reachable
for a future release was removed.

## 3. S-1 mutation proof

The mutation was applied only to
`apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:31`, changing
`input.displayCount !== 1` to `input.displayCount < 0`. The source was restored immediately after
the negative proof.

### Green baseline (package-local cwd)

Command:

```text
../../../../../node_modules/.bin/vitest run --config vitest.config.ts test/behavior.test.ts -t "A-3 switchDisplayRole rejects VICE when display info is unavailable"
```

Output:

```text
 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/kernel/base/display-context

 Test Files  1 passed (1)
      Tests  1 passed | 21 skipped (22)
   Duration  313ms (transform 180ms, setup 0ms, import 229ms, tests 18ms, environment 0ms)
```

### Red mutation

With only the guard mutation applied:

```text
 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/kernel/base/display-context

 ❯ test/behavior.test.ts (22 tests | 1 failed | 21 skipped) 21ms
     × A-3 switchDisplayRole rejects VICE when display info is unavailable 20ms

 FAIL  test/behavior.test.ts > display-context command actors > A-3 switchDisplayRole rejects VICE when display info is unavailable
 AssertionError: expected 'completed' to be 'error' // Object.is equality

 Expected: "error"
 Received: "completed"

 ❯ test/behavior.test.ts:91:32
```

This is the intended failure: deleting the live multi-display guard makes the command complete,
instead of merely failing an unrelated pure-function assertion.

### Restored green

After restoring `input.displayCount !== 1`:

```text
 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/kernel/base/display-context

 Test Files  1 passed (1)
      Tests  1 passed | 21 skipped (22)
   Duration  313ms (transform 180ms, setup 0ms, import 229ms, tests 18ms, environment 0ms)
```

## 4. Package focused proof

Command:

```text
yarn workspace @catering-v2s/kernel-base-display-context typecheck
yarn workspace @catering-v2s/kernel-base-display-context test
```

Result: exit code 0; 4 test files, 55 tests passed; package marker:

```text
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-display-context
```

## 5. Fresh independent reconciliation

The fresh read-only subagent performed a three-dimensional reconciliation against the requirements,
design/plan, project rules, and current source:

```text
REVIEW_TARGET=IMPLEMENTATION
SCOPE=TER_DISPLAY_CONTEXT_S1_S2_N1_RECHECK
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO
M=0 S=0 N=0
```

It confirmed the direct actor scenario, the exact production-drain debt statement, the corrected
bridge comment, and no accidental changes to N-2/N-3. It did not run commands.

## 6. TER-local final verification

### `verify:static`

Run id: `ter-local-static-91731-1788308466425`; exit code 0; `TERMINAL_STATIC=PASS`.
All skeleton (6), contracts (4), platform-ports (4), state (4), runtime (5), and display-context
(4) rule gates passed with support checks. Display red vectors remained target-only.

### `verify`

Run id: `ter-local-92410-1788308509561`; exit code 0. Key output:

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=10
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
TERMINAL_TEST_MARKERS=PASS real=5 noTests=5
Android Bundled 1656ms apps/terminal/assembly/android/pos-desktop/index.ts (730 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

The run emitted structured start/finish/duration records for each phase. Expo export is only Metro
and JS entry-closure evidence; it is not native, Gradle, autolinking, device, or adapter evidence.

## 7. Finding closure and remaining boundaries

| Finding | Closure | Status |
| --- | --- | --- |
| S-1 multi-display `switchDisplayRole` red vector | A-3 direct command subcase, live count, policy reason, role and error assertions; guard mutation red and restoration green | CONFIRMED |
| S-2 production resource drain | HANDOFF debt records registry-only test drain and process-exit reclamation; no unauthorized teardown added | CONFIRMED |
| N-1 misleading disposer comment | Bridge tail comment now matches current production reachability | CONFIRMED |
| N-2 persistDisplayRole soft failure | No code change; acknowledged as known layered risk | ACKNOWLEDGED |
| N-3 MASTER eligibility semantics | No code change; cleanup path remains the separate runtime-role actor | ACKNOWLEDGED |

Still unverified and intentionally out of scope: Android/native adapter implementation, Gradle,
real device behavior, production route-context trust, production teardown completion, cross-restart
role audit, browser L2, DEV, seed, reset, UAT, deployment, and repository-wide normal verify.
