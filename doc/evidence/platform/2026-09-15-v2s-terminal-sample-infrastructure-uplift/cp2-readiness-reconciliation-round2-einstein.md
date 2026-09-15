# CP-2 readiness reconciliation — Einstein

- `REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION`
- `REVIEWER=Einstein`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `REVIEW_ROUND=1`
- `reviewMode=FRESH_READ_ONLY_BLIND`
- `dynamicExecution=NOT_RUN`
- `VERDICT=NO-GO`
- `M/S/N=1/0/7`

## Input and boundary

The reviewer read the governing instructions, selected Roadmap authorization, routed project memory, terminal standards, v3.6 requirements, Codex analysis/design/plan and the current native/render/console/picker source and tools. No Web, Metro, DEV, Android device, seed, deployment, Computer Use, or write action was performed. This is the fresh read-only state before the main-agent TR-R04 repair and before dynamic authorization was exercised.

## Evidence seen

- `node tools/terminal-sample2/check-native-projection.mjs`: PASS.
- `node tools/terminal-sample2/check-native-projection.test.mjs`: PASS with app.json, private config, native-resource hash, app-asset hash and empty-discovery mutations.
- `node tools/terminal-sample2/check-behavior.mjs`: PASS for sample2 focused baseline and listed behavior red mutations.
- focused render/console/picker tests and package typechecks were green.
- `node tools/terminal-skeleton/verify-static.mjs` was red at `readability-real-static`, TR-R04, `WallpaperPicker.tsx:86`.
- source scan did not prove the required TR-08 production-bundle absence; no bundle/release run was performed.

## Findings

### M-1 — CONFIRMED at review time — B0 static baseline was not green

The exact first failure was the five-parameter `runAction` function at `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx:86-92`. The plan requires B0 static green. The main agent subsequently changed this to a single object parameter and focused rechecks passed; this report records the original independent blocker.

### M-2 — PARTIALLY_CONFIRMED — static native projection was not native runtime proof

MainActivity registration before `super.onCreate(null)`, splash theme/resource projection and the checker were statically present, but no Gradle/release/device run was available. Therefore U8 release/mobile/dual readiness remained OPEN.

### M-3 — PARTIALLY_CONFIRMED — ready boundary was statically constrained but release/no-ready proof was absent

`ScreenReadyBoundary` restricted ready to a resolved real primary physical surface with valid geometry; fallback and host-unavailable focused cases existed. No release proof showed `t0 splash visible → t1 physical PRIMARY ready → t2 splash hidden`, and no real long no-ready terminal-failure observation was present.

### M-4 — PARTIALLY_CONFIRMED — failure page path had focused proof only

`ScreenContainer` rendered a startup failure page for unavailable host/fallback/runtime failure and focused tests covered it. Real device no-ready/failure-page behavior remained unverified.

### M-5 — PARTIALLY_CONFIRMED — startup writer identity/sink boundary was incomplete

The writer duplicate guard and focused tests existed, but the reviewer did not find complete evidence for global single-client sink, old-HMR run isolation and first-write uniqueness. These had to be proven with the current writer/oracle, not only per-writer tests.

### M-6 — PARTIALLY_CONFIRMED — U13 runtime child-command chain was not fully evidenced

The picker UI and actor source propagated child results and focused tests passed, but the available test path used fake dispatch or manually dispatched notice state; it did not yet prove the complete production-visible UI → picker actor → kernel child command → readback/notice/retry chain under runtime injection.

### N-1 — UNVERIFIED_REQUIRES_EVIDENCE — TR-08 production bundle scan

Source absence of explicit automation/ADB/socket imports was supporting evidence only. The required production bundle symbol scan and a red fixture had not run.

## CP-2 status

`CP-2=NOT_MATCHED`, dynamic phase blocked at this historical checkpoint by the static baseline and missing release/runtime/bundle evidence. Native projection PASS was retained as static support only.

