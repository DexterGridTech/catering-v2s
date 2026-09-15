# Static/focused parallel-mutation first failure

```text
RUN_CONTEXT=2026-09-15-v2s-terminal-sample-infrastructure-uplift
FAILURE_CLASS=shared-source-mutation-race
BUSINESS_STATUS=FAIL
CLEANUP_STATUS=OPEN_PENDING_EXPLICIT_GENERATED_CACHE_CLEANUP
FIRST_FAILURE=check-behavior integration baseline: sample2Assembly.test.tsx:149 expected one startup.complete, observed zero
LAST_KNOWN_GOOD=standalone yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test -> 4 files / 14 tests passed
BROKEN_BOUNDARY=parallel mutation-based checkers shared the same source tree
```

## What happened

The main agent launched these mutation-based checkers concurrently:

- `node tools/terminal-sample2/check-behavior.mjs`
- `node tools/terminal-sample2/check-startup-diagnostics.mjs`
- `node tools/terminal-sample2/check-u8-focused.mjs`
- `node tools/terminal-skeleton/check-static.mjs`

`check-behavior.mjs` runs package tests while temporarily mutating and restoring
source files. The other checkers also use temporary source mutations. The
integration baseline therefore read a concurrently mutated source tree and
failed at `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:149`:

```text
AssertionError: expected [] to have a length of 1 but got +0
...
AssertionError [ERR_ASSERTION]: integration baseline focused tests must pass
```

This run is retained as a real FAIL. It is not a product PASS and was not
silently discarded.

## Diagnosis and recheck

The same integration package was then run alone, without any concurrent
mutation runner:

```text
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test
```

The standalone result was:

```text
Test Files  4 passed (4)
Tests       14 passed (14)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-wallpaper-console
```

The required repair is execution ordering, not a production-code change:
mutation-based checkers must run serially, with each checker restoring its
source before the next checker starts. The generated
`apps/terminal/assembly/base/android/node_modules` directory is handled
separately as explicit scaffold-cache cleanup before the hygiene rerun.

