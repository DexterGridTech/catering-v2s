# A9 runtime probe: current first failure and owned cleanup

## Scope

This record is a supporting-probe record for the historical `run-a9-runtime.mjs`.
It is not U8 release evidence and does not establish implementation acceptance.
The required current rerun was performed against the current repository and the
installed sample-wallpaper package.

## Current rerun

Command, from the repository root:

```text
node tools/terminal-sample2/run-a9-runtime.mjs --serial emulator-5556 --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/a9-runtime-current-rerun-01
```

The runner first failed before business assertions:

```text
SAMPLE2_F_A9_RUNTIME=NOT_RUN CLEANUP=FAIL
firstFailure=A9 mutated SECONDARY surface readback: timed out; logBytes=0
```

The raw result is preserved at:
`a9-runtime-current-rerun-01/a9-runtime-result.json`.

## Boundary diagnosis

The App mutation anchor in the current source is an inline `renderSurface`
callback, so the original exact source anchor was stale. The smallest safe
runner repair changed the mutation to the current callback form and added a
guard so reverse cleanup is attempted only after the runner has acquired its
owned process. `node --check tools/terminal-sample2/run-a9-runtime.mjs` passed.

After that repair the runner reached the mutated-secondary readback but timed
out with zero Metro/log bytes. The installed package was the current release
APK, while this historical runner expects a Metro/dev runtime and does not
build/install a compatible debug APK before starting its log wait. Therefore
this is a runner/precondition boundary, not evidence that the production
release path passed or failed the U8 contract. The new record-only U8 release
runner is the applicable evidence path for release and dual-display cold start.

## Cleanup

The interrupted A9 run left two resources to diagnose:

- owned package: `com.catering.v2s.terminal.samplewallpaper`;
- owned reverse: `tcp:8081`.

The device also had `tcp:8091`; it was not owned by this A9 run and was left
untouched. The exact owned cleanup was:

```text
adb -s emulator-5556 shell am force-stop com.catering.v2s.terminal.samplewallpaper
adb -s emulator-5556 reverse --remove tcp:8081
```

Post-cleanup readback:

```text
adb -s emulator-5556 shell pidof com.catering.v2s.terminal.samplewallpaper
# no output; exit 1 means no package process remains

adb -s emulator-5556 reverse --list
# host-16 tcp:8091 tcp:8091
```

Thus the A9 cleanup is now closed for the resources owned by this run; the
unowned `tcp:8091` reverse was not modified.

## Status

`A9 historical runner supporting probe: NOT_ACCEPTANCE_EVIDENCE`

The first failure, broken boundary, and cleanup evidence remain preserved.
U8 release normal and injected-failure evidence is recorded separately under
the sibling `u8-release-*` directories.
