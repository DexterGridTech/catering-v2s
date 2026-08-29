---
title: TER skeleton batch 1 CP-5 assembly evidence
status: complete
date: 2026-08-29
scope: assembly.android.pos-desktop scaffold normalization and entry closure
---

# CP-5 evidence

## Result

```text
CP5_SCAFFOLD_RAW=PASS
CP5_RAW_MANIFEST=PASS
CP5_NORMALIZED_SHAPE=PASS
CP5_DEPENDENCY_EXACT_SET=PASS
CP5_ENTRY_IMPORT_SHAPE=PASS
CP5_STATIC_RULES=PASS
CP5_WORKSPACE_INSTALL=PASS
CP5_WORKSPACE_COUNT=15
CP5_PACKAGE_TYPECHECK=PASS
CP5_TURBO_TYPECHECK=PASS_FORCE_14_OF_14
CP5_METRO_EXPORT=PASS
CP5_METRO_MODULES=623
CP5_SCRATCH_CLEANUP=PASS
CP5_EXPORT_ARTIFACT_CLEANUP=PASS
CP5_NATIVE_BUILD=UNVERIFIED
```

CP-5 owns only
`apps/terminal/assembly/android/pos-desktop`. It creates no native build,
does not run prebuild or `run:android`, and does not implement any terminal
capability. Dexter's latest-version decision authorized a process-local age
gate override for the install; the repository configuration was not changed.
The resulting workspace install, forced typecheck, and Metro export are now
closed below. Native build and runtime remain outside CP-5.

## Raw scaffold command and external resolution

The command was executed in the private scratch directory
`/tmp/ter-cp5-RCueNB`; no command targeted the repository. The environment
and resolved external versions were:

```text
Node v24.13.0
Yarn 4.17.0
npm 11.19.0
npx create-expo-app@latest --version -> 4.0.0
npm view create-expo-app@latest version -> 4.0.0
npm view expo-template-blank-typescript@latest version -> 57.0.20
expo@57.0.18 published -> 2026-08-28T10:48:19.967Z
expo-template-blank-typescript@57.0.20 published -> 2026-08-28T10:46:15.840Z
```

Exact command:

```sh
TER_SCRATCH=$(mktemp -d /tmp/ter-cp5-XXXXXX)
export TER_SCRATCH
export npm_config_cache="$TER_SCRATCH/npm-cache"
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
  npx create-expo-app@latest "$TER_SCRATCH/pos-desktop" \
  --template blank-typescript \
  --no-agents-md --no-install
```

The process exited 0. npm emitted the non-fatal warning
`Unknown user config "allow-scripts"`; it did not affect scaffold creation.
The raw command ended with:

```text
Creating pos-desktop using the blank-typescript template.
Downloaded and extracted project files.
Your project is ready!
SCAFFOLD_EXIT=0
```

Raw `package.json` before any workspace normalization:

```json
{
  "name": "pos-desktop",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "expo": "~57.0.18",
    "expo-status-bar": "~57.0.1",
    "react": "19.2.3",
    "react-native": "0.86.3"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "private": true
}
```

Raw tree (including the generated repository marker at the top level, but
not enumerating its internal object files):

```text
.git/
.gitignore
App.tsx
LICENSE
app.json
assets/
  android-icon-background.png
  android-icon-foreground.png
  android-icon-monochrome.png
  favicon.png
  icon.png
  splash-icon.png
index.ts
package.json
tsconfig.json
```

The actual command used `--no-agents-md`; no `AGENTS.md`, `CLAUDE.md`, or
`.claude/` was present in the raw tree. It did generate `.git/`,
`.gitignore`, and `LICENSE`, all of which were excluded from the workspace
target as required.

## Normalization

Retained from the observed raw app scaffold:

```text
app.json
assets/android-icon-background.png
assets/android-icon-foreground.png
assets/android-icon-monochrome.png
assets/favicon.png
assets/icon.png
assets/splash-icon.png
tsconfig.json
index.ts
App.tsx
```

Added for TER assembly closure:

```text
package.json
src/index.ts
src/moduleName.ts
src/dependencies.ts
src/skeletonBootstrap.ts
```

Excluded or deleted from the target:

```text
.git
.gitignore
LICENSE
node_modules (not created by --no-install)
.expo and dist (created by the failed export probe, then cleaned)
```

The normalized target has no nested repository, agent instruction file,
package-local lint/prettier configuration, or package-local license. Its
three-name identity is:

```text
path: apps/terminal/assembly/android/pos-desktop
npm: @catering-v2s/assembly-android-pos-desktop
moduleName: assembly.android.pos-desktop
```

The package keeps the raw template's `start`, `android`, `ios`, and `web`
scripts and adds only `typecheck`. Its runtime external dependencies are the
four raw template dependencies (`expo`, `expo-status-bar`, `react`, and
`react-native`), and its dev dependencies are the two raw template entries
(`@types/react` and `typescript`). No set-B UI dependency is declared or
imported.

The formal workspace dependency set contains exactly the other 13 batch-one
TER package roots:

