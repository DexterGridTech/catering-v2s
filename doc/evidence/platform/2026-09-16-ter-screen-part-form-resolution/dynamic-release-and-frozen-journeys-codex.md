# TER screenPart 机型解析 · dynamic release and frozen-journey evidence

```text
SCOPE=authorized release cold-start and sample1/sample2 frozen journeys
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
RUNNER_SCOPE=release APKs only; mobile and dual emulator shapes; no Web/Metro
```

## Release APK bindings

The four release cold-start and frozen-journey runs used the following current APKs. Each
runner also compared the installed base APK's SHA-256 and byte count with the local file
before executing the business assertions.

| app | repository-relative APK | bytes | SHA-256 prefix | build evidence |
|---|---|---:|---|---|
| sample-terminal | `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | 88,537,001 | `e2360e5a4827…e39c` | forced `assembleRelease --rerun-tasks` completed successfully |
| sample-wallpaper-terminal | `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | 88,946,033 | `e87b9b2097de…8c8c7` | forced `assembleRelease --rerun-tasks` completed successfully after the shared readiness fix |

## U8 release cold-start

The runner command was:

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --skip-build --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-cold-start-post-fix
```

The command first exposed the real pre-fix wallpaper release failure and preserved it at
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-cold-start-post-fix/`:
the sample-terminal mobile/dual cases passed, while the wallpaper cases stopped on
`StartupCompletionPrerequisitesMissing:group.ports` and cleanup passed. The APK used for
that wallpaper observation had been built before the final shared-source fix, so it is
retained as first-failure evidence, not as a current result.

After rebuilding the wallpaper APK with the current `consoleAssembly.tsx`, the scoped
rerun was:

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --app sample-wallpaper-terminal --skip-build --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-wallpaper-post-fix
```

It returned:

```text
TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS
```

The post-fix wallpaper result is recorded in
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-wallpaper-post-fix/`.
The combined current run's sample-terminal results are in
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-cold-start-post-fix/`.

| app | shape | business | cleanup | target device | release startup observations |
|---|---|---|---|---|---|
| sample-terminal | mobile | PASS | PASS | `emulator-5556`, primary 720×1280 | splash visible before readiness; `startup.ready-candidate` → `startup.complete` → `startup.ready-hidden`; settled primary RN content visible |
| sample-terminal | dual | PASS | PASS | `emulator-5554`, primary 2560×1600 + secondary 1280×720 | same ordering; settled primary RN content and secondary surface observed |
| sample-wallpaper-terminal | mobile | PASS | PASS | `emulator-5556`, primary 720×1280 | splash visible before readiness; `startup.ready-candidate` → `startup.complete` → `startup.ready-hidden`; settled picker content visible |
| sample-wallpaper-terminal | dual | PASS | PASS | `emulator-5554`, primary 2560×1600 + secondary 1280×720 | same ordering; settled picker content and secondary surface observed |

For the four current result files, the runner's `startup-order` object records
`firstContentObservedAfterReadyCandidate=true`, `firstContentObservedAfterReadyHidden=true`,
`provenReadyAfterRenderOwnedContent=true`, and `settledSplashHidden=true`. The per-shape
`logcat.txt`, `logcat-relevant.txt`, pre-ready/settled windows, UI trees, screenshots and
SurfaceFlinger/display snapshots are retained beside each `result.json`. This proves the
release emulator cold-start gate and splash ordering for these four runs; it is not a visual
PASS or overall implementation acceptance.

## Frozen sample journeys

The authorized record-only runners installed the same current release APKs and asserted
partKey, testID/state text, display pairing, business state, authenticated/pending cold
restart recovery, and package cleanup.

### sample1 normal

```text
node tools/terminal-sample2/run-sample1-frozen-journey.mjs --serial emulator-5556 --shape mobile --case normal --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample1-frozen/mobile-normal
node tools/terminal-sample2/run-sample1-frozen-journey.mjs --serial emulator-5554 --shape dual --case normal --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample1-frozen/dual-normal
```

Both returned `TERMINAL_SAMPLE1_FROZEN_JOURNEY=PASS CLEANUP=PASS` with
`firstFailure=null`. The mobile run covered anonymous login, invalid-login notice, member
list, member form, customer confirmation, confirmed member, authenticated cold restart,
logout and anonymous cold restart. The dual run covered the same state on PRIMARY plus the
customer confirmation on SECONDARY; its physical pairing was PRIMARY 2560×1600 and
SECONDARY 1280×720. The result files are:

- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample1-frozen/mobile-normal/result.json`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample1-frozen/dual-normal/result.json`

The runners recorded current sample-terminal APK binding
`e2360e5a4827bbcd86c8a1914904470915c58ffe01fd906491ae2f31e558e39c` and asserted the
existing sample1 partKey/testID names without synchronizing them to system-failure names.

### sample2 wallpaper

```text
node tools/terminal-sample2/run-sample2-frozen-journey.mjs --serial emulator-5554 --shape dual --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample2-frozen/dual
node tools/terminal-sample2/run-sample2-frozen-journey.mjs --serial emulator-5556 --shape mobile --output doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample2-frozen/mobile
```

Both returned `TERMINAL_SAMPLE2_FROZEN_JOURNEY=PASS CLEANUP=PASS` with
`firstFailure=null`. Each run asserted anonymous and picker partKeys, none/w1/w2/w3
selection and confirmation states, pending versus confirmed background state, pending
selection recovery after cold restart, and confirmed-state recovery with pending cleared.
The dual result additionally asserts `sample.wallpaper-console.waiting` before login and
`sample.wallpaper-console.welcome` after login on SECONDARY; its physical pairing is
PRIMARY 2560×1600 and SECONDARY 1280×720. The result files are:

- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample2-frozen/mobile/result.json`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample2-frozen/dual/result.json`

The runners recorded current wallpaper APK binding
`e87b9b2097de31225999c5edbdf76cd84cfcfe85e6e78206171f51e00a18c8c7`.

## Failure boundary and evidence tiers

```text
FIRST_DYNAMIC_FAILURE=wallpaper release U8 before current APK rebuild: StartupCompletionPrerequisitesMissing:group.ports
LAST_KNOWN_GOOD=sample-terminal U8 mobile/dual and all focused/static evidence before wallpaper rebuild
BROKEN_BOUNDARY=console-assembly readiness used DEV-only descriptor completion as release group.ports prerequisite
OWNING_SOURCE=apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx
MINIMAL_REPAIR=check the ten actual PlatformPorts bindings; keep descriptor metadata DEV-only; add release-like descriptor-stripped focused fixture
REVERIFICATION=wallpaper release U8 PASS/CLEANUP PASS; all four frozen journeys PASS/CLEANUP PASS
```

```text
STATIC=PASS (latest terminal verify:static recorded in static-focused evidence)
FOCUSED=PASS (current package suites and red mutations recorded in CP evidence)
NATIVE=PASS_FOR_AUTHORIZED_EMULATOR_OBSERVATIONS
ANDROID=PASS_FOR_RELEASE_APK_COLD_START_AND_FROZEN_JOURNEY_STATE
RELEASE=PASS_FOR_U8_COLD_START_AND_RECORD_ONLY_JOURNEYS; not overall release acceptance
WEB=OPEN_NOT_RUN
VISUAL=OPEN (screenshots captured; no independent visual verdict, and pixel claims remain D-13)
CLEANUP=PASS_FOR_ALL_CURRENT_U8_AND_FROZEN_RUNS
```

No Web/Metro run, visual acceptance, or deployment was performed in this evidence set.
