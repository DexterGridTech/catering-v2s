# CP-1 static and red-mutation evidence

This record was collected by the main Codex session after CP-1 source repairs. It is repository evidence, not a claim that the full implementation or dynamic acceptance is closed.

## Commands and results

### Skeleton mutation/model suite

Command:

```sh
node tools/terminal-skeleton/check-static.test.mjs
```

Exit: `0`.

Observed red mutations:

```text
TERMINAL_SKELETON_RED_ROOT_WORKSPACE_ENUMERATION=FAIL
TERMINAL_SKELETON_RED_D1_D1-VALUE-IMPORT_TS=FAIL
TERMINAL_SKELETON_RED_D1_D1-TYPE-IMPORT_TS=FAIL
TERMINAL_SKELETON_RED_D1_D1-REEXPORT_TS=FAIL
TERMINAL_SKELETON_RED_D1_D1-DYNAMIC_MJS=FAIL
TERMINAL_SKELETON_RED_D1_D1-REQUIRE_CJS=FAIL
TERMINAL_SKELETON_RED_D1_D1-IMPORT-EQUALS_TS=FAIL
TERMINAL_SKELETON_RED_D1_D1-RELATIVE_TS=FAIL
TERMINAL_SKELETON_RED_D1_ROOT_CONFIG=FAIL
TERMINAL_SKELETON_RED_RUNTIME_SUBSET=FAIL
TERMINAL_SKELETON_RED_DEPENDENCY_ARRAY_DRIFT=FAIL
TERMINAL_SKELETON_RED_RUNTIME_WHOLE_ARRAY_FACTORY=FAIL
TERMINAL_SKELETON_RED_BASE_GRAPH_FEATURE=FAIL
TERMINAL_SKELETON_RED_BASE_CROSS_PLATFORM_ADAPTER=FAIL
A2_D3_HANDLER_SCOPE_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,runtime-dependency-contract:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_THIRD_STORE_DISPATCH_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,runtime-dependency-contract:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_UNUSED_EXCEPTION_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,runtime-dependency-contract:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_NON_REDUX_DISPATCH_GREEN=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,runtime-dependency-contract:PASS,tr01-reducer-boundary:PASS,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
```

The mutation suite creates its temporary fixtures under the system temporary directory and removes them after each case; the real source tree remained unchanged after the run.

The whole-array factory control mutates a real production factory to consume
`dependencyModuleNames` instead of its owner-declared `runtimeModuleDependencyNames`; the
runtime contract gate fails with `runtimeModuleDependencyNames is not consumed`. The
cross-platform control moves a real Android adapter folder into an `adapter/electron/device`
fixture and updates graph, workspace, package and source declarations coherently. The only
intended failure is the R-E1 direction predicate, which reports
`assembly.base.android may only depend on same-platform adapter adapter.electron.device`.
Both controls restore the fixture tree in `finally`; a first restoration bug was fixed before
the final exit-0 run.

### Static skeleton gate

Command:

```sh
node tools/terminal-skeleton/check-static.mjs
```

Exit: `0`.

```text
RULE_GATES=7
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
```

### Static layering gate

Command:

```sh
node tools/terminal-layering/check-static.mjs
```

Exit: `0`.

```text
TERMINAL_LAYERING_RULE_GATES=4
TERMINAL_LAYERING_SUPPORT_CHECKS=0
TERMINAL_LAYERING_RULE_P_5A_DIRECTION=PASS
TERMINAL_LAYERING_RULE_P_5C_STATE_EDGE=PASS
TERMINAL_LAYERING_RULE_P_10_KERNEL_UI_LITERALS=PASS
TERMINAL_LAYERING_RULE_P_5D_UI_FEATURE_NATIVE_ELEMENTS=PASS
TERMINAL_LAYERING=PASS
```

### Root workspace enumeration

Command:

```sh
yarn workspaces list --json
```

Exit: `0`.

The output enumerated the root workspace and all current TER leaf packages, including `assembly/base/android`, `ui/base/console-assembly`, all `ui/base/*`, all `ui/feature/*`, all `ui/integration/*`, all `kernel/*`, and all Android adapter/assembly packages. The checker-side omission mutation independently produced `TERMINAL_SKELETON_RED_ROOT_WORKSPACE_ENUMERATION=FAIL` above.

## Status boundary

This closes Hume's CP-1 red-evidence gap. It does not close the separate B0 finding: the sample2 frozen implementation-acceptance prerequisite remains open in the current evidence set.
