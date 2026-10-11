SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER Stage C dynamic diagnosis · 2026-10-11

## Scope and first failures

- DEV default-mode start `r5-dev-1791656511875-98262-87f8e11e-3dcf-451c-94d9-0ad5d00f7b8c` failed before readiness with `REMOTE_BUSINESS_SERVER_STARTUP_FAILED:APPLICATION_STARTUP_FAILED`; the preserved remote build log identifies `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact`. Managed cleanup and remote-root cleanup both passed. The Stage C plan already leaves this default budget projection uncalibrated/open, so the DEV was started on the existing `IDENTITY_ONLY` build projection mode; that mode is not budget evidence. No reset or seed ran.
- The Expo Web console run `7667102b-d972-4f15-85e9-70220f03213f` failed with `SELECTOR_ARGUMENT_INVALID` while observing the staff-login UI command; runner cleanup passed. The first failure is retained in that run manifest and log.
- The first console Android supply-chain run `6acbeb6d-58ba-4862-8b29-4a043065d2e5` built and verified INSTALL/FULL/HOT and completed artifact registration, rule creation/enablement, activation, and project rule reads, then failed before dispatching the update command with `TERMINAL_AUTOMATION_UPDATE_COMMAND_MISSING`; runner cleanup passed. The journey searched for `.accept-target`, but production exports `requestTerminalUpdateCommand` as `kernel.base.terminal-update.request-terminal-update`. The owner command was present; test discovery used a stale name.

## Finding intake

`CONFIRMED`: `tools/terminal-automation/src/requests.ts` supplied three positional values to `kernel.base.runtime.selectRequestExecutionCandidates`. Its owner definition in `apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionCandidates.ts` declares one object parameter (`workspace`, `commandName`, `displayMode`), and `defineStateSelector` forwards each `argsTuple` member as one selector argument. The real automation handler therefore rejected the three-value tuple before the staff-login input could proceed. The lower-level owner proof in `apps/terminal/kernel/base/runtime/test/requestLedgerSelector.test.ts` uses the declared object shape; the previous driver fake test had asserted the mismatched tuple and did not exercise Runtime schema validation.

Finite same-root denominator: one production hard-coded caller for this selector in `tools/terminal-automation/src/requests.ts`, one owner definition, and one driver regression assertion in `tools/terminal-automation/test/requests.test.ts`. Generic selector helpers receive their argument tuples from each journey and are not changed by this finding.

Minimum repair: send one object in `argsTuple` and assert that exact wire shape in the existing request-observer test. No selector schema, protocol, or retry behavior changes. The focused driver test is the durable prevention for this caller/owner arity mismatch.

## Supply-chain command-name finding

`CONFIRMED`: the same stale `.accept-target` suffix existed at four live automation call sites: one in `tools/terminal-automation/journeys/update.android.test.ts` and three in `tools/terminal-automation/journeys/update.test.ts`. All selected the public update owner command. The owner exports `requestTerminalUpdateCommand` as `request-terminal-update`; logs from the failed run show the runtime module and successful supply-chain setup before the test failed during command discovery.

Minimum repair: match `.request-terminal-update` from the live owner descriptor at all four call sites and align the related missing-command diagnostic names. This changes only test discovery and does not add a production command or alter update behavior. Preserve the failed run and verify the repair with the same supply-chain scenario.

## Supply-chain rule-snapshot selector finding

Run `f7ae1ec8-bb9c-4552-a51b-b911902af858` passed INSTALL/FULL/HOT artifact checks, artifact registration, rule creation/enablement and audit-history readback, then failed before update dispatch. The log records `SELECTOR_NOT_REGISTERED` for `kernel.base.terminal-update.selectTerminalUpdateRuleSnapshot`; the catch-path organization read also queried the unregistered `kernel.feature.store-basic.selectStoreOrganizationPath`. The owner modules expose `kernel.feature.project-basic.selectProjectTerminalUpdateRules` with no parameters, `selectProjectBasicLoadReadiness`, and `selectProjectOrganizationPath`. The full rule selector has no `filterRuleRef` field; it returns the complete ready snapshot, whose `items` contain `ruleRef`.

`CONFIRMED`: the supply-chain test used a stale, non-public selector name, wrong positional argument, and a field absent from the public snapshot. The same file's pair path already used the correct public project-basic selector, providing a current-code counterexample to any claim that terminal-update owns a rule-snapshot selector.

Minimum repair: share the existing public selector name between supply and pair paths, pass the declared empty argument tuple, wait for the target rule inside the complete ready snapshot, and use project-basic readiness/path selectors in failure diagnostics. No production rule logic, selector contract, or runtime state changes.

Run `f7ae1ec8-bb9c-4552-a51b-b911902af858`: business `FAIL`, cleanup `PASS`; latest static typecheck and formatting after the selector-name repair passed. Same-scenario dynamic proof is pending. This is a runner observation defect, not proof of a CBS/TDS rule-data failure.

## Current-byte proof status

- Focused request-observer test and same console Expo Web journey after the argument-shape repair: `PASS`; console run `87afb762-ea92-44ad-a443-5761feaefeca`, business and cleanup both passed.
- The command-name repair is statically reconciled (`CP05_COMMAND_DELTA=MATCHED`); the failed `f7ae...` run passed that discovery point but exposed the next runner selector mismatch.
- Prior console Web run: business `FAIL`, cleanup `PASS`; never counted as success.
- DEV start under `IDENTITY_ONLY`: `PASS`; it establishes readiness only and does not establish calibrated DB-operation budgets.
- Wallpaper Web `06e78579-a966-4514-bd40-01b2af4cfbd6` and repaired console Web `87afb762-ea92-44ad-a443-5761feaefeca`: business and cleanup `PASS`. The first console Web failure remains retained as `FAIL/PASS` and is not counted.
- Android same-scenario proof after both command and public selector repairs, end-to-end supply/report chain completion, and remaining §11a assertions: `NOT_RUN` pending focused run.

