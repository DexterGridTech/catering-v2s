# B0 sample2 focused prerequisite evidence (current source)

This record does not claim the sample2 frozen implementation acceptance. It records the current
focused control results and the first failure found while reconciling the infrastructure runtime
subset change with existing sample2 tests.

## First failure and repair

The first run of:

```sh
node tools/terminal-sample2/check-behavior.mjs
```

failed before its mutation suite, in
`apps/terminal/kernel/feature/sample-wallpaper/test/sampleWallpaper.test.ts:19`, because the
test still expected the pre-D-4 whole workspace dependency list (`kernel.base.contracts`,
`kernel.base.runtime`, `kernel.base.state`) while the owner factory now correctly exposes its
self-declared runtime-module subset (`kernel.base.runtime`). The same stale assertion existed in
the sample-member-registry and sample-staff-session owner tests.

The main Codex updated those three test expectations to the current D-4 runtime subset. No
production behavior was weakened and no dependency declaration was added.

## Current focused/red result

The same command was rerun after the minimal test repair:

```text
exit=0
SAMPLE2_KERNEL_BASELINE=PASS
SAMPLE2_PICKER_BASELINE=PASS
SAMPLE2_INTEGRATION_BASELINE=PASS
SAMPLE2_PRIMITIVES_BASELINE=PASS
SAMPLE2_F_A5_ADMISSION_REJECTED=PASS admission_point=state-runtime-descriptor-invariant mutation_exit=1
SAMPLE2_F_A5_RUNTIME_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A5B_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A5D_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A2_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A2C_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A2A_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A2_SCROLL_RED=PASS mutation_scope=component-contract mutation_exit=1
SAMPLE2_F_A2_TOKEN_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A3A_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A3B_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A7_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A7B_RED=PASS mutation_scope=behavior mutation_exit=1
SAMPLE2_F_A9_ADMISSION_REJECTED=PASS admission_point=mobile-assembly-guard mutation_exit=1
SAMPLE2_KERNEL_BASELINE=PASS
SAMPLE2_PICKER_BASELINE=PASS
SAMPLE2_INTEGRATION_BASELINE=PASS
SAMPLE2_RED_MUTATION_CLEANUP=PASS
```

Independent typecheck controls also exited `0` for the kernel, picker, and integration packages.

## Remaining prerequisite status

The repository's prior sample2 CP-7 records still explicitly retain Web, release, native-device,
complete visual, and complete A/F acceptance as open. The focused result above closes only the
current focused/red control boundary. The B0 frozen-acceptance prerequisite remains `OPEN` until
the required runtime acceptance evidence is re-established on the current source.