```text
@catering-v2s/kernel-base-contracts
@catering-v2s/kernel-base-platform-ports
@catering-v2s/kernel-base-state
@catering-v2s/kernel-base-runtime
@catering-v2s/kernel-base-display-context
@catering-v2s/kernel-base-ui-state
@catering-v2s/kernel-base-test-support
@catering-v2s/ui-base-render
@catering-v2s/ui-base-automation
@catering-v2s/ui-base-primitives
@catering-v2s/ui-base-test-support
@catering-v2s/ui-integration-platform-console
@catering-v2s/adapter-android-persist-kv
```

`src/dependencies.ts` imports the same 13 package roots from their public
package roots. `src/skeletonBootstrap.ts` imports the same 13 npm roots plus
the assembly's local `./index` package root, and exports the 14 collected
module names. The local import is an entry reachability edge, not a workspace
dependency edge. `App.tsx` consumes all 14 names in a rendered `Text` value;
it does not use a type-only or `void` reference.

## Focused checks

The static checker, which now sees the assembly package and traverses the real
`index.ts -> App.tsx -> src/skeletonBootstrap.ts` chain, passed all six rule
gates and the separate hygiene check. Its focused test also exercises red
controls for a missing bootstrap workspace import and a missing App-to-bootstrap
edge:

```text
node tools/terminal-skeleton/check-static.mjs
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
node tools/terminal-skeleton/check-static.test.mjs
TERMINAL_SKELETON_MODEL_TEST=PASS
```

The read-only package/import count was:

```text
BATCH1_COUNT=14
INTERNAL_DEPENDENCIES=13
DEPENDENCY_IMPORTS=13
BOOTSTRAP_IMPORTS=13
```

During fresh CP-5 reconciliation, a red-control gap was found and fixed in the
static graph gate: a package with declared workspace dependencies could delete
all package-root imports from `src/dependencies.ts` and still pass because the
gate skipped source exact-set comparison when the source import set was empty.
The checker now compares source imports to declared workspace dependencies
unconditionally, and the model test includes that red case:

```text
red fixture: remove all workspace imports from ui.base.test-support/src/dependencies.ts
before fix: RULE_GRAPH_COMPARISON=PASS
after fix:  RULE_GRAPH_COMPARISON=FAIL
node tools/terminal-skeleton/check-static.test.mjs
TERMINAL_SKELETON_MODEL_TEST=PASS
node tools/terminal-skeleton/verify-static.mjs
TERMINAL_STATIC=PASS
```

The final target tree, excluding ignored build/cache directories, is:

```text
App.tsx
app.json
assets/android-icon-background.png
assets/android-icon-foreground.png
assets/android-icon-monochrome.png
assets/favicon.png
assets/icon.png
assets/splash-icon.png
index.ts
package.json
src/dependencies.ts
src/index.ts
src/moduleName.ts
src/skeletonBootstrap.ts
tsconfig.json
```

## Installation first failure and boundary diagnosis

The first immutable workspace install was attempted without changing
manifests or the age gate. This is retained as historical first-failure
evidence and is not the current CP-5 result:

```sh
YARN_NODE_LINKER=node-modules yarn install --immutable --mode=skip-build
```

It exited 1 in 0.979 seconds. This is the preserved first failure:

```text
➤ YN0000: · Yarn 4.17.0
➤ YN0000: ┌ Resolution step
➤ YN0016: │ expo@npm:~57.0.18: All versions satisfying "~57.0.18" are quarantined
➤ YN0000: └ Completed in 0s 972ms
➤ YN0000: · Failed with errors in 0s 979ms
```

The failure was the known npm age gate, not a scaffold or package graph
failure. At that time the package was about 1111 minutes old while the
configured gate was 1440 minutes; the observed release point was approximately
2026-08-29T10:48:19Z.

Because the install stopped before workspace linking, the normal workspace
entry command was not available:

```text
yarn workspace @catering-v2s/assembly-android-pos-desktop typecheck
Internal Error: Package for @catering-v2s/assembly-android-pos-desktop@
workspace:apps/terminal/assembly/android/pos-desktop not found in the project
exit 1
```

A direct TypeScript probe against the normalized tree also stopped on the
missing installed raw-template dependency, rather than proving source
correctness:

```text
./node_modules/.bin/tsc --project apps/terminal/assembly/android/pos-desktop/tsconfig.json --noEmit
apps/terminal/assembly/android/pos-desktop/App.tsx(1,25): error TS2307:
Cannot find module 'expo-status-bar' or its corresponding type declarations.
exit 2
```

The required Metro command was still run once to capture its real boundary:

```sh
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
  npx expo export --platform android
```

It started Metro but exited 1 after 2.768 seconds and 546 modules when
`expo-status-bar` could not be resolved:

```text
Android Bundling failed 2768ms apps/terminal/assembly/android/pos-desktop/index.ts (546 modules)
Error: Unable to resolve module expo-status-bar from .../App.tsx
exit 1
```

