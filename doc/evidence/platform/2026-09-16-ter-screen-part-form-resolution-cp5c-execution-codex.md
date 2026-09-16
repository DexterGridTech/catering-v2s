# TER screenPart 机型解析 · CP-5c execution evidence

```text
SCOPE=CP-5c / B-3 / R-12,R-13,R-14
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
STEP_STATUS=CLOSED_MATCHED
```

## Owning source changed

- `apps/terminal/ui/base/primitives/src/components/PrimitiveHeading.tsx`
- `apps/terminal/ui/base/primitives/test/primitives.test.tsx`
- `apps/terminal/ui/base/primitives/README.md`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/base/admin-shell/README.md`
- `apps/terminal/ui/integration/sample-console/README.md`
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`
- `apps/terminal/assembly/android/sample-terminal/README.md`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/README.md`

## Implementation facts

- laptop navigation uses real `Pressable` nodes with stable admin section test IDs,
  `accessibilityRole="button"`, labels, and selected state;
- mobile navigation uses the existing `PrimitiveGrid` `tablist` and real `Pressable`
  `tab` nodes; selected state is exposed through `accessibilityState`/`aria-selected`;
- `PrimitiveHeading` preserves the existing header role and adds the existing terminal
  live-announcement convention (`accessibilityLiveRegion="polite"`) so a changed detail
  heading is announced without creating an imperative focus or navigation owner;
- `AdminLayer`/`LayerStack` remain the owners of admin/business focus-scope suspension and
  close/back restoration; no `BackHandler` alternative or second focus pipeline was added;
- public `admin-shell` exports and `terminal-invariants.json` were not widened; the form-
  specific renderers and `AdminShellFrame` remain private to the package.

## Focused results after restoration

```text
COMMAND=yarn workspace @catering-v2s/ui-base-primitives typecheck
RESULT=PASS

COMMAND=yarn workspace @catering-v2s/ui-base-primitives test
RESULT=PASS; 1 file / 16 tests

COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell typecheck
RESULT=PASS

COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=PASS; 6 files / 15 tests

COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS; 13 files / 76 tests

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=PASS; 8 files / 38 tests

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
RESULT=PASS; 4 files / 16 tests
```

## First failures and repairs

The last known good before B-3 was the CP-5b restored focused set. The first B-3 attempt
failed because a React test renderer composite instance was inspected as if it were its
native host node (`PrimitiveHeading` did not expose host accessibility props). The owning
test boundary was corrected to select the `Text` host node. The next attempt found the same
boundary for `PrimitivePressOption`; the integration test now selects the real `Pressable`
host node. No production behavior was changed to mask either failure. After those focused
repairs, the commands above passed.

## Production red mutations

```text
MUTATION=remove PrimitiveHeading accessibilityLiveRegion="polite"
COMMAND=yarn workspace @catering-v2s/ui-base-primitives test
RESULT=RED; heading live-announcement assertion failed / 15 passed
RESTORED=YES

MUTATION=AdminSectionNavigationLaptop accessibilityRole="tab" instead of "button"
COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=RED; laptop role assertion failed / 37 passed
RESTORED=YES

MUTATION=remove AdminSectionNavigationLaptop selected binding
COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=RED; selected-after-press assertion failed / 37 passed
RESTORED=YES
```

Existing close/reopen, admin focus ownership, and focus restoration tests remain in the
sample-console integration suite; existing LayerStack focus/back tests remain in render.

## Evidence boundary

```text
STATIC=PASS_FOR_CP-5c_SOURCE_AND_PUBLIC_SURFACE
FOCUSED=PASS_FOR_CP-5c
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED; fresh record: doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-three-dimensional-reconciliation-pascal.md
```