## Android full-snapshot serialization failure

Run `701ca411-482d-4a61-9790-a3f861c33219` on the explicitly bound physical dual-screen device `D409P5C2J0285` completed with business `FAIL` and cleanup `PASS`. The real run log shows the project-basic actor reached `rules-snapshot-ready` with 25 rules and a collection hash, but the automation driver failed while serializing the full `selectProjectTerminalUpdateRules` result: `SELECTOR_SERIALIZATION_BUDGET_EXCEEDED` at the existing 8 ms selector observation budget. This was an overly broad test observation, not evidence that CBS rule loading failed.

`CONFIRMED`: the supply-chain journey only needs to prove that project-basic selected this run's enabled rule for the current application and store before dispatch. The owner already exposes `selectProjectTerminalUpdateCandidate(applicationId, storeRef)`, which returns that exact selected candidate and its scope/context identity. The pair projection path was also reading the complete snapshot before separately reading this candidate.

Minimum repair: both supply-chain and pair assertions wait on the public candidate selector with the exact application/store arguments, then assert ruleRef, applicationId, storeRef, selectedSpace and context identity. Failure diagnostics read only this candidate and the existing activation/readiness facts. Do not raise the serialization budget, truncate the snapshot, or change production behavior.

Run `701ca411-482d-4a61-9790-a3f861c33219`: business `FAIL`, cleanup `PASS`; same-scenario proof after narrowing to the candidate selector: `NOT_RUN` pending focused rerun. The latest broad business outcome remains this retained failure until a new run proves otherwise.

## Candidate selector returned null after readiness

Run `f526ef2a-2572-4161-9513-bb11ecc3149e` on the same explicitly assigned device completed with business `FAIL`, cleanup `PASS`. The retained log reports a connected session, active binding, flushed store/project readiness, matching readiness binding and project path, followed by `rule.candidate.wait.failed` with all candidate predicates false. This is the preserved first failure for the candidate-not-observed branch.

`CONFIRMED`: `project-basic/src/selectors/selectors.ts` additionally compared `serverConfig.selectedSpace` with the credential's `binding.groupWorkspaceKey`. They identify different facts: package `serverSpaces.selectedSpace` chooses a network endpoint profile (`development`), while the binding carries the tenant business workspace (`aurora`). The integration package declares the former as `development` and embeds `/group-workspaces/aurora` in the business address. That comparison made an otherwise-ready rule candidate unavailable.

Minimum repair: remove only the equality check. Preserve the SLAVE requirement that the server-config projection has been applied, and preserve the business checks that binding, loaded store, project path and project rule snapshot all match `binding.groupWorkspaceKey`. The existing owner test now uses server profile `development` with business workspace `workspace-1` and still expects the matching app/store candidate.

Current-byte focused evidence: `project-basic` package tests passed (8 tests, 2 files); package typecheck passed; Prettier passed for the affected selector, test, journey and this record. A fresh read-only CP-01 reconciliation returned `MATCHED`. The same-device Android supply-chain proof after this repair remains `NOT_RUN` pending the independent 6b delta result.

## Android bodyless POST failure before download-grant HTTP

Run `c39f8e61-efdf-419b-98e1-667a8185beb5` completed with business `FAIL` and cleanup `PASS`. The managed run built and registered matching INSTALL/FULL/HOT artifacts, enabled the update rule, and selected it on the device. The terminal then failed while creating the request for `issueTerminalUpdateArtifactDownloadGrant`; the safe Android adapter result was `ANDROID_HTTP_TRANSPORT_FAILED` after 2 ms, before a server response. The expected `INSTALLER_AWAITING_READBACK` outcome was not reached.

`CONFIRMED`: the generated terminal contract has exactly two `POST` operations with `requestSchema: NoBody`: `cancelTerminalActivation` and `issueTerminalUpdateArtifactDownloadGrant`; body-bearing POSTs are activation and report. `TerminalNetworkModule` converted `bodyText == null` to a null `RequestBody` for all methods. The sample-terminal `releaseRuntimeClasspath` resolves `com.squareup.okhttp3:okhttp:4.9.2` (Gradle dependencyInsight, 2026-10-11). Its exact official source at [`Request.kt`, tag `parent-4.9.2`](https://raw.githubusercontent.com/square/okhttp/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/Request.kt#L230-L245) rejects a null body when `HttpMethod.requiresRequestBody(method)` is true. The same tag's [`RequestBody.kt`](https://raw.githubusercontent.com/square/okhttp/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/RequestBody.kt#L127-L145) documents a zero-byte `ByteArray.toRequestBody()` with nullable content type. This establishes the exception mechanism; the 2 ms local failure and no response establish that this request did not reach CBS.

Minimum repair: when Android's HTTP adapter receives a bodyless POST, pass an explicit zero-byte, null-content-type request body; keep other bodyless methods bodyless and preserve JSON bodies unchanged. This uses the current Android network owner and does not change the generated contract or request semantics. A focused native unit test covers bodyless POST construction, bodyless GET, and a JSON POST. No new retry or timeout behavior is added.

Current-byte focused proof: `:catering-v2s-application-base-android:testDebugUnitTest --tests com.catering.v2s.terminal.application.base.android.TerminalNetworkRequestBodyTest` passed after the repair. Same-device Android `update.supply-chain` focused proof is still `NOT_RUN` at this record revision.
