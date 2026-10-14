# TER T1 CP-06 TEST_CHAIN_PREFLIGHT R1 finding intake

## Context and boundary

The fresh R1 review returned `OPEN` for two items. Its result was delivered in this task and no repository report path was supplied. This document records the main agent's independent intake and the minimal current-byte response. It does not claim that R2, any dynamic run, CP-06, 13c, or the whole-batch implementation review passed.

Governing sources reopened for this intake:

- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md` §6, §13, and especially R-17: business proof and cleanup are separate, with two fresh preflight rounds before dynamic execution.
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md` §11 and §13: the approved Web suites, structured run identity, first failure, cleanup, and CP-06 order.
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md` §7: current managed commands and run order.
- `project-memory/operations/claude-review-finding-intake.md`: findings are inputs; the main agent owns verification, disposition, and repair.
- `doc/platform/terminal-coding-standard.md` TR-16: Web precedes device execution for non-adapter behavior.
- Current `tools/terminal-automation/src/runner.ts` and the selected Web suites named below.

## Intake

### R1-S1 — Web harness cleanup failure was attributed to business

**Disposition: CONFIRMED.**

The runner treated any nonzero Vitest exit as `business=FAIL` (`tools/terminal-automation/src/runner.ts`, former exit-code classification), while `cleanupStatus` only included the outer process tree, generated artifacts, and Android cleanup. The Web suites independently throw from `afterAll`: `journeys/sampleConsole.test.ts`, `journeys/remote.web.test.ts`, and the `update.owner-flow` branch of `journeys/update.test.ts`. Thus a successful scenario followed by a browser/driver/Expo cleanup failure could be reported as business failure with outer cleanup PASS. The counterexample is a Web test body completing its business assertions, then `browser.close()` or process-tree readback failing in `afterAll`.

**Minimal repair:** those three selected Web suites now emit runId- and suite-bound business completion and cleanup-result markers. The sample and remote suites include diagnostics-subscription closure in their existing hook cleanup result. The existing managed runner requires exactly one matching business marker and cleanup marker for these suites, maps missing or malformed cleanup evidence to cleanup failure, and permits a nonzero Vitest exit to remain `business=PASS` only when the same run has an explicit business-pass marker, an explicit cleanup-fail marker, and no runner interruption/monitor/fixture/scenario-proof failure. All other nonzero exits remain business failures. This preserves the current Web lifecycle and does not add a second runner or cleanup framework.

**Focused proof:** `tools/terminal-automation/test/runner.test.ts` covers cleanup-only nonzero exit, missing/mismatched/duplicate markers, and suite selection. Dynamic business and cleanup results remain `NOT_RUN` until the managed runs execute.

### R1-S2 — plan describes a registered Web update case as absent

**Disposition: CONFIRMED.**

The implementation plan listed `update.owner-flow` commands at §7, but the later TR-16 paragraph said the case did not exist. Current parser/suite registration is in `tools/terminal-automation/src/runner.ts`; direct parser coverage and the current owner-flow assertions are in `tools/terminal-automation/test/runner.test.ts` and `tools/terminal-automation/journeys/update.test.ts`.

**Minimal repair:** only the stale sentence in §7 was changed to say that the current parser registers the case and that execution still requires a current parser/suite readback. No runner behavior or scenario scope was changed for this item.

## R2 outcome and focused verification

R2 was completed by the fresh read-only reviewer `/root/t1_cp06_preflight_r2` after the targeted streaming-marker repair. The reviewer returned `MATCHED` for the CP-06 Web test-chain preflight and found no remaining OPEN items in the reviewed chain. R2 confirmed that the runner receives raw stdout/stderr chunks in `writeOutput`, tracks exact run/suite markers without using the bounded log tail, and preserves the nonzero-exit cleanup-only classification.

The main agent added a deterministic regression in `tools/terminal-automation/test/runner.test.ts`: after the business marker, the tracker receives 1,048,577 bytes of unrelated output, then a cleanup-fail marker; the expected result remains business `PASS`, cleanup `FAIL`, and cleanup-explained nonzero exit. A second focused case splits markers over chunks and keeps stdout/stderr line fragments isolated.

Focused current-byte verification:

- `yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts` — `PASS`, 1 file / 75 tests.
- `yarn workspace @catering-v2s/terminal-automation typecheck` — `PASS`, exit code 0.
- Fresh R2 `TEST_CHAIN_PREFLIGHT` — `MATCHED`, read-only; no dynamic command was run by the reviewer.

## Current state

The CP-06 preflight is `MATCHED`. Before the first managed dynamic run, the main agent must still pass the current resource/identity preflight. At the time this record was updated, all CP-06 Expo Web, Android/device, business and cleanup outcomes remained `NOT_RUN`; this document does not convert the preflight result into dynamic evidence.

## First managed DEV start diagnosis

The first current-byte managed DEV start after preflight, `r5-dev-1791919538989-89176-a3786ab4-01e7-43b3-bcd4-b2270560382c`, failed before application readiness with `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact`. Its manifest records `lastKnownGood=REMOTE_JAVA_CONTROL_READY`, `brokenBoundary=REMOTE_BUSINESS_READINESS_BEFORE_TDS`, business `FAIL`, and managed cleanup `PASS`; no Web or device test began, and no reset or seed ran.

This is the already documented missing CP-05 budget projection for an existing operation, not a T1 operation change or a T1 business defect. The current T1 plan explicitly keeps the default budget projection `NOT_RUN/OPEN`, forbids fabricating calibration, and distinguishes the existing `IDENTITY_ONLY` generator/readiness mode from budget evidence. The current generator's `isCp05IdentityOnlyProjectionMode` allows that exact mode for identity-only projection, and the managed DEV runner forwards it to remote Java. Therefore the minimal next action is one managed DEV start with `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`; this does not modify a budget or claim budget validation. The first failed manifest and log remain preserved.

## First Web launcher failure and owner-entry repair

**Disposition: CONFIRMED.** The first selected Web command exited before the managed automation runner started and before a terminal-automation run manifest existed. It failed with `ERR_MODULE_NOT_FOUND` resolving `apps/terminal/kernel/base/server-config/src/moduleName` while `runner.ts` imported the package root. The wrapper invokes Node v24.13.0 with `--experimental-strip-types`; the package root barrel uses extensionless relative ESM imports intended for the TypeScript bundler. Node's v24.13.0 ESM documentation requires explicit file extensions for relative imports, and its TypeScript documentation states that built-in stripping does not read `tsconfig.json`. The observed failure therefore came from the runner/package runtime-entry mismatch, not DEV or Web business behavior.

The owner already had a narrow `./network-adapter` package subpath. The minimum repair adds the corresponding `./environment` subpath to the existing server-config resolver, gives that resolver's one runtime-relative import an explicit `.ts` extension, and switches the runner plus its configuration helper/test to the owner subpath. No loader, dependency, copied resolver, or business configuration logic was added. Server-config's no-emit typecheck enables `allowImportingTsExtensions` only for its source package. Its README documents the runtime entry; `serverConfigEnvironmentWiring.test.ts` invokes the exact Node type-stripping mode and imports the public subpath.

**Focused proof:** direct `node --experimental-strip-types --input-type=module` import of the owner subpath returned both resolver functions; `yarn workspace @catering-v2s/terminal-automation test test/serverConfigEnvironmentWiring.test.ts` passed 5 tests. The affected server-config typecheck first exposed TS5097, then passed after the package-local tsconfig change; terminal-automation typecheck also passed. This proves only the loader seam. The failed first command created no automation run manifest; Web business and cleanup remain `NOT_RUN` until the same planned managed journey starts successfully.

## Owner-flow run failure: managed Web origin did not match the DEV CORS allowlist

**Run:** `7d380997-c811-42f2-9ce2-940ff03a7cd2` (`update.owner-flow`, console, Web); business `FAIL`, diagnostics `PASS`, cleanup `PASS`.

**Disposition: CONFIRMED.** The captured Expo log says `Waiting on http://localhost:52741`; `tools/terminal-automation/journeys/update.test.ts` had allocated an ephemeral port and opened the app there. The managed DEV context injects `TERMINAL_AUTOMATION_WEB_ORIGIN`, and the T1 runner supplies the exact configured browser origin. The active DEV CORS setting is `http://127.0.0.1:8093`; `EdgeWebConfiguration` validates and allows exact loopback origins. The activation request failed at the browser HTTP transport boundary with `BROWSER_HTTP_TRANSPORT_FAILED` in 88 ms; no activation request appeared in CBS diagnostics. The finite denominator scan found `sampleConsole.test.ts` and `remote.web.test.ts` already bind Expo to the injected origin; ephemeral harnesses in geometry/visual/agent-capability suites are outside the CORS-protected owner-flow path.

