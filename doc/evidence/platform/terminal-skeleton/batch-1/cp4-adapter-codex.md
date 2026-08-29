---
title: TER skeleton batch 1 CP-4 Android adapter evidence
status: complete
date: 2026-08-29
scope: adapter.android.persist-kv scaffold normalization
---

# CP-4 evidence

## Result

```text
CP4_SCAFFOLD_RAW=PASS
CP4_WORKSPACE_COUNT=13
CP4_PACKAGE_SHAPE=PASS
CP4_DEPENDENCY_EXACT_SET=PASS
CP4_SOURCE_SHAPE=PASS
CP4_NATIVE_SHAPE=PASS
CP4_SCAFFOLD_HYGIENE=PASS
CP4_PACKAGE_TYPECHECK=PASS
CP4_TURBO_TYPECHECK=PASS
CP4_TEST_DRY_RUN_SCOPE=PASS
CP4_STATIC_BOUNDARY=EXPECTED_FAIL_ASSEMBLY_NOT_CREATED
CP4_NATIVE_BUILD=UNVERIFIED
CP4_SCRATCH_CLEANUP=PASS
```

CP-4 creates and normalizes only
`apps/terminal/adapter/android/persist-kv` for `adapter.android.persist-kv`.
It does not implement persist-KV behavior, does not run Gradle or Kotlin, and
does not claim the native module builds or runs.

## Raw scaffold

Raw command logs are under
`.runtime/terminal-skeleton/cp4/20260829T060150Z-cp4-adapter/`.

The official template was packed with `npm pack expo-module-template@latest`,
extracted to a private scratch directory, and consumed through `--source`.
The module command ran from the scratch directory with a relative target:

```sh
(
  cd "$TER_SCRATCH"
  EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 YARN_NODE_LINKER=node-modules \
    npm_config_cache="$TER_SCRATCH/npm-cache" \
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

Observed result:

```text
create-expo-module exit 0
raw target copied to .runtime/terminal-skeleton/cp4/20260829T060150Z-cp4-adapter/raw-target-copy
```

The private scratch directory `/tmp/ter-cp4-adapter.zeYZOt` was removed after
the raw evidence copy was captured:

```text
CP4_SCRATCH_CLEANUP=PASS
```

Raw top-level entries:

```text
.git
.gitignore
.npmignore
.prettierrc
.yarn
LICENSE
android
build
eslint.config.cjs
example
expo-module.config.json
internal
node_modules
package.json
src
tsconfig.json
yarn.lock
```

`--no-example` did not remove the template's `example/` directory. The raw
Android side contained:

```text
android/build.gradle
android/src/main/AndroidManifest.xml
android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt
```

## Normalization

Retained from the raw scaffold:

```text
android/build.gradle
android/src/main/AndroidManifest.xml
android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt
expo-module.config.json
internal/module_scripts/test.js
internal/module_scripts/util.js
```

Rewritten for TER:

```text
package.json
tsconfig.json
src/moduleName.ts
src/dependencies.ts
src/index.ts
```

Deleted or not copied into the workspace target:

```text
.git
.gitignore
.npmignore
.prettierrc
.yarn
LICENSE
build
eslint.config.cjs
example
node_modules
yarn.lock
raw sample TypeScript API files
build/prepare/open scripts
```

The adapter package has TER three-name metadata:

```text
path: apps/terminal/adapter/android/persist-kv
npm: @catering-v2s/adapter-android-persist-kv
moduleName: adapter.android.persist-kv
```

Its only TER dependency is
`@catering-v2s/kernel-base-platform-ports: workspace:*`. `src/dependencies.ts`
imports that package root directly and exports the derived moduleName list.

The raw scaffold used `typescript: ^5.9.2`; after workspace admission Yarn
materialized a package-local `node_modules/typescript`, which violates the
CP-4 scaffold hygiene target and reintroduces the large-file risk. The
normalized package therefore uses the CP-0 template/root TypeScript value
`~6.0.3`, and the generated package-local `node_modules` was moved to:

```text
.runtime/terminal-skeleton/cp4/trash-node-modules-20260829T060510Z
```

After reinstall it was not recreated.

Final target files, excluding ignored `.turbo/` cache:

```text
android/build.gradle
android/src/main/AndroidManifest.xml
android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt
expo-module.config.json
internal/module_scripts/test.js
internal/module_scripts/util.js
package.json
src/dependencies.ts
src/index.ts
src/moduleName.ts
tsconfig.json
```

## Verification

`YARN_NODE_LINKER=node-modules yarn install --immutable --mode=skip-build`
failed before lockfile update with the expected immutable-lockfile boundary:

```text
YN0028: The lockfile would have been modified by this install, which is explicitly forbidden.
```

The non-immutable install updated the workspace lockfile and exited 0:

```text
YARN_NODE_LINKER=node-modules yarn install --mode=skip-build
exit 0
Done with warnings in 13s 196ms
```

Yarn reported peer warnings from the official scaffold dev toolchain:

```text
@catering-v2s/adapter-android-persist-kv does not provide react, requested by expo and other dependencies.
@catering-v2s/adapter-android-persist-kv does not provide react-refresh, requested by babel-preset-expo.
```

These warnings are recorded as scaffold-tooling warnings. They did not block
workspace installation or TypeScript verification. No supply-chain age gate was
changed, and no sudo or alternate package manager was used.

Package typecheck:

```text
yarn workspace @catering-v2s/adapter-android-persist-kv typecheck
exit 0
```

TER Turbo typecheck:

```text
yarn turbo run typecheck --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'
```

Result:

```text
Packages in scope: 13
Tasks: 13 successful, 13 total
Cached: 12 cached, 13 total
Time: 655ms
```

Turbo test dry-run:

```text
yarn turbo run test --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal' --dry=json
```

The only real test command is the retained scaffold test script:

```text
@catering-v2s/adapter-android-persist-kv: node internal/module_scripts/test.js
REAL_TEST_TASK_COUNT=1
```

The real tree static checker was run from the TER entry:

```text
yarn workspace @catering-v2s/terminal verify:static
exit 1
```

This is the expected CP-4 boundary because assembly is not created yet. The
support hygiene check is already green:

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=FAIL
RULE_TRIPLE_NAMING=FAIL
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=FAIL
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
FIRST_FAILURE:graph-comparison:active TER package census mismatch; missing=["assembly.android.pos-desktop"] extra=[]
```

`git diff --check` over the TER batch files exited 0.

The hygiene checker now locates the real adapter package leaf from the projected
graph; `check-static.test.mjs` exercises its nested metadata failure path.

After the independent CP-4 review found that the first checker revision scanned
the layer directory rather than the package leaf, the checker was repaired to
derive adapter/assembly roots from the projected graph. The focused regression
run now reports `TERMINAL_SKELETON_MODEL_TEST=PASS`; a temporary nested
`.prettierrc` and a removed `.turbo/` ignore line each make the hygiene report
fail, and the real CP-4 tree reports `SCAFFOLD_HYGIENE=PASS`.

`git status --short --ignored` for the CP-4 target shows only the package
directory as untracked and the generated Turbo cache ignored:

```text
?? apps/terminal/adapter/android/persist-kv/
!! .runtime/
!! apps/terminal/adapter/android/persist-kv/.turbo/
```

## Not proved

Android Gradle/Kotlin compilation, native runtime behavior, Metro export, a
complete batch-one static pass, assembly consumption, and any persist-KV
capability remain unverified. Those are outside CP-4 and remain for later
authorized CPs.
