# TER screenPart 机型解析 · CP-4 execution evidence

```text
SCOPE=CP-4
STEP=A-4 R-10a admin declaration split with same-component siblings
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
STEP_STATUS=CLOSED_MATCHED
```

## Owning source changed

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`
- `apps/terminal/ui/base/admin-shell/test/parts.test.ts`
- `apps/terminal/ui/base/console-assembly/test/partSelection.test.ts`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`

`parts.ts` now exposes eight real admin assembly entries: each of the four stable
`partKey` values has exactly one `['laptop']` and one `['mobile']` sibling. Each sibling
uses the same existing component and all non-form semantic fields, while its
`rendererKey` is unique and includes the selected form. `admin.console` retains the
explicit `decisive` layer guard on both siblings; the three section keys retain the
normalized default `dismissible` guard on both siblings. No component differentiation
or layout change was made in CP-4.

## First failure, last known good, and broken boundary

At 17:44:50 the first CP-4 focused command set had one failure after the source change:

```text
COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly test
RESULT=FAIL
FAILURE=the mobile-request assertion expected the error to name `mobile`, but the
production pre-filter scan correctly reported the actual overlap set `laptop` before
filtering to the requested form
```

The same command set had already shown the admin-shell typecheck/test, console-assembly
typecheck, and both integration typecheck/test passing. The broken boundary was the new
test oracle, not the production conflict detector. The smallest repair changed only the
second expectation to assert that both requested forms reject the same actual full-input
overlap. The implementation was not weakened. The last known good is the complete
post-repair command set below.

The first post-finding attempt at 17:49:10 exposed a second, test-harness-only boundary in
the wallpaper integration test: it tried to drive the virtual admin keypad before injecting
the required surface layout, so no keyboard key existed. The production assembly was not
changed; the smallest repair called the existing `measurePrimarySurface` helper before
authentication. The focused test then passed at 17:49:33.

## Focused commands and results

```text
COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=PASS
TEST_FILES=4 passed
TESTS=11 passed

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly test
RESULT=PASS
TEST_FILES=2 passed
TESTS=7 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=PASS
TEST_FILES=8 passed
TESTS=38 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
RESULT=PASS
TEST_FILES=4 passed
TESTS=16 passed
```

The original command outputs are retained in the Codex execution record; this file is the
repository evidence index and keeps the counts and failure boundary. The 17:44:50 failure
is not relabeled as a pass.

## CP-4 behavior covered

- `admin-shell/test/parts.test.ts` uses the actual exported `parts` definitions and
  asserts the eight-entry denominator, four stable keys, disjoint singleton forms,
  unique renderer keys, normalized catalog-field equality, and normalized binding
  equality including `layerTier` and `layerGuard`.
- `console-assembly/test/partSelection.test.ts` uses actual `adminShellAssembly.parts`
  as the R-10a fixture. It mutates only one real sibling's form set to overlap and
  requests both laptop and mobile; both calls reject before form filtering with the
  actual key/form information.
- Existing real integration assembly tests remain green for both forms. Their
  production path consumes the eight unfiltered admin entries and the selected form
  projection; after authentication, the sample-console test asserts all four production
  sections for both forms, while the wallpaper-console test asserts all three shared
  production sections for both forms. No complete production catalog was hand-built for
  this step.
- The production input source is the actual `adminShellAssembly.parts` array (eight
  entries) spread by `createConsoleAssembly`; `parts.test.ts` and the console-assembly
  admission fixture assert that same real array's eight-entry/four-key denominator, and
  the integration tests exercise the real assembly output for each form. The assembly
  owner remains the source of the spread; no public catalog metadata was added merely to
  expose an internal input snapshot.
- The same-component constraint is preserved deliberately. CP-5/B-1 remains the owner
  of distinct component files, hook, and layout; CP-4 makes the zero-regression baseline
  explicit before that work.

## Negative controls

```text
MUTATION_1=remove one admin sibling from parts
EXPECTED=parts.test.ts and the eight-entry/part-key denominator fail
STATUS=negative-control-defined; not applied to source

MUTATION_2=make the real platform-ports sibling forms overlap
EXPECTED=partSelection.test.ts fails for both requested forms
STATUS=negative-control-defined; the same fixture is currently tested in the failing
form only through a test-local mutation and does not alter production source

MUTATION_3=omit layerGuard from the admin console sibling
EXPECTED=parts.test.ts binding-equality/decisive assertion fails
STATUS=negative-control-defined; not applied to source
```

## Evidence status

```text
STATIC=PASS_FOR_CP4_TYPECHECKS
FOCUSED=PASS_FOR_CP4_ADMIN_ASSEMBLY_AND_BOTH_INTEGRATION_TESTS
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED
INDEPENDENT_RECONCILIATION=doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md
```

This evidence does not claim CP-5/admin layout, mechanism-batch whole-scope reconciliation,
any native/Android/Web/visual/release result, or overall implementation acceptance.
