# CP3/CP4 focused evidence — current-byte repair round 4

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
EVIDENCE_TIER=focused_and_static
RUN_DATE=2026-09-15
SCOPE=console writer identity, B1 descriptor checker, TR-10 README, picker U13 runtime injection

## First failure and repair

1. The first focused attempt of the new CP3 regression failed with
   `missing startup.complete run id`. The preserved event list contained only
   `power-bridge.subscription-unavailable` and `sample.runtime-facts-resolved`.
2. Root cause was in the test harness: `mount()` supplied surface-frame and launcher layouts but
   did not supply the resolved part's `ui-base-render:screen-ready-boundary` layout. The production
   writer was not reached; this was not evidence against run identity generation.
3. The test now supplies a positive boundary layout before reading events. The production assembly
   allocates a local writer identity with `createRuntimeInstanceId()` and ignores an externally
   supplied `platformPorts.startupRunId`. In the `__DEV__` focused harness the platform-ports
   logger replaces startup event ids with its per-client tracker id; that tracker id is the
   authoritative emitted value for this test. Release has no DEV tracker, so the release emitted
   completion id comes from the writer. The two-client test proves the emitted ids cannot collide
   through the injected field, without conflating the two identity layers.

## Focused results

Commands were run from the repository root. All listed commands exited 0 and retained their own
business/cleanup output:

| Scope | Command/result |
|---|---|
| shared console assembly | `yarn --cwd apps/terminal/ui/base/console-assembly typecheck && yarn --cwd apps/terminal/ui/base/console-assembly test --runInBand`; 1 file, 3 tests PASS; `TERMINAL_PACKAGE_TEST=PASS` |
| render base | `yarn --cwd apps/terminal/ui/base/render typecheck && yarn --cwd apps/terminal/ui/base/render test --runInBand`; 11 files, 64 tests PASS; `TERMINAL_PACKAGE_TEST=PASS` |
| sample-console | `yarn --cwd apps/terminal/ui/integration/sample-console typecheck && yarn --cwd apps/terminal/ui/integration/sample-console test --runInBand`; 7 files, 36 tests PASS; includes shared external run-id two-assembly regression; `TERMINAL_PACKAGE_TEST=PASS` |
| sample2 picker | `yarn --cwd apps/terminal/ui/feature/sample-wallpaper-picker typecheck && yarn --cwd apps/terminal/ui/feature/sample-wallpaper-picker test --runInBand`; 3 files, 16 tests PASS; includes real UI before-write and after-write two-hop runtime injections; `TERMINAL_PACKAGE_TEST=PASS` |
| sample2 integration | `yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck && yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test --runInBand`; 4 files, 13 tests PASS; `TERMINAL_PACKAGE_TEST=PASS` |
| sample staff auth | package typecheck/test; 1 file, 7 tests PASS; `TERMINAL_PACKAGE_TEST=PASS` |
| sample member desk | package typecheck/test; 1 file, 24 tests PASS; `TERMINAL_PACKAGE_TEST=PASS` |
| sample2 behavior control | `node tools/terminal-sample2/check-behavior.mjs`; baseline, F-A5/F-A5B/F-A5D/F-A2/F-A2C/F-A2A/F-A2-scroll/F-A2-token/F-A3A/F-A3B/F-A7/F-A7B/F-A9 admission and red mutations PASS; `SAMPLE2_RED_MUTATION_CLEANUP=PASS` |
| render behavior control | `node tools/terminal-ui-render/check-behavior.mjs`; baseline 64, 26 red vectors, cleanup PASS |
| terminal static | `node tools/terminal-skeleton/verify-static.mjs`; all 7 rule gates PASS, `SCAFFOLD_HYGIENE=PASS`, `TERMINAL_STATIC=PASS` |
| descriptor model | `node tools/terminal-skeleton/check-static.test.mjs`; optional/spread descriptor red mutations fail as expected; `TERMINAL_SKELETON_MODEL_TEST=PASS` |

## What is and is not closed

- CP3 source/focused repair: current focused proof supports the rule that two assemblies given the
  same external platform-port run id emit two distinct `startup.complete` ids, neither equal to
  that external id. Fresh CP3 reconciliation is still required after this repair.
- CP4 U13 focused proof: current package tests enter through `WallpaperPicker` UI, pass through the
  picker actor to a kernel child runtime module, read back the write phase, and open the appropriate
  system notice for both before-write and after-write failure. This is not a release/Android proof.
- B1 README/checker repair: current static and package controls pass; fresh CP1 reconciliation is
  still required after the README/checker repair.
- No Web, Metro, DEV, release, Android device, dual-screen cold-start, seed/reset, UAT, deployment,
  or final implementation acceptance was claimed by this record.
