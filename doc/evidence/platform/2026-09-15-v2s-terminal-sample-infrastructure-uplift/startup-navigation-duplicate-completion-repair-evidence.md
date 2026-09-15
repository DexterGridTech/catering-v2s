# Startup navigation duplicate completion repair evidence

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

## Scope

This record covers the first dynamic failure found while exercising the current
sample2 mobile app from anonymous login into the real wallpaper picker. It is a
focused implementation repair record, not a release, Android, Web, visual, or
implementation-acceptance verdict.

## First failure and boundary

The app was launched from the repository's Expo/Metro entry on
`emulator-5556`, with the exact package
`com.catering.v2s.terminal.samplewallpaper`. The anonymous login surface
mounted and reached `startup.ready` and `startup.complete`. After submitting
the valid sample credential, the real `sample.wallpaper.picker` part mounted,
then the runtime emitted `startup.ready` followed by
`startup.ready-failed` with `Error`; the rendered layer stack was blank and the
picker was not usable.

The failure was observed in the runtime log with:

```text
startup.ready-failed reason=ready-failed:Error
```

The broken boundary was the second real-part `ScreenReadyBoundary` mount in
one console runtime, between the picker becoming the active part and its
first-layout readiness callback completing.

## Root cause

`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`
passed every local `ScreenReadyBoundary` readiness callback directly to the
shared startup actor. A login-to-business navigation remounts that boundary,
so the second callback dispatched `startup.ready` again and reached
`startupDiagnosticsWriter.writeComplete()` a second time.

The writer's strict duplicate guard in
`apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`
correctly throws on a duplicate completion. That guard remains strict; the
assembly consumer, rather than the writer, owns the lifecycle idempotence.

## Minimal repair

The shared console assembly now keeps one in-flight/fulfilled primary-ready
promise per runtime. Later local boundary mounts reuse that promise. If the
first dispatch genuinely fails, the promise gate is cleared so a real retry is
possible. This prevents navigation from writing a second completion while
preserving the existing duplicate-write diagnostic.

The focused regression is
`apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`:
it mounts the anonymous primary surface, triggers readiness, dispatches the
login success command, mounts the real picker surface, triggers readiness
again, and asserts exactly one `startup.complete` with no
`startup.ready-failed`.

## Focused verification after repair

Commands run from the owning package directories:

```text
yarn test  # @catering-v2s/ui-integration-sample-wallpaper-console
Test Files  4 passed (4)
Tests       14 passed (14)

yarn test  # @catering-v2s/ui-base-console-assembly
Test Files  1 passed (1)
Tests       3 passed (3)

yarn typecheck  # both packages
exit 0
```

The original dynamic failure is retained above as the first failure. A fresh
runtime rerun is still required before treating the repair as dynamic proof;
release, dual-display, Web, visual, U1–U13 acceptance, and cleanup evidence
remain OPEN.

## Focused runtime rerun after repair

After the focused repair, the same mobile Expo/Metro path was launched again
on `emulator-5556`, with the app state cleared and the exact package stopped
before launch. The anonymous login UI dump contained
`sample.auth.login:operator-name`, `sample.auth.login:passcode`, and
`sample.auth.login:submit`. After entering the valid sample credential and
submitting, the settled UI dump contained:

```text
sample.wallpaper.picker
sample.wallpaper.picker:title  text="选择屏幕壁纸"
sample.wallpaper.picker:options:none  content-desc="无壁纸" selected="true"
sample.wallpaper.picker:options:w1 content-desc="山景"
sample.wallpaper.picker:options:w2 content-desc="湖景"
sample.wallpaper.picker:options:w3 content-desc="海滩"
```

The Metro event sequence for the second real part was:

```text
startup.ready-candidate partKey=sample.wallpaper.picker sequence=15 surfaceKey=PRIMARY
startup.ready-hidden      partKey=sample.wallpaper.picker sequence=16 surfaceKey=PRIMARY
```

No `startup.ready-failed` was observed in the post-repair log readback. The
sequence contains one `startup.complete` for the runtime; the second local
boundary reuses the already fulfilled assembly promise. This is focused
runtime supporting evidence for the repair, not release or implementation
acceptance evidence. Final exact cleanup of the Metro session, adb reverse,
and package process was performed separately and the package PID readback was
empty.