**Root cause and minimum repair:** the update Web harness was the only DEV-backed terminal owner-flow harness that chose a different origin. It now validates and uses the injected managed origin for `update.owner-flow`, retains ephemeral ports for non-owner-flow cases, and logs the selected origin. The plan and `cs-terminal-automation` skill now state this exact-origin rule. Prevention destination: `SKILL`, because this is a recurring managed-harness implementation discipline; no new gate or CORS exception was added.

The same `update.owner-flow` command must run for console, then wallpaper. The exact-origin TEST_CHAIN_PREFLIGHT R1/R2 is complete; the separate FULL fixture identity delta was reviewed below. Both Web owner-flow business results remain `NOT_RUN` for the repaired byte until their managed runs complete.

## Owner-flow run failure: FULL fixture left embedded identity stale

**Run:** `1c653b40-2f01-4f37-b6d9-eab59c979579` (`update.owner-flow`, console, Web); business `FAIL`, diagnostics `N/A`, cleanup `PASS`.

**Disposition: CONFIRMED.** The managed runner used the approved `http://127.0.0.1:8093` origin and completed the real supply chain through FULL grant, artifact preparation, and fixture apply. The fixture then reported a successful FULL action but continued returning the original INSTALL artifact as `embedded`; the production owner correctly rejected the next candidate with `FULL_IDENTITY_CONFLICT`. The run log shows the successful FULL apply and subsequent rejection; this is a fixture projection inconsistency, not evidence that production identity checks should be weakened.

