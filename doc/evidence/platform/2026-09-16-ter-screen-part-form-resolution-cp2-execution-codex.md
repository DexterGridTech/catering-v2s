# TER screenPart 机型解析 · CP-2 execution evidence

```text
SCOPE=CP-2
STEP=A-2 default / hydration-prune / startup payload
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
STEP_STATUS=CLOSED_MATCHED
```

## Owning source changed

- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`
- `apps/terminal/kernel/base/ui-state/src/features/commands/pruneHydratedContainers.ts`
- `apps/terminal/kernel/base/ui-state/src/features/commands/index.ts`
- `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`
- `apps/terminal/kernel/base/ui-state/src/features/actors/index.ts`
- `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts`
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`
- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`
- `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`
- `apps/terminal/ui/base/console-assembly/test/startupDiagnosticsWriter.test.ts`
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-console/src/application/module.ts`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts`
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`

The implementation keeps integration defaults optional and read-only at render time, prunes
invalid or currently non-renderable hydrated containers before surface creation, and persists
that stale-record cleanup through the existing owner-only content write path. It carries nullable
`readyPartKey` plus typed `contentFailure` through the single console-assembly startup writer into
both integration payloads. It does not persist defaults, transfer declaration metadata into
ui-state, or add an `other-form` recovery reason.

## First failure and root cause

The first CP-2 focused run failed in three existing ui-state restart/acceptance tests:

- `apps/terminal/kernel/base/ui-state/test/acceptance.test.ts` — `U-7 restores containers and layers after restart`
- `apps/terminal/kernel/base/ui-state/test/content.test.ts` — `restores containers and layers with order, props, and openedAt across runtime restart`
- `apps/terminal/kernel/base/ui-state/test/content.test.ts` — `treats an old archive without layers entries as an empty layer state`

The failed expectation was a restored screen (`restored` / `restored-screen`) becoming
`undefined`. The broken boundary was:

```text
createUiStateModule.install
  -> pruneHydratedContainersCommand
  -> pruneHydratedContainersActor
  -> catalog membership check
  -> historical layer-only test fixture container removed
```

Root cause: the new container prune treated every hydrated container as having a production
catalog membership oracle, but these existing layer-only fixtures intentionally build a catalog
with no container declarations. At that boundary, the catalog cannot distinguish a stale
container from a valid fixture container, so removing it is an overreach.

Minimal repair: when the supplied catalog has no container declarations at all, the container
prune actor is a no-op; catalogs that do declare containers still traverse `MAIN`/`BRANCH` and
`PRIMARY`/`SECONDARY` and remove only entries that are absent or unavailable in the current
catalog/form. This preserves the old layer-only contract while keeping the production assembly
membership check active. No test fixture was changed to hide the failure.

## Focused commands and results

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-ui-state typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/kernel-base-ui-state test
RESULT=PASS
TEST_FILES=6 passed
TESTS=40 passed

COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=12 passed
TESTS=75 passed

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-console-assembly test
RESULT=PASS
TEST_FILES=1 passed
TESTS=3 passed

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
TESTS=15 passed
```

The raw command output is retained in the Codex execution record for this CP; the command/result
transcript above is the repository evidence index. No command was replaced by a test name or
exit code alone: the package test runners reported their file and test counts.

After the first independent review identified that the workspace had briefly contained
out-of-order A-3 changes, the main agent withdrew those changes and reran the CP-2-only set from
the current bytes. The rerun at 17:12:22 produced the same results above, including
`ui-base-console-assembly` 1 file/3 tests; no React Native Flow parse failure occurred in the
current, restored test boundary. The earlier OPEN review remains preserved separately as
historical evidence and is not used as a current PASS claim.

## Behavior covered by this CP

- `parseContainers` emits `hydrated-container-invalid` for malformed container records and keeps
  valid placement data in the existing state shape.
- The real prune actor emits `hydrated-container-not-renderable` for unknown, retired, or
  current-form-unavailable records, removes them from the hydrated view, and persists that
  removal through the existing owner-only content write. The reason is deliberately shared; no
  declaration metadata crosses into ui-state.
- The no-declaration guard is limited to catalogs with zero container declarations; it is not a
  production fallback and is required to preserve existing layer-only state tests that lack the
  membership oracle. A real cross-form container record remains an A-3 obligation after assembly
  filtering is active.
- An integration default is selected only when no persisted placement exists and is not written
  as a container action. The render focused suite covers default display without persistence.
- The console writer and both integration payload consumers preserve nullable `readyPartKey` and
  `contentFailure`, including the synthetic no-placement shape used by U-6. The current
  integration anonymous journeys are not claimed to produce that null shape; their placement
  owner audit is recorded in the design/plan.

## Evidence status

```text
STATIC=PASS_FOR_CP2_TYPECHECKS
FOCUSED=PASS_FOR_CP2_UI_STATE_RENDER_ASSEMBLY_INTEGRATION_TESTS
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED
INDEPENDENT_RECONCILIATION=MATCHED
INDEPENDENT_RECONCILIATION_RECORD=doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp2-three-dimensional-reconciliation-euler.md
INDEPENDENT_RECONCILIATION_REVIEWER=01a0a94e-7f05-72a1-8951-f290a275266a
```

This evidence does not claim the cross-form A-3 recheck, overall implementation acceptance, or
any native/Android/Web/visual/release result.
