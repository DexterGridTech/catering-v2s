# Startup diagnostics focused re-verification

COMMAND=`node tools/terminal-sample2/check-startup-diagnostics.mjs`
DATE=2026-09-15
BOUNDARY=Focused source/red-mutation check only; no release build, Android device, Web, Metro, DEV, seed, UAT, deploy, or Git.

```text
TERMINAL_STARTUP_DIAGNOSTICS_BASELINE=PASS
TERMINAL_STARTUP_DIAGNOSTICS_RED_DUPLICATE_GUARD=PASS
TERMINAL_STARTUP_DIAGNOSTICS_RED_SURFACE_IDENTITY=PASS
TERMINAL_STARTUP_DIAGNOSTICS_RED_RUN_ID_PROPAGATION=PASS
TERMINAL_STARTUP_DIAGNOSTICS_MUTATION_CLEANUP=PASS
```

Exit code `0`. This confirms the writer/sink focused controls only; it does not prove a release
startup oracle or device cold-start timing.

`FIRST_FAILURE`: none in this focused run.
`LAST_KNOWN_GOOD`: all labels above.
`BROKEN_BOUNDARY`: focused writer mutation -> release/device startup evidence.