The failed probe created ignored `.expo/` and `dist/` output under the target.
Those directories were removed after each probe; the final target tree
contains neither. The private scaffold scratch and failed export artifacts
were also cleaned with explicit cleanup checks:

```text
SCRATCH_CLEANUP=PASS
FAILED_ARTIFACT_CLEANUP=PASS
```

## Current install closure after Dexter's latest-version decision

Dexter subsequently decided that the latest packages may be installed without
waiting for the configured npm age gate. The gate was not changed in
`.yarnrc.yml`; the authorized override was process-local and was not persisted:

```sh
YARN_NPM_MINIMAL_AGE_GATE=0 YARN_NODE_LINKER=node-modules \
  yarn install --mode=skip-build
YARN_NPM_MINIMAL_AGE_GATE=0 YARN_NODE_LINKER=node-modules \
  yarn install --immutable --mode=skip-build
```

Both commands exited 0. The first completed in 1.045 seconds and the
immutable closure completed in 1.014 seconds. Yarn reported only the existing
adapter peer warnings (`react`, `react-refresh`) and `YN0086`; no resolution,
fetch, or link error occurred. The root configuration still reports
`npmMinimalAgeGate=1440`, while the process value used for these two commands
was `0`. No sudo command, alternate package manager, old lockfile, or manual
lockfile edit was used.

The workspace and Turbo scope were then checked from the resulting install:

```text
WORKSPACE_TOTAL=19
TER_LOCATION_PREFIX=15
TER_LEAF=14
TURBO_PACKAGES=14
TURBO_TASKS=14
ASSEMBLY_TASK_DEP_COUNT=13
TURBO_NON_TER=
```

The 15 locations under the `apps/terminal` prefix are the aggregate workspace
plus 14 leaves. Turbo's 14 packages are exactly the batch-one leaves; no
frontend package or aggregate task is in the typecheck scope.

## Current package typecheck

The normal Turbo invocation passed 14/14 but reused 12 local cache entries.
For closure evidence it was rerun with `--force`, so every package executed
its declared `tsc --noEmit` task:

```sh
yarn turbo run typecheck \
  --filter='./apps/terminal/**' \
  --filter='!@catering-v2s/terminal' \
  --force
```

Observed result:

```text
Running typecheck in 14 packages
Tasks:    14 successful, 14 total
Cached:   0 cached, 14 total
Time:     4.929s
TURBO_TYPECHECK_FORCE_EXIT=0
```

The run emitted no TypeScript diagnostics. The adapter peer warnings belong to
Yarn's post-resolution validation and did not alter the typecheck result.

A fresh post-compaction rerun on the same tree also forced all 14 tasks:

```text
yarn turbo run typecheck --force --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'
Running typecheck in 14 packages
Tasks:    14 successful, 14 total
Cached:   0 cached, 14 total
Time:     4.849s
TURBO_TYPECHECK_FORCE_REFRESH_EXIT=0
```

## Current Metro export

The first successful export was observed with a relative log path that pointed
outside the repository evidence directory; `tee` reported
`No such file or directory`, so that invocation is not treated as the log
closure. The command was rerun unchanged with an absolute evidence path:

```sh
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
  npx expo export --platform android
```

The complete rerun is in
`.runtime/terminal-skeleton/cp5-install/metro-export-rerun.log` and exited 0:

```text
Expo Autolinking module resolution enabled
Android Bundled 1394ms apps/terminal/assembly/android/pos-desktop/index.ts (623 modules)
Exported: dist
METRO_EXPORT_EXIT=0
METRO_EXPORT_ELAPSED_SECONDS=2
```

The only npm warning was the existing unknown `allow-scripts` user config.
The export created `dist/` and `.expo/`; both were removed by an exact-path
cleanup check:

```text
EXPORT_ARTIFACT_CLEANUP=PASS
```

A fresh post-compaction rerun of the same command also exited 0 and bundled the
same 623 modules:

```text
Expo Autolinking module resolution enabled
Android Bundled 1464ms apps/terminal/assembly/android/pos-desktop/index.ts (623 modules)
Exported: dist
METRO_EXPORT_REFRESH_EXIT=0
```

That rerun recreated `dist/` and `.expo/`; both were moved to
`.runtime/terminal-skeleton/cp5-install/cleanup-trash/` and no longer exist in
the assembly package root:

```text
EXPORT_ARTIFACT_CLEANUP_REFRESH=PASS
EXPO_CACHE_CLEANUP_REFRESH=PASS
```

This proves Metro can consume the 14-package entry-reachable JavaScript set.
It does not prove Gradle, autolinking, Kotlin capability, device startup, or
any terminal behavior.

## Remaining UNVERIFIED boundaries

The following are intentionally not claimed by CP-5:

```text
UNVERIFIED: create-expo-module complete success closure for every future adapter
UNVERIFIED: native Gradle/Kotlin build or runtime
UNVERIFIED: device, DEV, reset, seed, browser L2, UAT, deployment, and EAS
```

The one-time Android emulator build and runtime remain a separate CP-7
acceptance step. They are not part of `verify` and are not claimed here.
