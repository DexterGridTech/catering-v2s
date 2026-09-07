# TER terminal input CP-4 focused and static evidence

```text
CP=CP-4
SCOPE=affected-package typecheck/owned tests, static gates, and model red vectors
IMPLEMENTATION_AUTHORITY=true
CP4_RECONCILIATION=PASS
WEB_RUNTIME=NOT_RUN_BY_AUTHORITY
ANDROID_RUNTIME=NOT_RUN_BY_AUTHORITY
```

## Fresh affected-package proof

The following commands used each package's existing `typecheck` and `test` scripts. No alternate
runner or test entry was introduced.

| Package | Typecheck | Owned tests |
| --- | --- | --- |
| `apps/terminal/ui/base/input` | PASS | 8 files, 44 tests PASS |
| `apps/terminal/ui/base/primitives` | PASS | 1 file, 8 tests PASS |
| `apps/terminal/ui/base/render` | PASS | 8 files, 37 tests PASS |
| `apps/terminal/ui/feature/sample-member-desk` | PASS | 1 file, 24 tests PASS |
| `apps/terminal/ui/feature/sample-staff-auth` | PASS | 1 file, 7 tests PASS |
| `apps/terminal/ui/integration/sample-console` | PASS | 6 files, 15 tests PASS |
| `apps/terminal/ui/base/dev-host` | PASS | 3 files, 5 tests PASS |
| `apps/terminal/kernel/feature/sample-member-registry` | PASS | 1 file, 9 tests PASS |

Each owned test run ended with `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS` and each typecheck
ended with exit code 0.

## Static gates

Fresh runs produced:

```text
node tools/terminal-layering/check-static.mjs
TERMINAL_LAYERING_RULE_GATES=4
TERMINAL_LAYERING_RULE_P_5A_DIRECTION=PASS
TERMINAL_LAYERING_RULE_P_5C_STATE_EDGE=PASS
TERMINAL_LAYERING_RULE_P_10_KERNEL_UI_LITERALS=PASS
TERMINAL_LAYERING_RULE_P_5D_UI_FEATURE_NATIVE_ELEMENTS=PASS
TERMINAL_LAYERING=PASS

node tools/terminal-ui-render/check-static.mjs
RENDER_STATIC_RULE_GATES=7
RENDER_STATIC_SUPPORT_CHECKS=1
RENDER_STATIC_SUPPORT=PASS
TERMINAL_RENDER_STATIC=PASS

node tools/terminal-skeleton/verify-static.mjs
TERMINAL_STATIC=PASS
```

The skeleton model test contains expected mutation failures; those are model red-vector results,
not production-tree failures. The real static tree completed all six skeleton rules, four contract
rules, four platform-port rules, four state rules, five runtime rules, four display-context rules,
seven render rules, and four layering rules with PASS.

## Model red vectors

```text
node tools/terminal-ui-primitives/check-behavior.mjs
TERMINAL_PRIMITIVES_BEHAVIOR_BASELINE=PASS
TERMINAL_PRIMITIVES_BEHAVIOR_RED_THEME_TOKEN=PASS mutation_exit=1
TERMINAL_PRIMITIVES_BEHAVIOR_CLEANUP=PASS

node tools/terminal-ui-render/check-behavior.mjs
TERMINAL_RENDER_BEHAVIOR_BASELINE=PASS tests=37
TERMINAL_RENDER_BEHAVIOR_RED_VECTORS=26
TERMINAL_RENDER_BEHAVIOR_CLEANUP=PASS
```

The red-vector meaning is intentional: each mutated sandbox production tree failed its focused
test, while the unmutated baseline passed. No mutation result is reported as a production-source
failure.

## First failure, repair, and rerun

The first primitives behavior run stopped before executing its mutation because the existing
mutation helper searched for the generic fragment `flex-1 bg-canvas`, which became ambiguous after
the approved keyboard token was added. The helper reported:

```text
Error: mutation anchor count 2 for .../src/theme/tokens.ts
```

The root cause was the helper's non-unique mutation anchor, not a production behavior failure. The
main agent changed the helper to mutate the complete `baseTokens.container` entry only:
`container: 'flex-1 bg-canvas p-6 gap-4'`. The rerun then produced the baseline PASS, the expected
theme-token red mutation, and cleanup PASS shown above.

The render behavior run completed 26 mutations. Every mutation exited non-zero in its sandbox,
and the sandbox cleanup marker passed.

## First independent reconciliation and repair

The first fresh read-only reconciliation returned:

```text
REVIEW_TARGET=IMPLEMENTATION
CP4_RECONCILIATION=BLOCKED
MATCHED=9
OPEN=1
```

The OPEN was a real input-contract gap: `MemberForm` declared `layout: 'full'` on its system
keyboard name field, while `InputFieldOptions` allowed `layout` for both keyboard owners. This
left virtual-layout semantics attached to a system field and allowed future calls to repeat the
mistake.

The main agent repaired the root seam in two places:

- removed the invalid `layout` from
  `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx`;
- changed `InputFieldOptions` in `apps/terminal/ui/base/input/src/types.ts` to a discriminated
  union: system fields cannot declare `layout`, and virtual fields must declare it;
- added `apps/terminal/ui/base/input/test/inputFieldOptions.test.ts` with positive system/virtual
  assignments and a `@ts-expect-error` negative assignment. The package typecheck consumes this
  assertion.

The first typecheck after the initial edit exposed an incorrectly positioned `@ts-expect-error`
directive. That was a test assertion-placement failure, not a production failure; moving the
directive to the actual property line produced the current typecheck PASS. The repaired current
bytes were then re-run through all eight package typechecks/owned tests, static gates, and model
red vectors.

The second fresh independent reconciliation is required before this file can be marked PASS.

## Final independent CP-4 reconciliation

The second and final fresh read-only reviewer result was:

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
REVIEW_ROUND=2
ROUND_FINAL_DECISION=SELF_DECIDED
CP4_RECONCILIATION=PASS
MATCHED=12
OPEN=0
```

The twelve matched rows covered the repaired system-field layout seam and type assertion,
current eight-package denominators, static gates, red/real evidence separation, mutation cleanup,
input-only local-measurement boundary, sample-only alpha/financial boundary, CP-3 matrix and
`S-30..S-39` support including all three `S-38` oracles, dynamic non-claims, and public-surface
invariants. No Web, Android, physical pointer, secondary-surface runtime, portrait-device, or
real-POS claim was promoted to PASS.

## Input-specific static boundary observations

Fresh searches found no matches in `apps/terminal/ui/base/input/src` for the forbidden static or
environment-derived geometry sources: `Dimensions`, `useWindowDimensions`, `window.innerWidth`,
`Platform.OS`, `typeof window`, `terminalSurfaces`, `scaleToFit`, `className`, `displayMode`,
`PRIMARY`, `SECONDARY`, `surfaceSize`, or `InputSurfaceSize`.

The sample-console assembly still passes only the existing `imeInset` fact to input. Its remaining
`displayMode` references select the already-existing business surface; they do not pass static
surface dimensions. No input source owns App orientation, Android carrier, Presentation topology,
IME policy, host/VM/process, or device policy.

The `PrimitiveButton` keyboard variants are the approved presentation-only additive seam. They do
not add business props, `className`, or a second automation path; the existing testID and press
contract remain in force.

## Dynamic boundary

This CP was executed without Web browser or Android runtime authorization. Therefore this evidence
does not claim browser pointer rectangles, physical hit regions, Android local-layout behavior,
secondary-surface virtual input, portrait device behavior, or real POS behavior. Those remain
runtime evidence items listed by the approved plan.
