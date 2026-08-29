---
title: TER skeleton batch 1 CP-0 scaffold closure
status: partial
date: 2026-08-29
scope: create-expo-module representative adapter and create-expo-app version-source probe
---

# CP-0 evidence

## Result

```text
SCAFFOLD_RAW=PASS
SCRATCH_CLEANUP=PASS
MODULE_SCAFFOLD_RAW=PASS
MODULE_SCRATCH_CLEANUP=PASS
APP_SCAFFOLD_RAW=PASS
TEMPLATE_MANIFEST_SOURCE=RESOLVED
UI_EXPO_SDK_MAPPING=BLOCKED
UI_VERSION_SOURCE=PARTIAL
ADAPTER_INTAKE=UNBLOCKED
CP3_INTAKE=READY_FOR_SET_A_ONLY
```

The module blocking item is closed for the representative Android module. This does not claim that a
TER adapter has been created or that its native code builds. The UI/assembly version source is split:
the latest template's own manifest is already a resolved source for the packages it supplies, while
the SDK-aware mapping for UI-specific packages remains blocked. CP-3 is allowed only for an empty skeleton
that consumes set A; any declaration or source consumer for set B remains a stop condition.

## Preflight

Raw command logs are under
`.runtime/terminal-skeleton/scaffold-probe/20260829T132242-1414/`:

| command                                                  | observed result                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npx skills list --global --json`                        | exit 0; global `expo-module` entry is visible (`/Users/dexter/.agents/skills/expo-module`) |
| `node -v`                                                | `v24.13.0`, exit 0                                                                         |
| `yarn -v`                                                | `4.17.0`, exit 0                                                                           |
| `npx --version`                                          | `11.19.0`, exit 0                                                                          |
| `npm view create-expo-module@latest version`             | `57.0.1`, exit 0                                                                           |
| `npm view expo-module-template@latest version`           | `57.0.9`, exit 0                                                                           |
| `npx create-expo-module@latest --version`                | `57.0.1`, exit 0                                                                           |
| `npm view create-expo-app@latest version`                | `4.0.0`, exit 0                                                                            |
| `npm view expo-template-blank-typescript@latest version` | `57.0.20`, exit 0                                                                          |
| `yarn config get npmMinimalAgeGate`                      | `1440`, exit 0                                                                             |

The audit rerun that closes the CP-0 module evidence gap is under
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/`. That directory records
command files, cwd/target files, stdout/stderr logs, and separate status files for `npm pack`,
extraction, `create-expo-module`, the absolute-target first failure, and cleanup.

## Module probe

The official template was obtained with `npm pack expo-module-template@latest`, extracted into a
private scratch directory, and passed with `--source`. The successful invocation ran from the scratch
directory and used a relative target:

```sh
(
  cd "$TER_SCRATCH"
  EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 YARN_NODE_LINKER=node-modules \
    npx create-expo-module@latest adapter-android-persist-kv \
    --source "$TER_SCRATCH/package" \
    --no-example --platform android --package-manager yarn \
    --name TerminalPersistKv \
    --package com.catering.v2s.terminal.adapter.android.persistkv \
    --description "Catering V2S terminal Android persist KV adapter" \
    --license MIT --module-version 0.0.0 --author-name "Catering V2S" \
    --author-email "terminal@example.invalid" --author-url "" --repo ""
)
```

`npm pack`, extraction, and module creation each exited 0. The original first run recorded the raw
tree under `.runtime/terminal-skeleton/scaffold-probe/success-closure/raw-target-tree.txt`; the audit
rerun additionally records the exact command at
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/success/create-command.txt` and
the process status `EXIT_CODE=0` at
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/success/create.status`. The create
log reports all four expected stages: template files created, module dependencies installed,
TypeScript compiled, and an empty Git repository created.

The raw top-level entries were:

```text
.git  .gitignore  .npmignore  .prettierrc  .yarn  LICENSE  android  build
eslint.config.cjs  example  expo-module.config.json  internal  node_modules
package.json  src  tsconfig.json  yarn.lock
```

`presence.txt` records `.git`, `node_modules`, `.yarn`, `build`, `LICENSE`, `yarn.lock`, and `example`
as present; `ios` is absent; the Android manifest, Kotlin source set, `package.json`, and
`expo-module.config.json` are present. `--no-example` does not remove the template's own `example`
directory, so CP-4 must delete it during normalization.

