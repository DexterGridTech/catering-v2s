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
FINAL_ANDROID_DEVICE=PASS
FINAL_GRADLE_BUILD=PASS
FINAL_AUTOLINKED_ADAPTERS=5_OF_5
FINAL_APP_START=PASS
FINAL_BOOTSTRAP_RENDER=22_OF_22
FINAL_ANDROID_GENERATED_CLEANUP=PASS
```

CP-8 completes the eight batch-two skeleton packages and moves the active
projection to all 22 TER leaves. It adds no capability implementation: the
four Android adapters contain only the normalized official module shape and a
minimal Kotlin registration class. The generated scaffold `test` scripts are
retained for the adapter shape but are only represented in Turbo dry-run; no
adapter test is executed and no test-support content is promoted into the
production bundle.

The `22/22 typecheck` result below means that the 22 package roots and their
declared cross-package imports resolve and compile. It is **cross-package type
resolution evidence**, not evidence that terminal business types or adapter
capabilities are correct.

The original batch-one emulator acceptance is retained at
`../batch-1/cp7-android-device-codex.md` as its historical 14-package record.
After the skeleton was complete, a Dexter-directed final-tree emulator run was
performed and is recorded in the addendum below. That run extends the device
claim to the final 22-package tree for Gradle, Expo-module autolinking, app
startup, and bootstrap rendering only. It does not claim Kotlin capability,
adapter behavior, DEV, L2, UAT, deployment, or any terminal business slice.

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

## Final 22-package Android emulator acceptance addendum

This addendum is a one-time manual runtime proof after both skeleton batches
were present. It is deliberately outside `verify`; the fast TER entry remains
static gates → Turbo/typecheck → Expo export.

Preflight selected the Android emulator by serial, not the simultaneously
attached physical device:

```text
TARGET_SERIAL=emulator-5554
TARGET_NAME=Pixel_Tablet
ADB_STATE=device
SDK=35
ANDROID_SIZE=2560x1600
ANDROID_DIR_BEFORE=absent
PREFLIGHT=PASS
```

The command was run from the assembly package with the process-local proxy
environment and `--no-install`:

```sh
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
ANDROID_SERIAL=emulator-5554 \
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
ALL_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1,::1 \
npx expo run:android --no-install --device Pixel_Tablet
```

Observed in the raw output (`.runtime/terminal-skeleton/batch-2/device-final/expo-run-android-final.log`):

```text
Using expo modules
  - catering-v2s-adapter-android-app-control (0.1.0)
  - catering-v2s-adapter-android-device (0.1.0)
  - catering-v2s-adapter-android-dual-screen (0.1.0)
  - catering-v2s-adapter-android-logger (0.1.0)
  - catering-v2s-adapter-android-persist-kv (0.1.0)
