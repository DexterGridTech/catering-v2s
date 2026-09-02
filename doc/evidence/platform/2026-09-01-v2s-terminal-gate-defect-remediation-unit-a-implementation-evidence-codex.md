# TER gate defect remediation unit A implementation evidence

AUTHOR=Codex
DATE=2026-09-01
SCOPE=UNIT_A_ONLY
TARGET=D-8 + D-1 + D-2 + D-3 + D-4

## Boundary

This evidence covers only TER-local source, checker and verifier changes for unit A. It does not prove unit B, D-5 to D-24 outside the unit-A subset, native, Gradle, device, DEV, seed, reset, browser L2, UAT, deployment or root `scripts/verify`.

## Implemented surface

- D-8: package-local `terminal-invariants.json` files now carry owned task metadata and migrated public/checker expected sets. Central checker tables are replaced by package invariant reads for the unit-A gates.
- D-1: `kernel.base.runtime` has real `moduleKind = 'owner'`; the skeleton graph entry no longer carries `plannedKind`.
- D-2: runtime owner-kind validation resolves the actual `moduleKind` symbol through TypeScript, accepts namespace/intermediate aliases, and rejects a local same-text shadow.
- D-3: TR-01 dispatch exceptions are read from package invariants and constrained to approved lexical actor/owner bodies.
- D-4: test ownership is derived from package invariants and real runner markers; deleted scripts and deleted runtime test files fail instead of disappearing from the denominator.
- D-22 unit-A baseline support: closed-union bindings are read from package invariants, with `closedUnionConsumerCount` preventing silent row deletion.

## Fresh command output

Current-byte rerun on 2026-09-01:

`yarn workspace @catering-v2s/terminal verify:static`

```text
TERMINAL_STATIC=PASS
```

`yarn workspace @catering-v2s/terminal verify`

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks:    22 successful, 22 total
Tasks:    9 successful, 9 total
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 1708ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

`node tools/terminal-skeleton/check-static.test.mjs && node tools/terminal-runtime/check-static.test.mjs && node tools/terminal-skeleton/verify.test.mjs`

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

`node --input-type=module -e "import {assertClosedUnionConsumers} from './tools/terminal-shared/closed-union-consumers.mjs'; const result = assertClosedUnionConsumers(process.cwd()); console.log('A1_CLOSED_UNION_BINDINGS=PASS definitions=' + result.definitions + ' consumers=' + result.consumers);"`

```text
A1_CLOSED_UNION_BINDINGS=PASS definitions=9 consumers=22
```

Invariant summary probe:

```text
@catering-v2s/kernel-base-contracts publicExports=69 closedDefinitions=6 closedConsumers=10 ownedTest=REAL_TESTS
@catering-v2s/kernel-base-platform-ports publicExports=124 closedDefinitions=0 closedConsumers=0 ownedTest=REAL_TESTS
@catering-v2s/kernel-base-state publicExports=56 closedDefinitions=2 closedConsumers=5 ownedTest=REAL_TESTS
@catering-v2s/kernel-base-runtime publicExports=63 closedDefinitions=1 closedConsumers=7 ownedTest=REAL_TESTS
INVARIANT_SUMMARY publicExports=312 closedDefinitions=9 closedConsumers=22
```

`yarn workspace @catering-v2s/terminal verify:static`

```text
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
CONTRACT_RULE_ZERO_ADAPTER_CAPABILITY=PASS
CONTRACT_RULE_TR05_NAMED_BOUNDARY=PASS
CONTRACT_RULE_RUNTIME_ID_PREFIX_EXACT_SET=PASS
CONTRACT_RULE_CLOSED_LITERAL_UNIONS=PASS
TERMINAL_CONTRACTS_STATIC=PASS
PLATFORM_PORT_RULE_GATES=4
PLATFORM_PORT_SUPPORT_CHECKS=1
PLATFORM_PORT_RULE_TR05_NAMED_BOUNDARY=PASS
PLATFORM_PORT_RULE_REQUIRED_PORT_SHAPE=PASS
PLATFORM_PORT_RULE_DEFAULT_IMPORT_ALLOWLIST=PASS
PLATFORM_PORT_RULE_PLATFORM_IDENTIFIER_BOUNDARY=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
STATE_RULE_GATES=4
STATE_SUPPORT_CHECKS=1
STATE_RULE_TOOLKIT_ZERO_SLICE=PASS
STATE_RULE_TR05_NAMED_BOUNDARY=PASS
STATE_RULE_STORAGE_RESULT_CONSUMED=PASS
STATE_RULE_NO_STORAGE_CLEAR=PASS
TERMINAL_STATE_STATIC=PASS
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_STATIC=PASS
```

## Focused red vectors

All focused red vectors were run in temporary fixtures under `/tmp`; no repository fixture files were left behind.

```text
A1_D1_PLANNED_KIND_RED=PASS target=owner-kind vector=context-exact-set=PASS,command-mount-shape=PASS,owner-kind=FAIL,restart-positive=PASS,ledger-record-shape=PASS,support=PASS
A1_D2_LOCAL_SHADOW_RED=PASS target=owner-kind vector=context-exact-set=PASS,command-mount-shape=PASS,owner-kind=FAIL,restart-positive=PASS,ledger-record-shape=PASS,support=PASS
A2_D3_HANDLER_SCOPE_RED=PASS target=tr01-reducer-boundary vector=graph-comparison=PASS,triple-naming=PASS,dependency-direction=PASS,dependency-declaration-completeness=PASS,tr01-reducer-boundary=FAIL,kernel-platform-independence=PASS,hygiene=PASS
A1_D22_MISSING_ROW_RED=PASS target=graph-comparison vector=graph-comparison=FAIL,triple-naming=PASS,dependency-direction=PASS,dependency-declaration-completeness=PASS,tr01-reducer-boundary=PASS,kernel-platform-independence=PASS,hygiene=PASS
A2_D4_DELETE_SCRIPT_RED=PASS owned task contract mismatch; @catering-v2s/kernel-base-runtime invariant owns test but package script is missing
A2_D4_DELETE_TEST_DIR_RED=PASS marker kind mismatch; package=@catering-v2s/kernel-base-runtime expected=REAL_TESTS actual=NO_TEST_FILES
```