The first failed shape is retained under
`.runtime/terminal-skeleton/scaffold-probe/first-failure-workspace-root/` and
`path-resolution-failure/`. Passing an absolute target while invoking from the repository made the
CLI use the repository as `INIT_CWD`; its `path.join(INIT_CWD, target)` behavior placed the target
under the repository and Yarn rejected it as outside the declared workspace. The wrapper log records
the exact target cwd. This is why the scratch `cd` plus relative target is part of the command contract.

The audit rerun records the absolute-target command at
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/absolute-target-first-failure/create-command.txt`.
That command exited 1 as expected, with stdout/stderr in
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/absolute-target-first-failure/create-expo-module.log`
and status in
`.runtime/terminal-skeleton/scaffold-probe/20260829T135700-cp0-rerun/absolute-target-first-failure/status.txt`.

## App version-source probe

`create-expo-app@latest pos-desktop --template blank-typescript --no-agents-md --no-install` ran from a
private scratch directory and exited 0. Its raw manifest resolves to:

```text
expo ~57.0.18
react-native 0.86.3
react 19.2.3
@types/react ~19.2.2
typescript ~6.0.3
```

An independent latest-template metadata probe confirms the exact source boundary. The resolved template
is `expo-template-blank-typescript@57.0.20`; its published dependencies are `expo ~57.0.18`,
`expo-status-bar ~57.0.1`, `react 19.2.3`, and `react-native 0.86.3`, while its published
devDependencies are `@types/react ~19.2.2` and `typescript ~6.0.3`. Raw output is under
`.runtime/terminal-skeleton/cp2/ui-version-template-probe-143148.log`.

This yields two evidence sets:

| set                   | contents                                                                                                                    | status                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · template-provided | Expo, Expo Status Bar, React, React Native, TypeScript, and React types from the exact template manifest                    | `TEMPLATE_MANIFEST_SOURCE=RESOLVED`                                                                                                                |
| B · UI-specific       | `react-dom`, `react-native-web`, Reanimated, Worklets, and any later NativeWind/Tailwind/React Native Reusables consumption | `UI_EXPO_SDK_MAPPING=BLOCKED` until the SDK-aware compatibility mapping is obtained; packages with no skeleton source consumer are not added early |

The raw tree has `.git` and `LICENSE`, and no nested `AGENTS.md`, `CLAUDE.md`, or `.claude/`.

The prescribed `YARN_NODE_LINKER=node-modules yarn install` exited 1 with
`YN0016: expo@npm:~57.0.18: All versions satisfying "~57.0.18" are quarantined`, consistent with
`npmMinimalAgeGate=1440`. A follow-on `npx expo install` diagnostic also exited 1 because this machine's
user npm cache contains root-owned objects (`EACCES`/`EEXIST`); it did not change the age gate and is
not treated as a successful version resolution. These are independent boundaries: the first is a
time-based Yarn supply-chain gate, and the second is a local cache ownership issue. A future retry must
use a fresh scratch npm cache for the latter and must wait for the former; neither calls for lowering the
age gate, using sudo, or changing package manager. Raw app logs and before/after manifests are under
`.runtime/terminal-skeleton/app-probe/20260829T134500-app-latest/`.

Therefore CP-3 may consume set A's raw manifest values, but must not consume set B as if `expo install`
had succeeded. No age gate was lowered, no package manager was substituted, and no app was copied into
`apps/terminal`.

## Normalization rules reserved for CP-4/CP-5

These are rules for a later in-repository copy, not evidence that one has happened:

- retain the official Android Gradle files, Android manifest, Kotlin module registration,
  `expo-module.config.json`, and the source/config shape required by the accepted design;
- delete nested `.git`, `LICENSE`, `example`, `ios`, web/sample files, `build`, `node_modules`,
  `.yarn`, `yarn.lock`, package-local lint/prettier files, and unused scaffold samples;
- replace package metadata/scripts with the TER three-name/root/typecheck shape and only the declared
  workspace dependency; do not hand-write or copy native structure;
- for assembly, retain the app manifest/assets/runtime entry shape and apply the same nested-metadata
  and package-local configuration cleanup before workspace admission.

## Cleanup

All exact module and app scratch directories were removed with scoped `find` deletion, including
symlinks in the generated `node_modules`; final cleanup result is recorded in
`.runtime/terminal-skeleton/scaffold-probe/cleanup-20260829T134700.log`.

## Not proved

Android Gradle/Kotlin compilation or runtime, a normalized TER adapter, set-B UI dependency installation,
real workspace typecheck, Metro export, or any package capability remain unverified. The set-B age-gate
block remains the boundary for any UI-specific dependency consumer; the empty CP-3 skeleton uses only set A
and is not a reason to weaken supply-chain protection.