BUILD SUCCESSFUL in 11s
Expo Autolinking module resolution enabled
Installing .../android/app/build/outputs/apk/debug/app-debug.apk
Opening com.anonymous.posdesktop/.MainActivity on Pixel_Tablet
Android Bundled 1119ms .../index.ts (761 modules)
```

The command keeps Metro attached to the terminal. After the app was installed,
opened, and evidence was captured, the owned CLI session was stopped with
Ctrl-C; its process exit was `130`, recorded as
`EXPO_RUN_ANDROID_EXIT=130_CONTROLLED_STOP_AFTER_EVIDENCE`, not as a Gradle or
application failure. The target process remained alive during capture:

```text
APP_PID=3488
APP_MAIN_STARTED=PASS
APP_FATAL_EXCEPTION=NONE
APP_JS_ERROR=NONE
```

`uiautomator` output and the screenshot were then compared against the 22
`src/moduleName.ts` values:

```text
BOOTSTRAP_UI_MODULE_NAME_COUNT=22
BOOTSTRAP_UI_MODULE_NAME_EXPECTED=22
BOOTSTRAP_UI_MODULE_NAME_MISSING=NONE
BOOTSTRAP_UI_MODULE_NAME_EXTRA=NONE
BOOTSTRAP_RENDER=PASS
```

The screenshot is `.runtime/terminal-skeleton/batch-2/device-final/screen.png`;
the raw hierarchy is `ui.xml`, with expected and rendered lists in
`module-names-expected.log` and `module-names-rendered.log`. The Expo module
list above is the autolinking evidence for all five adapters. The generated
assembly `android/` tree and `.expo/` output were moved, not deleted, to
`/tmp/catering-v2s-ter-final-device-android.VyeF2L/`; the final TER-local verify
generated Turbo cache directories which were also moved there. Post-cleanup
package-local generated residue was zero.

After the resumed TER-local `verify`, Gradle/Turbo generated package-local
cache directories again. They were moved recoverably, not deleted:

```text
ADAPTER_ANDROID_BUILD_CLEANUP=/tmp/catering-v2s-ter-adapter-build-cleanup.fp7Foi/
PACKAGE_TURBO_CLEANUP=/tmp/catering-v2s-ter-package-turbo-cleanup.iMMRHZ/
POST_RESUME_GENERATED_RESIDUE=NONE
POST_RESUME_TER_STATIC=PASS
```

This run proves the final tree's Gradle build, Expo autolinking resolution,
APK installation, activity startup, JS main execution, and 22-name bootstrap
rendering. It does **not** prove any Kotlin/native method, persistence,
command, slice, port, dual-screen, or other terminal capability: all adapter
classes remain minimal registration-only skeletons.

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
verification. Testcontainers, DEV, reset, seed, browser, UAT, EAS, and Git
commands were not run.

During the final stale-wording scan, a shell quoting mistake accidentally
evaluated the backticked text `scripts/verify` inside an `rg` pattern. That
invoked the root verifier outside the authorized evidence path. It stopped at
the first static gate with `CODE_LAYOUT=FAIL` and
`R5_VERIFY_STATIC_FIRST_FAILURE:code-layout`; no runtime, Testcontainers, DEV,
or TER acceptance work was performed through the root verifier. The captured
accident record is
`.runtime/terminal-skeleton/batch-2/device-final/accidental-root-verify-static-first-failure.log`.
This is explicitly not counted as root verification evidence; the root
validate-only green boundary remains unproven by Dexter decision.

## Evidence index

```text
.runtime/terminal-skeleton/batch-2/check-static-after-hygiene-rerun.log
.runtime/terminal-skeleton/batch-2/check-static-test-after-hygiene-rerun.log
.runtime/terminal-skeleton/batch-2/verify-test-final.log
.runtime/terminal-skeleton/batch-2/typecheck-all-per-package.log
.runtime/terminal-skeleton/batch-2/ter-verify.log
.runtime/terminal-skeleton/batch-2/scaffold-rerun/run-meta.log
.runtime/terminal-skeleton/batch-2/device-final/final-device-acceptance.log
.runtime/terminal-skeleton/batch-2/device-final/expo-run-android-final.log
.runtime/terminal-skeleton/batch-2/device-final/ui.xml
.runtime/terminal-skeleton/batch-2/device-final/screen.png
.runtime/terminal-skeleton/batch-2/device-final/runtime-assertions.log
.runtime/terminal-skeleton/batch-2/device-final/logcat-app-assertion.log
.runtime/terminal-skeleton/batch-2/device-final/cleanup.log
.runtime/terminal-skeleton/batch-2/device-final/ter-verify-post-device.log
.runtime/terminal-skeleton/batch-2/device-final/accidental-root-verify-static-first-failure.log
.runtime/terminal-skeleton/batch-2/device-final/verify-static-post-final.log
.runtime/terminal-skeleton/batch-2/device-final/verify-static-after-resume.log
.runtime/terminal-skeleton/batch-2/device-final/ter-verify-after-resume.log
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
22/22 typecheck; Expo export 647 modules; final emulator Expo bundle 761
modules; cleanup; test dry-run executable=5; package-local generated
directories absent; adapter minimal registration; final 5/5 adapter
autolinking; final Gradle/APK/startup/bootstrap 22/22 rendering; assembly
bootstrap and root wiring
UNVERIFIED_REQUIRES_EVIDENCE=root scripts/verify --validate-only green;
Kotlin capability and terminal business behavior
```

`root scripts/verify --validate-only` was not run to green because Dexter's
active instruction authorizes TER-local verification only. A later accidental
root verifier invocation stopped at static first failure and is recorded above;
it is not a successful root validation and does not change the TER-local
acceptance result. Kotlin capability and terminal business behavior remain
outside this skeleton implementation boundary, not implementation failures.
The independent reviewer did not issue a formal GO/NO-GO; the formal
implementation verdict is intentionally delegated to the Claude review
requested in `doc/review/platform/2026-08-29-v2s-terminal-skeleton-implementation-review-request-codex.md`.

## Claude implementation review disposition

Claude's implementation review returned `GO`, `M=0`, `S=1`, `N=2`.

```text
S-1=ACCEPTED_AS_WORDING_GUARD
N-1=ACCEPTED_AND_CLARIFIED_CROSS_PACKAGE_TYPE_RESOLUTION
N-2=ACCEPTED_NO_ACTION_ROOT_VALIDATE_ONLY_OUTSIDE_TER_ONLY_AUTHORIZATION
```

The review found no source, graph, package-shape, or entry-closure mismatch.
Its significant item was a claim-boundary guard on the then-current evidence:
the four new adapters had not yet been device tested. The final-tree emulator
addendum above supplies that missing runtime evidence; it still does not imply
Kotlin capability or business behavior. The root `scripts/verify
--validate-only` state remains unexecuted by Dexter's TER-only instruction and
is not treated as a TER failure. A fresh independent reconciliation was run
before handing the updated implementation evidence back for Claude review.

## Fresh independent final-device reconciliation

After the final-device addendum, a fresh independent verifier performed a
read-only reconciliation against the current source, requirements, design,
plan, memory, and all listed runtime evidence. It returned:

```text
RECONCILIATION=MATCHED
SCOPE=FINAL_22_PACKAGE_DEVICE_EVIDENCE
REVIEWER_KIND=INDEPENDENT_SUBAGENT
OPEN=0
```

It independently confirmed the 22/22 UI exact-set, five adapter autolinking,
Gradle/APK/Activity/JS-main markers, target-PID error boundary, recoverable
generated-output cleanup, and TER-local verify/static exits. It did not issue a
formal Claude `GO`/`NO-GO`, did not run a second device run, and did not promote
Kotlin or terminal capability. During its stale-wording scan it accidentally
invoked the root verifier through unsafe shell command substitution; the
static-first failure is preserved in the incident log above and is explicitly
excluded from acceptance evidence.
