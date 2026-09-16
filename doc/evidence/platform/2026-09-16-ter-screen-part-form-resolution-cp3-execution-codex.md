# TER screenPart 机型解析 · CP-3 execution evidence

```text
SCOPE=CP-3
STEP=A-3 pre-filter conflict admission and assembly surface-form selection
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
STEP_STATUS=FOCUSED_COMPLETE_PENDING_INDEPENDENT_RECONCILIATION
```

## Owning source changed

- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`
- `apps/terminal/ui/base/console-assembly/vitest.config.ts`
- `apps/terminal/ui/base/console-assembly/test/partSelection.test.ts`
- `apps/terminal/ui/base/render/test/layerStack.test.tsx`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`

The production assembly now validates every unfiltered `parts` declaration before any
surface-form selection. It rejects an empty or duplicate declaration, compares every
same-`partKey` sibling's form set for overlap, then filters to the requested form and
re-applies the existing unique-key assertion before constructing the UI and renderer
catalogs. The public `createUiCatalog` contract remains unchanged.

The sample-console production-admin test no longer hand-builds a production catalog for
its precondition. Its remaining hand-built catalog test is explicitly named as a
non-production catalog unit; production behavior is exercised through the real sample
assembly. The render focused suite also has a direct LayerStack test proving that a
current-form-unavailable hydrated layer leaves neither a backdrop nor an empty layer in
the render tree.

## First failure and root cause

The first CP-3 command pair at 17:29:05 had one typecheck failure:

```text
test/partSelection.test.ts(29,5): error TS2322:
Type 'readonly string[]' is not assignable to type 'readonly SurfaceForm[]'.
Type 'string' is not assignable to type 'SurfaceForm'.
```

The focused test runner in that same pair reported 2 files/6 tests passed, but the step
was not accepted because the typecheck was red. The broken boundary was the malformed
test-only fixture constructor, not production assembly code. The smallest repair was to
cast only that deliberately malformed raw fixture at the test boundary; production
types and runtime behavior were not weakened.

After that repair, the console-assembly typecheck and focused tests passed. The later
LayerStack test was added and the render package was rechecked at 13 files/76 tests.

## Focused commands and results

```text
COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly test
RESULT=PASS
TEST_FILES=2 passed
TESTS=6 passed

COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=13 passed
TESTS=76 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=PASS
TEST_FILES=8 passed
TESTS=38 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
RESULT=PASS
TEST_FILES=4 passed
TESTS=16 passed
```

The original command output is retained in the Codex execution record; this file keeps
the command, package runner result, counts, first failure, and repair boundary as the
repository evidence index. The failed typecheck is not relabeled as a pass.

## CP-3 behavior covered

- `partSelection.test.ts` uses real `definePart` output to prove disjoint siblings select
  exactly one renderer for laptop and mobile, and that an overlap affecting only the
  other requested form is rejected before filtering. It also proves empty and duplicate
  form declarations are rejected before catalog creation.
- The two integration focused suites exercise their real assembly entry points for the
  laptop/mobile forms. No production assertion in the sample-console test now relies on
  a hand-built catalog.
- The sample2 focused suite persists the real laptop-only `sample.wallpaper-console.waiting`
  secondary container, recreates the real assembly with the mobile filtered catalog, and
  observes both selector removal and the `hydrated-container-not-renderable` diagnostic.
- `layerStack.test.tsx` observes the real `LayerStack` render tree for a hydrated
  mobile-only layer under a laptop catalog and asserts no `layer-backdrop` or empty layer
  remains. This is a structural render-tree assertion, not a pixel/visual pass.
- The overlap fixture is the production admission helper's red mutation boundary. The
  R-10a production admin sibling overlap and full eight-entry input denominator remain
  CP-4 obligations and will be re-run after the actual admin declaration split.

## Red mutations and negative controls

```text
MUTATION_1=replace the filtered selection with allParts before createUiCatalog
EXPECTED=partSelection/real integration form assertions fail by retaining wrong-form entries
STATUS=negative-control-defined; not applied to the committed source

MUTATION_2=skip assertNoSurfaceFormOverlap or run it after surface-form filtering
EXPECTED=the other-form-only overlap fixture becomes green
STATUS=negative-control-defined; focused test is specifically ordered to detect this

MUTATION_3=remove LayerStack's isUiCatalogEntryAvailable filter
EXPECTED=layerStack.test.tsx finds layer-backdrop and stale layer
STATUS=negative-control-defined; not applied to the committed source
```

These mutations are executable test edits, not claims that a production mutation was
run and passed. The real focused tests above are the current behavior evidence; CP-4
will bind the overlap negative control to actual R-10a admin siblings.

## Evidence status

```text
STATIC=PASS_FOR_CP3_TYPECHECKS
FOCUSED=PASS_FOR_CP3_CONSOLE_ASSEMBLY_RENDER_AND_TWO_INTEGRATION_TESTS
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MAIN_AGENT_FALLBACK_MATCHED;SEE_CP3_MAIN_FALLBACK_RECONCILIATION
```

This evidence does not claim CP-4/R-10a, the mechanism-batch whole-scope reconciliation,
any native/Android/Web/visual/release result, or overall implementation acceptance.
