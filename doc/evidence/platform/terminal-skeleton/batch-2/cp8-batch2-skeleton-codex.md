---
title: TER skeleton batch 2 implementation and final 22-package evidence
status: complete
date: 2026-08-29
scope: batch-two package construction, final graph closure, TER-local verification, and evidence cleanup
---

# CP-8 evidence

## Result

```text
BATCH2_PACKAGES=8
FINAL_TER_PACKAGES=22
ACTIVE_SKELETON_BATCH=2
STATIC_RULE_GATES=6
STATIC_SUPPORT_CHECKS=1
STATIC=PASS
TYPECHECK=22_OF_22_PASS
TURBO_DRY_TYPECHECK=22_PACKAGES_22_TASKS_22_EXECUTABLE
TURBO_DRY_TEST=22_PACKAGES_22_TASKS_5_EXECUTABLE_DRY_RUN_ONLY
TURBO_DRY_LINT=22_PACKAGES_22_TASKS_0_EXECUTABLE
TURBO_DRY_CLEAN=22_PACKAGES_22_TASKS_0_EXECUTABLE
METRO_EXPORT=PASS_647_MODULES
TER_VERIFY=PASS
TER_VERIFY_CLEANUP=PASS
SCAFFOLD_NATIVE_RERUN=4_OF_4_EXIT_0
SCAFFOLD_NATIVE_DIFF_FILES=0
PACKAGE_LOCAL_NODE_MODULES=ABSENT
VERIFY_TEST=PASS
```

CP-8 completes the eight batch-two skeleton packages and moves the active
projection to all 22 TER leaves. It adds no capability implementation: the
four Android adapters contain only the normalized official module shape and a
minimal Kotlin registration class. The generated scaffold `test` scripts are
retained for the adapter shape but are only represented in Turbo dry-run; no
adapter test is executed and no test-support content is promoted into the
production bundle.

The one-time Android emulator acceptance remains the batch-one CP-7 evidence
at `../batch-1/cp7-android-device-codex.md`. CP-8 does not rerun Gradle or the
emulator. Consequently this evidence does not extend the existing device
claim, and it does not claim Kotlin capability, adapter behavior, DEV, L2,
UAT, deployment, or any terminal business slice.

## Batch-two implementation

The added leaves are:

```text
kernel.base.transport
kernel.base.workflow
ui.base.input
ui.base.admin-shell
adapter.android.device
adapter.android.app-control
adapter.android.logger
adapter.android.dual-screen
```

`ui.integration.platform-console` now declares and imports the two batch-two
UI roots. `assembly.android.pos-desktop` declares and imports every other 21
TER root. `src/skeletonBootstrap.ts` imports the same 21 public package roots
plus the local assembly `./index`; `App.tsx` renders the resulting 22
`moduleName` values. `skeleton-graph.ts` is the only graph specification and
has `activeSkeletonBatch = 2`.

## Official scaffold rerun

The four new adapter native trees were regenerated in a scratch directory
with the explicit official source path. The source was packed from
`expo-module-template@latest`, which resolved to `57.0.9` for this run. Each
`create-expo-module@latest` invocation exited 0. The native files in each
scratch result were compared with the normalized repository target and had no
differences:

```text
TARGET=device EXIT=0
TARGET=device NATIVE_DIFF_FILES=0
TARGET=app-control EXIT=0
TARGET=app-control NATIVE_DIFF_FILES=0
TARGET=logger EXIT=0
TARGET=logger NATIVE_DIFF_FILES=0
TARGET=dual-screen EXIT=0
TARGET=dual-screen NATIVE_DIFF_FILES=0
SCRATCH_CLEANUP=PASS
```

The full raw trees, native hashes, diffs, per-target logs, resolved template
version, and cleanup marker are in
`.runtime/terminal-skeleton/batch-2/scaffold-rerun/` (the runtime directory
is ignored and is not a source input).

## Fresh TER-only commands

All commands below ran from the repository root with the user-authorized
proxy for external registry access (`127.0.0.1:7890`) and a process-local
`YARN_NPM_MINIMAL_AGE_GATE=0`. No repository Yarn configuration was changed.
The root `scripts/verify` command was not run; the user authorized TER-local
verification only.

Focused static/model controls:

