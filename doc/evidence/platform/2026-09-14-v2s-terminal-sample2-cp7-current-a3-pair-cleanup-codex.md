# TER sample2 current A3 pair cleanup

```text
RUN_ID=ter-sample2-cp7-current-a3-pair-20260914-01
CLEANUP_AT=2026-09-14 07:59 +09:00
RESULT=CLEANUP_PASS
```

Only the resources created and owned by this run were targeted:

- `com.catering.v2s.terminal.samplewallpaper` was force-stopped on `emulator-5554` and
  `emulator-5556`.
- The run-created `tcp:8081` ADB reverse was removed on both serials.
- TER-owned Metro PTY session `49249` was stopped and returned exit code `0` with `Stopped server`.

Readback:

```text
emulator-5554 pidof com.catering.v2s.terminal.samplewallpaper -> empty (exit 1)
emulator-5556 pidof com.catering.v2s.terminal.samplewallpaper -> empty (exit 1)
emulator-5554 adb reverse --list -> empty
emulator-5556 adb reverse --list -> empty
local TCP:8081 listener -> empty (exit 1)
```

The temporary F-A9_RUNTIME source mutation had already been restored before this run. The post-run
residue scan only found the expected `createSurfaceForDisplayIndex(assembly, 1)` examples in README
and focused tests; no temporary mutation remained in production source.