## Post-review M-1/M-2 recheck

The TR-01 invariant field is now named `dispatchExpression`; `reasonCategory` remains part of the full exception identity. Each declared exception is consumed by exactly one matching dispatch expression occurrence. Duplicate full identities, unconsumed declarations and calls beyond the declared occurrence count fail the TR-01 gate. The state workspace convenience `input.dispatch` row was removed.

`isStoreDispatchProperty` now recognizes `dispatch` only when the TypeScript receiver origin is Redux `Store` or Redux Toolkit `EnhancedStore`. A same-named method on an unrelated object is not a reducer call. The scratch model links only the Redux type packages needed to exercise this receiver-origin check; production behavior does not fall back to a name-only `dispatch` branch.

Fresh model command (exit 0):

```text
node tools/terminal-shared/package-invariants.test.mjs && node tools/terminal-skeleton/check-static.test.mjs && node tools/terminal-runtime/check-static.test.mjs && node tools/terminal-skeleton/verify.test.mjs
TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS
A2_D3_HANDLER_SCOPE_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_THIRD_STORE_DISPATCH_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_UNUSED_EXCEPTION_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_NON_REDUX_DISPATCH_GREEN=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:PASS,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

Fresh TER-local commands (both exit 0):

```text
yarn workspace @catering-v2s/terminal verify:static
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_STATIC=PASS

yarn workspace @catering-v2s/terminal verify
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks: 22 successful, 22 total
Tasks: 9 successful, 9 total
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 1755ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

These commands remain TER-local only; no root `scripts/verify` normal, native, Gradle, device, DEV, seed, reset, browser L2, UAT or deployment action was run.

## TER-local verify debug timeline

`verify.mjs` and `verify-static.mjs` now emit immediate, structured `TERMINAL_VERIFY_DEBUG` lines to stderr
before and after every `spawnSync` child. Each line carries a run id, phase/state, command, cwd, exit status,
signal/error code and elapsed milliseconds. This preserves the first visible boundary even while a child is still
running; child stdout/stderr remains replayed after the child exits so the existing marker contracts are unchanged.

Fresh `verify:static` debug evidence (exit 0):

```text
TERMINAL_VERIFY_DEBUG {"phase":"verify-static.start","state":"START",...}
TERMINAL_VERIFY_DEBUG {"phase":"subprocess.start","label":"model-test",...}
TERMINAL_VERIFY_DEBUG {"phase":"subprocess.finish","label":"model-test","status":0,"durationMs":30862}
TERMINAL_VERIFY_DEBUG {"phase":"subprocess.start","label":"real-static-tree",...}
TERMINAL_VERIFY_DEBUG {"phase":"subprocess.finish","label":"real-static-tree","status":0,"durationMs":1718}
TERMINAL_STATIC=PASS
```

The first no-output interval is therefore bounded to `check-static.test.mjs` model-test startup/fixture work
(about 31 seconds on this host), not an unlabelled verify deadlock. The complete outer static phase took about
42 seconds in the subsequent TER-local run; all later dry-run/typecheck/test/export phases emitted their own
start/finish lines, and the final run ended with `TERMINAL_VERIFY_CLEANUP=PASS` and `TERMINAL_VERIFY=PASS`.

Latest current-byte rerun after strengthening `verify.test.mjs` to assert `signal`, `errorCode`, and
`durationMs` on a failed child boundary:

```text
node tools/terminal-skeleton/verify.test.mjs              exit=0
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
yarn workspace @catering-v2s/terminal verify:static      exit=0
model-test durationMs=28637
real-static-tree durationMs=1548
TERMINAL_STATIC=PASS
yarn workspace @catering-v2s/terminal verify            exit=0
static durationMs=38527
model-test durationMs=28238
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

The debug fields and the existing first-failure/no-false-PASS assertions are therefore both covered by a
model test and observed in a real TER-local run.

## D-8 and D-22 migration proof

```text
A1_MIGRATION_LEGACY_TABLES=PASS tables=12 exports=312 keys=25 members=120 scalars=457 source=design-baseline
A1_CLOSED_UNION_MIGRATION=PASS definitions=9 consumers=22
A1_INVARIANT_MIGRATION=PASS comparison=ZERO_DIFF
```

The command additionally ran `assertClosedUnionConsumers(process.cwd())`, which resolved the current 9 closed-union definitions and 22 declared consumer bindings with TypeScript.

## Cleanup

- `find apps/terminal/assembly/android/pos-desktop -maxdepth 1 \( -name .expo -o -name dist \) -print` returned no paths after `verify`.
- `git diff --check` over the touched TER tool/design files returned exit 0.

## Remaining unverified boundaries

- No root `scripts/verify` run was performed.
- No native, Gradle, device or Android runtime behavior is proven.
- Unit B and D-5 to D-24 outside the unit-A subset are not implemented or proven by this evidence.
- Independent Claude review still needs to reopen source and rerun or inspect these outputs before accepting the implementation.
