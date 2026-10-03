# CP-04 fresh independent reconciliation

```text
CP=CP-04 current peer readiness, disconnect mask, and local recovery
STEP_RECONCILIATION=MATCHED
REVIEWER=/root/cp04_reconciliation_r2
REVIEW_MODE=FRESH_READ_ONLY_THREE_DIMENSIONAL_RECONCILIATION
```

## Verdict

CP-04 matches the current requirements, design/IA, and routed project-memory constraints. No OPEN finding remains for this CP. This is a stage reconciliation only; it is not a whole-batch verdict and does not prove Web, VM, adapter, DEV, or V-01–V-20 behavior.

## Evidence checked

- `sample-console` declares `MAIN content + staff session + member registry` as required slices in `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:54`; the same composition passes actual `uiStateModule`, `staffSessionModule`, and `memberRegistryModule` registrations to topology sync at line 180. Its test at `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx:765` observes staff/member frames and absence of wallpaper.
- `sample-wallpaper-console` declares `MAIN content + staff session + wallpaper` in `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:58`; line 168 passes actual `uiStateModule`, `staffSessionModule`, and `wallpaperModule` registrations. Its test at `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:600` observes staff/wallpaper frames and absence of member data.
- `MAIN` content is an actual `master-to-slave` registration at `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:637`, included in `uiStateModule.stateSlices` by `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts:91`.
- Staff projection sends only `{status, operatorName}` and writes `hostQualification` without replacing the SLAVE local session: `apps/terminal/kernel/feature/sample-staff-session/src/features/slices/slice.ts:39-57`. `staffSession.test.ts:48` checks the projected payload has no passcode and local state remains anonymous.
- Member projection sends only confirmed `{members}` and preserves destination `pending`: `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:41-56`; `memberRegistry.test.ts:48` checks local pending survives.
- Wallpaper projection sends only confirmed `{wallpaperId}` to `hostConfirmedWallpaperId`, preserving local confirmed and pending values: `apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts:53-72`; `sampleWallpaper.test.ts:38` checks those local values are unchanged.
- Readiness requires current peer reachability, identity, connection and each required applied revision: `apps/terminal/kernel/base/topology/src/selectors/selectTopologyState.ts:15`. Peer/connection changes clear revisions and reject stale connection application: `apps/terminal/kernel/base/topology/src/features/slices/topology.ts:88,93`; `topology.test.ts:473` covers stale-connection rejection.
- Mask/admin ordering and accessibility behavior align with IA `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md:50`; implementation and focused coverage are in `apps/terminal/ui/base/render/src/components/LayerStack.tsx:178,231,261` and `apps/terminal/ui/base/render/test/layerStack.test.tsx:150`.

## Remaining evidence boundary

The reviewer did not run tests. Current-byte package-focused test, lint, and typecheck outputs are recorded in `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp04-finding-intake-codex.md`. Expo Web, DEV, VM/device, adapter, and all V-01–V-20 remain `NOT_RUN`. CP-05 must add `hostPendingProjection` to the LMS required set and prove its actual current-peer projection path; this MATCHED verdict does not cover that future CP-05 change.