**Minimum repair:** `apps/terminal/kernel/base/terminal-update/src/testing/automationFixture.ts` now advances `embedded` to the exact prepared FULL artifact and advances `actual` from the exact prepared FULL/HOT artifact. HOT changes the actual bundle publication while retaining the installed FULL embedded identity. The direct test checks initial, post-FULL, and post-HOT projections, plus exact prepared/action identity and release; production candidate/grant/report code is unchanged. A fresh static R1 found no blocking issue; its optional note to compare HOT bundle/runtime fields directly was non-blocking because the existing publication identity assertion exercises the changed identity and the runtime is unchanged by HOT in this fixture. Fresh differential R2 is recorded separately when complete.

**Focused proof on repaired bytes:** `yarn workspace @catering-v2s/kernel-base-terminal-update test test/automationFixture.test.ts` — PASS, 4/4; `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` — PASS; `yarn workspace @catering-v2s/kernel-base-server-config typecheck` — PASS; `yarn workspace @catering-v2s/terminal-automation typecheck` — PASS. These local focused results do not close the managed Web owner-flow journey.

The run `1c653b40-2f01-4f37-b6d9-eab59c979579` remains a failed historical run with cleanup PASS. Console and wallpaper managed Web `update.owner-flow` remain `NOT_RUN` on the repaired fixture bytes. A new run still requires current managed resource/identity preflight.

