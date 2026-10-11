# Stage C CP-05 case-source finding intake

## Scope and classification

Finding source: fresh CP-05 independent reconciliation on 2026-10-11. The reviewer correctly found that the previous design listed granular acceptance labels as runner case IDs even though those labels had no standalone executable source.

**Disposition: CONFIRMED for the CLI/source mismatch; REJECTED_WITH_EVIDENCE for requiring each acceptance row to be a separate CLI journey.** Dexter's current user scope asks to keep the two main app journeys and avoid multiplying runners. The root problem is that the design and runner both treated matrix labels as command-line cases, not that the application lacked a second automation framework.

## Owning-source evidence

- The actual runner is `tools/terminal-automation/src/runner.ts`. Its stage C executable set is now exactly `update.supply-chain` and `update.pair`; granular matrix labels are absent from `updateCases` and therefore rejected by `parseAutomationRunArguments` before resource allocation.
- `tools/terminal-automation/test/runner.test.ts` verifies that the seven granular labels (`project-data`, `auto-selection`, `idle`, `install-reminder`, `shared-credential`, `grant`, `report`) are invalid CLI values. The test separately retains the supported pair and supply-chain case/platform checks.
- The parent supply-chain journey is `tools/terminal-automation/journeys/update.android.test.ts`: it checks binding identity, project load readiness, actual full rule snapshot identity, dispatches the real local update command, then verifies actual update/report readback. The pair journey is `tools/terminal-automation/journeys/update.pair.android.test.ts` and its shared Android harness, which asserts distinct runtime identities, same-App projection readiness, inactive/stopped peer TDC and per-runtime selectors.
- Existing owner-focused source covers details without separate automation entrypoints: project candidate and app filtering in `apps/terminal/kernel/feature/project-basic/test/projectBasic.test.ts`; IDLE and FULL reminder behavior in `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`; reminder UI in `apps/terminal/ui/base/admin-shell/test/installReminder.test.tsx`; saved-credential reads/download grant in `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`; report delivery in `terminalUpdate.test.ts` and actual management report readback in `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`.
- The separate TDP store-data acceptance is part of the console main journey via `tools/terminal-automation/journeys/mainSampleJourney.ts` and `storeBasicDataChange.ts`; these read the `store-basic` selector and topic state after the real operations-admin mutation and verify restoration. The wallpaper main journey remains its own integration/application journey.

## Minimum repair

The two design documents now distinguish executable CLI cases from acceptance-matrix row IDs. `update.supply-chain` and `update.pair` are the only top-level Stage C runner cases; §11 granular rows remain assertions grouped under those journeys or named owner-focused tests. The design adds the exact source mapping and states that source presence is not a test result. The implementation plan now describes the two case entrypoints and rejects unsupported labels instead of accepting them as unimplemented cases.

This does not change product behavior or erase an acceptance criterion. It prevents a metadata label from implying a runnable scenario. Actual execution results remain independently reported per §11a, and all not-yet-run faces remain `NOT_RUN`.

## Follow-up source finding: supply-chain sample/shape admission

**Disposition: CONFIRMED; repaired within the existing CP-05 runner scope.** The design and plan name two supply-chain execution forms: Android `console/dual` and Android `wallpaper/mobile` (`implementation-design-claude.md` §11 and `implementation-plan-claude.md` CP-05). Before this follow-up, `isSupportedSupplyChainRun` admitted only Android `dual`, which silently made the wallpaper/mobile form impossible to dispatch through the sole managed runner.

The minimal repair keeps the existing single `update.supply-chain` CLI case and admits only those two documented combinations. `parseAutomationRunArguments` rejects the other sample/shape/platform combinations before resource allocation; `updateCaseImplemented` uses the same predicate. The runner passes an explicit `--sample` into `TERMINAL_AUTOMATION_SAMPLE`; `update.android.test.ts` derives the app/package identity from that value and uses the requested device shape when preparing the fixture. No new case, runner, fixture, or product behavior was added.

The first focused typecheck after editing the predicate failed because the parser's `sample` local remained `string | undefined` at the call site. The parser had already rejected any value other than `console` and `wallpaper`; the minimum repair narrows that validated value to the existing execution union. The subsequent typecheck passed.

Focused checks on the repaired bytes:

- `yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts`: PASS, 1 file / 48 tests. Positive checks cover console/dual and wallpaper/mobile; negative checks cover console/mobile, wallpaper/dual and Web.
- `yarn workspace @catering-v2s/terminal-automation typecheck`: PASS.
- `yarn prettier --check tools/terminal-automation/src/runner.ts tools/terminal-automation/test/runner.test.ts doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md doc/review/platform/2026-10-11-ter-version-update-stage-c-cp05-case-intake-codex.md`: PASS.
- The Android supply-chain runs themselves were not launched by these focused checks. Their business and cleanup evidence remains `NOT_RUN` until the approved managed device runs.

## Proof and residual boundary

- `yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts`: PASS, 1 file / 48 tests.
- `yarn workspace @catering-v2s/terminal-automation typecheck`: PASS after the follow-up sample/shape change.
- Formatting command above: PASS after the follow-up documentation change.
- No managed dynamic run was performed for this change. Expo Web, Android, DEV, pair, and cleanup rows remain `NOT_RUN` until their approved runs execute.
- Fresh independent CP-05 reconciliation completed on the current bytes: `doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-05-reconciliation-codex.md`, `MATCHED`, `OPEN=0`. This intake remains the author's disposition and is not the independent verdict.
- A later README-only delta removed a duplicate Stage C runner paragraph from `scripts/README.md`; fresh reviewer `/root/cp05_delta_cp06_reconcile_1011` independently returned `CP05_DELTA=MATCHED`. Runner, journey, and test sources did not change, so the current-byte runner tests above remain applicable; they were not repeated for a documentation-only edit.
