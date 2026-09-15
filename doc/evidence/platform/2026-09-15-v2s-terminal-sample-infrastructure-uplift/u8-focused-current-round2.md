# U8 focused gate re-verification

COMMAND=`node tools/terminal-sample2/check-u8-focused.mjs`
DATE=2026-09-15
BOUNDARY=Focused source/red-mutation check only; no release build, Android device, Web, Metro, DEV, seed, UAT, deploy, or Git.

```text
TERMINAL_U8_FOCUSED_BASELINE_NATIVE_GATE=PASS
TERMINAL_U8_FOCUSED_RED_PREVENT_AUTO_HIDE=PASS
TERMINAL_U8_FOCUSED_BASELINE_READY_CALLBACK=PASS
TERMINAL_U8_FOCUSED_RED_READY_CALLBACK=PASS
TERMINAL_U8_FOCUSED_MUTATION_CLEANUP=PASS
```

Exit code `0`. This closes only the focused native/ready mutation controls. It does not prove
release APK linkage, mobile/dual cold-start timing, R-S7 device failure-page behavior, U10/U13,
Web, visual, or cleanup evidence.

`FIRST_FAILURE`: none in this focused run.
`LAST_KNOWN_GOOD`: all baseline/red/cleanup labels above.
`BROKEN_BOUNDARY`: focused mutation -> current release/device behavior.