**Differential preflight:** fixture R1 `PASS`; fixture R2 `MATCHED`. Both independently found the prepared FULL/HOT identity projections and direct readbacks consistent with the production owner checks. The only optional notes (direct HOT bundle/runtime or `selectedPublicationId` assertions) do not expose an uncovered identity branch: the existing regression asserts the unique HOT publication in `actual`, keeps FULL embedded identity unchanged, and the fixture derives version fields from that artifact. No extra assertion was added to avoid expanding this fix without a distinct counterexample. Combined with the unchanged CORS-origin R1/R2 (`PASS`/`MATCHED` above), the selected owner-flow Web chain is statically cleared for the focused managed rerun. No dynamic evidence is claimed by these reviews.

## Owner-flow run failure: FULL fixture omitted installed APK identity

**Run:** `e5a70a67-0c44-4f08-9a99-20483c36350e` (`update.owner-flow`, console, Web); manifest business `FAIL`, diagnostics `N/A`, cleanup `PASS`.

**Disposition: CONFIRMED.** The run reached the real candidate, grant, FULL preparation, and FULL apply path, then the production candidate check rejected the next selection with `FULL_IDENTITY_CONFLICT`. The fixture had advanced the embedded FULL artifact and publication but omitted the installed APK SHA from `readFacts().actual`; the production identity check was correct. The run manifest records `firstFailure=TERMINAL_AUTOMATION_WEB_BUSINESS_PASS_NOT_OBSERVED`, with the application failure visible in the structured run log; this distinction is retained rather than relabeling the runner marker as the business root cause.

**Minimum repair:** the owner-flow fixture now uses one APK SHA value for the FULL target and HOT `minimumFull`, projects that SHA after FULL apply, and preserves it through HOT while changing only the bundle publication. The direct test asserts the FULL-to-HOT selection and no further candidate after HOT. Production update decision and owner code are unchanged. This closes the same fixture-correlation family as the preceding embedded projection failure; the finite denominator is FULL/HOT fixtures exposing current, embedded, and APK identity facts.

**Focused current-byte proof:** `yarn workspace @catering-v2s/kernel-base-terminal-update test` — `PASS`, 3 files / 59 tests; `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` — `PASS`. Fresh read-only fixture R1 was `PASS`; fresh current-byte R2 was `MATCHED`. These checks do not close the managed owner-flow journey.

The failing console run remains `FAIL` with cleanup `PASS`. The repaired-byte console owner-flow run and wallpaper owner-flow run remain `NOT_RUN` until executed through the managed entry. Android/device evidence is unaffected by this fixture-only change and remains under its prior run identities and byte scope.

## Owner-flow run failure: task completion was checked before the next natural report heartbeat

**Run:** `d6641e09-6558-48e0-87c4-66d5e9c13eab` (`update.owner-flow`, console, Web); business `FAIL`, diagnostics `N/A`, cleanup `PASS`.

**Disposition: CONFIRMED.** The run completed the fixed FULL→HOT task and its exact `recentStatus` became `succeeded`, but the Web assertion immediately read `selectTerminalUpdateReportDelivery` and required an accepted report before the next heartbeat-triggered send. The run log records the taskless startup observation accepted earlier in the same session (`reportSequence=1`, around `20:56:35Z`), the completed update owner flow around `20:57:35Z`, then the immediate report-delivery selector read and `TERMINAL_AUTOMATION_OWNER_FLOW_REPORT_NOT_ACCEPTED` around `20:57:39Z`. No task-report submission event for the completed task preceded that assertion. The task-completion selector and CBS report-receipt path are separate facts; completion alone does not imply that the asynchronous TDC heartbeat consumer has submitted and received the task report.

**Minimum repair:** the Web owner-flow now waits for the exact task's successful recent status, then reads `selectTerminalUpdateReportDelivery`; when pending reports remain, it subscribes and waits up to 45 seconds for the natural owner delivery to settle. It does not inject a heartbeat or change production cadence. Paused/failed delivery still fails the assertion, and the existing operations history readback must still find the same exact task report. Focused assertions reject pending, paused, failed, and mismatched-task states.

**Focused current-byte proof:** `yarn workspace @catering-v2s/terminal-automation test --run test/updateOwnerFlow.test.ts` — `PASS`, 1 file / 7 tests; `yarn workspace @catering-v2s/terminal-automation typecheck` — `PASS`. Fresh R1/R2 `TEST_CHAIN_PREFLIGHT` — `MATCHED`; both repaired-byte managed Web owner-flow runs are still pending. This intake does not claim the owner-flow business path passed after the change.

