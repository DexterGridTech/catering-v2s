# TER screenPart 机型解析 · CP-5a execution evidence

```text
SCOPE=CP-5a / B-1 / R-10b,R-12,R-13,R-14 partial
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
STEP_STATUS=CLOSED_MATCHED
```

## Owning source changed

- `apps/terminal/ui/base/admin-shell/src/types/adminShell.ts`
- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLayerLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLayerMobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/*Laptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/*Mobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`
- `apps/terminal/ui/base/admin-shell/test/adminSections.test.tsx`
- `apps/terminal/ui/base/admin-shell/test/adminSectionsStructure.test.ts`
- `apps/terminal/ui/base/admin-shell/test/parts.test.ts`
- `apps/terminal/ui/base/admin-shell/test/react-test-renderer.d.ts`
- `apps/terminal/ui/base/admin-shell/package.json`

CP-5a gives each R-10 admin key distinct ordinary `Laptop`/`Mobile` renderer components.
`AdminLayer` remains the shared authentication, close-command and focus-scope owner; the
form-specific layer wrappers only select their already-bound shell component and do not
read form state. The shared `useAdminSections` hook owns the finite section collection and
raw requested selection; the two form-specific shell components independently apply their
first-entry fallback and invalid-selection behavior. It receives the already projected
catalog/context and does not branch on `surfaceForm`.

The historical `AdminShell` public component remains a compatibility entry delegating to
the mobile shell; the production R-10b bindings use private form-specific components. No
new public export or invariant entry was added.

## Focused results

```text
COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=PASS (after AST test type-fix and production mutation restoration)
TEST_FILES=7 passed
TESTS=16 passed

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly typecheck
RESULT=PASS
OUTPUT=(empty)

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

The wrapper test exercises raw selection state and rejection through the actual hook. The new
`adminSectionsStructure.test.ts` builds the TypeScript AST for `useAdminSections.ts` and its local
relative-import closure, rejecting `surfaceForm` property/element reads and destructuring. `parts.test.ts`
uses the actual eight production declarations and now requires two distinct component identities
per sibling pair. Existing real assembly tests select each form through the production assembly;
no hand-built catalog is used to prove renderer registration.

## Negative controls

```text
MUTATION=add a surfaceForm read/branch to useAdminSections
EXPECTED=CP-5a static review/AST check and hook boundary review reject the change
STATUS=RED_EXECUTED; both `adminSectionsStructure.test.ts` and the existing behavior test failed
(`2 failed`, `14 passed`, `16 total`); source restored and the same owned test returned `7 passed`,
`16 passed`. The mutation changed the context passed to `selectAdminSections`, so this is a
production-behavior mutation, not a test-only string mutation.

MUTATION=bind both sibling forms to the same component
EXPECTED=admin-shell parts focused distinct-component assertion fails
STATUS=negative-control-defined; not applied to source

MUTATION=select an unknown section key
EXPECTED=adminSections focused test confirms the raw requested selection remains unchanged;
form-specific wrappers retain their own valid first-entry fallback
STATUS=negative-control-executed by test
```

## Evidence boundary

```text
STATIC=CP-5a typechecks PASS; the AST test traverses the hook and local relative-import closure and
confirms no executable `surfaceForm` property/element/destructuring read in that closure
FOCUSED=PASS_FOR_CP-5a
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED

## Independent reconciliation

The first CP-5a review records remain retained as historical `OPEN` findings:
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-bacon.md`
and
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-confucius.md`.
After their scope findings were repaired, fresh reviewer Hooke independently re-read the
current requirements, design/IA, plan, terminal standard, memory boundary and current
source/tests. The current fresh record is
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-hooke.md`
with `VERDICT=MATCHED`. No nonexistent second reviewer record is used as evidence.
```

This record does not claim B-2 styles, B-3 focus/device behavior, dynamic evidence, or
implementation acceptance.