```sh
node tools/terminal-skeleton/check-static.test.mjs
node tools/terminal-skeleton/check-static.mjs
```

Both exited 0. The real-tree run printed six `RULE_* =PASS` markers,
`SCAFFOLD_HYGIENE=PASS`, and `TERMINAL_STATIC=PASS`. The model run printed
`TERMINAL_SKELETON_MODEL_TEST=PASS`.

Marker-failure control:

```sh
node tools/terminal-skeleton/verify.test.mjs
```

It exited 0 and printed `TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS`.

Per-leaf compiler proof:

```sh
# the loop is recorded verbatim in
# .runtime/terminal-skeleton/batch-2/typecheck-all-per-package.log
yarn workspace <each of the 22 TER leaf names> run typecheck
```

The recorded result is `PACKAGE_COUNT=22`, every package has `EXIT=0`, and
`TYPECHECK_ALL_EXIT=0`.

Final TER entry:

```sh
yarn workspace @catering-v2s/terminal run verify
```

Observed output included:

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SUPPORT_CHECKS=1
SCAFFOLD_HYGIENE=PASS
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=5
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks:    22 successful, 22 total
Cached:   0 cached, 22 total
Android Bundled 1907ms apps/terminal/assembly/android/pos-desktop/index.ts (647 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
TER_VERIFY_EXIT=0
TER_VERIFY_DURATION_SECONDS=20
```

The complete stdout/stderr and exit/duration markers are in
`.runtime/terminal-skeleton/batch-2/ter-verify.log`.

## Cleanup and boundaries

All package-local adapter `node_modules` trees created by the install were
moved out of the repository to a recoverable scratch directory before the
final static run. The pre-existing assembly `.expo` directory was likewise
moved out. The static hygiene check confirms no package-local `node_modules`,
nested repository metadata, agent instruction files, or package-local
licenses remain in the 22 leaves. Turbo cache directories are generated
outputs and are removed from the repository tree after this evidence is
written; the shared `apps/terminal/node_modules` tree is not part of the
source census.

The final TER verify owns and cleans only the assembly `dist` and `.expo`
paths it creates. Its cleanup marker is a separate condition from business
verification. No root verifier, Testcontainers, DEV, reset, seed, browser,
UAT, EAS, or Git command was run.

## Evidence index

```text
.runtime/terminal-skeleton/batch-2/check-static-after-hygiene-rerun.log
.runtime/terminal-skeleton/batch-2/check-static-test-after-hygiene-rerun.log
.runtime/terminal-skeleton/batch-2/verify-test-final.log
.runtime/terminal-skeleton/batch-2/typecheck-all-per-package.log
.runtime/terminal-skeleton/batch-2/ter-verify.log
.runtime/terminal-skeleton/batch-2/scaffold-rerun/run-meta.log
```

The batch-one emulator result and its explicit native claim boundary remain
in `batch-1/cp7-android-device-codex.md`; CP-8 relies on that prior evidence
only for the already-approved one-time batch-one device acceptance.

## Fresh independent full-range reconciliation

The fresh independent reconciliation after implementation returned
`RECONCILIATION=PARTIAL`, with no source or graph mismatch requiring a code
repair. The partial status is deliberate: the reviewer did not promote
unexecuted or unauthorized boundaries into a match.

```text
CONFIRMED=22/21 exact sets; batch-two 8 packages; static 6+1; TER-only
22/22 typecheck; Expo export 647 modules; cleanup; test dry-run executable=5;
package-local generated directories absent; adapter minimal registration;
assembly bootstrap and root wiring
PARTIALLY_CONFIRMED=batch-one CP-7 device evidence covers the 14-package
projection only, not the four new batch-two adapters
UNVERIFIED_REQUIRES_EVIDENCE=root scripts/verify --validate-only green;
batch-two Android/Gradle/autolinking/device behavior; Kotlin capability and
terminal business behavior
```

`root scripts/verify --validate-only` was not run because Dexter's active
instruction authorizes TER-local verification only. The two device/capability
items remain outside this skeleton implementation boundary, not implementation
failures. The independent reviewer did not issue a formal GO/NO-GO; the
formal implementation verdict is intentionally delegated to the Claude review
requested in `doc/review/platform/2026-08-29-v2s-terminal-skeleton-implementation-review-request-codex.md`.