## Owner-flow run failure: successful action report used stale actual-version state

**Run:** `63377ebb-e988-4612-95d3-31db83aec39e` (`update.owner-flow`, console, Web); business `FAIL`, cleanup `PASS`, managed DEV diagnostic read `FAIL`.

**Disposition: CONFIRMED.** The run manifest preserves the exact run/fixture identity and records `TERMINAL_AUTOMATION_WEB_BUSINESS_PASS_NOT_OBSERVED`, generated-artifact cleanup `PASS` (9,103,439,290 bytes removed), and managed DEV log read failure. The runner log shows that the real Project Basic candidate, FULL/HOT grant and apply chain completed, `selectTerminalUpdateReportDelivery` reached `pendingCount=0` with `sendPaused=false` and no delivery failure, and the Operations history readback ran; the owner-flow then failed at `tools/terminal-automation/journeys/update.test.ts` with `TERMINAL_AUTOMATION_OWNER_FLOW_ACTUAL_VERSION_MISMATCH`.

The source counterexample was a successful terminal `UpdatePort.applyPrepared` result after the port's actual facts had changed. `createTerminalUpdateArtifactExecutor` wrote the terminal task/report immediately without refreshing `TerminalUpdateState.actualVersions`; `createTerminalUpdateReportOwner.writeTaskWithOptions` builds the report body from that state snapshot. The separate later `reconcile` path already reads actual facts first, but did not verify that a successful action's facts identified its exact fixed artifact. Thus a successful action could publish stale or mismatched actual versions, while the approved R-15/UI oracle correctly rejected the Web run.

**Minimum repair:** `updateDecisions.actualMatchesArtifact` now compares the observed application/native/bundle/runtime/publication identity to the exact fixed artifact. Before an immediate terminal success is persisted or reported, the executor reads `UpdatePort.readFacts`, replaces `actualVersions` with a successful readback, and writes UNKNOWN with a stable reason if facts are unavailable or mismatch; the lifecycle log records expected and actual identity fields. The existing `reconcile` terminal-success path applies the same identity check after its existing facts read. The FULL→HOT continuation remains fixed for the normal next PRIMARY-ready path and was not made to require a same-process install readback. No new ledger, retry, or report path was added.

**Focused current-byte proof:** `yarn workspace @catering-v2s/kernel-base-terminal-update test` — `PASS`, 3 files / 60 tests; `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` — `PASS`; `yarn workspace @catering-v2s/kernel-base-terminal-update lint` — `PASS`, 26/26 owned files, 0 errors/warnings. Direct regressions cover a successful action updating actual facts before terminal status and a stale readback remaining UNKNOWN. These focused results do not close the managed Web owner-flow case.

The run `63377ebb-e988-4612-95d3-31db83aec39e` remains a failed current-byte historical run with cleanup `PASS` and managed DEV diagnostics `FAIL`. Both Web `update.owner-flow` cases remain to be rerun on the repaired owner bytes; the run did not change the external DEV service or execute reset/seed.

**Fresh dynamic-chain preflight after the actual-version repair:** R1 `/root/t1_actual_readback_preflight_r1` returned `MATCHED`; R2 `/root/t1_actual_readback_preflight_r2` returned `MATCHED`. Both were read-only checks of the current executor/reconcile readback, exact FULL/HOT artifact identity, actual selector/report ordering, current owner-flow fixture and managed Web harness cleanup/origin. They found no OPEN item for the two planned Web owner-flow runs. The reviewers did not run tests or dynamic commands. Console and wallpaper business runs on these repaired bytes were still `NOT_RUN` at preflight close; preflight MATCHED is not a dynamic PASS.

## Repaired-byte Web owner-flow runs

The two planned current-byte Expo Web owner-flow runs have now completed. These are the latest runs for the actual-version readback repair; earlier failed runs above remain historical and are not overwritten.

