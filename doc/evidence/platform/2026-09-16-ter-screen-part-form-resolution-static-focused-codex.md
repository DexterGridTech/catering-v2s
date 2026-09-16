# TER screenPart 机型解析 · static/focused evidence

```text
SCOPE=terminal static baseline and owning focused re-verification
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
BUSINESS=screenPart implementation; baseline repairs were required to satisfy the existing terminal static precondition
```

## First failure, last known good, broken boundary

The first full static run after the CP work was run as:

```text
COMMAND=yarn --cwd apps/terminal verify:static
RUN_ID=ter-local-static-32884-1789553475621
```

The first failing subprocess was `render-model-test`. Its model mutation suite reported an
unexpected public surface:

```text
AssertionError: render-public-surface status drifted during targeted mutation:
render public exports mismatch; missing=[] extra=["ContentFailureReason","FailureStage",
"RenderFailure","SystemFailureReason","TransitionFailureReason","isBusinessErrorCategory"]
TERMINAL_STATIC_FIRST_FAILURE=render-model-test:exit=1
```

The broken boundary was the render public-surface invariant, not the screenPart runtime
implementation. `src/index.ts` already exported the typed failure contract and
`isBusinessErrorCategory`, while `apps/terminal/ui/base/render/terminal-invariants.json`
had not been synchronized. The minimal repair added exactly those six existing exports to
the invariant; no new export was introduced.

During the same static-baseline recovery, the existing gates exposed three independent
owning-source boundaries. They were repaired before the final run and are listed here so
they cannot be mistaken for screenPart behavior evidence:

1. RD-6 required production port-descriptor attachment to be development-only. The
   existing descriptor attachments were wrapped in `if (__DEV__)` in the platform-ports
   defaults/factory and the existing web/device host support implementations. The
   descriptor is diagnostic metadata and is not required in production behavior.
2. TR-R05/TR-R04 rejected the new hydration prune helper's nesting/argument shape. The
   prune branch was extracted to the named helper
   `pruneHydratedContainersForDisplayMode({ ... })`; behavior was retained.
3. TR-R06 rejected `ui/base/test-support/src/platformTypes.ts` as a source-root file.
   The type was moved to `ui/base/test-support/src/types/platformTypes.ts` and the
   existing index export was updated.
4. The ui-state catalog boundary rejected a direct `containerKeys` read from the actor.
   Removing the guard caused three focused hydration regressions, so that attempted repair
   was reverted. The semantic predicate
   `hasUiContainerDeclarations(catalog)` now lives in
   `kernel/base/ui-state/src/foundations/catalog.ts`; the actor calls that predicate and
   retains the required no-declaration no-op behavior.

The failed ui-state attempt is preserved as a real counterexample: removing the guard
caused `acceptance.test.ts`, `content.test.ts` and the old-archive hydration case to fail
(3 failed, 37 passed, 40 total). After moving the predicate to the catalog owner, the
ui-state focused suite returned 6 files / 40 tests passing and its real static checker
returned PASS.

## Final full static run

```text
COMMAND=yarn --cwd apps/terminal verify:static
RUN_ID=ter-local-static-33183-1789553626230
RESULT=PASS
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_SKELETON_STATIC=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

The final run's model suites exercised their existing red mutations, including the newly
synchronized render public surface and the ui-state catalog boundary. The original command
output is retained in the Codex execution record; this repository record preserves the run
identity, first failure, root cause, repair boundary, and final result.

## Focused re-verification after final static repair

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-ui-state typecheck
RESULT=PASS

COMMAND=yarn workspace @catering-v2s/kernel-base-ui-state test
RESULT=PASS; 6 files / 40 tests

COMMAND=node tools/terminal-ui-state/check-static.mjs
RESULT=PASS; all 8 rules and support checks

COMMAND=node tools/terminal-ui-render/check-static.test.mjs
RESULT=PASS; all targeted render red mutations restored
```

These results are static/focused only. Native, Android, Web, visual, release and cleanup
remain separate evidence tiers until their authorized runners have actually produced
business and cleanup observations.

## Evidence boundary

```text
STATIC=PASS
FOCUSED=PASS_FOR_BASELINE_REPAIR_REVERIFICATION
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=OPEN_NOT_RUN
```

## Post-static focused integration re-verification

The first post-repair run of the real sample-console integration suite exposed a
fixture boundary rather than a production failure:

```text
COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
FIRST_FAILURE=missing startup.complete run id
OBSERVED=37 passed / 1 failed (38 total)
BROKEN_BOUNDARY=the RD-6 DEV-only port-descriptor change removed the unavailable
test-support port descriptors, so the test writer correctly withheld startup.complete
because startupReadiness.groups.ports was false
OWNING_SOURCE=apps/terminal/ui/integration/sample-console/test/support.ts
MINIMAL_REPAIR=restore explicit withTestPortDescriptor(unavailable, port) bindings for
the test-only unavailable platform ports; no production descriptor or writer rule was relaxed
REVERIFICATION=PASS; 8 files / 38 tests
```

The matching sample-wallpaper-console test-support fixture was repaired in the same
focused change so both integration test environments represent the same unavailable
port contract. This is focused evidence only; native/Android/Web/visual/release and
cleanup remain separate tiers.

## Latest static rerun and release first-failure repair

After the release cold-start runner exposed a wallpaper-only failure, the first failure was
retained as dynamic evidence:

```text
RELEASE_FIRST_FAILURE=StartupCompletionPrerequisitesMissing:group.ports
BROKEN_BOUNDARY=consoleAssembly used DEV-only platform-port descriptor completion as the functional release prerequisite
OWNING_SOURCE=apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx
MINIMAL_REPAIR=use the ten actual PlatformPorts binding-presence checks for groups.ports; retain descriptor metadata as DEV-only diagnostics
```

The release-like focused fixture in
`apps/terminal/ui/integration/sample-console/test/support.ts` now strips all port descriptors
and the existing separate-writer test exercises the descriptor-free boundary. The focused
sample-console suite returned `8 files / 38 tests PASS` after the repair. The wallpaper
release APK was then rebuilt with `assembleRelease --rerun-tasks` and the authorized U8
release runner passed on both shapes.

The final terminal static command was:

```text
COMMAND=yarn --cwd apps/terminal verify:static
RUN_ID=ter-local-static-52662-1789555282698
RESULT=PASS
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_SKELETON_STATIC=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

The post-fix source/focused reconciliation is
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-post-fix-startup-readiness-ports-reconciliation-codex.md`
with `VERDICT=MATCHED`. This does not convert the earlier release first failure into a
pass; it records the source repair and its focused/static re-verification separately.

The current tier summary is maintained in
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/dynamic-release-and-frozen-journeys-codex.md`.