| Sample | Run / started at (UTC) | Business evidence | Diagnostics | Cleanup |
|---|---|---|---|---|
| console | `2fab25c2-3a24-4daa-b807-93deba1e10e3` / `2026-10-13T21:44:41Z` | `PASS`; task `606192c6-bbd1-43b7-8692-8c0041841f6c`; report receipt accepted; Operations history readback matched that task (`currentTaskFound=1`, page 1, six visible history rows); final FULL/HOT actual readback identity matched the exact prepared HOT artifact (`1.0.0` native/build 2, `1.0.1` bundle, `ter-main-v1` runtime). | Android `N/A`; managed DEV diagnostics were read successfully. | `PASS`; Web browser/driver closed, Expo tree absent, runner-owned build outputs removed. |
| wallpaper | `24976967-4bca-4b09-ae00-3ae108ce551c` / `2026-10-13T21:51:00Z` | `PASS`; task `1c4db50f-2dc7-4153-a540-95a048685a2b`; report receipt accepted; Operations history readback matched that task (`currentTaskFound=1`, page 1, seven visible history rows); final FULL/HOT actual readback identity matched the exact prepared HOT artifact (`1.0.0` native/build 2, `1.0.1` bundle, `ter-main-v1` runtime). | Android `N/A`; managed DEV diagnostics were read successfully. | `PASS`; Web browser/driver closed, Expo tree absent, runner-owned build outputs removed. |

Both manifests end with `stage=FINISHED`, `business=PASS`, `diagnostics=N/A` (the platform-specific Android diagnostic slot), `cleanup=PASS`, `firstFailure=null`, `lastKnownGood=cleanup`. The run logs independently report `managedDev=PASS` after reading CBS and all three TDS diagnostics. Both runs used the managed `http://127.0.0.1:8093` Expo origin and the retained managed DEV `r5-dev-1791919673113-92637-3b34abbe-181b-475e-a93d-2155f0a11ee7`; no reset or seed was performed. The wallpaper run completed its owner-flow after the console run and its cleanup; there was no overlap.

These Web runs close the planned current-byte `update.owner-flow` proof for both application compositions and verify the real CBS supply/report/history path with the approved Web `UpdatePort` fixture. They do not prove Android PackageInstaller behavior or replace the plan's separately scoped device evidence. No source changed during either run.

## Android owner-flow TEST_CHAIN_PREFLIGHT intake

**R1:** `OPEN`. It correctly found that repaired-byte native `UpdatePort.readFacts/applyPrepared` still needs Android proof and that historical Android/remote evidence cannot substitute. It also raised two admission concerns: no separate pre-existing run-contract document and no current wallpaper mobile serial binding.

**Main-agent disposition:** the need for both planned Android proofs is `CONFIRMED`; the separate-document/current-serial blockers are `REJECTED_WITH_EVIDENCE`. The approved runner creates `.runtime/terminal-automation/<runId>/run-manifest.json` for each run after the managed resource and wrapper PID/start-token checks, inspects the explicitly supplied ADB serial, records the Android device identity, and fails closed before suite execution if identity readback fails. The suite also requires the same serial. A separate pre-existing evidence document is not required by the current plan or managed-runner contract. The latest read-only `adb devices -l` inventory identifies physical console dual `D409P5C2J0285` and wallpaper mobile candidate `emulator-5554`; this snapshot is only a candidate, while each run's own preflight and manifest are authoritative. No historical run is reused as current proof.

**Fresh R2:** `MATCHED` (read-only; no test or dynamic command). R2 independently confirmed that the plan requires explicit serial/prerequisite handling and run-scoped manifests, not a separate pre-existing contract file; it also verified the current parser/suite mapping and the manifest's serial/device-identity fields.

**Preflight disposition:** `MATCHED` for the two planned Android `update.owner-flow` D runs. No source or plan change was needed. At preflight close, native business, diagnostics and cleanup were `NOT_RUN`; later execution is recorded in [`2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md`](2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md). The preflight verdict does not promote those later run results to PASS.
